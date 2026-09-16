import type { UserProfileResponse } from '~/repository/modules/userProfile'

export function useUserProfile() {
  const { $api } = useNuxtApp()
  const { currentUserId } = useCurrentUser()

  const profileState = useState<UserProfileResponse | null>('current-user-profile', () => null)

  const profile = computed<UserProfileResponse | null>(() => profileState.value)

  async function load(): Promise<void> {
    if (import.meta.server) return
    if (profileState.value) return

    const id = currentUserId.value
    if (id === null) {
      profileState.value = null
      return
    }

    try {
      profileState.value = await $api.userProfile.get(id)
    } catch {
      profileState.value = null
    }
  }

  function setProfile(value: UserProfileResponse | null) {
    profileState.value = value
  }

  function clear() {
    profileState.value = null
  }

  return { profile, load, setProfile, clear }
}