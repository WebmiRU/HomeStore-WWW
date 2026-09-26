<template>
  <div class="mv-page">
    <div class="page-header">
      <h3 class="page-title">Списания и пополнения</h3>
    </div>

    <div class="mv-controls">
      <div class="preset-row">
        <span class="control-label">Период:</span>
        <button
          v-for="preset in periodPresets"
          :key="preset.value"
          type="button"
          class="ctl-btn"
          :class="{ active: period === preset.value }"
          @click="setPeriod(preset.value)"
        >
          {{ preset.label }}
        </button>

        <div v-if="period === 'custom'" class="control-group">
          <input v-model="dateFrom" type="date" class="ctl-input" />
          <span class="control-label">—</span>
          <input v-model="dateTo" type="date" class="ctl-input" />
        </div>
      </div>

      <div class="preset-row">
        <div class="control-group">
          <span class="control-label">Направление:</span>
          <select v-model="direction" class="ctl-select" @change="applyFilters">
            <option value="">Любое</option>
            <option value="replenish">Пополнение</option>
            <option value="writeoff">Списание</option>
          </select>
        </div>

        <div class="control-group">
          <span class="control-label">Состояние:</span>
          <button
            type="button"
            class="ctl-btn"
            :class="{ active: !onlyActive && !onlyReversed && !onlyReversals }"
            @click="setState('all')"
          >
            Все
          </button>
          <button
            type="button"
            class="ctl-btn"
            :class="{ active: onlyActive }"
            @click="setState('active')"
          >
            Без отката
          </button>
          <button
            type="button"
            class="ctl-btn"
            :class="{ active: onlyReversed }"
            @click="setState('reversed')"
          >
            Откаченные
          </button>
          <button
            type="button"
            class="ctl-btn"
            :class="{ active: onlyReversals }"
            @click="setState('reversals')"
          >
            Только возвраты
          </button>
        </div>

        <div class="control-group control-group--grow">
          <input
            v-model.trim="comment"
            type="search"
            class="ctl-input ctl-input--search"
            placeholder="Поиск по комментарию"
            @keyup.enter="applyFilters"
          />
          <button type="button" class="ctl-btn" @click="applyFilters">Найти</button>
          <button
            v-if="hasCustomFilters"
            type="button"
            class="ctl-btn ctl-btn--reset"
            @click="resetFilters"
          >
            Сбросить
          </button>
        </div>
      </div>
    </div>

    <div class="mv-summary">
      <div class="sum-card sum-card--writeoff">
        <div class="sum-card__label">Списано</div>
        <div class="sum-card__units">{{ summary?.writeoff.units ?? 0 }} шт.</div>
        <div class="sum-card__ops">{{ summary?.writeoff.operations ?? 0 }} операций</div>
      </div>
      <div class="sum-card sum-card--replenish">
        <div class="sum-card__label">Пополнено</div>
        <div class="sum-card__units">{{ summary?.replenish.units ?? 0 }} шт.</div>
        <div class="sum-card__ops">{{ summary?.replenish.operations ?? 0 }} операций</div>
      </div>
      <div class="sum-card">
        <div class="sum-card__label">Отката</div>
        <div class="sum-card__units">{{ summary?.reversed ?? 0 }}</div>
        <div class="sum-card__ops">возвратов: {{ summary?.reversals ?? 0 }}</div>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="!operations.length" class="empty">Операций нет</div>

    <div v-else class="mv-list">
      <article
        v-for="op in operations"
        :key="op.id"
        class="mv-card"
        :class="[
          `mv-card--${op.direction}`,
          op.is_reversal ? 'mv-card--return' : '',
          op.is_reversed ? 'mv-card--reversed' : '',
        ]"
      >
        <header class="mv-card__head">
          <span class="mv-card__sign">{{ signOf(op.direction) }}</span>
          <span class="mv-card__title">{{ op.direction_label }}</span>
          <span class="mv-card__num">№{{ op.id }}</span>

          <span v-if="op.is_reversal" class="mv-badge mv-badge--return">
            Возврат операции №{{ op.reversed_operation_id }}
          </span>
          <span v-else-if="op.is_reversed" class="mv-badge mv-badge--reversed">Откачена</span>

          <span class="mv-card__spacer" />

          <span v-if="op.author" class="mv-card__author">{{ op.author.name }}</span>
          <time class="mv-card__time">{{ formatDate(op.created_at) }}</time>
        </header>

        <p v-if="op.comment" class="mv-card__comment">{{ op.comment }}</p>
        <p v-else class="mv-card__comment mv-card__comment--empty">Без комментария</p>

        <table class="mv-rows">
          <tbody>
            <tr v-for="row in op.rows" :key="row.id" class="mv-row">
              <td class="mv-row__title">
                <NuxtLink v-if="row.item_id" :to="`/items/${row.item_id}/edit`" class="mv-row__link">
                  {{ row.item_title }}
                </NuxtLink>
                <span v-else class="mv-row__plain">{{ row.item_title }}</span>
                <span v-if="!row.item_id" class="mv-row__gone">(предмет удалён)</span>
              </td>
              <td class="mv-row__qty">
                <span class="mv-row__delta">{{ signOf(op.direction) }}{{ row.quantity }}</span>
              </td>
              <td class="mv-row__balance">
                <span v-if="row.before != null">{{ row.before }} → {{ row.after }}</span>
                <span v-else>—</span>
              </td>
              <td class="mv-row__returned">
                <span v-if="row.is_returned" class="mv-row__return-note">
                  возвращено {{ row.reversed_quantity }} из {{ row.quantity }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <footer v-if="canReverse(op)" class="mv-card__foot">
          <button type="button" class="mv-reverse-btn" @click="openReverse(op)">
            Вернуть
          </button>
          <span v-if="totalRemaining(op) < totalQuantity(op)" class="mv-card__foot-hint">
            уже возвращено {{ totalQuantity(op) - totalRemaining(op) }} из {{ totalQuantity(op) }}
          </span>
        </footer>
      </article>
    </div>

    <div v-if="!loading && meta.last_page > 1" class="pagination">
      <button
        type="button"
        class="page-btn"
        :disabled="meta.current_page <= 1"
        @click="goToPage(meta.current_page - 1)"
      >
        ← Назад
      </button>
      <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
      <button
        type="button"
        class="page-btn"
        :disabled="meta.current_page >= meta.last_page"
        @click="goToPage(meta.current_page + 1)"
      >
        Вперёд →
      </button>
    </div>

    <!-- Форма отката: выборочный, по строкам и по количеству -->
    <div v-if="reversing" class="modal-backdrop" @click.self="closeReverse">
      <div class="modal">
        <div class="modal__head">
          <span class="modal__title">Возврат операции №{{ reversing.id }}</span>
          <button type="button" class="modal__close" aria-label="Закрыть" @click="closeReverse">×</button>
        </div>

        <p class="modal__lead">
          {{ reversing.direction_label }} на {{ totalQuantity(reversing) }} шт.
          {{ reverseEffect }}
        </p>

        <table class="modal__rows">
          <tbody>
            <tr v-for="row in reversibleRows" :key="row.id" class="modal__row">
              <td class="modal__row-check">
                <input
                  v-model="selection[row.id].on"
                  type="checkbox"
                  :aria-label="`Вернуть ${row.item_title}`"
                />
              </td>
              <td class="modal__row-title">{{ row.item_title }}</td>
              <td class="modal__row-qty">
                <label :for="`rev-${row.id}`" class="modal__row-label">
                  {{ row.remaining }} из {{ row.quantity }}
                </label>
                <input
                  :id="`rev-${row.id}`"
                  v-model.number="selection[row.id].quantity"
                  type="number"
                  min="1"
                  :max="row.remaining"
                  class="modal__row-input"
                  :disabled="!selection[row.id].on"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div class="modal__field">
          <label class="modal__label" for="rev-comment">Комментарий</label>
          <input
            id="rev-comment"
            v-model.trim="reverseComment"
            type="text"
            class="modal__input"
            :placeholder="reverseCommentPlaceholder"
          />
        </div>

        <p v-if="reverseError" class="modal__error">{{ reverseError }}</p>

        <div class="modal__actions">
          <button type="button" class="btn-plain" :disabled="reversingBusy" @click="closeReverse">
            Отмена
          </button>
          <button
            type="button"
            class="btn-confirm"
            :disabled="reversingBusy || selectedCount === 0"
            @click="confirmReverse"
          >
            {{ reversingBusy ? 'Возвращаем…' : 'Вернуть' }}
            <template v-if="selectedCount"> ({{ selectedCount }})</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type {
  StockDirectionValue,
  StockOperation,
  StockOperationSummary,
} from '~/repository/modules/stockOperation'

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()

const operations = ref<StockOperation[]>([])
const summary = ref<StockOperationSummary | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

const period = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const direction = ref<StockDirectionValue | ''>('')
const comment = ref('')
const onlyActive = ref(false)
const onlyReversed = ref(false)
const onlyReversals = ref(false)

const periodPresets = [
  { value: '', label: 'Всё время' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'custom', label: 'Свои даты' },
]

const hasCustomFilters = computed(
  () =>
    period.value !== '' ||
    direction.value !== '' ||
    comment.value !== '' ||
    onlyActive.value ||
    onlyReversed.value ||
    onlyReversals.value
)

function currentFilters() {
  return {
    period: period.value as never,
    date_from: dateFrom.value || undefined,
    date_to: dateTo.value || undefined,
    direction: direction.value || undefined,
    comment: comment.value || undefined,
    only_active: onlyActive.value || undefined,
    only_reversed: onlyReversed.value || undefined,
    only_reversals: onlyReversals.value || undefined,
  }
}

async function load(page?: number) {
  loading.value = true
  error.value = null
  try {
    const filters = currentFilters()
    const result = await $api.stockOperation.list({ ...filters, page })
    operations.value = result.data
    meta.value = { current_page: result.meta.current_page, last_page: result.meta.last_page }
    // Сводка с теми же фильтрами, но без страницы: иначе в шапке считались бы
    // только операции текущей страницы.
    summary.value = await $api.stockOperation.summary(filters)
  } catch (err: any) {
    error.value = formatApiError(err, 'Ошибка загрузки журнала')
  } finally {
    loading.value = false
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (period.value) query.period = period.value
  if (dateFrom.value) query.date_from = dateFrom.value
  if (dateTo.value) query.date_to = dateTo.value
  if (direction.value) query.direction = direction.value
  if (comment.value) query.comment = comment.value
  if (onlyActive.value) query.only_active = '1'
  if (onlyReversed.value) query.only_reversed = '1'
  if (onlyReversals.value) query.only_reversals = '1'
  router.push({ query })
}

function applyFilters() {
  syncQuery()
  load(1)
}

function setPeriod(value: string) {
  period.value = value
  if (value === 'custom' && !dateFrom.value && !dateTo.value) {
    // Свои даты без границ — это «всё время» с двумя лишними кнопками:
    // подставляем текущий месяц, дальше пользователь поправит.
    const now = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    dateTo.value = iso(now)
    dateFrom.value = iso(new Date(now.getFullYear(), now.getMonth(), 1))
  }
  applyFilters()
}

function setState(state: 'all' | 'active' | 'reversed' | 'reversals') {
  onlyActive.value = state === 'active'
  onlyReversed.value = state === 'reversed'
  onlyReversals.value = state === 'reversals'
  applyFilters()
}

function resetFilters() {
  period.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  direction.value = ''
  comment.value = ''
  onlyActive.value = false
  onlyReversed.value = false
  onlyReversals.value = false
  applyFilters()
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

function signOf(dir: StockDirectionValue): string {
  return dir === 'replenish' ? '+' : '−'
}

function totalQuantity(op: StockOperation): number {
  return op.rows.reduce((sum, row) => sum + row.quantity, 0)
}

function totalRemaining(op: StockOperation): number {
  return op.rows.reduce((sum, row) => sum + row.remaining, 0)
}

/** Откат доступен у обычной операции, у которой что-то ещё можно вернуть. */
function canReverse(op: StockOperation): boolean {
  return !op.is_reversal && totalRemaining(op) > 0
}

const reversibleRows = computed(() =>
  reversing.value ? reversing.value.rows.filter((row) => row.remaining > 0) : []
)

// ── Форма отката ───────────────────────────────────────────────────────────
const reversing = ref<StockOperation | null>(null)
const reversingBusy = ref(false)
const reverseError = ref<string | null>(null)
const reverseComment = ref('')
const selection = reactive<Record<number, { on: boolean; quantity: number }>>({})

const selectedCount = computed(
  () => reversibleRows.value.filter((row) => selection[row.id]?.on).length
)

const reverseCommentPlaceholder = computed(() =>
  reversing.value?.direction === 'writeoff'
    ? 'Например: вернули на склад, приёмка №4'
    : 'Например: ошибочно приняли, товар числится за другим'
)

// Что произойдёт с остатком. Откат меняет направление на противоположное:
// откат списания возвращает товар, откат пополнения — забирает его.
// Раньше здесь стоял один текст на оба случая, и для пополнения он врал.
const reverseEffect = computed(() =>
  reversing.value?.direction === 'writeoff'
    ? 'Возврат вернёт товар на склад.'
    : 'Возврат заберёт товар со склада — ошибочно принятый приход отыгрывается.'
)

function openReverse(op: StockOperation) {
  reversing.value = op
  reverseError.value = null
  reverseComment.value = ''
  // По умолчанию отмечены все строки целиком: чаще всего возвращают именно
  // так, а лишние галочки снимаются за секунду — обратное (пустая форма)
  // заставляет кликать по каждой строке.
  for (const row of op.rows) {
    selection[row.id] = { on: row.remaining > 0, quantity: row.remaining }
  }
}

function closeReverse() {
  if (reversingBusy.value) return
  reversing.value = null
  reverseError.value = null
}

async function confirmReverse() {
  const op = reversing.value
  if (!op) return

  const rows = reversibleRows.value
    .filter((row) => selection[row.id]?.on)
    .map((row) => ({ row_id: row.id, quantity: Number(selection[row.id].quantity) }))

  if (rows.length === 0) return

  reversingBusy.value = true
  reverseError.value = null
  try {
    const result = await $api.stockOperation.reverse(op.id, {
      rows,
      comment: reverseComment.value || null,
    })
    $notify.add(
      `${result.direction_label}: возврат операции №${op.id} — ${rows.length} строк`,
      { type: 'success', timer: 6 }
    )
    reversing.value = null
    await load(meta.value.current_page)
  } catch (err: any) {
    reverseError.value = formatApiError(err, 'Не удалось выполнить возврат')
  } finally {
    reversingBusy.value = false
  }
}

// Фильтры живут в адресе: ссылкой на журнал можно поделиться, и кнопка
// «назад» возвращает к прошлым фильтрам, а не к пустому журналу.
watch(
  () => route.query,
  () => {
    period.value = (route.query.period as string) ?? ''
    dateFrom.value = (route.query.date_from as string) ?? ''
    dateTo.value = (route.query.date_to as string) ?? ''
    direction.value = (route.query.direction as StockDirectionValue) ?? ''
    comment.value = (route.query.comment as string) ?? ''
    onlyActive.value = route.query.only_active === '1'
    onlyReversed.value = route.query.only_reversed === '1'
    onlyReversals.value = route.query.only_reversals === '1'
    load(Number(route.query.page) || 1)
  },
  { immediate: true, deep: true }
)
</script>

<style scoped>
.page-header {
  margin-bottom: 14px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: #ccc;
}

.mv-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.preset-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-group--grow {
  flex: 1;
  min-width: 260px;
}

.control-label {
  font-size: 13px;
  color: #777;
}

.ctl-btn {
  padding: 5px 12px;
  font-size: 13px;
  background: #2a2a2a;
  color: #aaa;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.ctl-btn:hover {
  background: #333;
  color: #ddd;
}

.ctl-btn.active {
  background: #2a2a3a;
  color: #aaf;
  border-color: #3a3a5a;
}

.ctl-btn--reset {
  color: #a88;
  border-color: #4a3a3a;
}

.ctl-select,
.ctl-input {
  padding: 5px 10px;
  font-size: 13px;
  font-family: inherit;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
}

.ctl-input--search {
  flex: 1;
  min-width: 0;
}

.mv-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.sum-card {
  padding: 12px 14px;
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 10px;
}

.sum-card--writeoff {
  border-left: 3px solid #d29922;
}

.sum-card--replenish {
  border-left: 3px solid #3fb950;
}

.sum-card__label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.sum-card__units {
  font-size: 22px;
  font-weight: 700;
  color: #ddd;
  margin-top: 4px;
}

.sum-card__ops {
  font-size: 12px;
  color: #777;
  margin-top: 2px;
}

.mv-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mv-card {
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 10px;
  padding: 12px 14px;
}

.mv-card--reversed {
  opacity: 0.72;
}

.mv-card__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.mv-card__spacer {
  flex: 1;
}

.mv-card__sign {
  font-size: 16px;
  font-weight: 700;
  width: 18px;
  text-align: center;
}

.mv-card--replenish .mv-card__sign {
  color: #3fb950;
}

.mv-card--writeoff .mv-card__sign {
  color: #d29922;
}

.mv-card__title {
  font-size: 15px;
  font-weight: 600;
  color: #ddd;
}

.mv-card__num,
.mv-card__author,
.mv-card__time {
  font-size: 12px;
  color: #777;
}

.mv-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
}

.mv-badge--return {
  color: #9cb8ba;
  background: #1b3d40;
  border-color: #2e5b5f;
}

.mv-badge--reversed {
  color: #bbb;
  background: #262626;
  border-color: #3a3a3a;
}

.mv-card__comment {
  margin: 8px 0;
  font-size: 14px;
  color: #ccc;
}

.mv-card__comment--empty {
  color: #5f5f5f;
  font-style: italic;
}

.mv-rows {
  width: 100%;
  border-collapse: collapse;
}

.mv-row td {
  padding: 5px 8px 5px 0;
  font-size: 14px;
  border-top: 1px solid #262626;
  vertical-align: top;
}

.mv-row__title {
  color: #ccc;
}

.mv-row__link {
  color: #8ab4f8;
  text-decoration: none;
}

.mv-row__link:hover {
  text-decoration: underline;
}

.mv-row__plain {
  color: #999;
}

.mv-row__gone {
  font-size: 12px;
  color: #666;
  margin-left: 6px;
}

.mv-row__qty {
  width: 90px;
  text-align: right;
  font-weight: 600;
}

.mv-row__balance {
  width: 120px;
  text-align: right;
  color: #888;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.mv-row__return-note {
  font-size: 12px;
  color: #9cb8ba;
}

.mv-card__foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #262626;
}

.mv-reverse-btn {
  padding: 6px 16px;
  font-size: 13px;
  font-family: inherit;
  color: #c4f0f4;
  background: #1b3d40;
  border: 1px solid #2e5b5f;
  border-radius: 4px;
  cursor: pointer;
}

.mv-reverse-btn:hover {
  background: #23494c;
}

.mv-card__foot-hint {
  font-size: 12px;
  color: #777;
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

/* ── Модалка возврата ─────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal {
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 18px 20px;
}

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.modal__title {
  font-size: 16px;
  font-weight: 600;
  color: #ddd;
}

.modal__close {
  background: none;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: #888;
  cursor: pointer;
  padding: 0 4px;
}

.modal__close:hover {
  color: #ddd;
}

.modal__lead {
  font-size: 13px;
  color: #999;
  margin: 0 0 14px;
}

.modal__rows {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 14px;
}

.modal__row td {
  padding: 6px 8px 6px 0;
  border-top: 1px solid #262626;
  font-size: 14px;
  color: #ccc;
}

.modal__row-check {
  width: 28px;
}

.modal__row-qty {
  width: 130px;
  text-align: right;
}

.modal__row-label {
  display: block;
  font-size: 11px;
  color: #777;
  margin-bottom: 3px;
}

.modal__row-input {
  width: 70px;
  padding: 5px 8px;
  font-size: 14px;
  font-family: inherit;
  color: #e6e6e6;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  text-align: right;
}

.modal__row-input:disabled {
  opacity: 0.4;
}

.modal__field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
}

.modal__label {
  font-size: 12px;
  color: #888;
}

.modal__input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #e6e6e6;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
}

.modal__error {
  margin: 0 0 12px;
  padding: 8px 10px;
  font-size: 13px;
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
}

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-plain {
  padding: 8px 16px;
  font-size: 14px;
  font-family: inherit;
  color: #bbb;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  cursor: pointer;
}

.btn-plain:hover:not(:disabled) {
  background: #333;
}

.btn-confirm {
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  color: #c4f0f4;
  background: #1b3d40;
  border: 1px solid #2e5b5f;
  border-radius: 6px;
  cursor: pointer;
}

.btn-confirm:hover:not(:disabled) {
  background: #23494c;
}

.btn-confirm:disabled,
.btn-plain:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
