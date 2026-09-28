<template>
  <!--
    Превью темы рисуется настоящими токенами, а не картинкой: у превью стоят
    те же data-theme и data-accent, что и у страницы, поэтому оно всегда
    показывает ровно то, что получится. Нарисованная картинка через месяц
    разошлась бы с интерфейсом, и это молча ввело бы в заблуждение.
  -->
  <div class="theme-picker" role="radiogroup" :aria-label="t('options_page.theme_title')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="theme-card"
      :class="{ 'theme-card--on': modelValue === option.value }"
      :aria-checked="modelValue === option.value"
      :title="labelOf(option)"
      @click="$emit('update:modelValue', option.value)"
    >
      <span class="theme-card__preview" :data-theme="option.theme" :data-accent="accent">
        <span class="theme-card__bar">
          <span class="theme-card__dot" />
          <span class="theme-card__line" />
        </span>
        <span class="theme-card__panel">
          <span class="theme-card__field" />
          <span class="theme-card__btn" />
        </span>
        <span class="theme-card__rows">
          <span class="theme-card__row" />
          <span class="theme-card__row" />
          <span class="theme-card__row" />
        </span>
      </span>
      <span class="theme-card__name">{{ labelOf(option) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Theme } from '~/repository/modules/option'

/** Что выбрано: тёмная, светлая или «как в системе». */
const modelValue = defineModel<Theme>({ required: true })

const props = defineProps<{
  /** Акцент, под которым показывать превью: у темы своей палитры нет. */
  accent: string
}>()

const { t } = useI18n()

/**
 * Темы как список, а не флаг: появится третья — она просто добавится сюда.
 * У «как в системе» своей палитры нет, поэтому превью показывается таким,
 * каким оно окажется на самом деле: тёмным, ведь на сервере системная тема
 * неизвестна и первый экран тёмный.
 */
const options: { value: Theme; theme: 'dark' | 'light' }[] = [
  { value: 'dark', theme: 'dark' },
  { value: 'light', theme: 'light' },
  { value: 'system', theme: 'dark' },
]

const labelOf = (option: (typeof options)[number]): string =>
  t(
    option.value === 'dark'
      ? 'options_page.theme_dark'
      : option.value === 'light'
        ? 'options_page.theme_light'
        : 'options_page.theme_system',
  )
</script>

<style scoped>
.theme-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 150px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.theme-card:hover {
  border-color: var(--border-strong);
  color: var(--text);
}

.theme-card--on {
  border-color: var(--accent);
  color: var(--text);
  box-shadow: 0 0 0 1px var(--accent);
}

.theme-card__preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 6px;
  background: var(--bg);
  border: 1px solid var(--border);
}

.theme-card__bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.theme-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.theme-card__line {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-dim);
}

.theme-card__panel {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.theme-card__field {
  flex: 1;
  height: 8px;
  border-radius: 3px;
  background: var(--bg-sunken);
  border: 1px solid var(--border-strong);
}

.theme-card__btn {
  width: 26px;
  height: 10px;
  border-radius: 3px;
  background: var(--accent);
}

.theme-card__rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
  border-radius: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.theme-card__row {
  height: 5px;
  border-radius: 2px;
  background: var(--text-faint);
}

.theme-card__row:nth-child(2) {
  background: var(--accent-bg);
}

.theme-card__name {
  font-size: 13px;
  text-align: center;
}
</style>
