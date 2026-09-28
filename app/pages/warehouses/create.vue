<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('warehouses.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <form @submit.prevent="save" class="create-form">
      <label class="field">
        <span class="field-label">{{ t('form.title') }}</span>
        <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
      </label>

      <label class="field">
        <span class="field-label">{{ t('access_rights.user') }}</span>
        <select v-model.number="form.user_id" class="field-select" required>
          <option :value="null" disabled>{{ t('placeholders.pick') }}</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.email }})</option>
        </select>
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <NuxtLink to="/warehouses" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { UserProfileResponse } from '~/repository/modules/userProfile'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const router = useRouter()

const saving = ref(false)
const users = ref<UserProfileResponse[]>([])

const tabs = computed(() => [{ key: 'main', label: t('warehouses.main_tab') }])

const form = reactive({
  title: '',
  user_id: null as number | null,
})

async function loadUsers() {
  try {
    users.value = await $api.userProfile.all()
  } catch (err: any) {
    $notify.add(formatApiError(err, t('team.load_failed')), { type: 'error', timer: 10 })
  }
}

async function save() {
  if (form.user_id === null) {
    $notify.add(t('access_rights.pick_user'), { type: 'warning', timer: 5 })
    return
  }
  saving.value = true
  try {
    const created = await $api.warehouse.create({ title: form.title, user_id: form.user_id })
    $notify.add(t('form.created', { title: t('warehouses.one') }), { type: 'success' })
    router.push(`/warehouses/${created.id}`)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

onMounted(loadUsers)
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: var(--text-secondary);
}

.create-tabs {
  margin: 14px 0 20px;
}

.create-form {
  width: 100%;
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

.field-input,
.field-select {
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

.field-input:focus,
.field-select:focus {
  border-color: var(--border-strong);
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
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: var(--accent);
}

.btn-save:disabled {
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
