<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { TaskInfo, ScriptInfo } from '@/types'
import ScriptSelector from './ScriptSelector.vue'
import { useTaskStore } from '@/stores/tasks'
// @ts-ignore - vuedraggable v4 uses default export
import VueDraggable from 'vuedraggable'

const props = defineProps<{
  deviceId: string
}>()

const taskStore = useTaskStore()
const showSelector = ref(false)
const localTasks = ref<TaskInfo[]>([])

onMounted(() => {
  syncTasks()
})

// 从 store 同步任务列表
function syncTasks(): void {
  localTasks.value = [...taskStore.getQueueForDevice(props.deviceId)]
}

// 监听 store 变化
watch(
  () => taskStore.getQueueForDevice(props.deviceId),
  (newTasks) => {
    localTasks.value = [...newTasks]
  },
  { deep: true },
)

function taskStatusBadge(status: TaskInfo['status']): { label: string; class: string; icon: string } {
  const map: Record<string, { label: string; class: string; icon: string }> = {
    pending: { label: '等待中', class: 'badge-pending', icon: '⏳' },
    running: { label: '运行中', class: 'badge-running', icon: '⟳' },
    completed: { label: '已完成', class: 'badge-completed', icon: '✓' },
    failed: { label: '失败', class: 'badge-failed', icon: '✕' },
  }
  return map[status] ?? { label: status, class: '', icon: '?' }
}

function handleRemove(taskId: string): void {
  taskStore.removeTask(props.deviceId, taskId)
}

function handleAddTask(script: ScriptInfo): void {
  taskStore.enqueueTask(props.deviceId, script.name)
}

async function handleStart(): Promise<void> {
  await taskStore.startQueue(props.deviceId)
  await taskStore.fetchQueue(props.deviceId).then(syncTasks)
}

async function handleStop(): Promise<void> {
  await taskStore.stopQueue(props.deviceId)
}

async function handleClearCompleted(): Promise<void> {
  const completedTasks = localTasks.value.filter((t) => t.status === 'completed')
  for (const task of completedTasks) {
    await taskStore.removeTask(props.deviceId, task.id)
  }
  await taskStore.fetchQueue(props.deviceId).then(syncTasks)
}

/** 拖拽排序结束 */
async function onDragEnd(): Promise<void> {
  const orderedIds = localTasks.value.map((t) => t.id)
  await taskStore.reorderTasks(props.deviceId, orderedIds)
  await taskStore.fetchQueue(props.deviceId).then(syncTasks)
}
</script>

<template>
  <div class="task-queue">
    <!-- 工具栏 -->
    <div class="queue-toolbar">
      <div class="toolbar-left">
        <span class="queue-label">任务队列</span>
        <span class="queue-count">{{ localTasks.length }} 个任务</span>
      </div>
      <div class="toolbar-actions">
        <button class="btn-tool btn-start" :disabled="localTasks.length === 0" @click="handleStart">
          ▶ 开始执行
        </button>
        <button class="btn-tool btn-stop" @click="handleStop">
          ■ 停止
        </button>
        <button class="btn-tool btn-clear" @click="handleClearCompleted">
          ∅ 清空已完成
        </button>
        <button class="btn-tool btn-add" @click="showSelector = true">
          + 添加任务
        </button>
      </div>
    </div>

    <!-- 任务列表（可拖拽） -->
    <div v-if="localTasks.length === 0" class="queue-empty">
      <div class="empty-icon">☰</div>
      <div class="empty-text">暂无任务，请添加</div>
      <button class="btn-add-empty" @click="showSelector = true">+ 添加任务</button>
    </div>

    <VueDraggable
      v-else
      v-model="localTasks"
      handle=".drag-handle"
      item-key="id"
      class="task-list"
      :animation="200"
      @change="onDragEnd"
    >
      <template #item="{ element: task }">
        <div class="task-item">
          <div class="drag-handle" title="拖拽排序">⠿</div>
          <div class="task-badge-wrap">
            <span :class="['task-badge', taskStatusBadge(task.status).class]">
              <span class="badge-icon">{{ taskStatusBadge(task.status).icon }}</span>
              {{ taskStatusBadge(task.status).label }}
            </span>
          </div>
          <div class="task-info">
            <span class="task-script">{{ task.script_name }}</span>
          </div>
          <div class="task-meta">
            <span class="task-time">{{ task.created_at }}</span>
            <button
              class="btn-remove"
              title="移除任务"
              @click="handleRemove(task.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </template>
    </VueDraggable>

    <!-- Script Selector Modal -->
    <Teleport to="body">
      <ScriptSelector
        v-if="showSelector"
        @select="handleAddTask"
        @close="showSelector = false"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.task-queue {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-card);
  overflow: hidden;
}

/* ── 工具栏 ── */
.queue-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.15);
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.queue-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.queue-count {
  font-size: 11px;
  color: var(--text-muted);
}

.toolbar-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-tool {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-tool:hover:not(:disabled) {
  border-color: var(--border-accent);
  color: var(--accent);
}

.btn-tool:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-start {
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.3);
}

.btn-start:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.1);
  border-color: var(--success);
}

.btn-stop {
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.3);
}

.btn-stop:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error);
}

.btn-add {
  color: var(--accent);
  border-color: rgba(0, 240, 255, 0.3);
}

.btn-add:hover {
  background: rgba(0, 240, 255, 0.1);
  border-color: var(--accent);
}

/* ── 空状态 ── */
.queue-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 32px;
  opacity: 0.3;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 13px;
  margin-bottom: 12px;
}

.btn-add-empty {
  padding: 8px 20px;
  border-radius: 6px;
  border: 1px solid var(--accent);
  background: rgba(0, 240, 255, 0.1);
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-empty:hover {
  background: rgba(0, 240, 255, 0.2);
}

/* ── 任务列表 ── */
.task-list {
  display: flex;
  flex-direction: column;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.05);
  transition: background 0.15s;
}

.task-item:last-child {
  border-bottom: none;
}

.task-item:hover {
  background: rgba(0, 240, 255, 0.03);
}

.drag-handle {
  cursor: grab;
  color: var(--text-muted);
  font-size: 14px;
  user-select: none;
  flex-shrink: 0;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.task-item:hover .drag-handle {
  opacity: 0.8;
}

.drag-handle:active {
  cursor: grabbing;
}

.task-badge-wrap {
  flex-shrink: 0;
}

.task-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
  white-space: nowrap;
}

.badge-icon {
  font-size: 11px;
}

.badge-pending {
  background: var(--warning-dim);
  color: var(--warning);
}

.badge-running {
  background: rgba(59, 130, 246, 0.15);
  color: var(--info);
}

.badge-running .badge-icon {
  animation: spin 1s linear infinite;
}

.badge-completed {
  background: var(--success-dim);
  color: var(--success);
}

.badge-failed {
  background: var(--error-dim);
  color: var(--error);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-script {
  font-size: 13px;
  color: var(--text-primary);
  font-family: inherit;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.task-time {
  font-size: 11px;
  color: var(--text-muted);
}

.btn-remove {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s;
}

.btn-remove:hover {
  color: var(--error);
  background: var(--error-dim);
}
</style>
