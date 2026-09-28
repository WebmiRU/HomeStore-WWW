<template>
  <div class="edit-page">
    <h3 class="page-title">{{ t('team.edit_title', { id }) }}</h3>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <form @submit.prevent="save" class="edit-form">
        <section v-if="activeTab === 'main'" class="tab-section">
          <div class="avatar-block">
            <UserAvatar :user="previewUser" :size="120" />

            <div class="avatar-actions">
              <input
                ref="avatarInput"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                class="avatar-file"
                @change="onAvatarChange"
              />
              <button type="button" class="btn-avatar" :disabled="uploading" @click="avatarInput?.click()">
                {{ uploading ? t('form.loading') : t('team.avatar_upload') }}
              </button>
            </div>
          </div>

          <label class="field">
            <span class="field-label">{{ t('common.name') }}</span>
            <input v-model="form.name" type="text" class="field-input" maxlength="255" required />
          </label>

          <label class="field">
            <span class="field-label">E-mail</span>
            <input v-model="form.email" type="email" class="field-input" maxlength="255" required />
          </label>

          <label class="field">
            <span class="field-label">{{ t('team.new_password') }}</span>
            <input
              v-model="form.password"
              type="password"
              class="field-input"
              minlength="6"
              maxlength="255"
              autocomplete="new-password"
              :placeholder="t('team.password_leave_blank')"
            />
          </label>
        </section>

        <section v-if="activeTab === 'stats'" class="tab-section">
          <EntityAuditStats entity-type="user" :entity-id="Number(id)" />
        </section>

        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
          <NuxtLink to="/users" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
          <button v-if="isMe" type="button" class="btn-logout" :disabled="loggingOut" @click="logout">
            {{ loggingOut ? t('common.logging_out') : t('common.logout') }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { UserProfileResponse } from '~/repository/modules/userProfile'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const id = Number(route.params.id)
const { currentUserId, setCurrentUserId } = useCurrentUser()
const { profile, setProfile, clear: clearProfile } = useUserProfile()

const isMe = computed(() => currentUserId.value !== null && currentUserId.value === id)

const tabs = computed(() => [
  { key: 'main', label: t('form.main') },
  { key: 'stats', label: t('form.stats_tab') },
])

const activeTab = computed(() => {
  const q = route.query.tab
  if (typeof q === 'string' && tabs.value.some((t) => t.key === q)) {
    return q
  }
  return 'main'
})

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const uploading = ref(false)
const loggingOut = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const currentAvatarUrl = ref<string | null>(null)
const currentAvatarSha = ref<string | null>(null)

const form = reactive({
  name: '',
  email: '',
  password: '',
})

const currentAvatarWidth = ref<number | null>(null)
const currentAvatarHeight = ref<number | null>(null)
const currentAvatarThumbs = ref<{ cover: number; contain: number } | null>(null)

const previewUser = computed<UserProfileResponse>(() => ({
  id,
  name: form.name || t('user_avatar.default_name'),
  email: form.email,
  avatar_url: currentAvatarUrl.value,
  avatar_sha: currentAvatarSha.value,
  avatar_width: currentAvatarWidth.value,
  avatar_height: currentAvatarHeight.value,
  avatar_thumbs: currentAvatarThumbs.value,
  created_at: '',
  updated_at: '',
}))

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const user = await $api.userProfile.get(id)
    form.name = user.name
    form.email = user.email
    currentAvatarUrl.value = user.avatar_url ?? null
    currentAvatarSha.value = user.avatar_sha ?? null
    currentAvatarWidth.value = user.avatar_width ?? null
    currentAvatarHeight.value = user.avatar_height ?? null
    currentAvatarThumbs.value = user.avatar_thumbs ?? null
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const updated = await $api.userProfile.update(id, {
      name: form.name,
      email: form.email,
      ...(form.password ? { password: form.password } : {}),
    })
    currentAvatarUrl.value = updated.avatar_url ?? null
    currentAvatarSha.value = updated.avatar_sha ?? null
    currentAvatarWidth.value = updated.avatar_width ?? null
    currentAvatarHeight.value = updated.avatar_height ?? null
    currentAvatarThumbs.value = updated.avatar_thumbs ?? null
    if (isMe.value) {
      setProfile(updated)
    }
    form.password = ''
    $notify.add(t('form.saved', { title: t('team.one') }), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.save_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

async function onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const updated = await $api.userProfile.updateAvatar(id, file)
    currentAvatarUrl.value = updated.avatar_url ?? null
    currentAvatarSha.value = updated.avatar_sha ?? null
    currentAvatarWidth.value = updated.avatar_width ?? null
    currentAvatarHeight.value = updated.avatar_height ?? null
    currentAvatarThumbs.value = updated.avatar_thumbs ?? null
    if (isMe.value) {
      setProfile(updated)
    }
    $notify.add(t('team.avatar_updated'), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('team.avatar_failed')), { type: 'error', timer: 10 })
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function logout() {
  loggingOut.value = true
  try {
    await $api.auth.logout()
  } catch {
    // Даже если сервер недоступен — выходим на клиенте
  } finally {
    localStorage.removeItem('home-store-token')
    localStorage.removeItem('home-store-user-id')
    setCurrentUserId(null)
    clearProfile()
    $notify.add(t('notify.logged_out_body'), { type: 'info', timer: 5 })
    router.push('/login')
  }
}

onMounted(load)
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: #ccc;
}

.loading,
.error {
  color: #888;
  padding: 12px 0;
}

.error {
  color: #f88;
}

.edit-form {
  width: 100%;
}

.edit-tabs {
  margin: 14px 0 20px;
}

.tab-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.avatar-block {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.avatar-file {
  display: none;
}

.btn-avatar {
  padding: 8px 16px;
  font-size: 13px;
  font-family: inherit;
  color: #9fd8a6;
  background: #1f3a24;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-avatar:hover:not(:disabled) {
  background: #2a4d2e;
}

.btn-avatar:disabled {
  opacity: 0.5;
  cursor: default;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.tab-section .field {
  margin-bottom: 0;
}

.field-label {
  display: block;
  font-size: 13px;
  color: #888;
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: #666;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.btn-save {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  background: #2a5a2a;
  color: #cfc;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: #3a7a3a;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-logout {
  margin-left: auto;
  padding: 8px 20px;
  font-size: 14px;
  font-family: inherit;
  background: #3a1f1f;
  color: #f8a8a8;
  border: 1px solid #7a3a3a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-logout:hover:not(:disabled) {
  background: #4d2a2a;
}

.btn-logout:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 14px;
  color: #aaa;
  text-decoration: none;
  border: 1px dashed #555;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.btn-cancel:hover {
  color: #ddd;
  background: #333;
  border-style: solid;
}

@media (max-width: 768px) {
  .avatar-block {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-actions {
    flex-wrap: wrap;
  }

  .btn-logout {
    margin-left: 0;
  }
}
</style>