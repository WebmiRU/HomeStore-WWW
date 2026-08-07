<template>
  <div class="presets-page">
    <h3 class="page-title">Шаблоны этикеток</h3>

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
            <th>Штрих-код</th>
            <th>Шрифт</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in presets" :key="p.id">
            <td>{{ p.id }}</td>
            <td>{{ p.title }}</td>
            <td>{{ p.page_width }}×{{ p.page_height }}</td>
            <td>{{ p.cell_width }}×{{ p.cell_height }}</td>
            <td>{{ p.barcode_position }}</td>
            <td>{{ p.font?.name ?? (p.font_id ? '#' + p.font_id : '—') }}</td>
            <td class="actions">
              <NuxtLink :to="`/label-presets/${p.id}/edit`" class="action-link">ред.</NuxtLink>
              <a href="#" class="action-link action-del" @click.prevent="deletePreset(p.id)">уд.</a>
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
import { ref, onMounted, watch } from 'vue'
import type { LabelPresetResponse } from '~/repository/modules/labelPreset'

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()

const presets = ref<LabelPresetResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

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
    $notify.add(err?.data?.error || err?.message || 'Ошибка удаления', { type: 'error', timer: 10 })
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
.page-title {
  margin: 0 0 16px;
  font-size: 18px;
  color: #ccc;
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
</style>
