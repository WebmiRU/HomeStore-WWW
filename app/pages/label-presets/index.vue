<template>
  <div class="presets-page">
    <div class="page-header">
      <h3 class="page-title">Шаблоны этикеток</h3>
      <NuxtLink to="/label-presets/create" class="btn-add">Добавить</NuxtLink>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table class="presets-table" v-if="presets.length">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Страница</th>
            <th>Ячейка</th>
            <th>Этикеток/лист</th>
            <th>Штрих-код</th>
            <th>Шрифт</th>
            <th v-if="showOwnerColumn">Владелец</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in presets" :key="p.id" @dblclick="openRow($event, `/label-presets/${p.id}/edit`)">
            <td data-label="ID">{{ p.id }}</td>
            <td data-label="Название">{{ p.title }}</td>
            <td data-label="Страница">{{ p.page_width }}×{{ p.page_height }}</td>
            <td data-label="Ячейка">{{ p.cell_width }}×{{ p.cell_height }}</td>
            <td data-label="Этикеток/лист">{{ p.labels_per_sheet }}</td>
            <td data-label="Штрих-код">{{ p.barcode_position }}</td>
            <td data-label="Шрифт">{{ p.font?.name ?? (p.font_id ? '#' + p.font_id : '—') }}</td>
            <td v-if="showOwnerColumn" data-label="Владелец">
              <span
                v-if="p.user"
                class="owner-name"
                :class="isOwner(p.user) ? 'owner--me' : 'owner--other'"
              >{{ p.user.name }}</span>
              <span v-else>—</span>
            </td>
            <td class="actions">
              <NuxtLink :to="`/label-presets/${p.id}/edit`" class="action-link action-edit" title="Редактировать" aria-label="Редактировать">
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a href="#" class="action-link action-del" title="Удалить" aria-label="Удалить" @click.prevent="deletePreset(p.id)">
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Нет шаблонов</div>

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
import { ref, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { LabelPresetResponse } from '~/repository/modules/labelPreset'
import { useCurrentUser } from '~/composables/useCurrentUser'

const { $api, $notify } = useNuxtApp()
const { isOwner } = useCurrentUser()
const route = useRoute()
const router = useRouter()
const { openRow } = useRowOpen()

const presets = ref<LabelPresetResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

const showOwnerColumn = computed(() => presets.value.some(p => p.user && p.user.id))

async function loadPresets(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.labelPreset.list(page)
    presets.value = result.data
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

async function deletePreset(id: number) {
  if (!confirm('Удалить шаблон?')) return
  try {
    await $api.labelPreset.delete(id)
    $notify.add('Шаблон удалён', { type: 'success' })
    await loadPresets(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  }
}

onMounted(() => {
  const page = Number(route.query.page) || 1
  loadPresets(page)
})

watch(() => route.query.page, (newPage) => {
  const page = Number(newPage) || 1
  loadPresets(page)
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

.presets-table {
  width: 100%;
  border-collapse: collapse;
}

.presets-table th,
.presets-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.presets-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.presets-table td {
  color: #ccc;
}

.presets-table tr:hover td {
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
  color: #aaf;
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

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .presets-table,
  .presets-table tbody,
  .presets-table tr,
  .presets-table td {
    display: block;
  }

  .presets-table thead {
    display: none;
  }

  .presets-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .presets-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .presets-table td.cb-col {
    position: absolute;
    top: 12px;
    left: 14px;
    width: auto;
    padding: 0;
  }

  .presets-table td.cb-col input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }

  .presets-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .presets-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .presets-table tr:hover td {
    background: transparent;
  }
}
</style>
