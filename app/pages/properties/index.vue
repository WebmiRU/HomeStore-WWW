<template>
  <div class="properties-page">
    <div class="page-header">
      <h3 class="page-title">Свойства предметов</h3>
      <NuxtLink to="/properties/create" class="btn-add">Добавить</NuxtLink>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table v-if="properties.length" class="prop-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Тип</th>
            <th>Группа</th>
            <th>Ед.</th>
            <th>Спр.</th>
            <th>Значений</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in properties" :key="p.id" @dblclick="openRow($event, `/properties/${p.id}/edit`)">
            <td data-label="ID">{{ p.id }}</td>
            <td data-label="Название">{{ p.title }}</td>
            <td data-label="Тип">{{ p.type_label }}</td>
            <td data-label="Группа">
              <span v-if="p.group">{{ p.group.title }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td data-label="Ед.">
              <span v-if="p.unit">{{ p.unit.title_short }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td data-label="Спр.">
              <span v-if="p.dictionary">{{ p.dictionary.title }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td data-label="Значений">{{ p.values_count ?? 0 }}</td>
            <td class="actions">
              <NuxtLink
                :to="`/properties/${p.id}/edit`"
                class="action-link action-edit"
                title="Редактировать"
                aria-label="Редактировать"
              >
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a
                href="#"
                class="action-link action-del"
                title="Удалить"
                aria-label="Удалить"
                @click.prevent="deleteProperty(p)"
              >
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Нет свойств</div>

      <div v-if="meta.last_page > 1" class="pagination">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          class="page-btn"
          @click="goToPage((meta.current_page || 1) - 1)"
        >
          ← Назад
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          class="page-btn"
          @click="goToPage((meta.current_page || 1) + 1)"
        >
          Вперёд →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { PropertyResponse } from '~/repository/modules/property'

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()
const { openRow } = useRowOpen()

const properties = ref<PropertyResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

async function load(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.property.list(page)
    properties.value = result.data
    meta.value = { current_page: result.meta.current_page, last_page: result.meta.last_page }
  } catch (err: any) {
    error.value = formatApiError(err, 'Ошибка загрузки свойств')
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

async function deleteProperty(p: PropertyResponse) {
  // Значения свойства — это то, чем заполнены предметы: удаление стирает их
  // вместе с заполнениями, а проверить заранее, где оно заполнено, нельзя.
  if (!confirm(`Удалить свойство «${p.title}»?\n\nЗаполненные им значения у предметов тоже пропадут.`)) return

  try {
    await $api.property.delete(p.id)
    $notify.add('Свойство удалено', { type: 'success' })
    await load(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  }
}

onMounted(() => load(Number(route.query.page) || 1))

watch(
  () => route.query.page,
  (page) => load(Number(page) || 1),
)
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

.prop-table {
  width: 100%;
  border-collapse: collapse;
}

.prop-table th,
.prop-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.prop-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.prop-table td {
  color: #ccc;
}

.prop-table tr:hover td {
  background: #252525;
}

.muted {
  color: #666;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: #88a;
  text-decoration: none;
  margin-right: 8px;
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

  .prop-table,
  .prop-table tbody,
  .prop-table tr,
  .prop-table td {
    display: block;
  }

  .prop-table thead {
    display: none;
  }

  .prop-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .prop-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .prop-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .prop-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .prop-table tr:hover td {
    background: transparent;
  }
}
</style>
