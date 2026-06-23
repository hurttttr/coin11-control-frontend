import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UpdateInfo } from '@/types'

export const useUpdateStore = defineStore('update', () => {
  // ── State ──
  const updateInfo = ref<UpdateInfo>({
    has_update: false,
    current_commit: '',
    latest_commit: '',
    commits_behind: 0,
    commit_messages: [],
  })
  const checking = ref(false)
  const pulling = ref(false)
  const error = ref<string | null>(null)
  const dismissed = ref(false)
  const repoStatus = ref<string>('unknown')  // unknown | cloning | ready | error
  const repoError = ref<string | null>(null)
  const repoChecking = ref(false)
  let initialized = false

  // ── Actions ──

  async function checkUpdate(): Promise<void> {
    checking.value = true
    error.value = null
    try {
      const response = await fetch('/api/update/check')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: UpdateInfo = await response.json()
      updateInfo.value = data
      dismissed.value = false
    } catch (e) {
      error.value = e instanceof Error ? e.message : '检查更新失败'
      console.error('[UpdateStore] checkUpdate failed:', error.value)
    } finally {
      checking.value = false
    }
  }

  async function pullUpdate(): Promise<void> {
    pulling.value = true
    error.value = null
    try {
      const response = await fetch('/api/update/pull', {
        method: 'POST',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: UpdateInfo = await response.json()
      updateInfo.value = data
    } catch (e) {
      error.value = e instanceof Error ? e.message : '拉取更新失败'
      console.error('[UpdateStore] pullUpdate failed:', error.value)
    } finally {
      pulling.value = false
    }
  }

  async function checkRepoStatus(): Promise<void> {
    repoChecking.value = true
    try {
      const response = await fetch('/api/update/repo-status')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      repoStatus.value = data.status
      repoError.value = data.error || null
    } catch (e) {
      repoStatus.value = 'error'
      repoError.value = e instanceof Error ? e.message : '检查仓库状态失败'
    } finally {
      repoChecking.value = false
    }
  }

  function dismiss(): void {
    dismissed.value = true
  }

  function reset(): void {
    updateInfo.value = {
      has_update: false,
      current_commit: '',
      latest_commit: '',
      commits_behind: 0,
      commit_messages: [],
    }
    dismissed.value = false
    error.value = null
  }

  /** 初始化时自动检查更新（确保只调用一次） */
  function autoCheck(): void {
    if (!initialized) {
      initialized = true
      checkUpdate()
    }
  }

  return {
    // state
    updateInfo,
    checking,
    pulling,
    error,
    dismissed,
    repoStatus,
    repoError,
    repoChecking,
    // actions
    checkUpdate,
    pullUpdate,
    checkRepoStatus,
    dismiss,
    reset,
    autoCheck,
  }
})
