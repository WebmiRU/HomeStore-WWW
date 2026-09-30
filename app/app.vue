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
        :links="item.links"
        :more="item.more"
        @close="removeNotify"
      />
    </div>

    <AppHeader @search="doSearch" />

    <hr class="page-divider" />

    <NuxtPage />

    <!--
      Блок сканера внизу прячется настройкой. Скрытие только здесь: сканер
      продолжит работать, он же слушает клавиатуру на любой странице, — просто
      поле для ручного ввода кода исчезает.
    -->
    <footer v-if="showCodeBlock" class="page-footer">
      <div class="uuid-search">
        <span class="uuid-label">{{ t('scanner.code_label') }}</span>
        <input
          v-model="uuidQuery"
          type="text"
          :placeholder="t('scanner.code_placeholder')"
          class="uuid-input"
          @keydown.enter="doUuidSearch"
        />
        <button class="uuid-btn" @click="doUuidSearch">{{ t('scanner.find') }}</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import { keyToLatin } from '~/utils/scanKey'

const { $api, $notify } = useNuxtApp()
const { items, remove: removeNotify } = $notify
const router = useRouter()
const { options, load: loadOptions } = useOptions()
const { t } = useI18n()

/**
 * Оформление — атрибуты на <html>, а не классы на теле: значения выбираются
 * при отрисовке на сервере, иначе первый экран успевает показаться в одной
 * теме и перекраситься в другой. Через useHead атрибуты попадают и в
 * серверный HTML, и в клиентский, поэтому расхождения при гидрации не бывает.
 */
const { resolved: theme, accent, watchSystem: watchSystemTheme } = useTheme()

useHead({
  htmlAttrs: {
    'data-theme': theme,
    'data-accent': accent,
  },
})

// Прячется по настройке, а настройки приезжают после монтирования: до ответа
// блок виден, как и раньше, и исчезает сам. Прыгать им на сервере нельзя —
// настройки читаются с токеном, который живёт в localStorage.
const showCodeBlock = computed(() => options.value.show_code_block)

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

function onKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return
  if (e.ctrlKey || e.metaKey || e.altKey) return

  // keyToLatin вернёт пустую строку для непечатных клавиш (Enter, Tab,
  // стрелки): key у них многобайтный, и длина тут не равна единице.
  const key = keyToLatin(e)
  if (key === '') return

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
  // Настройки нужны в двух местах приложения: в шапке (меню) и здесь (блок
  // «Код»). Грузим из корня один раз — оба берут одно и то же состояние.
  loadOptions()
  // Системную тему знает только браузер: на сервере prefers-color-scheme нет.
  watchSystemTheme()
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
    $notify.add(formatApiError(err, t('notify.search_failed')), { type: 'error', timer: 10 })
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
  /*
   * Поля браузера по умолчанию (8px) не сброшены, и страница становилась на
   * 16px выше окна: 8px сверху и 8px снизу. На ноутбуке с высотой 965px из-за
   * этих шестнадцати пикселей появлялся вертикальный скролл там, где весь
   * список с кнопками пагинации и так помещался — и страница казалась
   * «длиннее», чем она есть.
   */
  margin: 0;
  background: var(--bg);
  color: var(--text-secondary);
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
  /*
    Ограничение высоты появилось из-за мультизагрузки: уведомление получает
    каждый файл, и пачка из пятнадцати снимков расталкивала бы столбик за
    верхний край экрана. Теперь столбик растёт вверх до 80% высоты окна и
    дальше прокручивается.
  */
  max-height: 80vh;
  overflow-y: auto;
  z-index: 999;
}

.notification {
  position: relative;
  overflow: hidden;
  min-height: 52px;
  padding: 15px 48px 15px 18px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--text-muted);
  border-radius: 6px;
  background-color: var(--bg-elevated);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--info-bg) 45%, transparent);
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
}

.notification > span {
  display: block;
}

.notification > span + span {
  margin-top: 6px;
}

/*
 * Ссылки внутри уведомления. Уведомление может перечислять предметы — с
 * коллизиями по кодам, — и без перехода по ссылке название пришлось бы искать
 * в списке вручную. Отступ как у строк текста, иначе список прилипает к
 * заголовку.
 */
.notification__link {
  display: block;
  margin-top: 4px;
  color: var(--info-hover);
  font-size: 13px;
  line-height: 1.4;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification__link:hover {
  color: var(--link-hover);
  text-decoration: underline;
}

.notification__more {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.notification--success {
  border-left-color: var(--success);
}
.notification--success .progress {
  background-color: var(--success);
}

.notification--error,
.notification--danger {
  border-left-color: var(--danger);
}
.notification--error .progress,
.notification--danger .progress {
  background-color: var(--danger);
}

.notification--warning {
  border-left-color: var(--warn);
}
.notification--warning .progress {
  background-color: var(--warn);
}

.notification--info {
  border-left-color: var(--info);
}
.notification--info .progress {
  background-color: var(--info);
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
  color: var(--text-muted);
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
  background-color: var(--bg-elevated);
  color: var(--text);
}

.notification .progress {
  height: 3px;
  width: 100%;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  transform-origin: left;
  background-color: var(--text-muted);
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
  /*
   * Отступ от меню до линии — половина прежнего. Меню занимает три строки на
   * узком экране, и на высоком окне пустое поле съедало место, из-за чего
   * кнопки пагинации в списке предметов уезжали за нижний край: список
   * показан, а «вперёд/назад» — нет, и страница выглядит короткой, хотя
   * записей много.
   */
  margin: 9px 0 8px;
  background: linear-gradient(to right, var(--bg-hover), var(--bg-elevated) 30%, var(--bg-hover));
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
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.uuid-label {
  font-size: 13px;
  color: var(--text-dim);
  white-space: nowrap;
}

.uuid-input {
  width: 300px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: monospace;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
}

.uuid-input:focus {
  border-color: var(--border-strong);
  color: var(--text);
}

.uuid-btn {
  padding: 6px 14px;
  font-size: 13px;
  background: var(--bg-hover);
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.uuid-btn:hover {
  background: color-mix(in srgb, var(--bg-hover) 70%, var(--text));
  color: var(--text);
}
</style>
