<template>
  <div class="properties-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('properties.list_page') }}</h3>
      <NuxtLink to="/properties/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
    </div>

      <IndexTable
        :rows="properties"
        :columns="columns"
        :loading="loading"
        :error="error"
        :empty-text="t('properties.no_properties')"
        :page="meta.current_page || 1"
        :last-page="meta.last_page"
        :open-to="(p) => `/properties/${p.id}`"
        @page="goToPage"
      >
        <template #cell-group="{ row: p }">
          <span v-if="p.group">{{ p.group.title }}<template v-if="p.group.deleted">{{ t('placeholders.deleted') }}</template></span>
          <span v-else class="muted">—</span>
        </template>
        <template #cell-unit="{ row: p }">
          <span v-if="p.unit">{{ p.unit.title_short }}<template v-if="p.unit.deleted">{{ t('placeholders.deleted') }}</template></span>
          <span v-else class="muted">—</span>
        </template>
        <template #cell-dictionary="{ row: p }">
          <span v-if="p.dictionary">{{ p.dictionary.title }}<template v-if="p.dictionary.deleted">{{ t('placeholders.deleted') }}</template></span>
          <span v-else class="muted">—</span>
        </template>
        <template #cell-values_count="{ row: p }">
          {{ p.values_count ?? 0 }}
        </template>
        <template #actions="{ row: p }">
          <NuxtLink
            :to="`/properties/${p.id}`"
            class="action-link action-edit"
            :title="t('common.edit')"
            :aria-label="t('common.edit')"
          >
            <img src="/img/icon/edit.svg" class="action-icon" alt="" />
          </NuxtLink>
          <a
            href="#"
            class="action-link action-del"
            :title="t('common.delete')"
            :aria-label="t('common.delete')"
            @click.prevent="deleteProperty(p)"
          >
            <img src="/img/icon/delete.svg" class="action-icon" alt="" />
          </a>
        </template>
      </IndexTable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { PropertyResponse } from '~/repository/modules/property'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const properties = ref<PropertyResponse[]>([])
const columns = computed(() => [
  { key: 'id', label: 'ID' },
  { key: 'title', label: t('common.title') },
  { key: 'type_label', label: t('properties.type') },
  { key: 'group', label: t('properties.group') },
  { key: 'unit', label: t('properties.unit_short') },
  { key: 'dictionary', label: t('properties.dictionary_short') },
  { key: 'values_count', label: t('properties.values_count') },
])
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
    error.value = formatApiError(err, t('properties.load_failed'))
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
  if (!confirm(t('properties.delete_confirm', { title: p.title }) + '\n\n' + t('properties.delete_confirm_tail'))) return

  try {
    await $api.property.delete(p.id)
    $notify.add(t('properties.delete_done'), { type: 'success' })
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

.muted {
  color: var(--text-faint);
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
