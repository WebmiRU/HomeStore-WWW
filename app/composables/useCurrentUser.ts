export type UserBrief = {
  id: number
  name: string
  email: string
}

function readStoredUserId(): number | null {
  if (import.meta.server) return null
  const raw = localStorage.getItem('home-store-user-id')
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function useCurrentUser() {
  const currentUserId = useState<number | null>('current-user-id', () => readStoredUserId())

  if (import.meta.client) {
    currentUserId.value = readStoredUserId()
  }

  const isOwner = (user?: UserBrief | null): boolean =>
    user !== undefined && user !== null && currentUserId.value !== null && currentUserId.value === user.id

  function setCurrentUserId(id: number | null) {
    currentUserId.value = id
  }

  return { currentUserId, isOwner, setCurrentUserId }
}
