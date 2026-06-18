<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWebSocketStore } from '@/stores/websocket'
import { useDeviceStore } from '@/stores/devices'
import { useTaskStore } from '@/stores/tasks'
import ScreenViewer from '@/components/monitor/ScreenViewer.vue'
import LogViewer from '@/components/monitor/LogViewer.vue'
import TaskQueue from '@/components/task/TaskQueue.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'

const route = useRoute()
const wsStore = useWebSocketStore()
const deviceStore = useDeviceStore()
const taskStore = useTaskStore()

const deviceId = route.params.id as string

const device = ref(
  deviceStore.devices.find((d) => d.serial === deviceId) ?? null,
)

onMounted(() => {
  // WebSocket 截图流连接
  wsStore.connect(deviceId)

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
      </div>
    </div>

    <!-- Main Grid: Screen + Tasks side by side -->
    <div class="detail-grid">
      <!-- 左侧: 设备画面 -->
      <section class="section screen-section">
        <div class="section-header">
          <h2 class="section-title">实时设备画面</h2>
        </div>
        <ScreenViewer :device-id="deviceId" />
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

/* ── Section Header ── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
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
