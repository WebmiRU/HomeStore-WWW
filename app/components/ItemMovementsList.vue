<template>
  <div class="mvlist">
    <div v-if="loading" class="mvlist__state">{{ t('form.loading') }}</div>
    <div v-else-if="error" class="mvlist__state mvlist__state--error">{{ error }}</div>
    <div v-else-if="!operations.length" class="mvlist__state">
      {{ t('item_movements.empty') }}
    </div>

    <template v-else>
      <!--
        Сводка по штукам у расходуемого предмета показывала бы нули: списали
        350 мл из бутылки, штуки не сдвинулись. Поэтому у него своя сводка —
        сумма расхода по каждому свойству. Штуки и доли свойств складывать
        нельзя, они несводимы.
      -->
      <div v-if="spentSummary.length" class="mvlist__sum">
        <!--
          Префикс «расход по свойству» один на весь список: повторять его у
          каждого свойства незачем, он и так стоит в заголовке блока.
        -->
        <span class="mvlist__sum-item">
          {{ t('movements.partial_amount') }}:
          <template v-for="(row, i) in spentSummary" :key="row.property_id">
            <span v-if="i > 0">; </span>{{ row.title }}
            <b>−{{ row.writeoff }}</b>
            <span class="mvlist__sum-dim">/ +{{ row.replenish }}</span>
          </template>
        </span>
        <span class="mvlist__sum-item">
          {{ t('movements.reversals') }}: <b>{{ summary.reversals }}</b>
        </span>
      </div>
      <div v-else class="mvlist__sum">
        <span class="mvlist__sum-item">{{ t('main.done_writeoff') }}: <b>{{ summary.writeoff.units }}</b> {{ t('units.pcs') }}</span>
        <span class="mvlist__sum-item">{{ t('main.done_replenish') }}: <b>{{ summary.replenish.units }}</b> {{ t('units.pcs') }}</span>
        <span class="mvlist__sum-item">{{ t('movements.reversals') }}: <b>{{ summary.reversals }}</b></span>
      </div>

      <table class="mvlist__table">
        <thead>
          <tr>
            <th>{{ t('item_movements.date') }}</th>
            <th>{{ t('item_movements.operation') }}</th>
            <th>{{ t('item_movements.comment') }}</th>
            <th>{{ t('form.quantity') }}</th>
            <th>{{ t('item_movements.remainder') }}</th>
            <th>{{ t('journal.actor') }}</th>
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
              <span v-if="op.is_reversal" class="mvlist__tag">{{ t('item_movements.reversal_of', { id: op.reversed_operation_id }) }}</span>
            </td>
            <td class="mvlist__cell-comment">{{ op.comment || '—' }}</td>
            <td class="mvlist__cell-qty">
              <!--
                Строка частичного расхода показывается по свойству: штуки у неё
                не обязаны меняться, а человек смотрит сюда за тем, сколько
                расхода ушло. Складывать 300 мл сиропа с 20 кг риса в одно
                число бессмысленно, поэтому строки идут списком.
              -->
              <span v-if="partialsOf(op).length" class="mvlist__partials">
                <span v-for="row in partialsOf(op)" :key="row.id" class="mvlist__partial">
                  {{ row.property_title }}: {{ op.direction === 'replenish' ? '+' : '−' }}{{ row.amount }}
                </span>
              </span>
              <template v-else>{{ mineOf(op) }}</template>
              <!--
                У частичной строки показывается возвращённый расход числом, а не
                номер возврата: возвращённое там дробное, и сумма по штукам
                давала «возврат №0» — ни о чём не говорящую строку.
              -->
              <span v-if="reversedPartial(op) !== null" class="mvlist__returned">
                {{ t('movements.partial_returned', { amount: reversedPartial(op) ?? 0 }) }}
                <span class="mvlist__returned-by">
                  ({{ returnedByTitle(op) }})
                </span>
              </span>
              <span v-else-if="op.rows.some((r) => r.is_returned)" class="mvlist__returned">
                {{ t('item_movements.reversal_of', { id: reversalOf(op) }) }}
              </span>
            </td>
            <td class="mvlist__cell-balance">
              <span v-if="partialsOf(op).length" class="mvlist__partial">
                {{ t('item_movements.by_property') }}: {{ balanceOf(op) }}
              </span>
              <span v-else-if="balanceOf(op)">{{ balanceOf(op) }}</span>
              <span v-else>—</span>
            </td>
            <!--
              Кто провёл операцию — ссылкой на его карточку. Имя само по себе
              отвечает на вопрос «чей это расход», но не отвечает на следующий:
              «а он вообще что делает в системе». Ссылка ведёт туда, где это
              видно.
            -->
            <td class="mvlist__cell-author">
              <NuxtLink v-if="op.author" :to="`/users/${op.author.id}`" class="mvlist__author">{{ op.author.name }}</NuxtLink>
              <span v-else class="muted">—</span>
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
const { t } = useI18n()

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

/**
 * Сумма штук по предмету в операции.
 *
 * Строки частичного расхода не в счёт: у них quantity — это число списавшихся
 * штук, а не сам расход, и складывать их с настоящими штуками значило бы
 * показать в шапке число, которого на складе никогда не было.
 */
function mineOf(op: StockOperation): number {
  return rowsOf(op)
    .filter((row) => !row.is_partial)
    .reduce((sum, row) => sum + row.quantity, 0)
}

/**
 * Сводка расхода по свойствам: сколько списано и сколько возвращено.
 *
 * Отдельно по каждому свойству, потому что складывать 350 мл сиропа с 200 кг
 * риса в одно число бессмысленно — получится величина, которой нигде нет.
 * Пустая сводка означает обычный предмет, и тогда показываются штуки.
 */
const spentSummary = computed(() => {
  const totals = new Map<number, { title: string; writeoff: number; replenish: number }>()

  for (const op of operations.value) {
    for (const row of rowsOf(op)) {
      if (!row.is_partial || row.property_id === null) continue

      const entry = totals.get(row.property_id) ?? {
        title: row.property_title ?? String(row.property_id),
        writeoff: 0,
        replenish: 0,
      }
      const amount = row.amount ?? 0

      if (op.direction === 'writeoff') entry.writeoff += amount
      else entry.replenish += amount

      totals.set(row.property_id, entry)
    }
  }

  return [...totals.entries()]
    .map(([property_id, value]) => ({ property_id, ...value }))
    .sort((a, b) => a.title.localeCompare(b.title))
})

/** Строки частичного расхода по этому предмету: по ним показывается расход. */
function partialsOf(op: StockOperation) {
  return rowsOf(op).filter((row) => row.is_partial)
}

/** Возвращено по частичным строкам операции, либо null, если возврата не было. */
function reversedPartial(op: StockOperation): number | null {
  const sum = partialsOf(op).reduce((total, row) => total + (row.reversed_amount ?? 0), 0)

  return sum > 0 ? Math.round(sum * 1000) / 1000 : null
}

/** Названия свойств, по которым был возврат: смешивать их в одну строку нельзя. */
function returnedByTitle(op: StockOperation): string {
  return partialsOf(op)
    .filter((row) => (row.reversed_amount ?? 0) > 0)
    .map((row) => row.property_title ?? String(row.property_id))
    .join(', ')
}

/** Всего списано по частичным строкам операции. */
function spentTotal(op: StockOperation): number {
  const sum = partialsOf(op).reduce((total, row) => total + (row.amount ?? 0), 0)

  return Math.round(sum * 1000) / 1000
}

/** Откуда эта строка — возврат: номер строки исходной операции. */
function reversalOf(op: StockOperation): number {
  const partial = partialsOf(op).find((row) => row.source_row_id)

  return partial?.source_row_id ?? returnedOf(op)
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
/**
 * «было → стало» по строке предмета в последней (самой новой) операции.
 *
 * У частичного расхода показывается остаток по свойству, а не по штукам: ради
 * расхода этот список и открывают, а «2 → 2» не сказал бы ничего.
 */
function balanceOf(op: StockOperation): string {
  const partial = partialsOf(op).at(-1)
  if (partial) {
    if (partial.property_before == null) return ''
    return `${partial.property_before} → ${partial.property_after ?? 0}`
  }

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
    error.value = formatApiError(err, t('item_movements.load_failed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => load(1))
</script>

<style scoped>
.mvlist__state {
  padding: 16px;
  color: var(--text-muted);
}

.mvlist__state--error {
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 4px;
}

.mvlist__sum {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.mvlist__sum-item b {
  color: var(--text);
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
  border-bottom: 1px solid var(--border);
}

.mvlist__table th {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.mvlist__table td {
  color: var(--text-secondary);
}

.mvlist__row--return td {
  color: var(--info-ink);
}

.mvlist__cell-date {
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 13px;
}

.mvlist__cell-kind {
  white-space: nowrap;
}

.mvlist__cell-comment {
  color: var(--text-secondary);
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
  color: var(--success);
}

.mvlist__sign--writeoff {
  color: var(--warn);
}

.mvlist__tag {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text-dim);
}

/*
 * Расход по свойству — с блоком, приглушённым цветом и своим шрифтом: это
 * подпись к движению, а не само значение количества, и в общей колонке оно
 * слилось бы с числами штук.
 */
.mvlist__partials {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mvlist__partial {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
}

.mvlist__sum-dim {
  margin-left: 4px;
}

.mvlist__returned {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-dim);
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
  color: var(--text-secondary);
  background: var(--bg-hover);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.mvlist__page:disabled {
  opacity: 0.4;
  cursor: default;
}

.mvlist__page-info {
  font-size: 13px;
  color: var(--text-muted);
}
/*
 * Ссылка на автора операции: тот же вид, что у ссылок в списках предметов и
 * складах, иначе колонка выглядит частью текста, а не переходом.
 */
.mvlist__cell-author {
  white-space: nowrap;
}

.mvlist__author {
  color: var(--link);
  text-decoration: none;
}

.mvlist__author:hover {
  text-decoration: underline;
}
</style>
