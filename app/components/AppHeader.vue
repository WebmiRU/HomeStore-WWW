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
        />
        <button type="submit" class="header-search__btn">Поиск</button>
      </form>
    </div>

    <nav class="entity-nav">
      <NuxtLink to="/" class="entity-link">Главная</NuxtLink>
      <NuxtLink to="/items" class="entity-link">Предметы</NuxtLink>
      <NuxtLink to="/stores" class="entity-link">Хранилища</NuxtLink>
      <NuxtLink to="/warehouses" class="entity-link">Склады</NuxtLink>
      <NuxtLink to="/label-presets" class="entity-link">Шаблоны</NuxtLink>
      <NuxtLink to="/label-lists" class="entity-link">Этикетки</NuxtLink>
      <NuxtLink to="/users" class="entity-link">Пользователи</NuxtLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits<{
  search: [query: string]
}>()

const { currentUserId } = useCurrentUser()
const { profile, load: loadProfile } = useUserProfile()

const searchQuery = ref('')

const profileHref = computed<string | null>(() =>
  currentUserId.value !== null ? `/users/${currentUserId.value}/edit` : null
)

function doSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  emit('search', q)
}

onMounted(() => {
  loadProfile()
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

.entity-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.entity-link {
  font-size: 14px;
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

@media (max-width: 768px) {
  .header-search__input {
    font-size: 16px;
  }

  .header-search__btn {
    font-size: 16px;
  }
}
</style>