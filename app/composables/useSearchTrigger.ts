import { useState } from '#imports'

export function useSearchTrigger() {
  const trigger = useState<number>('search-trigger', () => 0)

  function next(): void {
    trigger.value += 1
  }

  return {
    trigger,
    next,
  }
}