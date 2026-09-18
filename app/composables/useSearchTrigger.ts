import { useState } from '#imports'

const trigger = useState<number>('search-trigger', () => 0)

export function useSearchTrigger() {
  function next(): void {
    trigger.value += 1
  }

  return {
    trigger,
    next,
  }
}