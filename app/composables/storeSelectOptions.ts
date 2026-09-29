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
  /** Склад всей ветки: определён один раз, иначе дерево разорвётся. */
  склад: string | null
}

export function useStoreSelectOptions(stores: StoreResponse[], keepId: number | null = null): StoreSelectGroup[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  for (const store of stores) {
    map.set(store.id, { store, children: [], склад: store.warehouse?.title ?? null })
  }

  for (const store of stores) {
    const node = map.get(store.id)!
    const parentId = store.parent_id

    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node)
    } else {
      // Родителя в списке нет — например, он не пришёл, — но вложенность от
      // этого не перестаёт быть. Такое хранилище стоит в корне списка, но с
      // одной ступенью отступа: видно, что оно не лежит на верхнем уровне.
      node.склад = null
      roots.push(node)
    }
  }

  const flat: StoreSelectOption[] = []

  // Проход 1, снизу вверх: складом ветки считается первый заданный вниз.
  //
  // Склад достаётся всем уровням ветки сразу, включая корень. Иначе дерево
  // рвётся: «Хранилище 1» лежит внутри «Ящика 1», а тот — внутри «Зала
  // хранения», и склад задан только у хранилища. Если брать «как есть», то
  // хранилище уедет в свою группу, а ящик и зал останутся в другой — и полка
  // окажется не под своим шкафом.
  const складВетки = (node: TreeNode): string | null => {
    if (node.склад !== null) {
      return node.склад
    }

    for (const child of node.children) {
      const found = складВетки(child)

      if (found !== null) {
        node.склад = found

        return found
      }
    }

    return null
  }

  for (const root of roots) {
    складВетки(root)
  }

  // Проход 2, сверху вниз: склад корня достаётся каждому потомку.
  //
  // Одного поиска снизу вверх мало. «Стеллаж А» лежит внутри «Хранилища 1»,
  // склад задан у хранилища, и поиск до него на этом уровне уже не доходит —
  // узел со складом отвечает сразу и не смотрит глубже. Без раздачи вниз
  // стеллаж остался бы в «Без склада», то есть в другой группе, чем шкаф под
  // ним, и дерево снова разорвалось бы.
  const раздать = (node: TreeNode): void => {
    for (const child of node.children) {
      if (child.склад === null) {
        child.склад = node.склад
      }

      раздать(child)
    }
  }

  for (const root of roots) {
    раздать(root)
  }

  // Проход 3, сверху вниз: раскладываем варианты по группам складов.
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

  const складПо = new Map<number, string | null>()
  const собрать = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      складПо.set(node.store.id, node.склад)
      собрать(node.children)
    }
  }
  собрать(roots)

  const order: string[] = []
  const groups = new Map<string, StoreSelectOption[]>()

  for (const opt of flat) {
    const label = складПо.get(opt.id) ?? withoutWarehouse

    if (!groups.has(label)) {
      groups.set(label, [])
      order.push(label)
    }
    groups.get(label)!.push(opt)
  }

  return order.map((label) => ({ label, options: groups.get(label)! }))
}
