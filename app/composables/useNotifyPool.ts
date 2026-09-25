export interface NotifyItem {
  id: number
  message: string
  type?: string
  timer?: number
}

let nextId = 1

export const useNotifyPool = () => {
  const items = ref<NotifyItem[]>([])

  const add = (message: string, options?: { type?: string; timer?: number }) => {
    const id = nextId++
    items.value.unshift({
      id,
      message,
      type: options?.type ?? 'success',
      timer: options?.timer ?? 5,
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
