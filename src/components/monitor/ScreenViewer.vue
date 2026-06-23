<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'
import type { WSMessage } from '@/types'

const props = defineProps<{
  deviceId: string
}>()

const wsStore = useWebSocketStore()
const screenshotUrl = ref<string | null>(null)
const deviceStatus = ref<string>('connecting')
const connectionError = ref<string | null>(null)

// 从首帧自动检测图片格式
function detectImageFormat(data: string): string {
  // base64 前几个字符检测: iVBORw0KGgo → PNG, /9j/ → JPEG
  if (data.startsWith('/9j/')) return 'image/jpeg'
  if (data.startsWith('iVBOR')) return 'image/png'
  return 'image/png'  // adb screencap -p 默认输出 PNG
}

// 监听 WebSocket 消息中的截图
watch(
  () => wsStore.deviceScreenshots(props.deviceId).length,
  () => {
    const screenshots = wsStore.deviceScreenshots(props.deviceId)
    if (screenshots.length > 0) {
      const latest = screenshots[screenshots.length - 1]
      const mime = detectImageFormat(latest.data)
      screenshotUrl.value = `data:${mime};base64,${latest.data}`
      connectionError.value = null
    }
  },
  { immediate: true },
)

// 监听状态消息
watch(
  () => wsStore.deviceStatus(props.deviceId).length,
  () => {
    const statusMsgs = wsStore.deviceStatus(props.deviceId)
    if (statusMsgs.length > 0) {
      const latest = statusMsgs[statusMsgs.length - 1]
      deviceStatus.value = latest.data
    }
  },
  { immediate: true },
)

// 监听所有消息类型，捕捉 screencast 状态 + 错误
watch(
  () => wsStore.getMessages(props.deviceId).length,
  () => {
    const msgs = wsStore.getMessages(props.deviceId)
    const last = msgs[msgs.length - 1]
    if (last && last.type === 'error') {
      connectionError.value = last.data
    }
  },
)

const isConnected = computed(() => wsStore.isConnected(props.deviceId))
</script>

<template>
  <div class="screen-viewer">
    <!-- 状态标签 -->
    <div class="status-overlay" v-if="deviceStatus && screenshotUrl">
      <span :class="['status-tag', deviceStatus]">{{ deviceStatus }}</span>
    </div>

    <!-- 未连接 -->
    <div v-if="!isConnected" class="screen-placeholder">
      <div class="placeholder-icon">🖥</div>
      <div class="placeholder-text">等待设备连接...</div>
      <div class="placeholder-hint">{{ deviceId }}</div>
    </div>

    <!-- 已连接但无截图 -->
    <div v-else-if="!screenshotUrl" class="screen-placeholder">
      <div class="spinner-ring" />
      <div class="placeholder-text">等待画面传输...</div>
      <div class="placeholder-hint">WebSocket 已连接，等待首帧截图</div>
    </div>

    <!-- 截图画面 -->
    <img
      v-else
      :src="screenshotUrl"
      :alt="`${deviceId} 画面`"
      class="screen-image"
    />
  </div>
</template>

<style scoped>
.screen-viewer {
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 320px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  position: relative;
}

/* ── 状态覆盖层 ── */
.status-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

.status-tag {
  font-size: 10px;
  padding: 2px 10px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.status-tag.online,
.status-tag.idle {
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-tag.busy,
.status-tag.running {
  color: var(--info);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

/* ── 占位 ── */
.screen-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.placeholder-icon {
  font-size: 36px;
  margin-bottom: 8px;
  opacity: 0.3;
}

.placeholder-text {
  font-size: 14px;
}

.placeholder-hint {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.6;
}

.spinner-ring {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── 截图 ── */
.screen-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
