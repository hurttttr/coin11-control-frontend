<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'

const props = defineProps<{
  deviceId: string
}>()

const wsStore = useWebSocketStore()
const logContainer = ref<HTMLDivElement | null>(null)
const autoScroll = ref(true)
const isPaused = ref(false)

/** 格式化时间戳 */
function timestamp(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/** 提取日志消息文本 */
const logLines = computed<string[]>(() => {
  const msgs = wsStore.deviceLogs(props.deviceId)
  return msgs.map((msg) => {
    const ts = msg.data?.includes(' ') ? '' : `[${timestamp()}] `
    return `${ts}${msg.data}`
  })
})

watch(
  () => wsStore.deviceLogs(props.deviceId).length,
  async () => {
    if (autoScroll.value && !isPaused.value) {
      await nextTick()
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    }
  },
)

function handleScroll(): void {
  if (!logContainer.value) return
  const el = logContainer.value
  const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  autoScroll.value = isAtBottom
}

function togglePause(): void {
  isPaused.value = !isPaused.value
  if (!isPaused.value && logContainer.value) {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
}

function clearLogs(): void {
  wsStore.clearMessages(props.deviceId)
}
</script>

<template>
  <div class="log-viewer">
    <div class="log-header">
      <span class="log-title">
        <span class="log-indicator" /> 终端日志
        <span class="log-conn-status" :class="{ connected: wsStore.isConnected(deviceId) }">
          {{ wsStore.isConnected(deviceId) ? '● 已连接' : '○ 未连接' }}
        </span>
      </span>
      <div class="log-controls">
        <span class="log-count">{{ logLines.length }} 行</span>
        <button
          class="btn-log"
          :class="{ active: isPaused }"
          @click="togglePause"
        >
          {{ isPaused ? '▶ 继续' : '⏸ 暂停' }}
        </button>
        <button class="btn-log" @click="clearLogs">
          ∅ 清空
        </button>
      </div>
    </div>
    <div
      ref="logContainer"
      class="log-content"
      @scroll="handleScroll"
    >
      <div v-if="logLines.length === 0" class="log-empty">
        <span class="log-cursor">█</span> 等待日志输出...
      </div>
      <div v-else class="log-lines">
        <div v-for="(line, idx) in logLines" :key="idx" class="log-line">
          <span class="line-number">{{ String(idx + 1).padStart(4, '0') }}</span>
          <span class="line-content">{{ line }}</span>
        </div>
      </div>
      <!-- 暂停提示 -->
      <div v-if="isPaused && logLines.length > 0" class="scroll-hint">
        已暂停滚动
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-viewer {
  background: #0a0e1a;
  border: 1px solid rgba(0, 240, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: rgba(0, 240, 255, 0.04);
  border-bottom: 1px solid rgba(0, 240, 255, 0.08);
  flex-wrap: wrap;
  gap: 6px;
}

.log-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
}

.log-indicator {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.log-conn-status {
  font-size: 10px;
  color: var(--error);
  font-weight: 400;
}

.log-conn-status.connected {
  color: var(--success);
}

.log-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-count {
  font-size: 11px;
  color: var(--text-muted);
}

.btn-log {
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-log:hover {
  border-color: var(--border-accent);
  color: var(--accent);
}

.btn-log.active {
  border-color: var(--warning);
  color: var(--warning);
}

.log-content {
  flex: 1;
  max-height: 400px;
  overflow-y: auto;
  padding: 10px 0;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  background: #060a14;
  position: relative;
}

.log-empty {
  padding: 20px 14px;
  color: var(--text-muted);
  font-size: 13px;
}

.log-cursor {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.log-lines {
  display: flex;
  flex-direction: column;
}

.log-line {
  display: flex;
  padding: 0 14px;
  transition: background 0.1s;
}

.log-line:hover {
  background: rgba(0, 240, 255, 0.03);
}

.line-number {
  color: rgba(148, 163, 184, 0.3);
  min-width: 40px;
  user-select: none;
  flex-shrink: 0;
}

.line-content {
  color: #00ff41;
  white-space: pre-wrap;
  word-break: break-all;
  text-shadow: 0 0 4px rgba(0, 255, 65, 0.3);
}

.scroll-hint {
  position: sticky;
  bottom: 0;
  text-align: center;
  padding: 4px;
  font-size: 10px;
  color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
  border-top: 1px solid rgba(245, 158, 11, 0.2);
}
</style>
