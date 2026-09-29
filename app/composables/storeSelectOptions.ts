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
    } else if (parentId) {
      // Родителя в списке нет — например, он принадлежит другому складу и не
      // пришёл, — но вложенность хранилища от этого не перестаёт быть. Раньше
      // такое хранилище попадало в корень и читалось как лежащее отдельно,
      // хотя на самом деле оно лежит внутри шкафа.
      roots.push(node)
    } else {
      roots.push(node)
    }
  }

  const flat: StoreSelectOption[] = []

  const walk = (nodes: TreeNode[], depth: number, orphaned: boolean) => {
    for (const node of nodes) {
      if (node.store.can_create || (keepId !== null && node.store.id === keepId)) {
        flat.push({
          id: node.store.id,
          title: node.store.title,
          // Родителя нет в списке, но хранилище вложенное: одна ступень
          // отступа показывает, что оно не лежит в корне.
          depth: orphaned ? depth + 1 : depth,
          own: node.store.is_owner ?? false,
        })
      }
      walk(node.children, depth + 1, false)
    }
  }

  // Текущее хранилище предмета — видно, даже если права create нет.
  walk(roots, 0, false)

  // Хранилище верхнего уровня лежит вне склада — это не ошибка данных, а
  // норма, поэтому подпись «Без склада» берём из словаря.
  const { t } = useI18n()
  const withoutWarehouse = t('item_card.no_warehouse')

  // Склад хранилища — от самого верхнего предка, у которого он задан.
  //
  // Раньше брался только свой склад, и дерево разрывалось: «Хранилище 1»
  // лежит внутри «Ящика 1», склад задан только у хранилища, а у ящика — нет.
  // В списке они оказывались в разных группах, и полка уезжала из-под своего
  // шкафа отдельной строкой — «полка идёт отдельно».
  //
  // Ищем склад от корня вниз, а не от хранилища вверх: склад задают на верхнем
  // уровне, и всё, что вложено в этот шкаф, лежит в нём же, даже если на
  // полке склад проставлен отдельно.
  const byId = new Map<number, StoreResponse>(stores.map((s) => [s.id, s]))

  const warehouseOf = (store: StoreResponse): string | null => {
    let current: StoreResponse | undefined = store
    const пройденные = new Set<number>()

    while (current && !пройденные.has(current.id)) {
      пройденные.add(current.id)
      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }

    // Сейчас current — самый верхний предок (или сам склад, если он корневой).
    for (let node: StoreResponse | undefined = current; node; node = node.parent_id ? byId.get(node.parent_id) : undefined) {
      if (node.warehouse?.title) {
        return node.warehouse.title
      }
    }

    return null
  }

  const order: string[] = []
  const groups = new Map<string, StoreSelectOption[]>()

  for (const opt of flat) {
    const store = byId.get(opt.id)
    const label = store ? warehouseOf(store) ?? withoutWarehouse : withoutWarehouse

    if (!groups.has(label)) {
      groups.set(label, [])
      order.push(label)
    }
    groups.get(label)!.push(opt)
  }

  return order.map((label) => ({ label, options: groups.get(label)! }))
}
