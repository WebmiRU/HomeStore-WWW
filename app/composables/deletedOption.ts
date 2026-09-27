/**
 * Подсказка «текущее значение удалено» для селектов.
 *
 * Мягкое удаление оставляет ссылку в данных: у предмета category_id и
 * store_id остаются, а самой категории в списке уже нет (её скрывает
 * глобальный скоуп). Обычный селект в такой ситуации молча показывал бы
 * «[НЕТ]» — а это неправда: значение задано, просто родитель удалён.
 *
 * Поэтому в список добавляется одна синтетическая позиция с тем же
 * значением и пометкой [удалено]: выбор остаётся видимым, но выбрать его
 * снова нельзя (позиция disabled) — сменить родителя можно только на
 * живого.
 */
export interface DeletedRelation {
  id: number
  title: string
  deleted?: boolean
}

export interface SelectOption {
  id: number
  label: string
}

export function deletedOption(
  options: Array<{ id: number }>,
  currentId: number | null,
  relation: DeletedRelation | null | undefined,
  label: (title: string) => string = (title) => title,
): SelectOption | null {
  if (!relation?.deleted || currentId === null) {
    return null
  }

  // Если удалённый родитель всё же оказался в списке (например, пришло
  // хранилище по доступу), синтетическая позиция была бы дублем.
  if (options.some((option) => option.id === currentId)) {
    return null
  }

  return { id: currentId, label: `${label(relation.title)} [удалено]` }
}
