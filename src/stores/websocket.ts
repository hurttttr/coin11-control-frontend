import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WSMessage } from '@/types'

export const useWebSocketStore = defineStore('websocket', () => {
  // ── State ──
  const connections = ref<Map<string, WebSocket>>(new Map())
  const connectedDevices = ref<Set<string>>(new Set())
  const reconnectAttempts = ref<Map<string, number>>(new Map())
  const reconnectTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const messageBuffer = ref<Map<string, WSMessage[]>>(new Map())

  const MAX_RECONNECT_ATTEMPTS = 5

  // ── Getters ──

  const isConnected = computed(() => (deviceId: string) =>
    connectedDevices.value.has(deviceId),
  )

  const deviceLogs = computed(() => (deviceId: string) =>
    (messageBuffer.value.get(deviceId) ?? []).filter((m) => m.type === 'log'),
  )

  const deviceScreenshots = computed(() => (deviceId: string) =>
    (messageBuffer.value.get(deviceId) ?? []).filter((m) => m.type === 'screenshot'),
  )

  const deviceStatus = computed(() => (deviceId: string) =>
    (messageBuffer.value.get(deviceId) ?? []).filter((m) => m.type === 'status'),
  )

  function getMessages(deviceId: string): WSMessage[] {
    return messageBuffer.value.get(deviceId) ?? []
  }

  /** 指数退避: 1s → 2s → 4s → 8s → 16s */
  function getBackoffDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 16000)
  }

  // ── Actions ──

  function connect(deviceId: string): void {
    if (connectedDevices.value.has(deviceId)) return

    const attempts = reconnectAttempts.value.get(deviceId) ?? 0

    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[WS] ${deviceId}: 已达到最大重连次数 (${MAX_RECONNECT_ATTEMPTS})`)
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/device/${deviceId}?token=coin11-control-token`)

    ws.onopen = () => {
      console.log(`[WS] ${deviceId}: 已连接`)
      reconnectAttempts.value.set(deviceId, 0)
      connections.value.set(deviceId, ws)
      connectedDevices.value.add(deviceId)
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        const buf = messageBuffer.value.get(deviceId) ?? []
        buf.push(msg)
        // 最多保留 2000 条消息
        if (buf.length > 2000) buf.splice(0, buf.length - 2000)
        messageBuffer.value.set(deviceId, buf)
      } catch {
        console.warn(`[WS] ${deviceId}: 消息解析失败`)
      }
    }

    ws.onclose = () => {
      console.log(`[WS] ${deviceId}: 连接关闭`)
      connections.value.delete(deviceId)
      connectedDevices.value.delete(deviceId)

      // 自动重连（指数退避）
      const currentAttempts = reconnectAttempts.value.get(deviceId) ?? 0
      if (currentAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = getBackoffDelay(currentAttempts)
        console.log(`[WS] ${deviceId}: ${delay / 1000}s 后尝试重连 (第 ${currentAttempts + 1} 次)`)
        reconnectAttempts.value.set(deviceId, currentAttempts + 1)
        const timer = setTimeout(() => {
          connect(deviceId)
        }, delay)
        reconnectTimers.value.set(deviceId, timer)
      }
    }

    ws.onerror = () => {
      console.error(`[WS] ${deviceId}: 连接错误`)
      ws.close()
    }
  }

  function disconnect(deviceId: string): void {
    // 清除重连定时器
    const timer = reconnectTimers.value.get(deviceId)
    if (timer) {
      clearTimeout(timer)
      reconnectTimers.value.delete(deviceId)
    }
    reconnectAttempts.value.delete(deviceId)

    const ws = connections.value.get(deviceId)
    if (ws) {
      ws.close()
      connections.value.delete(deviceId)
    }

    connectedDevices.value.delete(deviceId)
  }

  function send(deviceId: string, data: Record<string, unknown>): void {
    const ws = connections.value.get(deviceId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    } else {
      console.warn(`[WS] ${deviceId}: 未连接，无法发送`)
    }
  }

  function disconnectAll(): void {
    for (const deviceId of [...connectedDevices.value]) {
      disconnect(deviceId)
    }
  }

  function clearMessages(deviceId: string): void {
    messageBuffer.value.delete(deviceId)
  }

  return {
    // state
    connectedDevices,
    messageBuffer,
    // getters
    isConnected,
    getMessages,
    deviceLogs,
    deviceScreenshots,
    deviceStatus,
    // actions
    connect,
    disconnect,
    send,
    disconnectAll,
    clearMessages,
  }
})
