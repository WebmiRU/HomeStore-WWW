export interface NotifyItem {
  id: number
  message: string
  type?: string
  timer?: number
  /** Ссылки под текстом: уведомление может перечислять предметы ссылками. */
  links?: Array<{ label: string; to: string }>
  /** Подпись про то, что список показан не целиком, например «…». */
  more?: string
}

let nextId = 1

export const useNotifyPool = () => {
  const items = ref<NotifyItem[]>([])

  const add = (
    message: string,
    options?: { type?: string; timer?: number; links?: NotifyItem['links']; more?: string },
  ) => {
    const id = nextId++
    items.value.unshift({
      id,
      message,
      type: options?.type ?? 'success',
      timer: options?.timer ?? 5,
      links: options?.links,
      more: options?.more,
    })
    return id
  }

  const remove = (id: number) => {
    const index = items.value.findIndex(item => item.id === id)
    if (index !== -1) {
      items.value.splice(index, 1)
    }
  }

  return {
    items,
    add,
    remove,
  }
}
