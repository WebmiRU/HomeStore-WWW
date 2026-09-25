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
  // Не читачём localStorage в момент первичной отрисовки: это вызывало
  // hydration mismatch (SSR рисует placeholder без id, клиент при гидрации
  // уже знал id и рисовал ссылку на профиль). Значение подтягиваем на
  // клиенте уже ПОСЛЕ монтирования, чтобы первый render совпал с SSR.
  const currentUserId = useState<number | null>('current-user-id', () => null)

  if (import.meta.client) {
    onMounted(() => {
      currentUserId.value = readStoredUserId()
    })
  }

  const isOwner = (user?: UserBrief | null): boolean =>
    user !== undefined && user !== null && currentUserId.value !== null && currentUserId.value === user.id

  function setCurrentUserId(id: number | null) {
    currentUserId.value = id
  }

  return { currentUserId, isOwner, setCurrentUserId }
}
