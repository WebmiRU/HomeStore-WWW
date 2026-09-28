<template>
  <div class="conflicts-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('codes.conflicts_title') }}</h3>
      <NuxtLink to="/orphan-codes" class="btn-back">{{ t('codes.to_cleanup') }}</NuxtLink>
    </div>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <!--
        Что считается коллизией. Формулировка важна: страница выглядит как
        список претензий, а повторяющиеся коды здесь разрешены — один
        штрихкод на несколько экземпляров это обычное дело. Проблема не в
        самом повторе, а в том, что при сканировании предмет приходится
        выбирать.
      -->
      <div class="explain">
        <p>
          {{ t('codes.conflicts_intro') }}
        </p>
        <p>
          <strong>{{ t('codes.what_to_do') }}</strong> {{ t('codes.conflicts_tip') }}
        </p>
      </div>

      <div v-if="rows.length === 0" class="empty">
        {{ t('codes.conflicts_empty') }}
      </div>

      <template v-else>
        <table class="table">
          <thead>
            <tr>
              <th>{{ t('form.code') }}</th>
              <th>{{ t('codes.items_with_code') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.code">
              <td class="cell-code">{{ row.code }}</td>
              <td>
                <ul class="items">
                  <li v-for="item in row.items" :key="item.id">
                    <NuxtLink :to="`/items/${item.id}`" class="item-link">{{ item.title }}</NuxtLink>
                    <span class="item-id">#{{ item.id }}</span>
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="meta.last_page > 1" class="pager">
          <button type="button" class="pager__btn" :disabled="page <= 1" @click="go(page - 1)">← {{ t('common.back') }}</button>
          <span class="pager__label">{{ t('codes.pager', { page, last: meta.last_page, total: meta.total }) }}</span>
          <button type="button" class="pager__btn" :disabled="page >= meta.last_page" @click="go(page + 1)">{{ t('common.next') }} →</button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { CodeConflict } from '~/repository/modules/code'
import { formatApiError } from '~/composables/formatApiError'

const { $api } = useNuxtApp()
const { t } = useI18n()

const loading = ref(true)
const error = ref<string | null>(null)
const rows = ref<CodeConflict[]>([])
const meta = ref({ current_page: 1, per_page: 25, total: 0, last_page: 1 })
const page = ref(1)

async function load(target: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.code.conflicts(target)
    rows.value = result.data
    meta.value = result.meta
    page.value = result.meta.current_page
  } catch (err: any) {
    error.value = formatApiError(err, t('list_common.load_failed'))
  } finally {
    loading.value = false
  }
}

function go(target: number) {
  if (target < 1 || target > meta.value.last_page) return
  void load(target)
}

onMounted(() => load(1))
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.btn-back {
  padding: 6px 14px;
  font-size: 13px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  text-decoration: none;
}

.btn-back:hover {
  background: color-mix(in srgb, var(--bg-hover) 70%, var(--text));
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

/* Жёлтый — язык коллизий, тот же, что метка на строке сканирования:
   страница тоже про «здесь угадали, разберись», а не про ошибку. */
.explain {
  margin-bottom: 18px;
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--warn-ink);
  background: var(--warn-bg);
  border: 1px solid var(--warn-bg);
  border-radius: 4px;
}

.explain p {
  margin: 0 0 8px;
}

.explain p:last-child {
  margin-bottom: 0;
}

.explain strong {
  color: var(--warn-hover);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th,
.table td {
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--border);
}

.table th {
  color: var(--text-muted);
  font-weight: normal;
  font-size: 12px;
}

/* Код — моноширинный и не рвётся: длинная строка без переноса, иначе
   таблицу растягивает один нечитаемый столбец. */
.cell-code {
  width: 40%;
  font-family: monospace;
  color: var(--info-ink);
  word-break: break-all;
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.items li + li {
  margin-top: 4px;
}

.item-link {
  color: var(--info-hover);
  text-decoration: none;
}

.item-link:hover {
  text-decoration: underline;
}

.item-id {
  margin-left: 6px;
  color: var(--text-faint);
  font-size: 12px;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.pager__btn {
  padding: 6px 14px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.pager__btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-hover) 80%, var(--text));
}

.pager__btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.pager__label {
  color: var(--text-muted);
  font-size: 13px;
}
</style>
