import type { RouteLocationRaw } from 'vue-router'

export function useRowOpen() {
  const router = useRouter()

  function openRow(event: MouseEvent, to: RouteLocationRaw) {
    const target = event.target as HTMLElement | null

    if (target?.closest('a, button, input, select, textarea, label')) {
      return
    }

    router.push(to)
  }

  return { openRow }
}
