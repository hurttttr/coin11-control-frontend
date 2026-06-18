import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TaskInfo, TaskStatus, TaskQueueData, ScriptInfo } from '@/types'

export const useTaskStore = defineStore('tasks', () => {
  // ── State ──
  const taskQueues = ref<TaskQueueData[]>([])
  const scripts = ref<ScriptInfo[]>([])
  const currentDeviceId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ──
  const allTasks = computed<TaskInfo[]>(() =>
    taskQueues.value.flatMap((q) => q.tasks),
  )

  const pendingTasks = computed(() =>
    allTasks.value.filter((t) => t.status === 'pending'),
  )

  const runningTasks = computed(() =>
    allTasks.value.filter((t) => t.status === 'running'),
  )

  const completedTasks = computed(() =>
    allTasks.value.filter((t) => t.status === 'completed'),
  )

  const failedTasks = computed(() =>
    allTasks.value.filter((t) => t.status === 'failed'),
  )

  function getQueueForDevice(deviceId: string): TaskInfo[] {
    return taskQueues.value.find((q) => q.device_id === deviceId)?.tasks ?? []
  }

  // ── Actions ──

  /** 获取可用脚本列表 */
  async function fetchScripts(): Promise<void> {
    try {
      const response = await fetch('/api/scripts')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: ScriptInfo[] = await response.json()
      scripts.value = data
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取脚本列表失败'
      console.error('[TaskStore] fetchScripts failed:', error.value)
    }
  }

  /** 获取指定设备的任务队列 */
  async function fetchQueue(deviceId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`/api/devices/${deviceId}/queue`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: TaskInfo[] = await response.json()
      // 合并到 taskQueues
      const existing = taskQueues.value.findIndex((q) => q.device_id === deviceId)
      if (existing !== -1) {
        taskQueues.value[existing] = { device_id: deviceId, tasks: data }
      } else {
        taskQueues.value.push({ device_id: deviceId, tasks: data })
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取队列失败'
      console.error('[TaskStore] fetchQueue failed:', error.value)
    } finally {
      loading.value = false
    }
  }

  /** 获取所有设备队列（旧版兼容） */
  async function fetchTasks(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch('/api/tasks')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: TaskQueueData[] = await response.json()
      taskQueues.value = data
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取任务列表失败'
      console.error('[TaskStore] fetchTasks failed:', error.value)
    } finally {
      loading.value = false
    }
  }

  /** 添加任务到设备队列 */
  async function enqueueTask(deviceId: string, scriptName: string): Promise<void> {
    try {
      const response = await fetch(`/api/devices/${deviceId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_name: scriptName }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await fetchQueue(deviceId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '添加任务失败'
      console.error('[TaskStore] enqueueTask failed:', error.value)
    }
  }

  /** 移除指定任务 */
  async function removeTask(deviceId: string, taskId: string): Promise<void> {
    try {
      const response = await fetch(`/api/devices/${deviceId}/queue/${taskId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await fetchQueue(deviceId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '移除任务失败'
      console.error('[TaskStore] removeTask failed:', error.value)
    }
  }

  /** 重新排序任务队列 */
  async function reorderTasks(deviceId: string, taskIds: string[]): Promise<void> {
    try {
      const response = await fetch(`/api/devices/${deviceId}/queue/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: taskIds }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await fetchQueue(deviceId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '重新排序失败'
      console.error('[TaskStore] reorderTasks failed:', error.value)
    }
  }

  /** 开始执行队列 */
  async function startQueue(deviceId: string): Promise<void> {
    try {
      const response = await fetch(`/api/devices/${deviceId}/queue/start`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '启动队列失败'
      console.error('[TaskStore] startQueue failed:', error.value)
    }
  }

  /** 停止执行队列 */
  async function stopQueue(deviceId: string): Promise<void> {
    try {
      const response = await fetch(`/api/devices/${deviceId}/queue/stop`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '停止队列失败'
      console.error('[TaskStore] stopQueue failed:', error.value)
    }
  }

  function setCurrentDevice(deviceId: string | null): void {
    currentDeviceId.value = deviceId
  }

  function updateTaskStatus(taskId: string, status: TaskStatus): void {
    for (const queue of taskQueues.value) {
      const idx = queue.tasks.findIndex((t) => t.id === taskId)
      if (idx !== -1) {
        queue.tasks[idx] = { ...queue.tasks[idx], status }
        break
      }
    }
  }

  function updateTaskLog(taskId: string, log: string): void {
    for (const queue of taskQueues.value) {
      const idx = queue.tasks.findIndex((t) => t.id === taskId)
      if (idx !== -1) {
        queue.tasks[idx] = { ...queue.tasks[idx], log }
        break
      }
    }
  }

  function setTaskQueues(data: TaskQueueData[]): void {
    taskQueues.value = data
  }

  return {
    // state
    taskQueues,
    scripts,
    currentDeviceId,
    loading,
    error,
    // getters
    allTasks,
    pendingTasks,
    runningTasks,
    completedTasks,
    failedTasks,
    getQueueForDevice,
    // actions
    fetchScripts,
    fetchQueue,
    fetchTasks,
    enqueueTask,
    removeTask,
    reorderTasks,
    startQueue,
    stopQueue,
    setCurrentDevice,
    updateTaskStatus,
    updateTaskLog,
    setTaskQueues,
  }
})
