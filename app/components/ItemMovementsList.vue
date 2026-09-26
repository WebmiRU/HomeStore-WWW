<template>
  <div class="mvlist">
    <div v-if="loading" class="mvlist__state">Загрузка...</div>
    <div v-else-if="error" class="mvlist__state mvlist__state--error">{{ error }}</div>
    <div v-else-if="!operations.length" class="mvlist__state">
      Списаний и пополнений по предмету не было
    </div>

    <template v-else>
      <div class="mvlist__sum">
        <span class="mvlist__sum-item">
          Списано: <b>{{ summary.writeoff.units }}</b> шт.
        </span>
        <span class="mvlist__sum-item">
          Пополнено: <b>{{ summary.replenish.units }}</b> шт.
        </span>
        <span class="mvlist__sum-item">
          Возвратов: <b>{{ summary.reversals }}</b>
        </span>
      </div>

      <table class="mvlist__table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Операция</th>
            <th>Комментарий</th>
            <th>Количество</th>
            <th>Остаток</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="op in operations" :key="op.id" :class="{ 'mvlist__row--return': op.is_reversal }">
            <td class="mvlist__cell-date">{{ formatDate(op.created_at) }}</td>
            <td class="mvlist__cell-kind">
              <span class="mvlist__sign" :class="`mvlist__sign--${op.direction}`">
                {{ op.direction === 'replenish' ? '+' : '−' }}
              </span>
              {{ op.direction_label }}
              <span v-if="op.is_reversal" class="mvlist__tag">возврат №{{ op.reversed_operation_id }}</span>
            </td>
            <td class="mvlist__cell-comment">{{ op.comment || '—' }}</td>
            <td class="mvlist__cell-qty">
              {{ mineOf(op) }}
              <span v-if="op.rows.some((r) => r.is_returned)" class="mvlist__returned">
                возврат {{ returnedOf(op) }}
              </span>
            </td>
            <td class="mvlist__cell-balance">
              <span v-if="balanceOf(op)">{{ balanceOf(op) }}</span>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="meta.last_page > 1" class="mvlist__pager">
        <button type="button" class="mvlist__page" :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">
          ←
        </button>
        <span class="mvlist__page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="mvlist__page"
          :disabled="meta.current_page >= meta.last_page"
          @click="load(meta.current_page + 1)"
        >
          →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { StockOperation } from '~/repository/modules/stockOperation'

const props = defineProps<{ itemId: number }>()

const { $api } = useNuxtApp()

const operations = ref<StockOperation[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

// Позиция предмета в операции может отличаться от самой операции (сканер мог
// попасть в чужой товар), поэтому в списке по предмету показываем только
// строку этого предмета, а не сумму всей операции.
function rowsOf(op: StockOperation) {
  return op.rows.filter((row) => row.item_id === props.itemId)
}

function mineOf(op: StockOperation): number {
  return rowsOf(op).reduce((sum, row) => sum + row.quantity, 0)
}

function returnedOf(op: StockOperation): number {
  return rowsOf(op).reduce((sum, row) => sum + row.reversed_quantity, 0)
}

const summary = computed(() => ({
  writeoff: {
    units: operations.value
      .filter((op) => op.direction === 'writeoff')
      .reduce((sum, op) => sum + mineOf(op), 0),
  },
  replenish: {
    units: operations.value
      .filter((op) => op.direction === 'replenish')
      .reduce((sum, op) => sum + mineOf(op), 0),
  },
  reversals: operations.value.filter((op) => op.is_reversal).length,
}))

/** «было → стало» по строке предмета в последней (самой новой) операции. */
function balanceOf(op: StockOperation): string {
  const row = rowsOf(op).at(-1)
  if (!row || row.before == null || row.after == null) return ''
  return `${row.before} → ${row.after}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU')
}

async function load(page = 1) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.stockOperation.forItem(props.itemId, { page, per_page: 50 })
    operations.value = result.data
    meta.value = { current_page: result.meta.current_page, last_page: result.meta.last_page }
  } catch (err: any) {
    error.value = formatApiError(err, 'Ошибка загрузки движений')
  } finally {
    loading.value = false
  }
}

onMounted(() => load(1))
</script>

<style scoped>
.mvlist__state {
  padding: 16px;
  color: #888;
}

.mvlist__state--error {
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
}

.mvlist__sum {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #888;
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
}

.mvlist__sum-item b {
  color: #ddd;
}

.mvlist__table {
  width: 100%;
  border-collapse: collapse;
}

.mvlist__table th,
.mvlist__table td {
  padding: 7px 10px;
  text-align: left;
  font-size: 14px;
  border-bottom: 1px solid #2b2b2b;
}

.mvlist__table th {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
}

.mvlist__table td {
  color: #ccc;
}

.mvlist__row--return td {
  color: #9cb8ba;
}

.mvlist__cell-date {
  white-space: nowrap;
  color: #999;
  font-size: 13px;
}

.mvlist__cell-kind {
  white-space: nowrap;
}

.mvlist__cell-comment {
  color: #bbb;
}

.mvlist__cell-qty,
.mvlist__cell-balance {
  white-space: nowrap;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.mvlist__sign {
  font-weight: 700;
}

.mvlist__sign--replenish {
  color: #3fb950;
}

.mvlist__sign--writeoff {
  color: #d29922;
}

.mvlist__tag {
  margin-left: 6px;
  font-size: 12px;
  color: #6d8f92;
}

.mvlist__returned {
  margin-left: 8px;
  font-size: 12px;
  color: #6d8f92;
}

.mvlist__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 14px;
}

.mvlist__page {
  padding: 4px 12px;
  font-size: 13px;
  color: #ccc;
  background: #333;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.mvlist__page:disabled {
  opacity: 0.4;
  cursor: default;
}

.mvlist__page-info {
  font-size: 13px;
  color: #888;
}
</style>
