<template>
  <div class="orphans-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('codes.orphans_title') }}</h3>
      <NuxtLink to="/label-lists" class="btn-back">{{ t('codes.to_labels') }}</NuxtLink>
    </div>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <!-- Что вообще считается осиротевшим. Формулировка важна: страница
           выглядит как «уборка мусора», а удаление здесь обратимо не всегда. -->
      <div class="explain">
        <p>
          {{ t('codes.orphans_about') }}
        </p>
        <p>
          <strong>{{ t('codes.orphans_exclude') }}</strong> {{ t('codes.orphans_explain_full') }}
        </p>
      </div>

      <div v-if="summary.total === 0" class="empty">
        {{ t('codes.orphans_none') }}
      </div>

      <template v-else>
        <div class="summary">
          <div class="summary__count">{{ summary.total }}</div>
          <div class="summary__meta">
            <div>{{ t('codes.orphans_count') }}</div>
            <div class="summary__dates" v-if="summary.oldest">
              {{ t('codes.oldest', { date: formatDate(summary.oldest) }) }}<br />
              {{ t('codes.newest', { date: formatDate(summary.newest) }) }}
            </div>
          </div>
        </div>

        <!-- Выбор по возрасту, а не поштучно: код — это нечитаемая
             32-символьная строка, выбирать из них руками бессмысленно. -->
        <fieldset class="picker">
          <legend>{{ t('codes.orphans_what') }}</legend>

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
            {{ t('codes.orphans_stale_hint') }}
          </p>
        </fieldset>

        <div class="actions">
          <button
            type="button"
            class="btn-preview"
            :disabled="!selectedCount || previewing"
            @click="downloadPreview"
          >
            {{ previewing ? t('codes.orphans_preparing') : t('codes.orphans_preview', { count: selectedCount }) }}
          </button>

          <button
            type="button"
            class="btn-del"
            :disabled="!selectedCount || deleting"
            @click="armed = !armed"
          >
            {{ deleting ? t('codes.orphans_deleting') : t('codes.orphans_delete', { count: selectedCount }) }}
          </button>
        </div>

        <!-- Двухшаговое подтверждение вместо confirm(): удаление необратимо,
             и его последствия нужно проговорить до того, как нажали. -->
        <div v-if="armed && !deleting" class="confirm">
          <p class="confirm__text">
            {{ t('codes.will_delete', { count: selectedCount }) }}
            {{ tp('words.code_nom', selectedCount) }}
            ({{ selectedLabel }}). {{ t('codes.cannot_undo') }}
          </p>
          <p class="confirm__text confirm__text--warn">
            {{ t('codes.orphans_warning') }}
          </p>
          <div class="confirm__actions">
            <button type="button" class="btn-del" :disabled="deleting" @click="runDelete">
              {{ t('codes.confirm_delete', { count: selectedCount }) }}
            </button>
            <button type="button" class="btn-cancel" :disabled="deleting" @click="armed = false">
              {{ t('common.cancel') }}
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
const { t, tp } = useI18n()

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
    error.value = formatApiError(err, t('codes.summary_failed'))
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
        t('codes.pdf_partial', { rendered, total }),
        { type: 'warning', timer: 10 }
      )
    } else {
      $notify.add(t('codes.preview_ready', { count: tp('words.code_nom', rendered) }), {
        type: 'success',
      })
    }
  } catch (err: any) {
    $notify.add(await readBlobApiError(err, t('codes.preview_failed')), {
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
      t('codes.deleted_count', { count: tp('words.code_nom', deleted) }),
      { type: 'success' }
    )
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, t('codes.delete_failed')), { type: 'error', timer: 10 })
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

/* Фиолетовый — тот же язык, что и «безымянная этикетка» на главной:
   страница про то же самое, только с обратной стороны. */
.explain {
  margin-bottom: 18px;
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--note-ink);
  background: var(--note-bg);
  border: 1px solid var(--note);
  border-radius: 6px;
}

.explain p {
  margin: 0 0 8px;
}

.explain p:last-child {
  margin-bottom: 0;
}

.explain strong {
  color: var(--note-ink);
}

.summary {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px 20px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.summary__count {
  font-size: 40px;
  line-height: 1;
  font-weight: 700;
  color: var(--note-ink);
}

.summary__meta {
  font-size: 14px;
  color: var(--text-muted);
}

.summary__dates {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.6;
}

.picker {
  margin: 0 0 18px;
  padding: 14px 18px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
}

.picker legend {
  padding: 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
}

.picker__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

.picker__row--off {
  opacity: 0.4;
  cursor: default;
}

.picker__row--all .picker__label {
  color: var(--note-ink);
}

.picker__label {
  flex: 1;
}

.picker__count {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.picker__hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-dim);
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
  background: var(--note-bg);
  color: var(--note-ink);
  border: 1px solid var(--note);
}

.btn-preview:hover:not(:disabled) {
  background: color-mix(in srgb, var(--note) 26%, var(--bg-elevated));
}

.btn-del {
  background: var(--danger);
  color: var(--danger-ink);
  border: 1px solid var(--danger);
}

.btn-del:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 26%, var(--bg-elevated));
}

.btn-cancel {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
}

.btn-cancel:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-hover) 70%, var(--text));
}

.btn-preview:disabled,
.btn-del:disabled,
.btn-cancel:disabled {
  opacity: 0.4;
  cursor: default;
}

.confirm {
  padding: 14px 18px;
  background: var(--danger-bg);
  border: 1px solid var(--danger);
  border-radius: 6px;
}

.confirm__text {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
}

.confirm__text--warn {
  color: var(--danger-ink);
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
