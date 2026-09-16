import { computed } from 'vue'

export type UserBrief = {
  id: number
  name: string
  email: string
}

export function useCurrentUser() {
  const currentUserId = computed<number | null>(() => {
    if (import.meta.server) return null
    const raw = localStorage.getItem('home-store-user-id')
    const id = Number(raw)
    return Number.isFinite(id) && id > 0 ? id : null
  })

  const isOwner = (user?: UserBrief | null): boolean =>
    user !== undefined && user !== null && currentUserId.value !== null && currentUserId.value === user.id

  return { currentUserId, isOwner }
}