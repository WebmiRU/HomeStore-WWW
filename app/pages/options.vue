<template>
  <div class="options-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('options_page.title') }}</h3>
      <div class="page-header-actions">
        <button type="button" class="btn-plain" :disabled="saving" @click="fillDefaults">
          {{ t('options_page.restore') }}
        </button>
        <button type="button" class="btn-confirm" :disabled="saving || !dirty" @click="saveAll">
          {{ saving ? t('options_page.saving') : t('options_page.save') }}
        </button>
      </div>
    </div>

    <TabBar :tabs="tabs" class="options-tabs" />

    <p class="options-hint">
      {{ t('options_page.hint') }}
    </p>

    <!--
      Вкладки, а не одна длинная страница: у настроек три независимых сюжета,
      и в одной куче список меню отодвигал всё остальное за пределы экрана.
      Ключ вкладки живёт в адресе — на вкладку можно вернуться кнопкой «назад».
    -->
    <section v-if="activeTab === 'menu'" class="options-card">
      <h4 class="options-card__title">{{ t('options_page.menu_title') }}</h4>
      <p class="options-card__hint">
        {{ t('options_page.menu_hint') }}
      </p>

      <ul class="menu-list">
        <li v-for="entry in topEntries" :key="entry.key" class="menu-row-wrap">
          <div class="menu-row" :class="{ 'menu-row--off': !shown.has(entry.key) }">
            <label class="menu-row__check">
              <input
                type="checkbox"
                :checked="shown.has(entry.key)"
                :aria-label="t('options_page.show_item', { label: t(entry.labelKey) })"
                @change="toggleShown(entry.key)"
              />
              <span class="menu-row__label">{{ t(entry.labelKey) }}</span>
            </label>

            <span class="menu-row__move">
              <button
                type="button"
                class="menu-move"
                :disabled="isFirst(topOrder, entry.key)"
                :aria-label="t('options_page.up', { label: t(entry.labelKey) })"
                @click="move(entry.key, -1, topOrder)"
              >
                ↑
              </button>
              <button
                type="button"
                class="menu-move"
                :disabled="isLast(topOrder, entry.key)"
                :aria-label="t('options_page.down', { label: t(entry.labelKey) })"
                @click="move(entry.key, 1, topOrder)"
              >
                ↓
              </button>
            </span>
          </div>

          <!--
            Вложенные пункты показываются всегда: разворачивать их было нечем
            — список и без того состоит из пятнадцати строк, и половина из них
            была бы под обрешёнными группами.
          -->
          <ul v-if="isNavGroup(entry)" class="menu-list menu-list--nested">
            <li v-for="item in groupEntries(entry)" :key="item.key" class="menu-row-wrap">
              <div class="menu-row" :class="{ 'menu-row--off': !shown.has(item.key) }">
                <label class="menu-row__check">
                  <input
                    type="checkbox"
                    :checked="shown.has(item.key)"
                    :aria-label="t('options_page.show_item', { label: t(item.labelKey) })"
                    @change="toggleShown(item.key)"
                  />
                  <span class="menu-row__label">{{ t(item.labelKey) }}</span>
                </label>

                <span class="menu-row__move">
                  <button
                    type="button"
                    class="menu-move"
                    :disabled="isFirst(groupOrder(entry), item.key)"
                    :aria-label="t('options_page.up', { label: t(item.labelKey) })"
                    @click="move(item.key, -1, groupOrder(entry))"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="menu-move"
                    :disabled="isLast(groupOrder(entry), item.key)"
                    :aria-label="t('options_page.down', { label: t(item.labelKey) })"
                    @click="move(item.key, 1, groupOrder(entry))"
                  >
                    ↓
                  </button>
                </span>
              </div>
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <section v-else-if="activeTab === 'mode'" class="options-card">
      <h4 class="options-card__title">{{ t('options_page.mode_title') }}</h4>
      <p class="options-card__hint">
        {{ t('options_page.mode_hint') }}
      </p>

      <div class="mode-row">
        <label
          v-for="mode in modes"
          :key="mode.value"
          class="mode-choice"
          :class="{ 'mode-choice--on': operationMode === mode.value }"
        >
          <input
            type="radio"
            name="operation-mode"
            :value="mode.value"
            :checked="operationMode === mode.value"
            @change="operationMode = mode.value"
          />
          <span>{{ t(mode.labelKey) }}</span>
        </label>
      </div>

      <div class="options-divider" />

      <label class="menu-row menu-row--plain">
        <span class="menu-row__check">
          <input
            type="checkbox"
            :checked="rememberOperationMode"
            @change="rememberOperationMode = !rememberOperationMode"
          />
          <span class="menu-row__label">{{ t('options_page.remember_mode') }}</span>
        </span>
      </label>
      <p class="options-card__hint">
        {{ t('options_page.remember_mode_hint') }}
      </p>
    </section>

    <section v-else-if="activeTab === 'interface'" class="options-card">
      <h4 class="options-card__title">{{ t('options_page.interface_title') }}</h4>

      <h5 class="options-card__subtitle">{{ t('options_page.theme_title') }}</h5>
      <ThemePicker v-model="themeChoice" :accent="accentChoice" />
      <p class="options-card__hint">{{ t('options_page.theme_hint') }}</p>

      <h5 class="options-card__subtitle">{{ t('options_page.accent_title') }}</h5>
      <AccentPicker v-model="accentChoice" :theme="themePreview" />
      <p class="options-card__hint">{{ t('options_page.accent_hint') }}</p>

      <label class="menu-row menu-row--plain">
        <span class="menu-row__check">
          <input
            type="checkbox"
            :checked="showCodeBlock"
            @change="showCodeBlock = !showCodeBlock"
          />
          <span class="menu-row__label">{{ t('options_page.show_code_block') }}</span>
        </span>
      </label>
      <p class="options-card__hint">
        {{ t('options_page.show_code_block_hint') }}
      </p>
    </section>

    <section v-else class="options-card">
      <h4 class="options-card__title">{{ t('options_page.language_title') }}</h4>
      <p class="options-card__hint">
        {{ t('options_page.language_hint') }}
      </p>

      <div class="mode-row">
        <label
          v-for="item in languages"
          :key="item.value"
          class="mode-choice"
          :class="{ 'mode-choice--on': localeChoice === item.value }"
        >
          <input
            type="radio"
            name="language"
            :value="item.value"
            :checked="localeChoice === item.value"
            @change="switchLanguage(item.value)"
          />
          <span>{{ t(item.labelKey) }}</span>
        </label>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isNavGroup, navTree, sortNavKeys, type NavGroup, type NavItem } from '~/utils/navigation'
import type { Accent, Locale, OperationMode, Theme } from '~/repository/modules/option'
import type { TranslationKey } from '~/i18n/ru'
import { formatApiError } from '~/composables/formatApiError'

const route = useRoute()
const { $notify } = useNuxtApp()
const { options, load, save } = useOptions()
const { t, locale, setLocale } = useI18n()

// computed, а не обычный массив: язык приезжает из настроек после монтирования,
// и собранный при setup список вкладок остался бы на старом языке.
const tabs = computed(() => [
  { key: 'menu', label: t('options_page.tab_menu') },
  { key: 'mode', label: t('options_page.tab_mode') },
  { key: 'interface', label: t('options_page.tab_interface') },
  { key: 'language', label: t('options_page.tab_language') },
])

const activeTab = computed(() => {
  const q = route.query.tab
  return typeof q === 'string' && tabs.value.some((tab) => tab.key === q) ? q : tabs.value[0]!.key
})

const languages: { value: Locale; labelKey: TranslationKey }[] = [
  { value: 'ru', labelKey: 'options_page.language_ru' },
  { value: 'en', labelKey: 'options_page.language_en' },
]

const modes: { value: OperationMode; labelKey: TranslationKey }[] = [
  { value: 'search', labelKey: 'options_page.mode_search' },
  { value: 'replenish', labelKey: 'options_page.mode_replenish' },
  { value: 'writeoff', labelKey: 'options_page.mode_writeoff' },
]

/**
 * Форма живёт отдельно от настроек: править их и сохранять можно не сразу, а
 * настройки приезжают с сервера и не должны перерисовываться под руками.
 */
const order = ref<string[]>([])
const hidden = ref<Set<string>>(new Set())
const operationMode = ref<OperationMode>('search')
const showCodeBlock = ref(true)
const rememberOperationMode = ref(true)
/** Язык в форме: он же и то, что сейчас показано на экране. */
const localeChoice = ref<Locale>('ru')
const saving = ref(false)

/**
 * Верхний уровень целиком, группы включительно: группа в списке настроек —
 * такой же пункт меню, её можно и спрятать, и переставить. Отдельный список
 * «только ссылок» тут означал бы, что группами нельзя управлять вовсе.
 */
const topKeys = computed(() => navTree.map((entry) => entry.key))

const shown = computed(() => new Set(navKeys().filter((key) => !hidden.value.has(key))))

const topEntries = computed(() =>
  sortNavKeys(topKeys.value, order.value).map((key) => navTree.find((entry) => entry.key === key)!),
)

/**
 * Все ключи меню в порядке по умолчанию: верхний уровень, затем вложенные.
 *
 * Именно по умолчанию, а не по текущей расстановке формы: этим списком
 * пользуется и сравнение «что изменилось», иначе форма сравнивалась бы сама с
 * собой и «Сохранить» у человека без настроек было бы активно сразу.
 */
function navKeys(): string[] {
  return topKeys.value.concat(
    navTree.filter(isNavGroup).flatMap((group) => groupKeys(group)),
  )
}

/**
 * Ключи уровня в том виде, как их видит человек, — по текущей расстановке.
 *
 * Раньше сюда подставлялся порядок по умолчанию, и после перестановки
 * получалось расхождение: список показывался новый, а «крайние» строки
 * вычислялись по старому, и у нижнего пункта оставалась включённая стрелка
 * вниз.
 */
const topOrder = computed(() => topEntries.value.map((entry) => entry.key))

function groupKeys(group: NavGroup): string[] {
  return group.items.map((item) => item.key)
}

function groupOrder(group: NavGroup): string[] {
  return groupEntries(group).map((item) => item.key)
}

function groupEntries(group: NavGroup): NavItem[] {
  return sortNavKeys(groupKeys(group), order.value)
    .map((key) => group.items.find((item) => item.key === key))
    .filter((item): item is NavItem => item !== undefined)
}

const isFirst = (keys: string[], key: string): boolean => keys.indexOf(key) <= 0
const isLast = (keys: string[], key: string): boolean => keys.indexOf(key) === keys.length - 1

/**
 * Поднимает или опускает пункт на одну строку.
 *
 * Меняются местами позиции ключей в общем плоском списке: уровни в нём
 * перемешаны, и важно лишь, кто раньше кого внутри своего уровня.
 */
function move(key: string, direction: -1 | 1, keys: string[]): void {
  const neighbour = keys[keys.indexOf(key) + direction]
  if (neighbour === undefined) return

  const from = order.value.indexOf(key)
  const to = order.value.indexOf(neighbour)
  if (from === -1 || to === -1) return

  const next = [...order.value]
  next[from] = neighbour
  next[to] = key
  order.value = next
}

/**
 * Язык применяется сразу, чтобы результат был виден тут же, но сохраняется
 * вместе с остальными настройками — как любая другая настройка, с той же
 * кнопкой. Cookie обновляется сразу: следующая загрузка не должна ждать ответа
 * сервера, чтобы показать нужный язык.
 */
function switchLanguage(next: Locale): void {
  localeChoice.value = next
  setLocale(next)
}

function toggleShown(key: string): void {
  const next = new Set(hidden.value)

  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }

  hidden.value = next
}

/** Переносит настройки из ответа сервера в форму. */
function fillFromOptions(): void {
  order.value = sortNavKeys(navKeys(), options.value.menu_order)
  hidden.value = new Set(options.value.menu_hidden)
  operationMode.value = options.value.operation_mode
  showCodeBlock.value = options.value.show_code_block
  rememberOperationMode.value = options.value.remember_operation_mode
  localeChoice.value = options.value.locale
}

/** К умолчаниям: пустой порядок и пустой список скрытых — это «как в приложении». */
function fillDefaults(): void {
  order.value = navKeys()
  hidden.value = new Set()
  operationMode.value = 'search'
  showCodeBlock.value = true
  rememberOperationMode.value = true
  localeChoice.value = 'ru'
}

/**
 * Оформление показывается сразу, а сохраняется — этой же кнопкой.
 *
 * Тему и акцент выбирают, чтобы посмотреть на результат, но отправляет всё
 * одна кнопка, как язык и порядок меню: иначе на странице настроек было бы
 * два разных способа сохранить, и «Сохранить» не срабатывал бы, пока
 * оформление не поменяли.
 */
const { mode, resolved, accent, preview } = useTheme()

const themeChoice = ref<Theme>(mode.value)
const accentChoice = ref<Accent>(accent.value)

/** Для превью акцентов: «как в системе» — это уже разрешённая тема. */
const themePreview = computed(() => resolved.value)

// Предпросмотр без сохранения: значение применяется к странице и в cookie,
// но в настройки аккаунта уходит только с кнопкой.
watch(themeChoice, (value) => preview({ theme: value }))
watch(accentChoice, (value) => preview({ accent: value }))

// Ответ сервера — источник истины: он заполняет форму, в том числе после
// сохранения остальных настроек.
watch([mode, accent], ([theme, value]) => {
  themeChoice.value = theme
  accentChoice.value = value
})

/** Ключи в том виде, в каком их видит человек с учётом сохранённого порядка. */
const storedOrder = computed(() => [
  ...sortNavKeys(topKeys.value, options.value.menu_order),
  ...navTree.filter(isNavGroup).flatMap((group) => sortNavKeys(groupKeys(group), options.value.menu_order)),
])

const dirty = computed(
  () =>
    order.value.join() !== storedOrder.value.join() ||
    [...hidden.value].sort().join() !== [...options.value.menu_hidden].sort().join() ||
    operationMode.value !== options.value.operation_mode ||
    showCodeBlock.value !== options.value.show_code_block ||
    rememberOperationMode.value !== options.value.remember_operation_mode ||
    localeChoice.value !== options.value.locale ||
    themeChoice.value !== options.value.theme ||
    accentChoice.value !== options.value.accent,
)

async function saveAll(): Promise<void> {
  saving.value = true

  try {
    // Порядок сохраняем целиком, вместе со скрытыми: пустой список означал бы
    // «как в приложении», а спрятанные пункты в нём остались бы видимыми.
    await save({
      menu_order: order.value,
      menu_hidden: [...hidden.value],
      operation_mode: operationMode.value,
      show_code_block: showCodeBlock.value,
      remember_operation_mode: rememberOperationMode.value,
      locale: localeChoice.value,
      theme: themeChoice.value,
      accent: accentChoice.value,
    })

    $notify.add(t('options_page.saved'), { type: 'success', timer: 4 })
  } catch (err: unknown) {
    $notify.add(formatApiError(err, t('options_page.save_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await load()
  fillFromOptions()
})

// Настройки могли прийти после первого отрисовки — тогда форму надо заполнить.
watch(options, fillFromOptions)
</script>

<style scoped>
.options-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 860px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.options-tabs {
  margin-bottom: 0;
}

.options-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.options-card {
  padding: 16px;
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.options-card__title {
  margin: 0 0 4px;
  font-size: 15px;
  color: var(--text);
}

.options-card__hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Подзаголовок внутри карточки настроек: у «Интерфейса» внутри три смысловые
   части — оформление и блок «Код» — и без него они сливаются в один список. */
.options-card__subtitle {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: normal;
  color: var(--text-secondary);
}

.options-divider {
  height: 1px;
  margin: 16px 0 12px;
  background: var(--bg-hover);
}

.menu-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.menu-list--nested {
  margin: 0 0 0 26px;
}

.menu-row-wrap {
  border-top: 1px solid var(--border);
}

.menu-list > .menu-row-wrap:first-child,
.menu-list--nested > .menu-row-wrap:first-child {
  border-top: none;
}

.menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.menu-row--plain {
  justify-content: flex-start;
  padding: 0 0 4px;
}

/* Спрятанный пункт остаётся в списке и гаснет: иначе его нечем будет
   вернуть, кроме как сбросом всех настроек. */
.menu-row--off .menu-row__label {
  color: var(--text-dim);
  text-decoration: line-through;
}

.menu-row__check {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.menu-row__label {
  font-size: 14px;
  color: var(--text-secondary);
}

.menu-row__move {
  display: flex;
  gap: 4px;
}

.menu-move {
  width: 28px;
  height: 26px;
  font-size: 14px;
  line-height: 1;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}

.menu-move:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-hover);
}

.menu-move:disabled {
  opacity: 0.35;
  cursor: default;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-choice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}

.mode-choice--on {
  color: var(--info-ink);
  background: var(--info-bg);
  border-color: var(--info-bg);
}
</style>
