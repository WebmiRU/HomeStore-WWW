import type { CategoryResponse } from '~/repository/modules/category'

export interface CategorySelectOption {
  id: number
  title: string
  /** Глубина в дереве: 0 — корень. */
  depth: number
  /** Сколько предметов прямо в этой категории, без вложенных. */
  itemsCount: number
}

interface TreeNode {
  option: CategorySelectOption
  children: TreeNode[]
}

/**
 * Раскладывает категории по дереву: узел становится ребёнком родителя, а
 * родителя нет в списке — корнем. Категория с отсутствующим или несуществующим
 * родителем не потеряется, а просто поднимется наверх: иначе она была бы
 * невидима и в селекте, и в дереве.
 */
function buildTree(categories: CategoryResponse[]): TreeNode[] {
  const nodes = new Map<number, TreeNode>()

  for (const category of categories) {
    nodes.set(category.id, {
      option: {
        id: category.id,
        title: category.title,
        depth: 0,
        itemsCount: category.items_count ?? 0,
      },
      children: [],
    })
  }

  const roots: TreeNode[] = []

  for (const category of categories) {
    const node = nodes.get(category.id)!
    const parent = category.parent_id !== null ? nodes.get(category.parent_id) : undefined

    if (parent && parent !== node) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Взаимная родимость (A -> B и B -> A) сервер не допускает, но если такая
  // строка всё же есть, обход от корней её не увидит, а пустой список вместо
  // дерева хуже любого списка: не осталось бы ни дерева, ни селекта. Такие
  // узлы поднимаем в корни, пусть и отдельным куском после нормальных.
  const reachable = new Set<number>()

  const mark = (node: TreeNode): void => {
    if (reachable.has(node.option.id)) return
    reachable.add(node.option.id)
    node.children.forEach(mark)
  }

  roots.forEach(mark)

  for (const node of nodes.values()) {
    if (!reachable.has(node.option.id)) roots.push(node)
  }

  return roots
}

function walk(nodes: TreeNode[], depth: number, into: CategorySelectOption[]): void {
  // Обход с отметкой посещённых: при взаимной родительности children ссылается
  // сам на себя, и рекурсия без такой отметки ушла бы в бесконечный цикл.
  const seen = new Set<number>()
  const stack = nodes.map((node) => ({ node, depth })).reverse()

  while (stack.length) {
    const current = stack.pop()!

    if (seen.has(current.node.option.id)) continue

    seen.add(current.node.option.id)
    into.push({ ...current.node.option, depth: current.depth })

    // Кладём детей в обратном порядке: стек разбирается с конца, и так
    // они выходят в том же порядке, в каком перечислены.
    for (let i = current.node.children.length - 1; i >= 0; i--) {
      stack.push({ node: current.node.children[i], depth: current.depth + 1 })
    }
  }
}

/**
 * Плоский список категорий с отступом по глубине — для селектов, где
 * вложенность показывается тире, как у дерева хранилищ.
 */
export function categorySelectOptions(categories: CategoryResponse[]): CategorySelectOption[] {
  const flat: CategorySelectOption[] = []

  walk(buildTree(categories), 0, flat)

  return flat
}

/**
 * То же, но без самой категории и её ветви: ими нельзя сделать её же
 * родителем, и сервер отвечает на такое 422.
 */
export function categoryParentOptions(
  categories: CategoryResponse[],
  selfId: number | null,
): CategorySelectOption[] {
  const all = categorySelectOptions(categories)

  if (selfId === null) {
    return all
  }

  const blocked = new Set<number>([selfId])

  // Категория не может быть родителем своего потомка, поэтому blocked
  // замыкается вниз по дереву: у отмеченной категории дети тоже отпадают.
  let grew = true
  while (grew) {
    grew = false
    for (const category of categories) {
      if (category.parent_id !== null && blocked.has(category.parent_id) && !blocked.has(category.id)) {
        blocked.add(category.id)
        grew = true
      }
    }
  }

  return all.filter((option) => !blocked.has(option.id))
}
