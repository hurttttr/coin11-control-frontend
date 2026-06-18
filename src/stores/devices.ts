import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import type { DeviceInfo, DeviceStatus } from '@/types'

export const useDeviceStore = defineStore('devices', () => {
  // ── State ──
  const devices = ref<DeviceInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let refreshTimer: ReturnType<typeof setInterval> | null = null

  // ── Getters ──
  const onlineDevices = computed(() =>
    devices.value.filter((d) => d.status === 'online'),
  )

  const offlineDevices = computed(() =>
    devices.value.filter((d) => d.status === 'offline'),
  )

  const busyDevices = computed(() =>
    devices.value.filter((d) => d.status === 'busy'),
  )

  const deviceCount = computed(() => devices.value.length)

  // ── Actions ──
  async function fetchDevices(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch('/api/devices')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: DeviceInfo[] = await response.json()
      devices.value = data
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取设备列表失败'
      console.error('[DeviceStore] fetchDevices failed:', error.value)
    } finally {
      loading.value = false
    }
  }

  async function connectDevice(address: string): Promise<void> {
    error.value = null
    try {
      const response = await fetch('/api/devices/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await fetchDevices()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '连接设备失败'
      console.error('[DeviceStore] connectDevice failed:', error.value)
      throw error.value
    }
  }

  async function disconnectDevice(serial: string): Promise<void> {
    error.value = null
    try {
      const response = await fetch(`/api/devices/${serial}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await fetchDevices()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '断开设备失败'
      console.error('[DeviceStore] disconnectDevice failed:', error.value)
    }
  }

  /** 轮询刷新 — 每 intervalMs 毫秒自动拉取设备列表 */
  function startPolling(intervalMs = 5000): void {
    stopPolling()
    refreshTimer = setInterval(() => {
      fetchDevices()
    }, intervalMs)
  }

  function stopPolling(): void {
    if (refreshTimer !== null) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  function updateDeviceStatus(serial: string, status: DeviceStatus): void {
    const idx = devices.value.findIndex((d) => d.serial === serial)
    if (idx !== -1) {
      devices.value[idx] = { ...devices.value[idx], status }
    }
  }

  function setDevices(list: DeviceInfo[]): void {
    devices.value = list
  }

  return {
    // state
    devices,
    loading,
    error,
    // getters
    onlineDevices,
    offlineDevices,
    busyDevices,
    deviceCount,
    // actions
    fetchDevices,
    connectDevice,
    disconnectDevice,
    startPolling,
    stopPolling,
    updateDeviceStatus,
    setDevices,
  }
})
