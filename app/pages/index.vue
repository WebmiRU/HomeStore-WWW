<template>
  <div class="home">
    <div class="mode-buttons">
      <button
        type="button"
        class="mode-btn mode-btn--search"
        :class="{ 'mode-btn--active': activeMode === 'search' }"
        @click="activeMode = 'search'"
      >
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
      </button>

      <button
        type="button"
        class="mode-btn mode-btn--add"
        :class="{ 'mode-btn--active': activeMode === 'add' }"
        @click="activeMode = 'add'"
      >
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
      </button>

      <button
        type="button"
        class="mode-btn mode-btn--writeoff"
        :class="{ 'mode-btn--active': activeMode === 'writeoff' }"
        @click="activeMode = 'writeoff'"
      >
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
import { ref } from 'vue'

type Mode = 'search' | 'add' | 'writeoff'

const activeMode = ref<Mode>('search')
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
  transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
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

.mode-btn--active {
  transform: translateY(-3px);
}

.mode-btn--search.mode-btn--active {
  background: #1b2b45;
  border-color: #4d94f7;
  color: #d7e6ff;
  box-shadow: 0 0 0 1px #4d94f7, 0 0 24px rgba(77, 148, 247, 0.3);
}

.mode-btn--add.mode-btn--active {
  background: #1b3525;
  border-color: #3fb950;
  color: #d8f5dc;
  box-shadow: 0 0 0 1px #3fb950, 0 0 24px rgba(63, 185, 80, 0.3);
}

.mode-btn--writeoff.mode-btn--active {
  background: #3a2e1a;
  border-color: #d29922;
  color: #f7e6c2;
  box-shadow: 0 0 0 1px #d29922, 0 0 24px rgba(210, 153, 34, 0.3);
}
</style>
