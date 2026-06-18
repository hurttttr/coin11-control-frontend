import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import DeviceCard from '@/components/device/DeviceCard.vue'
import type { DeviceInfo } from '@/types'

function createDevice(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    serial: 'R58NA70A1YA',
    model: 'SM-G998B',
    status: 'online',
    connection_type: 'usb',
    android_version: '13',
    ...overrides,
  }
}

describe('DeviceCard.vue', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/device/:id', name: 'device-detail', component: { template: '<div>detail</div>' } },
      ],
    })
  })

  function factory(device: DeviceInfo) {
    return mount(DeviceCard, {
      props: { device },
      global: {
        plugins: [router, pinia],
      },
    })
  }

  it('renders device model and serial', () => {
    const wrapper = factory(createDevice())
    expect(wrapper.text()).toContain('SM-G998B')
    expect(wrapper.text()).toContain('R58NA70A1YA')
  })

  it('renders Android version', () => {
    const wrapper = factory(createDevice({ android_version: '14' }))
    expect(wrapper.text()).toContain('Android 14')
  })

  it('shows status label for online device', () => {
    const wrapper = factory(createDevice({ status: 'online' }))
    expect(wrapper.text()).toContain('在线')
  })

  it('shows status label for busy device', () => {
    const wrapper = factory(createDevice({ status: 'busy' }))
    expect(wrapper.text()).toContain('忙碌')
  })

  it('shows status label for offline device', () => {
    const wrapper = factory(createDevice({ status: 'offline' }))
    expect(wrapper.text()).toContain('离线')
  })

  it('displays USB connection type icon and label', () => {
    const wrapper = factory(createDevice({ connection_type: 'usb' }))
    expect(wrapper.text()).toContain('USB')
  })

  it('displays WiFi connection type icon and label', () => {
    const wrapper = factory(createDevice({ connection_type: 'wifi' }))
    expect(wrapper.text()).toContain('WiFi')
  })

  it('renders StatusIndicator component', () => {
    const wrapper = factory(createDevice())
    expect(wrapper.findComponent({ name: 'StatusIndicator' }).exists()).toBe(true)
  })

  it('navigates to device detail on card click', async () => {
    const push = vi.spyOn(router, 'push')
    const wrapper = factory(createDevice({ serial: 'TEST123' }))

    await wrapper.find('.device-card').trigger('click')
    expect(push).toHaveBeenCalledWith('/device/TEST123')
  })

  it('renders disconnect button', () => {
    const wrapper = factory(createDevice({ serial: 'TO-DISCONNECT' }))
    const btn = wrapper.find('.btn-disconnect')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('断开')
  })
})
