<template>
  <div class="search-page">
    <h3 class="page-title">Результаты поиска: «{{ query }}»</h3>

    <div v-if="loading" class="loading">Поиск...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <div v-if="results.length === 0" class="empty">Ничего не найдено</div>

      <table v-else class="results-table">
        <thead>
          <tr>
            <th>Тип</th>
            <th>Название</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in results" :key="`${r.type}-${r.payload.id}`">
            <td>
              <span v-if="r.type === 'item'" class="type-badge type-item">Предмет</span>
              <span v-else class="type-badge type-store">Хранилище</span>
            </td>
            <td>
              <div class="result-title">{{ r.payload.title }}</div>
              <div v-if="r.payload.title_print" class="result-sub">{{ r.payload.title_print }}</div>
            </td>
            <td class="actions">
              <LabelListToggler
                v-if="r.type === 'item'"
                :item-id="r.payload.id"
              />
              <LabelListToggler
                v-else
                :store-id="r.payload.id"
              />
              <NuxtLink
                v-if="r.type === 'item'"
                :to="`/items/${r.payload.id}/edit`"
                class="action-link"
              >
                ред.
              </NuxtLink>
              <NuxtLink
                v-else
                :to="`/stores/${r.payload.id}/edit`"
                class="action-link"
              >
                ред.
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import type { FulltextSearchResult } from '~/repository/modules/code'

const { $api } = useNuxtApp()
const route = useRoute()

const query = ref((route.query.q as string) || '')
const loading = ref(true)
const error = ref<string | null>(null)
const results = ref<FulltextSearchResult[]>([])

async function search() {
  const q = route.query.q as string
  if (!q) {
    error.value = 'Не указан поисковый запрос'
    loading.value = false
    return
  }

  query.value = q
  loading.value = true
  error.value = null
  try {
    results.value = await $api.code.fulltextSearch(q)
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || 'Ошибка поиска'
  } finally {
    loading.value = false
  }
}

onMounted(search)

watch(() => route.query.q, () => {
  search()
})
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
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

.empty {
  background: #222;
  border: 1px solid #333;
  border-radius: 6px;
  text-align: center;
  font-size: 15px;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.results-table th:first-child,
.results-table td:first-child,
.results-table th:last-child,
.results-table td:last-child {
  width: 1px;
  white-space: nowrap;
}

.results-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.results-table td {
  color: #ccc;
}

.results-table tr:hover td {
  background: #252525;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.type-item {
  background: #2a3a2a;
  color: #8c8;
  border: 1px solid #3a5a3a;
}

.type-store {
  background: #2a2a3a;
  color: #88c;
  border: 1px solid #3a3a5a;
}

.result-title {
  font-size: 15px;
  color: #ddd;
}

.result-sub {
  font-size: 13px;
  color: #888;
  margin-top: 2px;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: #88a;
  text-decoration: none;
  font-size: 13px;
}

.action-link:hover {
  color: #aaf;
}
</style>
