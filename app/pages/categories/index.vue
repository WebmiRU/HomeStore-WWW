<template>
  <div class="categories-page">
    <div class="page-header">
      <h3 class="page-title">Категории</h3>
      <NuxtLink to="/categories/create" class="btn-add">Добавить</NuxtLink>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table v-if="rows.length" class="cat-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Предметов</th>
            <th>Создан</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" @dblclick="openRow($event, `/categories/${row.id}/edit`)">
            <td data-label="ID">{{ row.id }}</td>
            <td data-label="Название">
              <span class="tree-prefix">{{ '—'.repeat(row.depth) }}</span>
              <span v-if="row.depth > 0" class="tree-space"> </span>
              {{ row.title }}
            </td>
            <td data-label="Предметов">
              <span v-if="row.itemsCount">{{ row.itemsCount }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td data-label="Создан">{{ formatDate(row.createdAt) }}</td>
            <td class="actions">
              <NuxtLink
                :to="`/items?category_id=${row.id}`"
                class="action-link action-view"
                title="Предметы категории"
                aria-label="Предметы категории"
              >
                <img src="/img/icon/view.svg" class="action-icon" alt="" />
              </NuxtLink>
              <NuxtLink
                :to="`/categories/${row.id}/edit`"
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
                @click.prevent="deleteCategory(row)"
              >
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Нет категорий</div>

      <p class="page-hint">
        Счётчик показывает только предметы самой категории. Удаление уносит всю ветвь
        вложенных категорий, а предметы остаются — у них просто пропадает категория.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { formatDate } from '~/utils/auditLabels'
import { formatApiError } from '~/composables/formatApiError'
import { categorySelectOptions } from '~/composables/categorySelectOptions'
import type { CategoryResponse } from '~/repository/modules/category'

const { $api, $notify } = useNuxtApp()
const { openRow } = useRowOpen()

const categories = ref<CategoryResponse[]>([])
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
    error.value = formatApiError(err, 'Ошибка загрузки категорий')
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
    ? `Удалить категорию «${row.title}» вместе со всей её ветвью (${size} шт.)?\n\n` +
      'Предметы сохранятся, но останутся без категории.'
    : `Удалить категорию «${row.title}»?\n\nПредметы сохранятся, но останутся без категории.`

  if (!confirm(message)) return

  try {
    await $api.category.delete(row.id)
    $notify.add('Категория удалена', { type: 'success' })
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
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

.cat-table {
  width: 100%;
  border-collapse: collapse;
}

.cat-table th,
.cat-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.cat-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.cat-table td {
  color: #ccc;
}

.cat-table tr:hover td {
  background: #252525;
}

.tree-prefix {
  color: #555;
}

.tree-space {
  display: inline;
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

.page-hint {
  margin: 14px 0 0;
  font-size: 12px;
  color: #777;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .cat-table,
  .cat-table tbody,
  .cat-table tr,
  .cat-table td {
    display: block;
  }

  .cat-table thead {
    display: none;
  }

  .cat-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .cat-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .cat-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .cat-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .cat-table tr:hover td {
    background: transparent;
  }
}
</style>
