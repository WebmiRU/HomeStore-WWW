import { ref } from 'vue'
import type { StoreResponse } from '~/repository/modules/store'

export type ChainCrumb =
  | { type: 'warehouse'; id: number; title: string }
  | { type: 'store'; id: number; title: string; root: boolean }
  | { type: 'item'; id: number; title: string }

// Кэш дерева хранилищ (модульный синглтон): загружается один раз на клиенте,
// цепочки пересчитываются по нему без повторных запросов.
const storeById = ref<Map<number, StoreResponse>>(new Map())
let loaded = false
let loadingPromise: Promise<void> | null = null

async function ensureStores($api: any): Promise<void> {
  if (loaded) return
  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        const stores = (await $api.store.list()) as StoreResponse[]
        const map = new Map<number, StoreResponse>()
        for (const s of stores) map.set(s.id, s)
        storeById.value = map
        loaded = true
      } catch {
        // Не удалось загрузить дерево — цепочки просто не появятся.
      } finally {
        loadingPromise = null
      }
    })()
  }
  await loadingPromise
}

export function useLocationChain() {
  const { $api } = useNuxtApp()

  async function chainForStore(storeId: number | null | undefined): Promise<ChainCrumb[]> {
    if (storeId == null) return []
    await ensureStores($api)
    const store = storeById.value.get(storeId)
    if (!store) return []

    const crumbs: ChainCrumb[] = []
    if (store.warehouse) {
      crumbs.push({ type: 'warehouse', id: store.warehouse.id, title: store.warehouse.title })
    }
    for (const parent of store.parents ?? []) {
      crumbs.push({ type: 'store', id: parent.id, title: parent.title, root: parent.parent_id == null })
    }
    crumbs.push({ type: 'store', id: store.id, title: store.title, root: store.parent_id == null })
    return crumbs
  }

  async function chainForItem(
    storeId: number | null | undefined,
    itemId: number,
    title: string,
  ): Promise<ChainCrumb[]> {
    const crumbs = await chainForStore(storeId)
    crumbs.push({ type: 'item', id: itemId, title })
    return crumbs
  }

  return { chainForStore, chainForItem }
}