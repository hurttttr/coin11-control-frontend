import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import LogViewer from '@/components/monitor/LogViewer.vue'
import { useWebSocketStore } from '@/stores/websocket'

describe('LogViewer.vue', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-17T12:30:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function factory(props: { deviceId: string } = { deviceId: 'R58NA70A1YA' }) {
    return mount(LogViewer, {
      props,
      global: { plugins: [pinia] },
    })
  }

  it('shows waiting state when no logs', () => {
    expect(factory().text()).toContain('等待日志输出')
  })

  it('shows 0 lines when empty', () => {
    expect(factory().text()).toContain('0 行')
  })

  it('displays log messages from WebSocket store', async () => {
    const wrapper = factory()
    const store = useWebSocketStore()

    store.messageBuffer = new Map(Object.entries({
      R58NA70A1YA: [
        { type: 'log', device_id: 'R58NA70A1YA', data: 'log message 1' },
        { type: 'log', device_id: 'R58NA70A1YA', data: 'log message 2' },
        { type: 'log', device_id: 'R58NA70A1YA', data: 'log message 3' },
      ],
    }))

    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('log message 1')
    expect(wrapper.text()).toContain('log message 2')
    expect(wrapper.text()).toContain('log message 3')
    expect(wrapper.text()).toContain('3 行')
  })

  it('shows connected indicator when WebSocket is connected', async () => {
    const wrapper = factory()
    const store = useWebSocketStore()

    store.connectedDevices = new Set(['R58NA70A1YA'])
    await nextTick()

    expect(wrapper.text()).toContain('● 已连接')
  })

  it('shows disconnected indicator when WebSocket is not connected', () => {
    expect(factory().text()).toContain('○ 未连接')
  })

  it('toggles pause state when pause button is clicked', async () => {
    const wrapper = factory()
    await nextTick()

    const pauseBtn = wrapper.findAll('.btn-log')[0]
    expect(pauseBtn.text()).toContain('⏸ 暂停')
    await pauseBtn.trigger('click')
    expect(wrapper.text()).toContain('▶ 继续')
    await pauseBtn.trigger('click')
    expect(wrapper.text()).toContain('⏸ 暂停')
  })

  it('shows pause overlay when paused with logs', async () => {
    const wrapper = factory()
    const store = useWebSocketStore()

    store.messageBuffer = new Map(Object.entries({
      R58NA70A1YA: [
        { type: 'log', device_id: 'R58NA70A1YA', data: 'test log' },
      ],
    }))
    await nextTick()
    await nextTick()

    await wrapper.findAll('.btn-log')[0].trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('已暂停滚动')
  })

  it('clears logs when clear button is clicked', async () => {
    const wrapper = factory()
    const store = useWebSocketStore()
    const spy = vi.spyOn(store, 'clearMessages')
    await nextTick()

    await wrapper.findAll('.btn-log')[wrapper.findAll('.btn-log').length - 1].trigger('click')
    expect(spy).toHaveBeenCalledWith('R58NA70A1YA')
  })

  it('shows line numbers for each log entry', async () => {
    const wrapper = factory()
    const store = useWebSocketStore()

    store.messageBuffer = new Map(Object.entries({
      R58NA70A1YA: [
        { type: 'log', device_id: 'R58NA70A1YA', data: 'single line' },
      ],
    }))
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('0001')
  })

  it('adds timestamps to log messages without spaces', async () => {
    const wrapper = factory()
    const store = useWebSocketStore()

    store.messageBuffer = new Map(Object.entries({
      R58NA70A1YA: [
        { type: 'log', device_id: 'R58NA70A1YA', data: 'plain_message' },
      ],
    }))
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('plain_message')
    expect(wrapper.text()).toContain('12:30:00')
  })

  it('does not add extra timestamp when data already contains a space', async () => {
    const wrapper = factory()
    const store = useWebSocketStore()

    store.messageBuffer = new Map(Object.entries({
      R58NA70A1YA: [
        { type: 'log', device_id: 'R58NA70A1YA', data: '2025-06-17 INFO: started' },
      ],
    }))
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('2025-06-17 INFO: started')
  })

  it('reactively updates when new log messages arrive', async () => {
    const wrapper = factory()
    const store = useWebSocketStore()

    store.messageBuffer = new Map(Object.entries({
      R58NA70A1YA: [
        { type: 'log', device_id: 'R58NA70A1YA', data: 'first message' },
      ],
    }))
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('first message')
    expect(wrapper.text()).toContain('1 行')

    store.messageBuffer = new Map(Object.entries({
      R58NA70A1YA: [
        { type: 'log', device_id: 'R58NA70A1YA', data: 'first message' },
        { type: 'log', device_id: 'R58NA70A1YA', data: 'second message' },
      ],
    }))
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('second message')
    expect(wrapper.text()).toContain('2 行')
  })
})
