<template>
  <div class="login-page">
    <h3 class="page-title">Вход</h3>

    <form @submit.prevent="submit" class="login-form">
      <label class="field">
        <span class="field-label">E-mail</span>
        <input v-model="form.email" type="email" class="field-input" maxlength="255" autocomplete="email" required />
      </label>

      <label class="field">
        <span class="field-label">Пароль</span>
        <input v-model="form.password" type="password" class="field-input" autocomplete="current-password" required />
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-login" :disabled="loading">Войти</button>
        <NuxtLink to="/" class="btn-cancel">Отмена</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const router = useRouter()

const loading = ref(false)

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
    $notify.add(`Добро пожаловать, ${result.user.name}`, { type: 'success' })
    router.push('/')
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Не удалось войти'), { type: 'error', timer: 10 })
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
  color: #ccc;
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

.btn-login {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  background: #2a4a7a;
  color: #cfe;
  border: 1px solid #3a6a9a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-login:hover:not(:disabled) {
  background: #3a6a9a;
}

.btn-login:disabled {
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
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>