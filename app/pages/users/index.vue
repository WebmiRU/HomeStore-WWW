<template>
  <div class="users-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('team.users_title') }}</h3>
      <NuxtLink to="/users/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
    </div>

    <IndexTable
      :rows="users"
      :columns="columns"
      :loading="loading"
      :error="error"
      :empty-text="t('team.no_users')"
      :page="meta.current_page || 1"
      :last-page="meta.last_page"
      :open-to="(u) => `/users/${u.id}`"
      @page="goToPage"
    >
      <template #cell-avatar="{ row: u }">
        <UserAvatar :user="u" :size="48" lightbox />
      </template>
      <template #cell-name="{ row: u }">{{ u.name }}</template>
      <template #cell-created_at="{ row: u }">{{ formatDate(u.created_at) }}</template>
      <template #actions="{ row: u }">
        <NuxtLink :to="`/users/${u.id}`" class="action-link action-edit" :title="t('common.edit')" :aria-label="t('common.edit')">
          <img src="/img/icon/edit.svg" class="action-icon" alt="" />
        </NuxtLink>
        <a href="#" class="action-link action-del" :title="t('common.delete')" :aria-label="t('common.delete')" @click.prevent="deleteUser(u.id)">
          <img src="/img/icon/delete.svg" class="action-icon" alt="" />
        </a>
      </template>
    </IndexTable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { UserProfileResponse } from '~/repository/modules/userProfile'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const users = ref<UserProfileResponse[]>([])
const columns = computed(() => [
  { key: 'id', label: 'ID' },
  { key: 'avatar', label: t('team.avatar'), class: 'img-col' },
  { key: 'name', label: t('common.name') },
  { key: 'email', label: 'E-mail' },
  { key: 'created_at', label: t('common.created') },
])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

async function loadUsers(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.userProfile.list(page)
    users.value = result.data
    meta.value = {
      current_page: result.meta.current_page,
      last_page: result.meta.last_page,
    }
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  router.push({ query: { page } })
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function deleteUser(id: number) {
  if (!confirm(t('team.delete_confirm'))) return
  try {
    await $api.userProfile.delete(id)
    $notify.add(t('team.delete_done'), { type: 'success' })
    await loadUsers(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
  }
}

onMounted(() => {
  const page = Number(route.query.page) || 1
  loadUsers(page)
})

watch(() => route.query.page, (newPage) => {
  const page = Number(newPage) || 1
  loadUsers(page)
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.btn-add {
  padding: 6px 16px;
  font-size: 14px;
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
}

.btn-add:hover {
  background: var(--accent);
}

.loading,
.error,
.empty {
  padding: 20px;
  color: var(--text-muted);
}

.error {
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 4px;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: var(--link);
  text-decoration: none;
  margin-right: 8px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.action-link img.action-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.action-link:hover {
  color: var(--link-hover);
}

.action-del {
  color: var(--danger);
}

.action-del:hover {
  color: var(--danger);
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
