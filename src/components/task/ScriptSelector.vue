<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'
import type { ScriptInfo } from '@/types'

const emit = defineEmits<{
  select: [script: ScriptInfo]
  close: []
}>()

const taskStore = useTaskStore()
const { scripts } = storeToRefs(taskStore)

// 如果脚本列表为空，自动拉取
if (scripts.value.length === 0) {
  taskStore.fetchScripts()
}

function handleSelect(script: ScriptInfo): void {
  emit('select', script)
  emit('close')
}

function handleClose(): void {
  emit('close')
}
</script>

<template>
  <div class="script-selector-overlay" @click.self="handleClose">
    <div class="script-selector-panel card">
      <div class="panel-header">
        <h3 class="panel-title">选择脚本</h3>
        <button class="btn-close" @click="handleClose">✕</button>
      </div>
      <div class="panel-body">
        <div v-if="scripts.length === 0" class="panel-empty">
          <p>暂无可用脚本</p>
        </div>
        <div
          v-for="script in scripts"
          :key="script.name"
          class="script-item"
          @click="handleSelect(script)"
        >
          <div class="script-name">{{ script.name }}</div>
          <div v-if="script.description" class="script-desc">{{ script.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.script-selector-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.script-selector-panel {
  width: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.panel-empty {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.script-item {
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.script-item:hover {
  background: rgba(0, 240, 255, 0.06);
}

.script-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: inherit;
}

.script-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
