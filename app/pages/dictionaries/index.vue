<template>
  <div class="dictionaries-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('properties.dictionaries_list') }}</h3>
      <NuxtLink to="/dictionaries/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
    </div>

    <IndexTable
      :rows="dictionaries"
      :columns="columns"
      :loading="loading"
      :error="error"
      :empty-text="t('properties.no_dictionaries')"
      :page="meta.current_page || 1"
      :last-page="meta.last_page"
      :open-to="(d) => `/dictionaries/${d.id}`"
      @page="goToPage"
    >
      <template #cell-created_at="{ row: d }">
        {{ formatDate(d.created_at) }}
      </template>
      <template #actions="{ row: d }">
        <NuxtLink
          :to="`/dictionaries/${d.id}`"
          class="action-link action-edit"
          :title="t('properties.dictionary_values_title')"
          :aria-label="t('properties.dictionary_values_title')"
        >
          <img src="/img/icon/edit.svg" class="action-icon" alt="" />
        </NuxtLink>
        <a
          href="#"
          class="action-link action-del"
          :title="t('common.delete')"
          :aria-label="t('common.delete')"
          @click.prevent="deleteDictionary(d)"
        >
          <img src="/img/icon/delete.svg" class="action-icon" alt="" />
        </a>
      </template>
    </IndexTable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { formatDate } from '~/utils/auditLabels'
import { formatApiError } from '~/composables/formatApiError'
import type { DictionaryResponse } from '~/repository/modules/dictionary'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const dictionaries = ref<DictionaryResponse[]>([])
const columns = computed(() => [
  { key: 'id', label: 'ID' },
  { key: 'title', label: t('common.title') },
  { key: 'values_count', label: t('properties.values_count') },
  { key: 'created_at', label: t('common.created') },
])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

async function load(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.dictionary.list(page)
    dictionaries.value = result.data
    meta.value = { current_page: result.meta.current_page, last_page: result.meta.last_page }
  } catch (err: any) {
    error.value = formatApiError(err, t('properties.dictionaries_load_failed'))
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

async function deleteDictionary(d: DictionaryResponse) {
  // Справочник удаляется вместе со значениями, а значения могут быть
  // выбраны в свойствах, — их придётся перезаполнить.
  if (!confirm(t('properties.dictionary_delete_confirm', { title: d.title, count: d.values_count }))) return

  try {
    await $api.dictionary.delete(d.id)
    $notify.add(t('properties.dictionary_delete_done'), { type: 'success' })
    await load(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
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
