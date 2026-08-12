<template>
  <div class="home">
    <div class="mode-buttons">
      <NuxtLink to="/search" class="mode-btn mode-btn--search">
        <svg
          class="mode-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <span class="mode-label">Поиск</span>
      </NuxtLink>

      <NuxtLink to="/items/create" class="mode-btn mode-btn--add">
        <svg
          class="mode-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span class="mode-label">Добавить</span>
      </NuxtLink>

      <button class="mode-btn mode-btn--writeoff" @click="onWriteOff">
        <svg
          class="mode-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 4h16v16H4z" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <polyline points="9 13 12 16 15 13" />
        </svg>
        <span class="mode-label">Списать</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { $notify } = useNuxtApp()

function onWriteOff() {
  $notify.add('Раздел «Списание» в разработке', { type: 'info', timer: 5 })
}
</script>

<style scoped>
.home {
  padding-top: 8px;
}

.mode-buttons {
  display: flex;
  gap: 20px;
  width: 100%;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex: 1;
  padding: 28px 32px;
  border-radius: 10px;
  border: 1px solid #333;
  background: #222;
  color: #ccc;
  cursor: pointer;
  text-decoration: none;
  font-family: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.mode-btn:hover {
  transform: translateY(-3px);
  background: #2a2a2a;
}

.mode-icon {
  width: 56px;
  height: 56px;
}

.mode-label {
  font-size: 20px;
  letter-spacing: 0.5px;
}

.mode-btn--search {
  border-color: #3a4a6a;
}
.mode-btn--search .mode-icon {
  color: #4d94f7;
}
.mode-btn--search:hover {
  border-color: #4d94f7;
}

.mode-btn--add {
  border-color: #3a5a3a;
}
.mode-btn--add .mode-icon {
  color: #3fb950;
}
.mode-btn--add:hover {
  border-color: #3fb950;
}

.mode-btn--writeoff {
  border-color: #5a4a3a;
}
.mode-btn--writeoff .mode-icon {
  color: #d29922;
}
.mode-btn--writeoff:hover {
  border-color: #d29922;
}
</style>
