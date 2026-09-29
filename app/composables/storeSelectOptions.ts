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

interface TreeNode {
  store: StoreResponse
  children: TreeNode[]
}

export function useStoreSelectOptions(stores: StoreResponse[], keepId: number | null = null): StoreSelectGroup[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  for (const store of stores) {
    map.set(store.id, { store, children: [] })
  }

  for (const store of stores) {
    const node = map.get(store.id)!
    const parentId = store.parent_id

    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const flat: StoreSelectOption[] = []

  // Шкаф с пометкой «вложенное» — родителя в списке нет, он не пришёл, и он не
  // лежит на верхнем уровне. Одна ступень отступа показывает это, иначе
  // хранилище читается как лежащее отдельно.
  const walk = (nodes: TreeNode[], depth: number, orphaned: boolean) => {
    for (const node of nodes) {
      if (node.store.can_create || (keepId !== null && node.store.id === keepId)) {
        flat.push({
          id: node.store.id,
          title: node.store.title,
          depth: orphaned ? depth + 1 : depth,
          own: node.store.is_owner ?? false,
        })
      }

      walk(node.children, depth + 1, false)
    }
  }

  walk(roots, 0, false)

  // Хранилище верхнего уровня лежит вне склада — это не ошибка данных, а
  // норма, поэтому подпись «Без склада» берём из словаря.
  const { t } = useI18n()
  const withoutWarehouse = t('item_card.no_warehouse')

  const byId = new Map<number, StoreResponse>(stores.map((s) => [s.id, s]))

  // Склад хранилища — свой, а если не задан, то склад родителя.
  //
  // Именно вверх, а не вниз по ветке. Склад задают на шкафу, а полки внутри
  // него остаются без склада: брать надо у того, кто стоит выше. Если искать
  // вниз, то шкаф без склада оттягивал бы в «Без склада» всё, что под ним
  // оказалось с пометкой, и наоборот — однажды заданный склад внизу уводил бы
  // от своего места весь верх.
  const складХранилища = (store: StoreResponse): string | null => {
    let current: StoreResponse | undefined = store
    const пройденные = new Set<number>()

    while (current && !пройденные.has(current.id)) {
      пройденные.add(current.id)

      if (current.warehouse?.title) {
        return current.warehouse.title
      }

      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }

    return null
  }

  const order: string[] = []
  const groups = new Map<string, StoreSelectOption[]>()

  for (const opt of flat) {
    const store = byId.get(opt.id)
    const label = (store ? складХранилища(store) : null) ?? withoutWarehouse

    if (!groups.has(label)) {
      groups.set(label, [])
      order.push(label)
    }
    groups.get(label)!.push(opt)
  }

  return order.map((label) => ({ label, options: groups.get(label)! }))
}
