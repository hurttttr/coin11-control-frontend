<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useWebSocketStore } from '@/stores/websocket'
import { useDeviceStore } from '@/stores/devices'
import { useTaskStore } from '@/stores/tasks'
import ScreenViewer from '@/components/monitor/ScreenViewer.vue'
import ScrcpyViewer from '@/components/monitor/ScrcpyViewer.vue'
import LogViewer from '@/components/monitor/LogViewer.vue'
import TaskQueue from '@/components/task/TaskQueue.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'

type ScreenMode = 'legacy' | 'scrcpy'

const route = useRoute()
const wsStore = useWebSocketStore()
const deviceStore = useDeviceStore()
const taskStore = useTaskStore()

const deviceId = route.params.id as string

const device = ref(
  deviceStore.devices.find((d) => d.serial === deviceId) ?? null,
)

// 画面传输模式: legacy = 截图轮询 (2fps), scrcpy = H.264 实时流 + 可操控
const screenMode = ref<ScreenMode>('scrcpy')  // 默认使用 scrcpy

onMounted(() => {
  // WebSocket 连接（仅 legacy 模式需要）
  if (screenMode.value === 'legacy') {
    wsStore.connect(deviceId)
  }

  // 如果找不到设备信息则刷新
  if (!device.value) {
    deviceStore.fetchDevices().then(() => {
      device.value = deviceStore.devices.find((d) => d.serial === deviceId) ?? null
    })
  }

  // 加载任务数据
  taskStore.fetchQueue(deviceId)
  taskStore.fetchScripts()
})

onUnmounted(() => {
  wsStore.disconnect(deviceId)
})

// 切换画面模式
function toggleMode() {
  if (screenMode.value === 'legacy') {
    screenMode.value = 'scrcpy'
    wsStore.disconnect(deviceId)
  } else {
    screenMode.value = 'legacy'
    wsStore.connect(deviceId)
  }
}

// 监听 WebSocket 状态消息更新设备状态
watch(
  () => wsStore.deviceStatus(deviceId).length,
  () => {
    const statusMsgs = wsStore.deviceStatus(deviceId)
    if (statusMsgs.length > 0) {
      const latest = statusMsgs[statusMsgs.length - 1]
      // 尝试将状态映射到 DeviceStatus
      const statusMap: Record<string, 'online' | 'busy' | 'offline'> = {
        online: 'online',
        idle: 'online',
        busy: 'busy',
        running: 'busy',
        offline: 'offline',
        disconnected: 'offline',
      }
      const mapped = statusMap[latest.data]
      if (mapped && device.value) {
        deviceStore.updateDeviceStatus(deviceId, mapped)
        device.value.status = mapped
      }
    }
  },
)
</script>

<template>
  <div class="device-detail">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <router-link to="/" class="back-link">← 返回仪表盘</router-link>
        <div>
          <h1 class="page-title">
            {{ device?.model ?? deviceId }}
            <StatusIndicator
              v-if="device"
              :status="device.status"
              size="sm"
              :show-label="true"
            />
          </h1>
          <p class="page-subtitle">{{ deviceId }}</p>
        </div>
      </div>
      <div class="header-meta" v-if="device">
        <span class="meta-tag">Android {{ device.android_version }}</span>
        <span class="meta-tag">{{ device.connection_type === 'usb' ? 'USB' : 'WiFi' }}</span>
        <!-- 画面模式切换 -->
        <button
          class="mode-toggle"
          :class="{ active: screenMode === 'scrcpy' }"
          @click="toggleMode"
          :title="screenMode === 'scrcpy' ? '切换为截图模式 (2fps)' : '切换为 Scrcpy 实时流 (可操控)'"
        >
          {{ screenMode === 'scrcpy' ? '🎮 实时' : '📷 截图' }}
        </button>
      </div>
    </div>

    <!-- Main Grid: Screen + Tasks side by side -->
    <div class="detail-grid">
      <!-- 左侧: 设备画面 -->
      <section class="section screen-section">
        <div class="section-header">
          <h2 class="section-title">实时设备画面</h2>
          <span class="mode-badge" :class="screenMode">
            {{ screenMode === 'scrcpy' ? 'Scrcpy 实时流' : '截图轮询 (2fps)' }}
          </span>
        </div>
        <ScrcpyViewer
          v-if="screenMode === 'scrcpy'"
          :device-id="deviceId"
        />
        <ScreenViewer
          v-else
          :device-id="deviceId"
        />
      </section>

      <!-- 右侧: 任务队列 -->
      <section class="section">
        <TaskQueue :device-id="deviceId" />
      </section>
    </div>

    <!-- 底部全宽: 日志终端 -->
    <section class="section">
      <h2 class="section-title">实时日志终端</h2>
      <LogViewer :device-id="deviceId" />
    </section>
  </div>
</template>

<style scoped>
.device-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.back-link {
  font-size: 13px;
  color: var(--accent);
  text-decoration: none;
  padding: 4px 0;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.back-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.page-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin: 4px 0 0;
  font-family: inherit;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-tag {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.08);
  color: var(--text-muted);
}

/* ── 模式切换按钮 ── */
.mode-toggle {
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--border, #2a2a3e);
  background: transparent;
  color: var(--text-muted, #94a3b8);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.mode-toggle:hover {
  border-color: var(--accent, #6366f1);
  color: var(--accent, #6366f1);
}

.mode-toggle.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--accent, #6366f1);
  color: var(--accent, #6366f1);
}

/* ── 模式徽标 ── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.mode-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mode-badge.scrcpy {
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
}

.mode-badge.legacy {
  background: rgba(148, 163, 184, 0.08);
  color: var(--text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
