<template>
  <div class="login-page">
    <h3 class="page-title">{{ t('login.title') }}</h3>

    <form @submit.prevent="submit" class="login-form">
      <label class="field">
        <span class="field-label">E-mail</span>
        <input v-model="form.email" type="email" class="field-input" maxlength="255" autocomplete="email" required />
      </label>

      <label class="field">
        <span class="field-label">{{ t('login.password') }}</span>
        <input v-model="form.password" type="password" class="field-input" autocomplete="current-password" required />
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-login" :disabled="loading">{{ t('login.submit') }}</button>
        <NuxtLink to="/" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { setCurrentUserId } = useCurrentUser()

const loading = ref(false)

const redirect = computed(() => {
  const value = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return value && value.startsWith('/') ? value : '/'
})

const form = reactive({
  email: '',
  password: '',
})

async function submit() {
  loading.value = true
  try {
    const result = await $api.auth.login({ ...form })
    localStorage.setItem('home-store-token', result.token)
    localStorage.setItem('home-store-user-id', String(result.user.id))
    setCurrentUserId(result.user.id)
    const { setProfile } = useUserProfile()
    setProfile(result.user)
    $notify.add(t('login.welcome', { name: result.user.name }), { type: 'success' })
    router.push(redirect.value)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('login.failed')), { type: 'error', timer: 10 })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 8vh;
}

.page-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: var(--text-secondary);
}

.login-form {
  width: 100%;
  max-width: 360px;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--border-strong);
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.btn-login {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  background: var(--info);
  color: var(--info-ink);
  border: 1px solid var(--info);
  border-radius: 4px;
  cursor: pointer;
}

.btn-login:hover:not(:disabled) {
  background: color-mix(in srgb, var(--info) 26%, var(--bg-elevated));
}

.btn-login:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-muted);
  text-decoration: none;
  border: 1px dashed var(--border-strong);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.btn-cancel:hover {
  color: var(--text);
  background: var(--bg-hover);
  border-style: solid;
}

@media (max-width: 768px) {
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>