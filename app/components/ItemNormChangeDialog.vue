<template>
  <div class="modal-backdrop" @click.self="cancel">
    <div class="modal">
      <div class="modal__head">
        <span class="modal__title">{{ t('norm_change.title') }}</span>
        <button type="button" class="modal__close" :aria-label="t('common.close')" @click="cancel">×</button>
      </div>

      <p class="modal__lead">
        {{ t('norm_change.lead') }}
      </p>

      <table class="norm-change__table">
        <tbody>
          <tr v-for="row in rows" :key="row.property_id">
            <td class="norm-change__name">{{ row.title }}</td>
            <td class="norm-change__change">
              {{ formatAmount(row.from) }} → {{ formatAmount(row.to) }} {{ row.unit ?? '' }}
            </td>
            <td class="norm-change__now">{{ t('norm_change.now') }}: {{ formatAmount(row.current) }} {{ row.unit ?? '' }}</td>
          </tr>
        </tbody>
      </table>

      <!--
        Два варианта — потому что по карточке не видно, что было на уме: то ли
        человек ошибся при вводе (написал 1000 вместо 100), то ли ошибка в
        другом месте (в ящике оказалось не 10 литров, а 10 бутылок по 100 мл).

        Под каждым вариантом стоит результат числами: «8 шт, Объём 35 000 мл,
        Вес нетто 748 г». Без них выбор остаётся гаданием — из названий режимов
        не видно ни во сколько штук выльется, ни сколько товара получится.
        Считает сервер: формула принадлежит ему, и клиент, посчитавший её у
        себя по памяти, показал бы одно, а сделал бы другое.
      -->
      <div class="norm-change__choice">
        <label
          v-for="option in options"
          :key="option.value"
          class="norm-change__option"
          :class="{ 'norm-change__option--off': !option.fits }"
        >
          <input v-model="mode" type="radio" :value="option.value" :disabled="!option.fits">
          <span>
            <b>{{ option.title }}</b>
            <span class="norm-change__option-hint">{{ option.hint }}</span>
            <span class="norm-change__result">
              <span class="norm-change__result-line">
                {{ t('norm_change.will_be') }}:&nbsp;<b class="norm-change__num">{{ option.quantity }}</b>&nbsp;{{ t('norm_change.pieces') }}
              </span>
              <span v-for="line in option.lines" :key="line.property_id" class="norm-change__result-line">
                {{ line.title }}:&nbsp;<b class="norm-change__num">{{ line.stock }}</b>&nbsp;{{ line.unit }}
              </span>
            </span>
            <!--
              Вариант, при котором остаток в штуки не помещается, нельзя
              выбирать: он раздул бы запас молча, и человек узнал бы об этом
              только потом, увидев неверные числа. Объяснение прямо под ним.
            -->
            <span v-if="!option.fits" class="norm-change__warning">
              {{ t('norm_change.does_not_fit') }}
            </span>
          </span>
        </label>

        <label class="norm-change__option" :class="{ 'norm-change__option--on': mode === 'custom' }">
          <input v-model="mode" type="radio" value="custom">
          <span>
            <b>{{ t('norm_change.custom') }}</b>
            <span class="norm-change__option-hint">{{ t('norm_change.custom_hint') }}</span>
          </span>
        </label>
      </div>

      <!--
        Свои числа: человек вписывает, сколько штук и сколько всего, а норма
        выводится сама. Единственный выход, когда норма ошиблась полностью —
        например, в ящике оказалось 200 бутылок по 200 мл, а введено было
        «10 000». Никакой выбор из двух готовых вариантов это не лечит, потому
        что оба считаются от неверной нормы.
      -->
      <div v-if="mode === 'custom'" class="norm-change__actual">
        <label class="modal__field">
          <span class="modal__label">{{ t('norm_change.actual_quantity') }}</span>
          <input v-model.number="actualQuantity" type="number" class="modal__input" min="0" step="1">
        </label>
        <label v-for="row in rows" :key="row.property_id" class="modal__field">
          <span class="modal__label">
            {{ row.title }}: {{ t('norm_change.actual_total') }}, {{ row.unit ?? '' }}
          </span>
          <input
            v-model.number="actualTotals[row.property_id]"
            type="number"
            class="modal__input"
            min="0"
            step="any"
          >
        </label>
        <p v-if="actualPreview" class="norm-change__actual-note" :class="{ 'norm-change__actual-note--bad': actualHintBad }">
          {{ actualPreview }}
        </p>
      </div>

      <p v-if="error" class="modal__error">{{ error }}</p>

      <div class="modal__actions">
        <button type="button" class="btn-plain" @click="cancel">{{ t('common.cancel') }}</button>
        <button type="button" class="btn-confirm" :disabled="!canApply" @click="apply">{{ t('norm_change.apply') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Выбор при смене нормы расходуемого свойства.
 *
 * Модалка не «спрашивает разрешения», а показывает последствия числами: объём
 * и число штук связаны через норму, и смена одного меняет другое. Угадывать, что
 * человек имел в виду, сервер не может, поэтому вариантов ровно два и у каждого
 * подписан результат.
 *
 * Свойств в наборе может быть несколько, и расти и падать они могут в разные
 * стороны. Число штук у предмета одно и считается оно как большее из
 * отмеченных, поэтому исходы приходят уже посчитанными целиком — по одному
 * свойству «2 шт» и «8 шт» выглядели бы опечаткой, а не разными будущими.
 */
import { computed, ref, watch } from 'vue'
import { formatAmount } from '~/utils/amount'

export type NormChangeRow = {
  property_id: number
  title: string
  from: number
  to: number
  current: number
  unit?: string | null
  /** Что получится при каждом из двух вариантов — считает сервер. */
  outcomes?: Record<'recalculate' | 'keep', { quantity: number; stock: number }>
}

const props = defineProps<{
  rows: NormChangeRow[]
}>()

export type NormDecision = 'recalculate' | 'keep' | 'custom'

const emit = defineEmits<{
  (e: 'cancel'): void
  /**
   * Решение по нормам. При custom заодно уходят фактические числа: что вписано
   * и что из этого выйдет, сервер проверяет сам и откажет, если числа
   * несовместимы (5 штук по 10 000 при 4 500 на руках).
   */
  (e: 'apply', mode: NormDecision, actual: { quantity: number; properties: Record<number, number> } | null): void
}>()

const { t } = useI18n()

// По умолчанию сохраняется объём: человек менял норму (то есть описание
// штуки), а не хотел избавиться от части товара.
const mode = ref<'recalculate' | 'keep'>('recalculate')

function firstOutcome(key: 'recalculate' | 'keep'): { quantity: number; stock: number } | null {
  return props.rows.find((row) => row.outcomes?.[key])?.outcomes?.[key] ?? null
}

function outcomeLines(key: 'recalculate' | 'keep'): { property_id: number; title: string; stock: string; unit: string }[] {
  return props.rows
    .filter((row) => row.outcomes?.[key])
    .map((row) => ({
      property_id: row.property_id,
      title: row.title,
      stock: formatAmount(row.outcomes![key].stock),
      unit: row.unit ?? '',
    }))
}

/** Вписанные человеком числа: сколько штук и сколько всего по свойствам. */
const actualQuantity = ref<number | null>(null)
const actualTotals = ref<Record<number, number | undefined>>({})
const error = ref<string | null>(null)

/**
 * Сходятся ли вписанные числа с вписанными штуками — показывается сразу.
 *
 * Норма остаётся той, что введена в поле свойства, а здесь человек говорит
 * факт: сколько штук и сколько всего. Если числа не сходятся, он должен увидеть
 * это до нажатия, а не получить отказ сервера и решить, что кнопка сломалась.
 *
 * Формулировка — прямо то, что не так: «в 5 шт по 10 000 вмещается 100 000, а
 * указано 40 000». Фраза «чего-то не хватает» годилась для одного случая, а
 * расхождения бывают двух: штук больше, чем товара, и товара больше, чем штук.
 * Итог всё равно считает сервер, это подсказка.
 */
const actualPreview = computed(() => {
  const quantity = Number(actualQuantity.value)
  const quantityFilled = actualQuantity.value !== '' && Number.isFinite(quantity)

  const lines: string[] = []
  let bad = false
  // Во сколько штук укладывается вписанное — по большему из заполненных полей:
  // штуку держит любое из отмеченных свойств, и наибольшее требование и есть
  // искомое число штук.
  let fitsPieces = 0
  let sawTotal = false

  for (const row of props.rows) {
    const raw = actualTotals.value[row.property_id]
    const total = Number(raw)

    // Пустое поле — это «не вписано», а не ноль. Иначе в подсказке появлялось
    // бы «указано 0» про поле, в котором ничего не написано.
    const filled = raw !== undefined && raw !== null && raw !== '' && Number.isFinite(total)

    if (!filled) continue

    sawTotal = true
    fitsPieces = Math.max(fitsPieces, Math.ceil(total / row.to - 0.0001))

    const pieces = Math.ceil(total / row.to - 0.0001)

    lines.push(
      quantityFilled && quantity > 0
        ? `${row.title}: ${formatAmount(total)} ${row.unit ?? ''} — ${t('norm_change.that_is')} ` +
          `${pieces} ${t('norm_change.pieces')}, ${t('norm_change.entered_word')} ${quantity}`
        : `${row.title}: ${t('norm_change.entered')} ${formatAmount(total)} ${row.unit ?? ''}`
    )
  }

  if (lines.length === 0) return null

  // Заявлено штук не столько, сколько набирается: лишние были бы пустыми
  // (50 000 мл при норме 10 000 — это ровно пять полных, шестой не существует).
  if (quantityFilled && quantity > 0 && sawTotal && quantity !== fitsPieces) bad = true

  return bad ? `${t('norm_change.does_not_fit_hint')} ${lines.join('; ')}` : lines.join('; ')
})

/** Кнопку не жмём, пока в своих числах чего-то не хватает. */
const canApply = computed(() => {
  if (mode.value !== 'custom') return true

  const quantity = Number(actualQuantity.value)
  if (!Number.isFinite(quantity) || quantity < 0) return false

  return props.rows.some((row) => {
    const value = Number(actualTotals.value[row.property_id])
    return Number.isFinite(value) && value >= 0
  })
})

const actualHintBad = computed(() => (actualPreview.value ?? '').startsWith(t('norm_change.does_not_fit_hint')))

const options = computed(() => [
  {
    value: 'recalculate' as const,
    title: t('norm_change.recalculate'),
    hint: t('norm_change.recalculate_hint'),
    quantity: firstOutcome('recalculate')?.quantity ?? 0,
    lines: outcomeLines('recalculate'),
    fits: props.rows.every((row) => row.outcomes?.recalculate?.fits !== false),
  },
  {
    value: 'keep' as const,
    title: t('norm_change.keep'),
    hint: t('norm_change.keep_hint'),
    quantity: firstOutcome('keep')?.quantity ?? 0,
    lines: outcomeLines('keep'),
    fits: props.rows.every((row) => row.outcomes?.keep?.fits !== false),
  },
])

/**
 * По умолчанию выбирается первый пригодный вариант.
 *
 * Раньше выбор стоял на «сохранить объём» безусловно, и когда он оказывался
 * непригодным, кнопка была включена, а результат — чужой. Теперь при смене
 * набора свойств выбор пересчитывается.
 */
watch(
  () => props.rows,
  () => {
    error.value = null
    actualQuantity.value = null
    actualTotals.value = {}

    const firstFit = options.value.find((option) => option.fits)
    mode.value = firstFit ? firstFit.value : 'custom'
  },
  { immediate: true }
)

function cancel() {
  emit('cancel')
}

function apply() {
  error.value = null

  if (mode.value !== 'custom') {
    emit('apply', mode.value, null)
    return
  }

  const properties: Record<number, number> = {}

  for (const row of props.rows) {
    const value = Number(actualTotals.value[row.property_id])
    if (Number.isFinite(value) && value >= 0) {
      properties[row.property_id] = value
    }
  }

  emit('apply', 'custom', {
    quantity: Math.max(0, Math.trunc(Number(actualQuantity.value ?? 0))),
    properties,
  })
}
</script>

<style scoped>
.norm-change__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin-bottom: 12px;
}

.norm-change__table td {
  padding: 5px 0;
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
}

.norm-change__change {
  white-space: nowrap;
  color: var(--text);
  font-weight: 600;
}

.norm-change__now {
  text-align: right;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 13px;
}

.norm-change__choice {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.norm-change__option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.norm-change__option:hover {
  background: var(--bg-hover);
}

.norm-change__option-hint {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}

/*
 * Результат варианта — числами и на отдельной строке. Подсказки говорят обоим
 * вариантах сразу, и в одну строку оба исхода не помещались: «8 шт, Объём
 * 35 000 мл» и «1 шт, Объём 270 мл» — это разные будущие одного выбора, и
 * путать их нельзя.
 */
/*
 * Результат — по строке на величину и с отступом между строками. Подсказки
 * говорят обоим вариантах сразу, и в одну строку оба исхода не помещались:
 * «8 шт, Объём 35 000 мл» и «1 шт, Объём 270 мл» — это разные будущие одного
 * выбора, и путать их нельзя. Без отступа строки слипались в «8 штОбъём:
 * 35 000 мл», и первое число — главное — терялось среди подписей.
 */
.norm-change__result {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.norm-change__result-line {
  display: block;
  margin-top: 2px;
}

/*
 * Числа — жирные и своим цветом. В перечне названий свойств величины терялись:
 * весь блок выглядел одинаковым, и «8 шт» приходилось сравнивать с «1 шт» по
 * мелкому тексту. Цвет тот же, что у ссылки, — в этой части формы он больше
 * нигде не занят.
 */
.norm-change__num {
  font-weight: 700;
  color: var(--link);
  font-variant-numeric: tabular-nums;
}

/* Невозможный вариант гасится вместе с подписью: полупрозрачностью, а не
   серым текстом — иначе выглядит как обычный и остаётся доступным. */
.norm-change__option--off {
  opacity: 0.55;
  cursor: not-allowed;
}

.norm-change__option--on {
  border-color: var(--accent);
}

.norm-change__warning {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--warn);
}

.norm-change__actual {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 4px;
}

.norm-change__actual-note {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

/* Числа не сходятся: подсказка об этом же — иначе человек жмёт «сохранить так»
   и получает отказ, думая, что кнопка сломалась. */
.norm-change__actual-note--bad {
  color: var(--warn);
}
</style>
