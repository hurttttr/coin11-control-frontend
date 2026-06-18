<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { storeToRefs } from 'pinia'
import DeviceCard from './DeviceCard.vue'

const deviceStore = useDeviceStore()
const { devices, loading } = storeToRefs(deviceStore)

const connectAddress = ref('')
const connecting = ref(false)
const connectError = ref<string | null>(null)

onMounted(() => {
  deviceStore.fetchDevices()
  deviceStore.startPolling(10000)
})

onUnmounted(() => {
  deviceStore.stopPolling()
})

async function handleConnect(): Promise<void> {
  const address = connectAddress.value.trim()
  if (!address) return
  connecting.value = true
  connectError.value = null
  try {
    await deviceStore.connectDevice(address)
    connectAddress.value = ''
  } catch (e) {
    connectError.value = e instanceof Error ? e.message : '连接失败'
  } finally {
    connecting.value = false
  }
}
</script>

<template>
  <div class="device-grid-wrapper">
    <!-- 远程连接区域 -->
    <div class="connect-section">
      <div class="connect-input-group">
        <input
          v-model="connectAddress"
          type="text"
          class="connect-input"
          placeholder="设备 IP:Port，例如 192.168.1.100:5555"
          @keyup.enter="handleConnect"
        />
        <button
          class="btn-connect"
          :disabled="connecting || !connectAddress.trim()"
          @click="handleConnect"
        >
          <span v-if="connecting" class="spinner-sm" />
          {{ connecting ? '连接中...' : '远程连接' }}
        </button>
      </div>
      <p v-if="connectError" class="connect-error">{{ connectError }}</p>
    </div>

    <!-- 设备网格 -->
    <div class="device-grid">
      <div v-if="loading && devices.length === 0" class="grid-placeholder">
        <div class="placeholder-spinner" />
        <div class="placeholder-text">加载设备中...</div>
      </div>
      <div v-else-if="devices.length === 0" class="grid-placeholder">
        <div class="placeholder-icon">⊘</div>
        <div class="placeholder-text">暂无设备</div>
        <div class="placeholder-hint">等待设备连接...</div>
      </div>
      <DeviceCard
        v-for="device in devices"
        :key="device.serial"
        :device="device"
      />
    </div>
  </div>
</template>

<style scoped>
.device-grid-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── 远程连接 ── */
.connect-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.connect-input-group {
  display: flex;
  gap: 8px;
}

.connect-input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.connect-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.1);
}

.connect-input::placeholder {
  color: var(--text-muted);
}

.btn-connect {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid var(--accent);
  background: rgba(0, 240, 255, 0.1);
  color: var(--accent);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-connect:hover:not(:disabled) {
  background: rgba(0, 240, 255, 0.2);
  box-shadow: 0 0 16px rgba(0, 240, 255, 0.15);
}

.btn-connect:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.connect-error {
  margin: 0;
  font-size: 12px;
  color: var(--error);
}

/* ── 设备网格 ── */
.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.grid-placeholder {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.placeholder-icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.placeholder-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.placeholder-text {
  font-size: 15px;
  margin-bottom: 6px;
}

.placeholder-hint {
  font-size: 12px;
}
</style>
