<script setup lang="ts">
/**
 * ScrcpyViewer - auto-detects H.264 format (Annex B vs AVCC).
 * Backend: send_frame_meta=false -> raw Annex B stream.
 * Frontend: detect format from first bytes, configure decoder accordingly.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{ deviceId: string }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const status = ref('connecting...')
const meta = ref<{ w: number; h: number } | null>(null)
const conn = ref(false)
const fps = ref(0)
const err = ref<string | null>(null)

let ws: WebSocket | null = null
let dec: VideoDecoder | null = null
let ctx: CanvasRenderingContext2D | null = null
let tm: ReturnType<typeof setInterval> | null = null
let fc = 0
let touch = false
let ok = false
let sps: Uint8Array | null = null
let pps: Uint8Array | null = null
let pend: Uint8Array[] = []

const ar = computed(() => meta.value ? `${meta.value.w} / ${meta.value.h}` : '16 / 9')

onMounted(() => {
  connect()
  tm = setInterval(() => { fps.value = fc; fc = 0 }, 1000)
})
onUnmounted(() => { kill(); if (tm) clearInterval(tm) })

function connect() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${proto}//${window.location.host}/ws/scrcpy/${props.deviceId}?token=coin11-control-token`)
  ws.binaryType = 'arraybuffer'
  ws.onopen = () => { conn.value = true; status.value = 'starting...' }
  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) recv(new Uint8Array(e.data))
    else try { onMsg(JSON.parse(e.data)) } catch {}
  }
  ws.onclose = () => { conn.value = false }
  ws.onerror = () => { err.value = 'WS error'; status.value = 'failed' }
}

function onMsg(m: any) {
  if (m.type === 'scrcpy_meta') {
    meta.value = { w: m.width, h: m.height }
    const c = canvas.value
    if (c) { c.width = m.width; c.height = m.height; ctx = c.getContext('2d') }
  } else if (m.type === 'error') { err.value = m.data; status.value = 'error' }
}

function kill() {
  ok = false; sps = null; pps = null; pend = []
  if (dec) { try { dec.close() } catch {}; dec = null }
}

function recv(data: Uint8Array) {
  if (!ok || !dec) {
    pend.push(data)
    tryInit()
    return
  }
  feed(data)
}

function tryInit() {
  if (!meta.value) return
  if (sps && pps) return  // already extracting

  // Concatenate all pending data to search for SPS/PPS
  const total = pend.reduce((s, b) => s + b.length, 0)
  const buf = new Uint8Array(total)
  let off = 0
  for (const b of pend) { buf.set(b, off); off += b.length }

  // Detect format and extract SPS/PPS
  detectAndExtract(buf)
}

function detectAndExtract(buf: Uint8Array) {
  // Check first few bytes for Annex B start code (00 00 01 or 00 00 00 01)
  const isAnnexB = (buf[0] === 0 && buf[1] === 0 && (buf[2] === 1 || buf[3] === 1))

  if (isAnnexB) {
    console.log('[Scrcpy] Annex B format detected')
    // Extract SPS/PPS from Annex B
    extractAnnexB(buf)
  } else {
    console.log('[Scrcpy] AVCC format detected')
    // Extract SPS/PPS from AVCC (4-byte length prefix)
    extractAVCC(buf)
  }
}

function extractAnnexB(buf: Uint8Array) {
  let i = 0
  while (i < buf.length - 3) {
    if (buf[i] !== 0 || buf[i + 1] !== 0) { i++; continue }
    let start = -1
    if (buf[i + 2] === 1) { start = i + 3; i += 2 }
    else if (i + 4 < buf.length && buf[i + 2] === 0 && buf[i + 3] === 1) { start = i + 4; i += 3 }
    else { i++; continue }
    if (start < 0) continue
    const nt = buf[start] & 0x1F
    let end = buf.length
    for (let j = start + 1; j < buf.length - 3; j++) {
      if (buf[j] === 0 && buf[j + 1] === 0 && (buf[j + 2] === 1 || (buf[j + 2] === 0 && buf[j + 3] === 1))) {
        end = j; break
      }
    }
    const nalu = buf.slice(start, end)
    if (nt === 7) sps = nalu
    else if (nt === 8) pps = nalu
    i += (end - start)
    if (sps && pps) break
  }
  initDecAnnexB()
}

function extractAVCC(buf: Uint8Array) {
  let pos = 0
  while (pos < buf.length - 4) {
    const len = (buf[pos] << 24) | (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3]
    if (len <= 0 || len + pos + 4 > buf.length) break
    pos += 4
    const nt = buf[pos] & 0x1F
    if (nt === 7) sps = buf.slice(pos, pos + len)
    else if (nt === 8) pps = buf.slice(pos, pos + len)
    pos += len
    if (sps && pps) break
  }
  initDecAVCC()
}

function buildAvccDesc(sps: Uint8Array, pps: Uint8Array): Uint8Array {
  const sl = sps.length, pl = pps.length
  const desc = new Uint8Array(11 + sl + 3 + pl)
  let o = 0
  desc[o++] = 1; desc[o++] = sps[1]; desc[o++] = sps[2]; desc[o++] = sps[3]
  desc[o++] = 0xFF; desc[o++] = 0xE1
  desc[o++] = (sl >> 8) & 0xFF; desc[o++] = sl & 0xFF
  desc.set(sps, o); o += sl
  desc[o++] = 1
  desc[o++] = (pl >> 8) & 0xFF; desc[o++] = pl & 0xFF
  desc.set(pps, o)
  return desc
}

function getCodecFromSPS(sps: Uint8Array): string {
  const p = sps[1].toString(16).padStart(2, '0').toUpperCase()
  const c = sps[2].toString(16).padStart(2, '0').toUpperCase()
  const l = sps[3].toString(16).padStart(2, '0').toUpperCase()
  return `avc1.${p}${c}${l}`
}

function hasKeyFrame(data: Uint8Array): boolean {
  for (let i = 0; i < data.length - 4; i++) {
    if (data[i] === 0 && data[i + 1] === 0) {
      let nt = 0
      if (data[i + 2] === 1) nt = data[i + 3] & 0x1F
      else if (i + 4 < data.length && data[i + 2] === 0 && data[i + 3] === 1) nt = data[i + 4] & 0x1F
      if (nt === 5) return true
    }
  }
  return false
}

function doDecode(data: Uint8Array) {
  if (!ok || !dec) return
  if (dec.state !== 'configured') return
  try {
    const key = hasKeyFrame(data)
    dec.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp: performance.now() * 1000, data }))
  } catch (e: any) {
    if (e.name !== 'QuotaExceededError') console.warn('[Scrcpy] Dec err:', e.message)
  }
}

function feedBufferedFrames(saved: Uint8Array[]) {
  let foundKey = false
  for (const d of saved) {
    if (!foundKey) {
      if (!hasKeyFrame(d)) continue
      foundKey = true
    }
    doDecode(d)
  }
}

function initDecAnnexB() {
  const w = meta.value!.w, h = meta.value!.h
  if (typeof VideoDecoder === 'undefined') { err.value = 'WebCodec unsupported'; return }
  if (!sps || !pps) { err.value = 'no SPS/PPS'; return }
  const saved = pend.slice()
  const _sps = sps, _pps = pps
  kill()

  const desc = buildAvccDesc(_sps, _pps)
  const codec = getCodecFromSPS(_sps)

  dec = new VideoDecoder({
    output: (f: VideoFrame) => {
      if (!ctx) { f.close(); return }
      try {
        ctx.drawImage(f, 0, 0); fc++
        if (status.value !== 'LIVE') status.value = 'LIVE'
      } catch {
        createImageBitmap(f).then(bm => {
          try { ctx!.drawImage(bm, 0, 0); fc++ } catch {}
          bm.close(); f.close()
        }).catch(() => { f.close() })
        return
      }
      f.close()
    },
    error: () => {
      console.warn('[Scrcpy] Decoder error')
      ok = false; sps = null; pps = null
      if (dec) { try { dec.close() } catch {}; dec = null }
    },
  })

  try {
    dec.configure({ codec, codedWidth: w, codedHeight: h, description: desc })
    ok = true; status.value = 'LIVE'
    feedBufferedFrames(saved)
    pend = []
    console.log('[Scrcpy] Annex B decoder ready:', codec)
  } catch {
    try { dec.close() } catch {}; dec = null; sps = null; pps = null
    initDecFallback(w, h, saved, _sps, _pps)
  }
}

function initDecAVCC() {
  const w = meta.value!.w, h = meta.value!.h
  if (typeof VideoDecoder === 'undefined') { err.value = 'WebCodec unsupported'; return }
  if (!sps || !pps) { err.value = 'no SPS/PPS'; return }
  const saved = pend.slice()
  const _sps = sps, _pps = pps
  kill()

  const desc = buildAvccDesc(_sps, _pps)
  const codec = getCodecFromSPS(_sps)

  dec = new VideoDecoder({
    output: (f: VideoFrame) => {
      if (!ctx) { f.close(); return }
      try { ctx.drawImage(f, 0, 0); fc++; if (status.value !== 'LIVE') status.value = 'LIVE' }
      catch {
        createImageBitmap(f).then(bm => {
          try { ctx!.drawImage(bm, 0, 0); fc++ } catch {}
          bm.close(); f.close()
        }).catch(() => { f.close() })
        return
      }
      f.close()
    },
    error: () => {
      console.warn('[Scrcpy] Decoder error')
      ok = false; sps = null; pps = null
      if (dec) { try { dec.close() } catch {}; dec = null }
    },
  })

  try {
    dec.configure({ codec, codedWidth: w, codedHeight: h, description: desc })
    ok = true; status.value = 'LIVE'
    feedBufferedFrames(saved)
    pend = []
    console.log('[Scrcpy] AVCC decoder ready:', codec)
  } catch {
    try { dec.close() } catch {}; dec = null; sps = null; pps = null
    initDecFallback(w, h, saved, _sps, _pps)
  }
}

function initDecFallback(w: number, h: number, saved: Uint8Array[], _sps: Uint8Array, _pps: Uint8Array) {
  const desc = buildAvccDesc(_sps, _pps)
  for (const c of ['avc1.42E01E', 'avc1.42001E', 'avc1.64001E', 'avc1.4D001E', 'avc1.64001F', 'avc1.4D0028']) {
    dec = new VideoDecoder({
      output: (f: VideoFrame) => {
        if (!ctx) { f.close(); return }
        try { ctx.drawImage(f, 0, 0); fc++; if (status.value !== 'LIVE') status.value = 'LIVE' }
        catch {
          createImageBitmap(f).then(bm => {
            try { ctx!.drawImage(bm, 0, 0); fc++ } catch {}
            bm.close(); f.close()
          }).catch(() => { f.close() })
          return
        }
        f.close()
      },
      error: () => {
        console.warn('[Scrcpy] Decoder error')
        ok = false; sps = null; pps = null
        if (dec) { try { dec.close() } catch {}; dec = null }
      },
    })
    try {
      dec.configure({ codec: c, codedWidth: w, codedHeight: h, description: desc })
      ok = true; status.value = 'LIVE'
      feedBufferedFrames(saved)
      pend = []
      console.log('[Scrcpy] Decoder fallback ok:', c)
      return
    } catch {}
    try { dec.close() } catch {}; dec = null; sps = null; pps = null
  }
  err.value = 'decoder fail'
}

function feed(data: Uint8Array) {
  if (!ok || !dec) return
  doDecode(data)
}

function pct(e: MouseEvent | Touch) {
  const c = canvas.value; if (!c) return { x: 0, y: 0 }
  const r = c.getBoundingClientRect()
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
}
function snd(m: Record<string, unknown>) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)) }
function down(e: MouseEvent | TouchEvent) { touch = true; const p = e instanceof MouseEvent ? e : e.touches[0]; const { x, y } = pct(p); snd({ type: 'touchDown', x, y }) }
function move(e: MouseEvent | TouchEvent) { if (!touch) return; const p = e instanceof MouseEvent ? e : e.touches[0]; const { x, y } = pct(p); snd({ type: 'touchMove', x, y }) }
function up_() { touch = false; snd({ type: 'touchUp', x: 0, y: 0 }) }
function retry() { err.value = null; status.value = 'connecting...'; kill(); meta.value = null; if (ws) { ws.close(); ws = null }; connect() }
</script>

<template>
  <div class="sv" :class="{ active: !!meta }">
    <div class="sw" :style="{ aspectRatio: ar }"
      @mousedown="down" @mousemove="move" @mouseup="up_" @mouseleave="up_"
      @touchstart.prevent="down" @touchmove.prevent="move" @touchend.prevent="up_">
      <div v-if="!meta && !err" class="ol"><div class="lb"><div class="sp" /><div class="lt">{{ status }}</div></div></div>
      <div v-if="err" class="ol"><div class="eb"><div class="ei">&#9888;</div><div class="et">{{ err }}</div><button class="rb" @click="retry">retry</button></div></div>
      <canvas ref="canvas" class="cv" />
      <div class="hud"><span class="dt" :class="{ ok: conn }" /><span class="ht">{{ fps }} FPS</span><span v-if="meta" class="ht">{{ meta.w }}x{{ meta.h }}</span><span v-else class="ht">{{ status }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.sv { width: 100%; border-radius: 8px; overflow: hidden; background: #000; position: relative; border: 1px solid var(--border,#2a2a3e); }
.active { border-color: var(--accent,#6366f1); }
.sw { position: relative; width: 100%; cursor: crosshair; user-select: none; -webkit-user-select: none; touch-action: none; background: #000; min-height: 150px; }
.cv { display: block; width: 100%; height: auto; background: #050510; }
.ol { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.85); z-index: 2; }
.lb,.eb { display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--text-muted,#94a3b8); text-align: center; max-width: 80%; }
.sp { width: 36px; height: 36px; border: 3px solid rgba(99,102,241,.2); border-top-color: var(--accent,#6366f1); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
.lt { font-size: 13px; }
.et { font-size: 13px; color: #f87171; word-break: break-all; }
.rb { padding: 6px 18px; border-radius: 6px; border: 1px solid var(--accent,#6366f1); background: transparent; color: var(--accent,#6366f1); font-size: 12px; cursor: pointer; }
.rb:hover { background: rgba(99,102,241,.12); }
.hud { position: absolute; top: 8px; left: 8px; display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 6px; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 3; pointer-events: none; }
.dt { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; transition: background .3s; }
.dt.ok { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,.5); }
.ht { font-size: 11px; color: #94a3b8; font-family: monospace; }
</style>
