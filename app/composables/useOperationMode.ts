import { readonly, ref } from 'vue'

export type OperationMode = 'search' | 'replenish' | 'writeoff'

const STORAGE_KEY = 'home-store-operation-mode'

// Модульный синглтон: состояние общее для всех компонентов приложения.
// sessionStorage доступен только на клиенте, поэтому инициализация через
// import.meta.client не ломает SSR.
const mode = ref<OperationMode>('search')

if (import.meta.client) {
  const saved = sessionStorage.getItem(STORAGE_KEY)
  if (saved === 'replenish' || saved === 'writeoff' || saved === 'search') {
    mode.value = saved
  }
}

export function useOperationMode() {
  function persist(next: OperationMode) {
    mode.value = next
    if (import.meta.client) {
      sessionStorage.setItem(STORAGE_KEY, next)
    }
  }

  return { mode: readonly(mode), persist }
}