<template>
  <div class="accent-picker" role="radiogroup" :aria-label="t('options_page.accent_title')">
    <button
      v-for="option in options"
      :key="option"
      type="button"
      role="radio"
      class="accent-swatch"
      :class="{ 'accent-swatch--on': modelValue === option }"
      :aria-checked="modelValue === option"
      :title="labelOf(option)"
      :data-accent="option"
      @click="$emit('update:modelValue', option)"
    >
      <span class="accent-swatch__chip" />
      <span class="accent-swatch__name">{{ labelOf(option) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Accent } from '~/repository/modules/option'

/** Какой акцент выбран. */
const modelValue = defineModel<Accent>({ required: true })

/** Акцент, под которым показывать образцы: у самой настройки своей палитры нет. */
const props = defineProps<{
  theme: 'dark' | 'light'
}>()

const { t } = useI18n()

/**
 * Список акцентов. Следит за ним сервер: Option::accents() отвергнет значение,
 * которого здесь нет, а лишний пункт молча не появился бы.
 */
const options: Accent[] = ['green', 'purple', 'blue', 'amber']

const labelOf = (option: Accent): string =>
  t(
    option === 'green'
      ? 'options_page.accent_green'
      : option === 'purple'
        ? 'options_page.accent_purple'
        : option === 'blue'
          ? 'options_page.accent_blue'
          : 'options_page.accent_amber',
  )
</script>

<style scoped>
.accent-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.accent-swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px 7px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.accent-swatch:hover {
  border-color: var(--border-strong);
  color: var(--text);
}

.accent-swatch--on {
  border-color: var(--accent);
  color: var(--text);
  box-shadow: 0 0 0 1px var(--accent);
}

/* Образец красится настоящим акцентом страницы: свой цвет он не знает. */
.accent-swatch__chip {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--accent);
  box-shadow: inset 0 -6px 0 var(--accent-bg);
}
</style>
