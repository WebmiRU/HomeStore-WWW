import type { StoreResponse } from '~/repository/modules/store'

export interface StoreSelectOption {
  id: number
  title: string
  depth: number
  own: boolean
}

export interface StoreSelectGroup {
  label: string
  options: StoreSelectOption[]
}

export function useStoreSelectOptions(stores: StoreResponse[], keepId: number | null = null): StoreSelectGroup[] {
  interface TreeNode {
    store: StoreResponse
    children: TreeNode[]
  }

  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  for (const store of stores) {
    map.set(store.id, { store, children: [] })
  }

  for (const store of stores) {
    const node = map.get(store.id)!
    if (store.parent_id && map.has(store.parent_id)) {
      map.get(store.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const flat: StoreSelectOption[] = []

  const walk = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.store.can_create || (keepId !== null && node.store.id === keepId)) {
        flat.push({
          id: node.store.id,
          title: node.store.title,
          depth,
          own: node.store.is_owner ?? false,
        })
      }
      walk(node.children, depth + 1)
    }
  }

  // Текущее хранилище предмета — видно, даже если права create нет.
  walk(roots, 0)

  const labelById = new Map<number, string>(
    stores.map((s) => [s.id, s.warehouse?.title ?? 'Без склада'])
  )

  const order: string[] = []
  const groups = new Map<string, StoreSelectOption[]>()

  for (const opt of flat) {
    const label = labelById.get(opt.id) ?? 'Без склада'
    if (!groups.has(label)) {
      groups.set(label, [])
      order.push(label)
    }
    groups.get(label)!.push(opt)
  }

  return order.map((label) => ({ label, options: groups.get(label)! }))
}