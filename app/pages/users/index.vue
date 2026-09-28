<template>
  <div class="users-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('team.users_title') }}</h3>
      <NuxtLink to="/users/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
    </div>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table class="users-table" v-if="users.length">
        <thead>
          <tr>
            <th>ID</th>
            <th class="img-col">{{ t('team.avatar') }}</th>
            <th>{{ t('common.name') }}</th>
            <th>E-mail</th>
            <th>{{ t('common.created') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" @dblclick="openRow($event, `/users/${u.id}`)">
            <td data-label="ID">{{ u.id }}</td>
            <td :data-label="t('team.avatar')" class="img-col">
              <UserAvatar :user="u" :size="38" lightbox />
            </td>
            <td :data-label="t('common.name')">{{ u.name }}</td>
            <td data-label="E-mail">{{ u.email }}</td>
            <td :data-label="t('common.created')">{{ formatDate(u.created_at) }}</td>
            <td class="actions">
              <NuxtLink :to="`/users/${u.id}`" class="action-link action-edit" :title="t('common.edit')" :aria-label="t('common.edit')">
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a href="#" class="action-link action-del" :title="t('common.delete')" :aria-label="t('common.delete')" @click.prevent="deleteUser(u.id)">
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">{{ t('team.no_users') }}</div>

      <div class="pagination" v-if="meta.last_page > 1">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          @click="goToPage((meta.current_page || 1) - 1)"
          class="page-btn"
        >
          ← {{ t('common.back') }}
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          @click="goToPage((meta.current_page || 1) + 1)"
          class="page-btn"
        >
          {{ t('common.forward') }} →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { UserProfileResponse } from '~/repository/modules/userProfile'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { openRow } = useRowOpen()

const users = ref<UserProfileResponse[]>([])
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

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.users-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.users-table td {
  color: var(--text-secondary);
}

.users-table tr:hover td {
  background: var(--bg-elevated);
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: var(--info);
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
  color: var(--info);
}

.action-del {
  color: var(--danger);
}

.action-del:hover {
  color: var(--danger);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.page-btn {
  padding: 6px 14px;
  font-size: 13px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-hover) 70%, var(--text));
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .users-table,
  .users-table tbody,
  .users-table tr,
  .users-table td {
    display: block;
  }

  .users-table thead {
    display: none;
  }

  .users-table tr {
    position: relative;
    margin-bottom: 14px;
    /* Сверху 44px — под кнопки действий, аватар в левом углу стоит на них. */
    padding: 44px 14px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .users-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
    font-size: 15px;
    white-space: normal;
  }

  .users-table td.img-col {
    position: absolute;
    top: 12px;
    left: 12px;
    width: auto;
    padding: 0;
  }

  /* Подпись колонки у аватара не нужна: картинка и так всё говорит, а на
     телефоне она в углу и подпись только сбивала бы влево. */
  .users-table td.img-col::before {
    display: none;
  }

  .users-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .users-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .users-table tr:hover td {
    background: transparent;
  }
}
</style>
