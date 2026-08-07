д<template>
  <div class="lists-page">
    <div class="page-header">
      <h3 class="page-title">Этикетки</h3>
      <NuxtLink to="/label-lists/create" class="btn-add">Добавить</NuxtLink>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table class="lists-table" v-if="lists.length">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Шаблон</th>
            <th>Создан</th>
            <th>Обновлён</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="list in lists" :key="list.id">
            <td>{{ list.id }}</td>
            <td>{{ list.title }}</td>
            <td>{{ list.label_preset?.title ?? (list.label_preset_id ? '#' + list.label_preset_id : '—') }}</td>
            <td>{{ formatDate(list.created_at) }}</td>
            <td>{{ formatDate(list.updated_at) }}</td>
            <td class="actions">
              <NuxtLink :to="`/label-lists/${list.id}/edit`" class="action-link">ред.</NuxtLink>
              <a href="#" class="action-link action-del" @click.prevent="deleteList(list.id)">уд.</a>
              <a
                href="#"
                class="action-link action-download"
                :class="{ disabled: downloading === list.id }"
                @click.prevent="downloadPdf(list.id)"
              >
                {{ downloading === list.id ? '...' : 'скач.' }}
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Нет списков</div>

      <div class="pagination" v-if="meta.last_page > 1">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          @click="goToPage((meta.current_page || 1) - 1)"
          class="page-btn"
        >
          ← Назад
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          @click="goToPage((meta.current_page || 1) + 1)"
          class="page-btn"
        >
          Вперёд →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import type { LabelListResponse } from '~/repository/modules/labelList'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()

const lists = ref<LabelListResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })
const downloading = ref<number | null>(null)

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

async function loadLists(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.labelList.list(page)
    lists.value = result.data
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

async function downloadPdf(id: number) {
  downloading.value = id
  try {
    const blob = await $fetch<Blob>(`/api/label-list/${id}/generate`, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `labels-${id}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    $notify.add('Документ отправлен на загрузку', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка скачивания'), { type: 'error', timer: 10 })
  } finally {
    downloading.value = null
  }
}

async function deleteList(id: number) {
  if (!confirm('Удалить список?')) return
  try {
    await $api.labelList.delete(id)
    $notify.add('Список удалён', { type: 'success' })
    await loadLists(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  }
}

onMounted(() => {
  const page = Number(route.query.page) || 1
  loadLists(page)
})

watch(() => route.query.page, (newPage) => {
  const page = Number(newPage) || 1
  loadLists(page)
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
  color: #ccc;
}

.btn-add {
  padding: 6px 16px;
  font-size: 14px;
  background: #2a5a2a;
  color: #cfc;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
}

.btn-add:hover {
  background: #3a7a3a;
}

.loading,
.error,
.empty {
  padding: 20px;
  color: #888;
}

.error {
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
}

.lists-table {
  width: 100%;
  border-collapse: collapse;
}

.lists-table th,
.lists-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.lists-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.lists-table td {
  color: #ccc;
}

.lists-table tr:hover td {
  background: #252525;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: #88a;
  text-decoration: none;
  margin-right: 8px;
  font-size: 13px;
}

.action-link:hover {
  color: #aaf;
}

.action-download {
  color: #6a6;
}

.action-download:hover {
  color: #8c8;
}

.action-download.disabled {
  opacity: 0.4;
  cursor: wait;
  color: #666;
}

.action-del {
  color: #a66;
}

.action-del:hover {
  color: #f88;
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
  background: #333;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: #444;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: #888;
}
</style>
