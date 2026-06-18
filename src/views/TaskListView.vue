<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import StatusIndicator from '@/components/common/StatusIndicator.vue'

const taskStore = useTaskStore()
const { taskQueues, loading, pendingTasks, runningTasks, completedTasks, failedTasks } = storeToRefs(taskStore)

onMounted(() => {
  taskStore.fetchTasks()
})

function handleRemoveTask(deviceId: string, taskId: string): void {
  taskStore.removeTask(deviceId, taskId)
}

function handleRefresh(): void {
  taskStore.fetchTasks()
}

function taskStatusBadge(status: string): { label: string; class: string; icon: string } {
  const map: Record<string, { label: string; class: string; icon: string }> = {
    pending: { label: '等待中', class: 'badge-pending', icon: '⏳' },
    running: { label: '运行中', class: 'badge-running', icon: '⟳' },
    completed: { label: '已完成', class: 'badge-completed', icon: '✓' },
    failed: { label: '失败', class: 'badge-failed', icon: '✕' },
  }
  return map[status] ?? { label: status, class: '', icon: '?' }
}
</script>

<template>
  <div class="task-list-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">任务列表</h1>
        <p class="page-subtitle">全局任务队列管理</p>
      </div>
      <div class="header-actions">
        <div class="stats">
          <span class="stat pending">{{ pendingTasks.length }} 待处理</span>
          <span class="stat running">{{ runningTasks.length }} 运行中</span>
          <span class="stat completed">{{ completedTasks.length }} 已完成</span>
          <span class="stat failed">{{ failedTasks.length }} 失败</span>
        </div>
        <button class="btn-refresh" @click="handleRefresh" :disabled="loading">
          ⟳ 刷新
        </button>
      </div>
    </div>

    <!-- Task Queues -->
    <div class="task-queues">
      <!-- 加载中 -->
      <div v-if="loading && taskQueues.length === 0" class="queue-placeholder">
        <div class="placeholder-spinner" />
        <div class="placeholder-text">加载任务列表中...</div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="taskQueues.length === 0" class="queue-placeholder">
        <div class="placeholder-icon">☰</div>
        <div class="placeholder-text">暂无任务</div>
        <div class="placeholder-hint">前往设备详情页添加任务</div>
      </div>

      <!-- 按设备分组显示 -->
      <div
        v-for="queue in taskQueues"
        :key="queue.device_id"
        class="queue-group card"
      >
        <div class="queue-header">
          <span class="queue-device">{{ queue.device_id }}</span>
          <span class="queue-count">{{ queue.tasks.length }} 个任务</span>
        </div>
        <div v-if="queue.tasks.length === 0" class="queue-empty-device">
          该设备暂无任务
        </div>
        <div v-else class="task-list">
          <div
            v-for="task in queue.tasks"
            :key="task.id"
            class="task-item"
          >
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
                @click="handleRemoveTask(queue.device_id, task.id)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-list-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: 4px 0 0;
}

.header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.stat.pending { color: var(--warning); }
.stat.running { color: var(--info); }
.stat.completed { color: var(--success); }
.stat.failed { color: var(--error); }

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  border-color: var(--border-accent);
  color: var(--accent);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── 任务队列列表 ── */
.task-queues {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.queue-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
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

.queue-group {
  overflow: hidden;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.15);
}

.queue-device {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.queue-count {
  font-size: 11px;
  color: var(--text-muted);
}

.queue-empty-device {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.task-list {
  display: flex;
  flex-direction: column;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.05);
  transition: background 0.15s;
}

.task-item:last-child {
  border-bottom: none;
}

.task-item:hover {
  background: rgba(0, 240, 255, 0.03);
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
