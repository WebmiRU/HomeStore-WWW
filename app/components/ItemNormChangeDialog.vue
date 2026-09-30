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
        <label v-for="option in options" :key="option.value" class="norm-change__option">
          <input v-model="mode" type="radio" :value="option.value">
          <span>
            <b>{{ option.title }}</b>
            <span class="norm-change__option-hint">{{ option.hint }}</span>
            <span class="norm-change__result">
              <span class="norm-change__result-line">
                {{ t('norm_change.will_be') }}: <b>{{ option.quantity }} {{ t('norm_change.pieces') }}</b>
              </span>
              <span v-for="line in option.lines" :key="line.property_id" class="norm-change__result-line">
                {{ line.title }}: {{ line.stock }} {{ line.unit }}
              </span>
            </span>
          </span>
        </label>
      </div>

      <div class="modal__actions">
        <button type="button" class="btn-plain" @click="cancel">{{ t('common.cancel') }}</button>
        <button type="button" class="btn-confirm" @click="apply">{{ t('norm_change.apply') }}</button>
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
import { computed, ref } from 'vue'
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

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'apply', mode: 'recalculate' | 'keep'): void
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

const options = computed(() => [
  {
    value: 'recalculate' as const,
    title: t('norm_change.recalculate'),
    hint: t('norm_change.recalculate_hint'),
    quantity: firstOutcome('recalculate')?.quantity ?? 0,
    lines: outcomeLines('recalculate'),
  },
  {
    value: 'keep' as const,
    title: t('norm_change.keep'),
    hint: t('norm_change.keep_hint'),
    quantity: firstOutcome('keep')?.quantity ?? 0,
    lines: outcomeLines('keep'),
  },
])

function cancel() {
  emit('cancel')
}

function apply() {
  emit('apply', mode.value)
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
.norm-change__result {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text);
}

.norm-change__result-line {
  display: block;
  color: var(--text-secondary);
}

/* Первая строка — про штуки, она главная, поэтому тем же цветом, что и текст. */
.norm-change__result-line:first-child {
  color: var(--text);
}
</style>
