<template>
  <header class="app-header">
    <div class="header-row">
      <NuxtLink
        v-if="profileHref"
        :to="profileHref"
        class="header-avatar"
        :title="profile?.name ?? t('common.profile')"
      >
        <UserAvatar :user="profile ?? { id: currentUserId ?? undefined }" :size="56" />
      </NuxtLink>
      <div v-else class="header-avatar header-avatar--placeholder header-avatar--empty">
        <UserAvatar :user="{ id: undefined }" :size="56" />
      </div>

      <form class="header-search" @submit.prevent="doSearch">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('common.search_placeholder')"
          class="header-search__input"
          @keydown.enter.prevent="doSearch"
        />
        <button type="button" class="header-search__btn" @click="doSearch">{{ t('common.search') }}</button>
      </form>

      <button
        v-if="currentUserId !== null"
        type="button"
        class="header-logout"
        :disabled="loggingOut"
        @click="logout"
      >
        {{ loggingOut ? t('common.logging_out') : t('common.logout') }}
      </button>

      <!--
        Переключатель темы в шапке: настройка есть и в «Настройках», но
        перекрасить интерфейс нужно здесь и сейчас, не заходя туда. Подпись
        на кнопке — то, что получится после нажатия, а не то, что сейчас:
        иначе кнопка врёт, пока в ней не разобрались.

        Иконка нарисована тут, а не взята из файла: солнце и луна — две
        окружности и несколько лучей, и ради них держать в проекте картинку
        неразумно. Ток currentColor красит её под тему сама.
      -->
      <button
        type="button"
        class="header-theme"
        :title="resolved === 'light' ? t('theme.to_dark') : t('theme.to_light')"
        :aria-label="resolved === 'light' ? t('theme.to_dark') : t('theme.to_light')"
        @click="toggle"
      >
        <svg
          class="header-theme__icon"
          :class="resolved === 'light' ? 'header-theme__icon--sun' : 'header-theme__icon--moon'"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <template v-if="resolved === 'light'">
            <circle cx="12" cy="12" r="4.2" />
            <path
              d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"
              stroke-linecap="round"
            />
          </template>
          <path v-else d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11Z" />
        </svg>
      </button>
    </div>

    <nav class="entity-nav">
      <template v-for="entry in visibleTree" :key="entry.key">
        <NuxtLink v-if="!isGroup(entry)" :to="entry.to" class="entity-link">
          {{ t(entry.labelKey) }}
        </NuxtLink>

        <div
          v-else
          class="entity-group"
          :class="{
            'entity-group--open': openGroup === entry.key,
            'entity-group--active': isGroupActive(entry),
          }"
        >
          <button
            type="button"
            class="entity-link entity-group__toggle"
            :aria-expanded="openGroup === entry.key"
            aria-haspopup="true"
            @click="toggleGroup(entry.key)"
          >
            {{ t(entry.labelKey) }}
            <span class="entity-group__caret" aria-hidden="true">▾</span>
          </button>

          <div v-if="openGroup === entry.key" class="entity-group__menu">
            <NuxtLink v-for="item in entry.items" :key="item.key" :to="item.to" class="entity-group__item">
              {{ t(item.labelKey) }}
            </NuxtLink>
          </div>
        </div>
      </template>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { isNavGroup, type NavEntry, type NavGroup } from '~/utils/navigation'

/**
 * Меню приходит из utils/navigation: там и порядок по умолчанию, и ключи
 * пунктов. Здесь оно уже то, что видит пользователь, — без спрятанных
 * пунктов и в его порядке.
 */
const emit = defineEmits<{
  search: [query: string]
}>()

const { $api, $notify } = useNuxtApp()
const router = useRouter()
const route = useRoute()
const { currentUserId, setCurrentUserId } = useCurrentUser()
const { profile, load: loadProfile, clear: clearProfile } = useUserProfile()
const { visibleTree, load: loadOptions, reset: resetOptions } = useOptions()
// Тема и акцент живут в useState, поэтому шапка читает их и обновляет сама:
// перекраска должна происходить на всей странице сразу, а не только там, где
// настройка выбрана.
const { resolved, toggle } = useTheme()
const { t } = useI18n()

const searchQuery = ref('')
const loggingOut = ref(false)
const openGroup = ref<string | null>(null)

function isGroup(entry: NavEntry): entry is NavGroup {
  return isNavGroup(entry)
}

function isGroupActive(group: NavGroup): boolean {
  return group.items.some((item) => route.path === item.to || route.path.startsWith(`${item.to}/`))
}

function toggleGroup(key: string) {
  openGroup.value = openGroup.value === key ? null : key
}

function closeGroup() {
  openGroup.value = null
}

// Клик мимо группы и Escape закрывают меню: иначе оно остаётся висеть поверх
// страницы после перехода.
function onDocumentPointerDown(event: PointerEvent) {
  if (openGroup.value === null) return
  const target = event.target as HTMLElement | null
  if (!target?.closest('.entity-group')) closeGroup()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeGroup()
}

// Любой переход закрывает раскрытую группу. Ориентироваться пользователю есть
// чем: у родителя подсвечено активное состояние, а у пункта в самой группе —
// подсветка по маршруту.
watch(
  () => route.fullPath,
  closeGroup,
)

// Подставляем текущий запрос из URL (например, при открытии /search?q=...),
// чтобы строка поиска отражала то, что уже ищем.
watch(
  () => route.query.q,
  (value) => {
    if (typeof value === 'string' && value !== '') {
      searchQuery.value = value
    }
  },
  { immediate: true },
)

const profileHref = computed<string | null>(() =>
  currentUserId.value !== null ? `/users/${currentUserId.value}` : null
)

function doSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  emit('search', q)
}

async function logout() {
  loggingOut.value = true
  try {
    await $api.auth.logout()
  } catch {
    // Даже если сервер недоступен — выходим на клиенте
  } finally {
    localStorage.removeItem('home-store-token')
    localStorage.removeItem('home-store-user-id')
    setCurrentUserId(null)
    clearProfile()
    resetOptions()
    $notify.add(t('notify.logged_out'), { type: 'info', timer: 5 })
    router.push('/login')
    loggingOut.value = false
  }
}

onMounted(() => {
  loadProfile()
  loadOptions()
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<style scoped>
.app-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-avatar {
  flex-shrink: 0;
  display: inline-flex;
  border-radius: 50%;
  transition: box-shadow 0.15s ease;
}

a.header-avatar:hover {
  box-shadow: 0 0 0 2px var(--info-bg), 0 0 0 4px var(--info-bg);
}

.header-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-search__input {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  font-size: 16px;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  outline: none;
}

.header-search__input:focus {
  border-color: var(--border-strong);
}

.header-search__btn {
  flex-shrink: 0;
  padding: 10px 22px;
  font-size: 16px;
  background: var(--bg-hover);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  cursor: pointer;
}

.header-search__btn:hover {
  background: color-mix(in srgb, var(--bg-hover) 70%, var(--text));
}

.header-logout {
  flex-shrink: 0;
  padding: 10px 18px;
  font-size: 14px;
  font-family: inherit;
  background: var(--danger-bg);
  color: var(--danger-ink);
  border: 1px solid var(--danger);
  border-radius: 6px;
  cursor: pointer;
}

.header-logout:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 26%, var(--bg-elevated));
}

.header-logout:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Кнопка темы. Рисуется иконкой, а не картинкой: ток currentColor красит её
   под тему сама, и вид у неё тот же, что у соседних кнопок. */
.header-theme {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.header-theme:hover {
  color: var(--text);
  border-color: var(--border);
  background: var(--bg-elevated);
}

.header-theme__icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}

/* Луна сплошная: обводить её контуром — значит нарисовать луну с дыркой, а
   это уже другой знак. */
.header-theme__icon--moon {
  fill: currentColor;
  stroke: none;
}

.header-theme__icon--sun {
  fill: currentColor;
  stroke: currentColor;
}

.header-theme__icon--sun circle {
  fill: none;
}

.entity-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

/* Группа — обёртка с выпадающим списком, поэтому ей нужен собственный
   контекст позиционирования для меню. */
.entity-group {
  position: relative;
}

.entity-link {
  font-size: 14px;
  font-family: inherit;
  color: var(--info);
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.entity-link:hover {
  background: color-mix(in srgb, var(--bg-elevated) 80%, var(--text));
  color: var(--info);
  border-color: var(--border-strong);
}

.router-link-active.entity-link {
  color: var(--info);
  background: var(--info-bg);
  border-color: var(--info-bg);
}

/* Родитель группы не ссылка, но должен выглядеть ровно так же — иначе
   строка меню разъезжается. Плюс активное состояние, когда мы внутри. */
.entity-group__toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  cursor: pointer;
}

.entity-group__toggle.router-link-active,
.entity-group--active > .entity-group__toggle {
  color: var(--info);
  background: var(--info-bg);
  border-color: var(--info-bg);
}

.entity-group__caret {
  /* Стрелка раньше была 10px при opacity 0.7 — на тёмном фоне её было видно
     только при поиске глазами, и пункт с вложенными разделами ничем не
     выдавал себя. Теперь она читается сразу, как в обычном выпадающем меню. */
  font-size: 14px;
  line-height: 1;
  opacity: 0.9;
  transition: transform 0.15s ease;
}

.entity-group--open .entity-group__caret {
  transform: rotate(180deg);
}

.entity-group__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 180px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  background: var(--bg-sunken);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--bg-sunken) 45%, transparent);
}

.entity-group__item {
  padding: 7px 10px;
  font-size: 14px;
  color: var(--info);
  text-decoration: none;
  border-radius: 4px;
  white-space: nowrap;
}

.entity-group__item:hover {
  background: color-mix(in srgb, var(--bg-elevated) 80%, var(--text));
  color: var(--info);
}

.router-link-active.entity-group__item {
  background: var(--info-bg);
  color: var(--info);
}

@media (max-width: 768px) {
  .header-search__input {
    font-size: 16px;
  }

  .header-search__btn {
    font-size: 16px;
  }
}
</style>