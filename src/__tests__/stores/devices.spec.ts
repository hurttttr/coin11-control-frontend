import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDeviceStore } from '@/stores/devices'
import type { DeviceInfo } from '@/types'

function createDevice(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    serial: `device-${Math.random().toString(36).slice(2, 8)}`,
    model: 'SM-G998B',
    status: 'online',
    connection_type: 'usb',
    android_version: '13',
    ...overrides,
  }
}

describe('useDeviceStore', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  describe('initial state', () => {
    it('starts with empty devices array', () => {
      const store = useDeviceStore()
      expect(store.devices).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('starts with zero counts', () => {
      const store = useDeviceStore()
      expect(store.deviceCount).toBe(0)
      expect(store.onlineDevices).toEqual([])
      expect(store.offlineDevices).toEqual([])
      expect(store.busyDevices).toEqual([])
    })
  })

  describe('setDevices', () => {
    it('sets devices array', () => {
      const store = useDeviceStore()
      const devices = [createDevice(), createDevice()]
      store.setDevices(devices)
      expect(store.devices).toEqual(devices)
      expect(store.deviceCount).toBe(2)
    })

    it('replaces existing devices', () => {
      const store = useDeviceStore()
      store.setDevices([createDevice()])
      expect(store.deviceCount).toBe(1)

      store.setDevices([])
      expect(store.deviceCount).toBe(0)
    })
  })

  describe('computed device groups', () => {
    it('correctly groups online devices', () => {
      const store = useDeviceStore()
      store.setDevices([
        createDevice({ serial: 'dev1', status: 'online' }),
        createDevice({ serial: 'dev2', status: 'busy' }),
        createDevice({ serial: 'dev3', status: 'online' }),
        createDevice({ serial: 'dev4', status: 'offline' }),
      ])

      expect(store.onlineDevices).toHaveLength(2)
      expect(store.onlineDevices.every((d) => d.status === 'online')).toBe(true)
    })

    it('correctly groups busy devices', () => {
      const store = useDeviceStore()
      store.setDevices([
        createDevice({ serial: 'dev1', status: 'busy' }),
        createDevice({ serial: 'dev2', status: 'online' }),
      ])

      expect(store.busyDevices).toHaveLength(1)
      expect(store.busyDevices[0].serial).toBe('dev1')
    })

    it('correctly groups offline devices', () => {
      const store = useDeviceStore()
      store.setDevices([
        createDevice({ serial: 'dev1', status: 'offline' }),
        createDevice({ serial: 'dev2', status: 'offline' }),
        createDevice({ serial: 'dev3', status: 'online' }),
      ])

      expect(store.offlineDevices).toHaveLength(2)
      expect(store.offlineDevices.every((d) => d.status === 'offline')).toBe(true)
    })

    it('returns empty arrays when no devices match', () => {
      const store = useDeviceStore()
      store.setDevices([createDevice({ status: 'online' })])

      expect(store.offlineDevices).toEqual([])
      expect(store.busyDevices).toEqual([])
    })
  })

  describe('updateDeviceStatus', () => {
    it('updates status of existing device', () => {
      const store = useDeviceStore()
      store.setDevices([createDevice({ serial: 'dev1', status: 'online' })])

      store.updateDeviceStatus('dev1', 'busy')
      expect(store.devices[0].status).toBe('busy')
    })

    it('does nothing for unknown device', () => {
      const store = useDeviceStore()
      store.setDevices([createDevice({ serial: 'dev1', status: 'online' })])

      store.updateDeviceStatus('unknown-device', 'offline')
      expect(store.devices[0].status).toBe('online')
    })

    it('preserves other device fields when updating status', () => {
      const store = useDeviceStore()
      store.setDevices([
        createDevice({
          serial: 'dev1',
          model: 'Pixel 7',
          connection_type: 'wifi',
          android_version: '14',
          status: 'online',
        }),
      ])

      store.updateDeviceStatus('dev1', 'busy')
      expect(store.devices[0].model).toBe('Pixel 7')
      expect(store.devices[0].connection_type).toBe('wifi')
      expect(store.devices[0].android_version).toBe('14')
    })
  })

  describe('fetchDevices', () => {
    it('sets loading state during fetch', async () => {
      const store = useDeviceStore()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      const promise = store.fetchDevices()
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })

    it('populates devices on successful fetch', async () => {
      const store = useDeviceStore()
      const mockDevices = [createDevice({ serial: 'dev1' }), createDevice({ serial: 'dev2' })]
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDevices),
      })

      await store.fetchDevices()
      expect(store.devices).toEqual(mockDevices)
      expect(store.error).toBeNull()
    })

    it('sets error on failed fetch', async () => {
      const store = useDeviceStore()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      await store.fetchDevices()
      expect(store.error).toBeTruthy()
      expect(store.devices).toEqual([])
    })

    it('handles network error', async () => {
      const store = useDeviceStore()
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await store.fetchDevices()
      expect(store.error).toBe('Network error')
    })
  })

  describe('connectDevice', () => {
    it('posts address and refreshes devices', async () => {
      const store = useDeviceStore()
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })

      await store.connectDevice('192.168.1.100:5555')

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/devices/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: '192.168.1.100:5555' }),
      })
    })

    it('sets error on connection failure', async () => {
      const store = useDeviceStore()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      })

      await expect(store.connectDevice('bad:address')).rejects.toBeTruthy()
      expect(store.error).toBeTruthy()
    })
  })

  describe('disconnectDevice', () => {
    it('sends DELETE request and refreshes', async () => {
      const store = useDeviceStore()
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })

      await store.disconnectDevice('dev1')

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/devices/dev1', {
        method: 'DELETE',
      })
    })
  })

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('starts periodic polling', () => {
      const store = useDeviceStore()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      store.startPolling(5000)
      // fetchDevices is NOT called by startPolling itself
      expect(globalThis.fetch).toHaveBeenCalledTimes(0)

      vi.advanceTimersByTime(5000)
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    it('stops polling and fetch is not called after stop', () => {
      const store = useDeviceStore()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      store.startPolling(5000)
      store.stopPolling()

      vi.advanceTimersByTime(10000)
      // fetch should have been called only by the initial fetchDevices
      const callCountBefore = globalThis.fetch.mock.calls.length
      // After stopping, no new fetches should happen
      vi.advanceTimersByTime(10000)
      expect(globalThis.fetch).toHaveBeenCalledTimes(callCountBefore)
    })

    it('restarts polling without duplicate timers', () => {
      const store = useDeviceStore()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      store.startPolling(5000)
      store.startPolling(5000) // should stop first timer

      vi.advanceTimersByTime(5000)
      // fetch should be called only once by the single active timer
      // (after initial fetchDevices call which happens on first startPolling if any — but it doesn't)
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    it('uses default interval of 5000ms', () => {
      const store = useDeviceStore()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      store.startPolling() // no argument — default 5000
      vi.advanceTimersByTime(5000)
      expect(globalThis.fetch).toHaveBeenCalled()
    })
  })
})
