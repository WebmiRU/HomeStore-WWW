<template>
  <div v-if="item" class="modal-backdrop" @click.self="close">
    <div class="modal">
      <div class="modal__head">
        <span class="modal__title">{{ t('correction.title') }}</span>
        <button type="button" class="modal__close" :aria-label="t('common.close')" @click="close">×</button>
      </div>

      <p class="modal__lead">
        {{ t('correction.lead') }}
      </p>

      <!--
        Вводится факт, а не дельта. Человек знает, сколько на руках, и сверяет
        с тем, что показывает система; заставлять его вычитать в уме значило бы
        завести ошибку туда, где её быть не должно. Дельту считает сервер.
      -->
      <div v-if="!isPartial" class="modal__field">
        <span class="modal__label">
          {{ t('correction.quantity') }} — {{ t('correction.now') }}: {{ item.payload.quantity ?? 1 }}
        </span>
        <input v-model.number="quantity" type="number" class="modal__input" min="0" step="1">
      </div>

      <div v-else class="correction__list">
        <div v-for="row in partialRows" :key="row.property_id" class="modal__field">
          <span class="modal__label">
            {{ row.property_title }} — {{ t('correction.now') }}: {{ formatAmount(row.total) }} {{ row.unit_short ?? '' }}
          </span>
          <input
            v-model.number="actual[row.property_id]"
            type="number"
            class="modal__input"
            min="0"
            step="any"
            :placeholder="t('correction.untouched')"
          >
        </div>
      </div>

      <div class="modal__field">
        <span class="modal__label">{{ t('correction.reason') }}</span>
        <input v-model="comment" type="text" class="modal__input" maxlength="1000" :placeholder="t('correction.reason_hint')">
      </div>

      <p v-if="error" class="modal__error">{{ error }}</p>

      <div class="modal__actions">
        <button type="button" class="btn-plain" @click="close">{{ t('common.cancel') }}</button>
        <button type="button" class="btn-confirm" :disabled="saving" @click="save">
          {{ saving ? t('common.saving') : t('correction.apply') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Корректировка остатка фактическим.
 *
 * Существует не для удобства, а потому что подгонять остаток списаниями —
 * значит соврать в журнале, а журнал для того и ведётся. Здесь человек
 * утверждает факт, дельту считает сервер, и движение остаётся настоящим.
 *
 * Отдельный компонент, а не блок в карточке: у предмета с расходуемыми
 * свойствами полей столько, сколько у него расходуемых свойств, и их список
 * меняется — держать такую форму в разметке карточки значило бы держать там
 * же логику пересчёта.
 */
import { computed, ref, watch } from 'vue'
import type { ItemResponse } from '~/repository/modules/item'
import { formatAmount } from '~/utils/amount'

const props = defineProps<{
  item: ItemResponse | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'applied', operationId: number): void
}>()

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()

const saving = ref(false)
const error = ref<string | null>(null)
const quantity = ref<number | null>(null)
const comment = ref('')
/** Факт по каждому свойству; undefined — свойство не трогаем. */
const actual = ref<Record<number, number | undefined>>({})

const isPartial = computed(() => (props.item?.partial ?? []).length > 0)
const partialRows = computed(() => props.item?.partial ?? [])

watch(
  () => props.item,
  (value) => {
    error.value = null
    comment.value = ''
    quantity.value = value?.payload.quantity ?? null
    actual.value = {}
  },
  { immediate: true }
)

function close() {
  if (!saving.value) emit('close')
}

async function save() {
  if (!props.item) return

  const payload: Record<string, unknown> = { item_id: props.item.payload.id }

  if (isPartial.value) {
    // Пустое поле — «не трогай»: человек сверяет то, что может, а остальное
    // не трогать было бы отдельным запретом.
    const properties = Object.entries(actual.value)
      .filter(([, value]) => value !== null && value !== undefined && !Number.isNaN(Number(value)))
      .map(([propertyId, value]) => ({ property_id: Number(propertyId), actual: Number(value) }))

    if (properties.length === 0) {
      error.value = t('correction.fill_at_least_one')
      return
    }

    payload.properties = properties
  } else {
    payload.quantity = Math.max(0, Math.trunc(Number(quantity.value ?? 0)))
  }

  saving.value = true
  error.value = null

  try {
    const operation = await $api.operation.correct({ payload: [payload], comment: comment.value.trim() || null })
    $notify.add(t('correction.applied'), { type: 'success' })
    emit('applied', operation.id)
    emit('close')
  } catch (err: any) {
    error.value = formatApiError(err, t('correction.failed'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/*
 * Свои стили здесь только те, чего нет в общих правилах модалки: поля идут
 * в столбик, поэтому подпись к текущему остатку — часть подписи поля, а не
 * второе значение рядом.
 */
.correction__list {
  display: flex;
  flex-direction: column;
}
</style>
