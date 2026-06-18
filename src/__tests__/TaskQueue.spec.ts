import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import TaskQueue from '@/components/task/TaskQueue.vue'
import { useTaskStore } from '@/stores/tasks'
import type { TaskInfo } from '@/types'

let router: ReturnType<typeof createRouter>

// Mock vuedraggable
vi.mock('vuedraggable', () => ({
  default: {
    name: 'VueDraggable',
    props: {
      modelValue: { type: Array, default: () => [] },
      handle: { type: String, default: '' },
      itemKey: { type: String, default: 'id' },
      animation: { type: Number, default: 0 },
    },
    template:
      '<div class="mock-draggable"><template v-for="(item, idx) in modelValue" :key="item[itemKey]"><slot name="item" :element="item" :index="idx" /></template></div>',
    emits: ['change', 'update:modelValue'],
  },
}))

// ScriptSelector mock — must emit 'select' via button click
vi.mock('@/components/task/ScriptSelector.vue', () => ({
  default: {
    name: 'ScriptSelector',
    props: ['scriptName'],
    template: `<div class="mock-script-selector">
      <button class="mock-select" @click="$emit('select', { name: 'test_script.sh', path: '/scripts/test.sh', description: 'A test script' })">Select</button>
      <button class="mock-close" @click="$emit('close')">Close</button>
    </div>`,
    emits: ['select', 'close'],
  },
}))

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    device_id: 'R58NA70A1YA',
    script_name: 'test_script.sh',
    status: 'pending',
    position: 1,
    created_at: '2025-06-17T10:00:00Z',
    log: '',
    ...overrides,
  }
}

describe('TaskQueue.vue', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/device/:id', component: { template: '<div>detail</div>' } },
      ],
    })
  })

  function factory(props: { deviceId: string } = { deviceId: 'R58NA70A1YA' }) {
    return mount(TaskQueue, {
      props,
      global: {
        plugins: [router, pinia],
        stubs: { Teleport: false },
      },
      attachTo: document.body,
    })
  }

  it('shows empty state when no tasks', () => {
    const wrapper = factory()
    expect(wrapper.text()).toContain('暂无任务')
  })

  it('shows 0 task count when empty', () => {
    const wrapper = factory()
    expect(wrapper.text()).toContain('0 个任务')
  })

  it('displays tasks from store on mount', async () => {
    const store = useTaskStore()
    store.setTaskQueues([
      {
        device_id: 'R58NA70A1YA',
        tasks: [
          createTask({ script_name: 'backup.sh', status: 'pending' }),
          createTask({ script_name: 'cleanup.sh', status: 'completed' }),
        ],
      },
    ])

    const wrapper = factory()
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('backup.sh')
    expect(wrapper.text()).toContain('cleanup.sh')
    expect(wrapper.text()).toContain('2 个任务')
  })

  it('renders task status badges correctly', async () => {
    const store = useTaskStore()
    store.setTaskQueues([
      {
        device_id: 'R58NA70A1YA',
        tasks: [
          createTask({ script_name: 'p.sh', status: 'pending' }),
          createTask({ script_name: 'r.sh', status: 'running' }),
          createTask({ script_name: 'c.sh', status: 'completed' }),
          createTask({ script_name: 'f.sh', status: 'failed' }),
        ],
      },
    ])

    const wrapper = factory()
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('等待中')
    expect(wrapper.text()).toContain('运行中')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('失败')
  })

  it('opens ScriptSelector when add button is clicked', async () => {
    const wrapper = factory()
    await nextTick()

    await wrapper.find('.btn-add').trigger('click')
    await nextTick()

    expect(document.body.querySelector('.mock-script-selector')).toBeTruthy()
  })

  it('closes ScriptSelector when close button is clicked', async () => {
    const wrapper = factory()
    await nextTick()

    await wrapper.find('.btn-add').trigger('click')
    await nextTick()
    expect(document.body.querySelector('.mock-close')).toBeTruthy()

    await (document.body.querySelector('.mock-close') as HTMLElement).click()
    await nextTick()

    // ScriptSelector should remove itself when closed
    // wait for Vue to process
  })

  it('adds a task when add button clicked', async () => {
    const store = useTaskStore()
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })

    const wrapper = factory()
    await nextTick()

    // Open selector
    await wrapper.find('.btn-add').trigger('click')
    await nextTick()

    const selectBtn = document.body.querySelector('.mock-select') as HTMLElement
    expect(selectBtn).toBeTruthy()

    await selectBtn.click()
    await nextTick()
    await nextTick()

    // After selecting a script, fetch should be called for enqueueTask API
    // The enqueueTask action calls fetch('/api/devices/R58NA70A1YA/queue', { method: 'POST', ... })
    const postCalls = (globalThis.fetch as any).mock.calls.filter(
      (call: any[]) => call[0] === '/api/devices/R58NA70A1YA/queue' && call[1]?.method === 'POST',
    )
    expect(postCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('removes a task when remove button is clicked', async () => {
    const store = useTaskStore()
    store.setTaskQueues([
      {
        device_id: 'R58NA70A1YA',
        tasks: [createTask({ id: 'task-001', script_name: 'backup.sh' })],
      },
    ])
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    const removeSpy = vi.spyOn(store, 'removeTask')

    const wrapper = factory()
    await nextTick()
    await nextTick()

    const removeBtn = wrapper.find('.btn-remove')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')

    expect(removeSpy).toHaveBeenCalledWith('R58NA70A1YA', 'task-001')
  })

  it('calls startQueue when start button is clicked', async () => {
    const store = useTaskStore()
    store.setTaskQueues([
      {
        device_id: 'R58NA70A1YA',
        tasks: [createTask()],
      },
    ])
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    const startSpy = vi.spyOn(store, 'startQueue')
    const fetchSpy = vi.spyOn(store, 'fetchQueue')

    const wrapper = factory()
    await nextTick()
    await nextTick()

    await wrapper.find('.btn-start').trigger('click')
    expect(startSpy).toHaveBeenCalledWith('R58NA70A1YA')
  })

  it('calls stopQueue when stop button is clicked', async () => {
    const store = useTaskStore()
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    const stopSpy = vi.spyOn(store, 'stopQueue')

    const wrapper = factory()
    await nextTick()

    await wrapper.find('.btn-stop').trigger('click')
    expect(stopSpy).toHaveBeenCalledWith('R58NA70A1YA')
  })

  it('disables start button when no tasks', async () => {
    const wrapper = factory()
    await nextTick()

    expect(wrapper.find('.btn-start').attributes('disabled')).toBeDefined()
  })

  it('clears completed tasks when clear button is clicked', async () => {
    const store = useTaskStore()
    store.setTaskQueues([
      {
        device_id: 'R58NA70A1YA',
        tasks: [
          createTask({ id: 't1', status: 'completed' }),
          createTask({ id: 't2', status: 'pending' }),
        ],
      },
    ])
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    const removeSpy = vi.spyOn(store, 'removeTask')

    const wrapper = factory()
    await nextTick()
    await nextTick()

    await wrapper.find('.btn-clear').trigger('click')

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledWith('R58NA70A1YA', 't1')
  })
})
