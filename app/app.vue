<template>
  <div class="page">
    <div class="notify-pool">
      <Notify
        v-for="item in items"
        :key="item.id"
        :id="item.id"
        :message="item.message"
        :type="item.type"
        :timer="item.timer"
        @close="removeNotify"
      />
    </div>

    <AppHeader @search="doSearch" />

    <hr class="page-divider" />

    <NuxtPage />

    <footer class="page-footer">
      <div class="uuid-search">
        <span class="uuid-label">КОД:</span>
        <input
          v-model="uuidQuery"
          type="text"
          placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
          class="uuid-input"
          @keydown.enter="doUuidSearch"
        />
        <button class="uuid-btn" @click="doUuidSearch">Найти</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const { items, remove: removeNotify } = $notify
const router = useRouter()

const uuidQuery = ref('')
const { next: triggerSearch } = useSearchTrigger()

// Клавиатурный буфер-сканер, работающий на любой странице: отсканированный
// код «эмулирует» переход на главную с ?scan=<code>, где его обрабатывает
// главная страница (в сохранённом режиме сессии).
let buffer = ''
let scanTimer: ReturnType<typeof setTimeout> | null = null

const MIN_CODE_LEN = 8
const MAX_CODE_LEN = 256
const SCAN_DEBOUNCE_MS = 100

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

// Символ, который физическая клавиша даёт в американской раскладке:
// [без Shift, с Shift]. e.code не зависит от раскладки клавиатуры,
// поэтому символы ()/:., — не превращаются в Ж/ю/б при русском языке.
const KEY_SYMBOLS: Record<string, [string, string]> = {
  Minus: ['-', '_'],
  Equal: ['=', '+'],
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: ['\\', '|'],
  Semicolon: [';', ':'],
  Quote: ["'", '"'],
  Backquote: ['`', '~'],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  Space: [' ', ' '],
}

const SHIFT_DIGITS = [')', '!', '@', '#', '$', '%', '^', '&', '*', '(']

function keyToLatin(e: KeyboardEvent): string {
  const code = e.code
  const shifted = e.shiftKey

  // Буквы: физическая клавиша 'KeyA'..'KeyZ' — латинская буква по определению.
  if (code.startsWith('Key')) {
    const latin = code.slice(3) // 'A'..'Z'
    return shifted ? latin.toUpperCase() : latin.toLowerCase()
  }

  // Цифры: 'Digit0'..'Digit9'.
  if (code.startsWith('Digit')) {
    const digit = code.slice(5) // '0'..'9'
    if (digit.length === 1) {
      const i = digit.charCodeAt(0) - 48
      return shifted ? SHIFT_DIGITS[i]! : digit
    }
  }

  const pair = KEY_SYMBOLS[code]
  if (pair) {
    return shifted ? pair[1] : pair[0]
  }

  // Непечатные клавиши (Enter, Tab, стрелки и т.д.) — игнорируем.
  return ''
}

function onKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return
  if (e.ctrlKey || e.metaKey || e.altKey) return

  const key = keyToLatin(e)
  if (key.length !== 1) return

  buffer += key
  if (buffer.length > MAX_CODE_LEN) {
    buffer = buffer.slice(0, MAX_CODE_LEN)
  }

  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    const code = buffer
    buffer = ''
    if (code.length >= MIN_CODE_LEN) {
      submitScan(code)
    }
  }, SCAN_DEBOUNCE_MS)
}

function submitScan(code: string) {
  // Сканирование с любой страницы: обрабатывается главной через ?scan=.
  router.push({ path: '/', query: { scan: code } })
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (scanTimer) clearTimeout(scanTimer)
})

async function doSearch(q: string) {
  try {
    // Навигация сразу: страница поиска сама покажет спиннер и сделает запрос.
    await router.push({ path: '/search', query: { q } })
    // Если уже на /search с тем же q — route.query не изменится и watch не
    // сработает; форсируем повторный поиск меткой-триггером.
    triggerSearch()
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка поиска'), { type: 'error', timer: 10 })
  }
}

function doUuidSearch() {
  const q = uuidQuery.value.trim()
  if (!q) return
  // Эмулируем сканер: код обрабатывается на главной тем же сценарием,
  // что и ввод с устройства (режим, найденное/список, «код не найден»).
  router.push({ path: '/', query: { scan: q } })
}
</script>

<style>
body {
  background: #1a1a1a;
  color: #ccc;
  font-family: 'Ubuntu Condensed', sans-serif;
}

@keyframes progress {
  0%   { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}

.notify-pool {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 400px;
  z-index: 999;
}

.notification {
  position: relative;
  overflow: hidden;
  min-height: 52px;
  padding: 15px 48px 15px 18px;
  border: 1px solid #333;
  border-left: 4px solid #8b949e;
  border-radius: 6px;
  background-color: #1a1a2e;
  box-shadow: 0 8px 24px rgba(1, 4, 9, 0.45);
  color: #c9d1d9;
  font-size: 13px;
  line-height: 1.5;
}

.notification > span {
  display: block;
}

.notification > span + span {
  margin-top: 6px;
}

.notification--success {
  border-left-color: #3fb950;
}
.notification--success .progress {
  background-color: #3fb950;
}

.notification--error,
.notification--danger {
  border-left-color: #f85149;
}
.notification--error .progress,
.notification--danger .progress {
  background-color: #f85149;
}

.notification--warning {
  border-left-color: #d29922;
}
.notification--warning .progress {
  background-color: #d29922;
}

.notification--info {
  border-left-color: #2f81f7;
}
.notification--info .progress {
  background-color: #2f81f7;
}

.notification .delete {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #8b949e;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.notification .delete::before,
.notification .delete::after {
  content: '';
  position: absolute;
  top: 13px;
  left: 7px;
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background-color: currentColor;
}

.notification .delete::before {
  transform: rotate(45deg);
}

.notification .delete::after {
  transform: rotate(-45deg);
}

.notification .delete:hover {
  background-color: #21262d;
  color: #f0f6fc;
}

.notification .progress {
  height: 3px;
  width: 100%;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  transform-origin: left;
  background-color: #8b949e;
  opacity: 0.8;
  animation: progress linear;
  animation-direction: reverse;
  animation-fill-mode: forwards;
}

@media (max-width: 768px) {
  .page {
    padding: 12px !important;
  }

  .uuid-search {
    width: 100%;
    box-sizing: border-box;
    flex-wrap: wrap;
    row-gap: 6px;
  }

  .uuid-label {
    flex: 1 1 100%;
  }

  .uuid-input {
    flex: 1 1 140px;
    width: auto;
    min-width: 0;
    font-size: 16px;
  }

  .uuid-btn {
    flex-shrink: 0;
    font-size: 16px;
  }

  input, select, textarea {
    font-size: 16px !important;
  }
}
</style>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24px 20px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.page-divider {
  border: none;
  height: 1px;
  margin: 18px 0 8px;
  background: linear-gradient(to right, #444, #2a2a2a 30%, #444);
}

.page-footer {
  margin-top: auto;
  padding-top: 40px;
  display: flex;
  justify-content: center;
}

.uuid-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
}

.uuid-label {
  font-size: 13px;
  color: #777;
  white-space: nowrap;
}

.uuid-input {
  width: 300px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: monospace;
  background: #2a2a2a;
  color: #bbb;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
}

.uuid-input:focus {
  border-color: #666;
  color: #ddd;
}

.uuid-btn {
  padding: 6px 14px;
  font-size: 13px;
  background: #333;
  color: #aaa;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.uuid-btn:hover {
  background: #444;
  color: #ddd;
}
</style>
