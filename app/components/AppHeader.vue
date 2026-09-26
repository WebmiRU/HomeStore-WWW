<template>
  <header class="app-header">
    <div class="header-row">
      <NuxtLink
        v-if="profileHref"
        :to="profileHref"
        class="header-avatar"
        :title="profile?.name ?? 'Мой профиль'"
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
          placeholder="Поиск предметов и хранилищ..."
          class="header-search__input"
          @keydown.enter.prevent="doSearch"
        />
        <button type="button" class="header-search__btn" @click="doSearch">Поиск</button>
      </form>

      <button
        v-if="currentUserId !== null"
        type="button"
        class="header-logout"
        :disabled="loggingOut"
        @click="logout"
      >
        {{ loggingOut ? 'Выход...' : 'Выйти' }}
      </button>
    </div>

    <nav class="entity-nav">
      <template v-for="entry in navTree" :key="entry.label">
        <NuxtLink v-if="!isGroup(entry)" :to="entry.to" class="entity-link">
          {{ entry.label }}
        </NuxtLink>

        <div
          v-else
          class="entity-group"
          :class="{
            'entity-group--open': openGroup === entry.label,
            'entity-group--active': isGroupActive(entry),
          }"
        >
          <button
            type="button"
            class="entity-link entity-group__toggle"
            :aria-expanded="openGroup === entry.label"
            aria-haspopup="true"
            @click="toggleGroup(entry.label)"
          >
            {{ entry.label }}
            <span class="entity-group__caret" aria-hidden="true">▾</span>
          </button>

          <div v-if="openGroup === entry.label" class="entity-group__menu">
            <NuxtLink v-for="item in entry.items" :key="item.to" :to="item.to" class="entity-group__item">
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>
      </template>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

type NavItem = { label: string; to: string }
type NavGroup = { label: string; items: NavItem[] }
type NavEntry = NavItem | NavGroup

/**
 * Меню описано данными, а не разметкой: пункты наращиваются пачками, и
 * вложенность не должна требовать копирования вёрстки. Раскрытая группа одна
 * за раз, иначе в шапке превращается в кашу.
 */
const navTree: NavEntry[] = [
  { label: 'Главная', to: '/' },
  { label: 'Предметы', to: '/items' },
  { label: 'Хранилища', to: '/stores' },
  { label: 'Склады', to: '/warehouses' },
  { label: 'Категории', to: '/categories' },
  {
    label: 'Свойства',
    items: [
      { label: 'Свойства', to: '/properties' },
      { label: 'Группы свойств', to: '/property-groups' },
      { label: 'Ед. изм.', to: '/units' },
      // Справочник — такой же источник значений, как единица измерения: тип
      // свойства ссылается на оба. Держать их порознь в шапке незачем.
      { label: 'Справочники', to: '/dictionaries' },
    ],
  },
  { label: 'Движения', to: '/stock-operations' },
  {
    label: 'Маркировка',
    items: [
      { label: 'Этикетки', to: '/label-lists' },
      { label: 'Шаблоны', to: '/label-presets' },
    ],
  },
  {
    // Люди и их права — два раздела об одном, поэтому в шапке они одним пунктом.
    // «Команда» короче «Пользователи и доступ» и звучит в том же просторе,
    // что остальные пункты.
    label: 'Команда',
    items: [
      { label: 'Пользователи', to: '/users' },
      { label: 'Доступ', to: '/access' },
    ],
  },
  { label: 'Журнал', to: '/journal' },
  { label: 'Чистка кодов', to: '/orphan-codes' },
]

const emit = defineEmits<{
  search: [query: string]
}>()

const { $api, $notify } = useNuxtApp()
const router = useRouter()
const route = useRoute()
const { currentUserId, setCurrentUserId } = useCurrentUser()
const { profile, load: loadProfile, clear: clearProfile } = useUserProfile()

const searchQuery = ref('')
const loggingOut = ref(false)
const openGroup = ref<string | null>(null)

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

function isGroupActive(group: NavGroup): boolean {
  return group.items.some((item) => route.path === item.to || route.path.startsWith(`${item.to}/`))
}

function toggleGroup(label: string) {
  openGroup.value = openGroup.value === label ? null : label
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
  currentUserId.value !== null ? `/users/${currentUserId.value}/edit` : null
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
    $notify.add('Вы вышли из системы', { type: 'info', timer: 5 })
    router.push('/login')
    loggingOut.value = false
  }
}

onMounted(() => {
  loadProfile()
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
  box-shadow: 0 0 0 2px #2a2a3a, 0 0 0 4px #3a3a5a;
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
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 6px;
  outline: none;
}

.header-search__input:focus {
  border-color: #666;
}

.header-search__btn {
  flex-shrink: 0;
  padding: 10px 22px;
  font-size: 16px;
  background: #333;
  color: #ddd;
  border: 1px solid #555;
  border-radius: 6px;
  cursor: pointer;
}

.header-search__btn:hover {
  background: #444;
}

.header-logout {
  flex-shrink: 0;
  padding: 10px 18px;
  font-size: 14px;
  font-family: inherit;
  background: #3a1f1f;
  color: #f8a8a8;
  border: 1px solid #7a3a3a;
  border-radius: 6px;
  cursor: pointer;
}

.header-logout:hover:not(:disabled) {
  background: #4d2a2a;
}

.header-logout:disabled {
  opacity: 0.5;
  cursor: default;
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
  color: #88a;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.entity-link:hover {
  background: #2a2a2a;
  color: #aaf;
  border-color: #444;
}

.router-link-active.entity-link {
  color: #aaf;
  background: #2a2a3a;
  border-color: #3a3a5a;
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
  color: #aaf;
  background: #2a2a3a;
  border-color: #3a3a5a;
}

.entity-group__caret {
  font-size: 10px;
  opacity: 0.7;
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
  background: #24242c;
  border: 1px solid #444;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

.entity-group__item {
  padding: 7px 10px;
  font-size: 14px;
  color: #88a;
  text-decoration: none;
  border-radius: 4px;
  white-space: nowrap;
}

.entity-group__item:hover {
  background: #2f2f3a;
  color: #aaf;
}

.router-link-active.entity-group__item {
  background: #2a2a3a;
  color: #aaf;
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