<template>
  <div class="categories-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('categories.list') }}</h3>
      <NuxtLink to="/categories/create" class="btn-add">{{ t('categories.add') }}</NuxtLink>
    </div>

    <IndexTable
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :error="error"
      :empty-text="t('categories.no_categories')"
      :open-to="(row) => `/categories/${row.id}`"
    >
      <template #cell-title="{ row }">
        <span class="tree-prefix">{{ '—'.repeat(row.depth) }}</span>
        <span v-if="row.depth > 0" class="tree-space"> </span>
        {{ row.title }}
      </template>
      <template #cell-items_count="{ row }">
        <span v-if="row.itemsCount">{{ row.itemsCount }}</span>
        <span v-else class="muted">—</span>
      </template>
      <template #cell-created_at="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>
      <template #actions="{ row }">
        <!--
          Воронка, а не глаз: пункт ведёт в список предметов, отобранных по
          категории, — это фильтр. Глаз в приложении уже значит «только
          чтение», и второй значок на то же место сбивал с толку.
        -->
        <NuxtLink
          :to="`/items?category_id=${row.id}`"
          class="action-link action-view"
          :title="t('categories.items_of_category')"
          :aria-label="t('categories.items_of_category')"
        >
          <img src="/img/icon/funnel.svg" class="action-icon" alt="" />
        </NuxtLink>
        <NuxtLink
          :to="`/categories/${row.id}`"
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
          @click.prevent="deleteCategory(row)"
        >
          <img src="/img/icon/delete.svg" class="action-icon" alt="" />
        </a>
      </template>
    </IndexTable>

    <p class="page-hint">
      {{ t('categories.counter_hint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { formatDate } from '~/utils/auditLabels'
import { formatApiError } from '~/composables/formatApiError'
import { categorySelectOptions } from '~/composables/categorySelectOptions'
import type { CategoryResponse } from '~/repository/modules/category'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()

const categories = ref<CategoryResponse[]>([])
const columns = computed(() => [
  { key: 'id', label: 'ID' },
  { key: 'title', label: t('categories.title') },
  { key: 'items_count', label: t('list_common.items_count') },
  { key: 'created_at', label: t('common.created') },
])
const loading = ref(true)
const error = ref<string | null>(null)

/** Дерево раскладывается целиком: список категорий без пагинации. */
const rows = computed(() =>
  categorySelectOptions(categories.value).map((option) => {
    const category = categories.value.find((item) => item.id === option.id)

    return { ...option, createdAt: category?.created_at ?? '' }
  })
)

async function load() {
  loading.value = true
  error.value = null
  try {
    categories.value = await $api.category.all()
  } catch (err: any) {
    error.value = formatApiError(err, t('categories.load_failed'))
  } finally {
    loading.value = false
  }
}

/** Сколько категорий уйдёт вместе с удаляемой — из уже загруженного дерева. */
function branchSize(selfId: number): number {
  const byParent = new Map<number | null, CategoryResponse[]>()

  for (const category of categories.value) {
    const siblings = byParent.get(category.parent_id) ?? []
    siblings.push(category)
    byParent.set(category.parent_id, siblings)
  }

  let size = 1
  const stack = [...(byParent.get(selfId) ?? [])]

  while (stack.length) {
    const child = stack.pop()!
    size += 1
    stack.push(...(byParent.get(child.id) ?? []))
  }

  return size
}

async function deleteCategory(row: { id: number; title: string }) {
  const size = branchSize(row.id)
  const message = size > 1
    ? t('categories.delete_branch_confirm', { title: row.title, count: size }) + '\n\n' +
      t('categories.keep_warning')
    : t('categories.delete_confirm', { title: row.title }) + '\n\n' + t('categories.keep_warning')

  if (!confirm(message)) return

  try {
    await $api.category.delete(row.id)
    $notify.add(t('categories.delete_done'), { type: 'success' })
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
  }
}

onMounted(load)
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

.tree-prefix {
  color: var(--text-dim);
}

.tree-space {
  display: inline;
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

.page-hint {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
