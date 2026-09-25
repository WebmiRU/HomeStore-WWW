<template>
  <div class="orphans-page">
    <div class="page-header">
      <h3 class="page-title">Осиротевшие коды</h3>
      <NuxtLink to="/label-lists" class="btn-back">К этикеткам</NuxtLink>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <!-- Что вообще считается осиротевшим. Формулировка важна: страница
           выглядит как «уборка мусора», а удаление здесь обратимо не всегда. -->
      <div class="explain">
        <p>
          Это коды, напечатанные в составе набора безымянных этикеток, у которого потом
          удалили сам набор. Набор удаляется без кодов намеренно: наклейки-то уже наклеены.
        </p>
        <p>
          <strong>Сюда не попадают</strong> свободные коды действующих наборов — это рабочие
          наклейки, ждущие привязки, и трогать их нельзя.
        </p>
      </div>

      <div v-if="summary.total === 0" class="empty">
        Осиротевших кодов нет — уборка не требуется.
      </div>

      <template v-else>
        <div class="summary">
          <div class="summary__count">{{ summary.total }}</div>
          <div class="summary__meta">
            <div>кодов осиротело</div>
            <div class="summary__dates" v-if="summary.oldest">
              самый старый — {{ formatDate(summary.oldest) }}<br />
              новейший — {{ formatDate(summary.newest) }}
            </div>
          </div>
        </div>

        <!-- Выбор по возрасту, а не поштучно: код — это нечитаемая
             32-символьная строка, выбирать из них руками бессмысленно. -->
        <fieldset class="picker">
          <legend>Что удалять</legend>

          <label
            v-for="b in summary.buckets"
            :key="b.days"
            class="picker__row"
            :class="{ 'picker__row--off': b.count === 0, 'picker__row--all': b.days === 0 }"
          >
            <input
              type="radio"
              name="bucket"
              :value="b.days"
              v-model="selectedDays"
              :disabled="b.count === 0"
            />
            <span class="picker__label">{{ b.label }}</span>
            <span class="picker__count">{{ b.count }}</span>
          </label>

          <p class="picker__hint">
            Обновление страницы подставляет самые «залежавшиеся» коды: их давно можно было
            использовать, но не использовали.
          </p>
        </fieldset>

        <div class="actions">
          <button
            type="button"
            class="btn-preview"
            :disabled="!selectedCount || previewing"
            @click="downloadPreview"
          >
            {{ previewing ? 'Готовим PDF...' : `Показать, что удалится (${selectedCount})` }}
          </button>

          <button
            type="button"
            class="btn-del"
            :disabled="!selectedCount || deleting"
            @click="armed = !armed"
          >
            {{ deleting ? 'Удаляем...' : `Удалить ${selectedCount}` }}
          </button>
        </div>

        <!-- Двухшаговое подтверждение вместо confirm(): удаление необратимо,
             и его последствия нужно проговорить до того, как нажали. -->
        <div v-if="armed && !deleting" class="confirm">
          <p class="confirm__text">
            Будет удалено <strong>{{ selectedCount }}</strong>
            {{ plural(selectedCount, 'код', 'кода', 'кодов') }}
            ({{ selectedLabel }}). Отменить это нельзя.
          </p>
          <p class="confirm__text confirm__text--warn">
            Наклейки при этом никуда не денутся. Но перестанут отличаться от любого
            никогда не выдававшегося кода: при сканировании приложение ответит
            «код не найден», пока вы снова не заведёте предмет или хранилище с этим кодом.
          </p>
          <div class="confirm__actions">
            <button type="button" class="btn-del" :disabled="deleting" @click="runDelete">
              Да, удалить {{ selectedCount }}
            </button>
            <button type="button" class="btn-cancel" :disabled="deleting" @click="armed = false">
              Отмена
            </button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { OrphanedCodesSummary, OrphanAgeBucket } from '~/repository/modules/code'
import { formatApiError, readBlobApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()

const EMPTY: OrphanedCodesSummary = { total: 0, oldest: null, newest: null, buckets: [] }

const summary = ref<OrphanedCodesSummary>(EMPTY)
const loading = ref(true)
const error = ref<string | null>(null)

const selectedDays = ref<number | null>(null)
const armed = ref(false)
const deleting = ref(false)
const previewing = ref(false)

const selectedBucket = computed<OrphanAgeBucket | null>(
  () => summary.value.buckets.find((b) => b.days === selectedDays.value) ?? null
)
const selectedCount = computed(() => selectedBucket.value?.count ?? 0)
const selectedLabel = computed(() => selectedBucket.value?.label ?? '')

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/**
 * Подставляет самую «залежавшуюся» непустую корзину: если код пролежал
 * месяц неиспользованным, он первым кандидатом на удаление.
 */
function pickDefault(): void {
  const firstNonEmpty = summary.value.buckets.find((b) => b.count > 0)
  selectedDays.value = firstNonEmpty?.days ?? null
}

async function load() {
  loading.value = true
  error.value = null
  try {
    summary.value = await $api.code.orphanedCodes()
    pickDefault()
  } catch (err: any) {
    error.value = formatApiError(err, 'Не удалось загрузить сводку')
  } finally {
    loading.value = false
  }
}

async function downloadPreview() {
  if (!selectedBucket.value) return
  previewing.value = true
  armed.value = false
  try {
    const { blob, total, rendered } = await $api.code.orphanedCodesPreview(selectedDays.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'orphaned-codes.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    if (rendered < total) {
      $notify.add(
        `В PDF попали только первые ${rendered} из ${total} — сверяйте по счёту, а не по листам`,
        { type: 'warning', timer: 10 }
      )
    } else {
      $notify.add(`Предпросмотр готов: ${rendered} ${plural(rendered, 'код', 'кода', 'кодов')}`, {
        type: 'success',
      })
    }
  } catch (err: any) {
    $notify.add(await readBlobApiError(err, 'Не удалось построить предпросмотр'), {
      type: 'error',
      timer: 10,
    })
  } finally {
    previewing.value = false
  }
}

async function runDelete() {
  if (!selectedBucket.value) return
  deleting.value = true
  try {
    const deleted = await $api.code.deleteOrphanedCodes(selectedDays.value)
    armed.value = false
    $notify.add(
      `Удалено ${deleted} ${plural(deleted, 'код', 'кода', 'кодов')}`,
      { type: 'success' }
    )
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Не удалось удалить коды'), { type: 'error', timer: 10 })
  } finally {
    deleting.value = false
  }
}

onMounted(load)
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
  color: #ccc;
}

.btn-back {
  padding: 6px 14px;
  font-size: 13px;
  background: #333;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 4px;
  text-decoration: none;
}

.btn-back:hover {
  background: #444;
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

/* Фиолетовый — тот же язык, что и «безымянная этикетка» на главной:
   страница про то же самое, только с обратной стороны. */
.explain {
  margin-bottom: 18px;
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: #cdb8f0;
  background: #241a33;
  border: 1px solid #5a4480;
  border-radius: 6px;
}

.explain p {
  margin: 0 0 8px;
}

.explain p:last-child {
  margin-bottom: 0;
}

.explain strong {
  color: #e2d3f7;
}

.summary {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px 20px;
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 10px;
}

.summary__count {
  font-size: 40px;
  line-height: 1;
  font-weight: 700;
  color: #cdb8f0;
}

.summary__meta {
  font-size: 14px;
  color: #999;
}

.summary__dates {
  margin-top: 4px;
  font-size: 12px;
  color: #777;
  line-height: 1.6;
}

.picker {
  margin: 0 0 18px;
  padding: 14px 18px 16px;
  border: 1px solid #2b2b2b;
  border-radius: 10px;
  background: #1e1e1e;
}

.picker legend {
  padding: 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #888;
}

.picker__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  font-size: 14px;
  color: #ccc;
  cursor: pointer;
}

.picker__row--off {
  opacity: 0.4;
  cursor: default;
}

.picker__row--all .picker__label {
  color: #e2d3f7;
}

.picker__label {
  flex: 1;
}

.picker__count {
  font-variant-numeric: tabular-nums;
  color: #888;
}

.picker__hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #777;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.btn-preview,
.btn-del,
.btn-cancel {
  padding: 8px 18px;
  font-size: 14px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-preview {
  background: #2f2a3d;
  color: #cdb8f0;
  border: 1px solid #5a4480;
}

.btn-preview:hover:not(:disabled) {
  background: #3b3350;
}

.btn-del {
  background: #5a2a2a;
  color: #f0c8c8;
  border: 1px solid #8a3a3a;
}

.btn-del:hover:not(:disabled) {
  background: #6e3434;
}

.btn-cancel {
  background: #333;
  color: #ccc;
  border: 1px solid #444;
}

.btn-cancel:hover:not(:disabled) {
  background: #444;
}

.btn-preview:disabled,
.btn-del:disabled,
.btn-cancel:disabled {
  opacity: 0.4;
  cursor: default;
}

.confirm {
  padding: 14px 18px;
  background: #2a1f1f;
  border: 1px solid #6a3a3a;
  border-radius: 6px;
}

.confirm__text {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.5;
  color: #ddd;
}

.confirm__text--warn {
  color: #e8b0b0;
}

.confirm__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 768px) {
  .summary {
    flex-wrap: wrap;
  }
}
</style>
