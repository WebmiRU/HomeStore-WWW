import { ref } from 'vue'
import type { StoreResponse } from '~/repository/modules/store'

export type ChainCrumb =
  | { type: 'warehouse'; id: number; title: string }
  | { type: 'store'; id: number; title: string; root: boolean }

// Кэш дерева хранилищ (модульный синглтон): загружается один раз на клиенте,
// цепочки пересчитываются по нему без повторных запросов.
// Кэш обновляется раз в минуту, чтобы данные о складах не устаревали
// в течение длинной сессии (например, после правок в БД).
const storeById = ref<Map<number, StoreResponse>>(new Map())
let loaded = false
let loadedAt = 0
let loadingPromise: Promise<void> | null = null

const CACHE_TTL_MS = 60_000

async function ensureStores($api: any, force = false): Promise<void> {
  if (loaded && !force && Date.now() - loadedAt < CACHE_TTL_MS) return
  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        const stores = (await $api.store.list()) as StoreResponse[]
        const map = new Map<number, StoreResponse>()
        for (const s of stores) map.set(s.id, s)
        storeById.value = map
        loaded = true
        loadedAt = Date.now()
      } catch {
        // Не удалось обновить дерево — используем то, что уже загружено.
        loaded = true
        loadedAt = Date.now()
      } finally {
        loadingPromise = null
      }
    })()
  }
  await loadingPromise
}

export function useLocationChain() {
  const { $api } = useNuxtApp()

  // Цепочка расположения объекта: склад → хранилища-предки → (само хранилище).
  // Сам объект (предмет/хранилище) в цепочку не включается — его название
  // уже отображается в строке поисковой выдачи / карточке найденного.
  async function chainForStore(
    storeId: number | null | undefined,
    includeSelf = true,
  ): Promise<ChainCrumb[]> {
    if (storeId == null) return []
    await ensureStores($api)
    let store = storeById.value.get(storeId)
    if (!store) return []

    // Если у хранилища есть warehouse_id, но склад не пришёл — вероятно,
    // кэш устарел (до правки БД). Принудительно обновляем и пробуем ещё раз.
    if (store.warehouse_id != null && !store.warehouse) {
      await ensureStores($api, true)
      store = storeById.value.get(storeId)
      if (!store) return []
    }

    const crumbs: ChainCrumb[] = []
    if (store.warehouse) {
      crumbs.push({ type: 'warehouse', id: store.warehouse.id, title: store.warehouse.title })
    }
    // Родители могут прийти и от корня к листу, и наоборот (в зависимости от
    // версии API) — нормализуем к порядку «от корня к листу».
    let parents = store.parents ?? []
    if (parents.length > 1) {
      const firstIsRoot = parents[0]!.parent_id == null
      const lastIsRoot = parents[parents.length - 1]!.parent_id == null
      if (!firstIsRoot && lastIsRoot) parents = [...parents].reverse()
    }
    for (const parent of parents) {
      crumbs.push({ type: 'store', id: parent.id, title: parent.title, root: parent.parent_id == null })
    }
    if (includeSelf) {
      crumbs.push({ type: 'store', id: store.id, title: store.title, root: store.parent_id == null })
    }
    return crumbs
  }

  return { chainForStore }
}