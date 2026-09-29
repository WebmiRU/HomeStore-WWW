<template>
  <div class="codes-editor">
    <div v-for="(code, index) in rows" :key="index" class="input-group codes-editor__row">
      <!--
        Кнопки перестановки — слева от поля, а не перетаскивание.
        Перетаскивание на адаптиве не работает: попасть пальцем в
        «ручку» и уследить за ней почти невозможно, а нажимать две кнопки
        можно хоть одним большим пальцем. И наводить курсор незачем.
      -->
      <template v-if="!readonly">
        <button
          type="button"
          class="input-group__btn input-group__btn--move input-group__btn--icon"
          :title="t('images.order_up')"
          :disabled="index === 0"
          @click="moveCode(index, -1)"
        >▲</button>
        <button
          type="button"
          class="input-group__btn input-group__btn--move input-group__btn--icon"
          :title="t('images.order_down')"
          :disabled="index === codes.length - 1"
          @click="moveCode(index, 1)"
        >▼</button>
      </template>

      <input
        :ref="(el) => setInput(el, index)"
        :value="code"
        type="text"
        class="field-input input-group__control"
        maxlength="256"
        :placeholder="t('items.code_hint')"
        :readonly="readonly"
        autocomplete="off"
        @input="onInput(index, $event)"
        @keydown="onKeydown($event)"
      />

      <!--
        Кнопка «−» убирает строку. Кнопки «+» нет и не нужна: пустая строка
        в конце списка всегда есть, и следующая появляется сама, как только
        в поле что-то введено.
      -->
      <button
        v-if="!readonly"
        type="button"
        class="input-group__btn input-group__btn--minus input-group__btn--icon"
        :title="index === 0 ? t('items.code_clear') : t('items.code_remove')"
        @click="removeCode(index)"
      >−</button>
    </div>

    <p class="field-hint">
      {{ t('items.codes_hint') }}
    </p>

    <!--
      Крыжик показывается всегда, независимо от числа кодов: у предмета может
      не быть ни одного кода, и «нулевой» предмет — тоже законное состояние,
      просто пополнить его можно будет лишь новой наклейкой. Ограничивать
      крыжик числом кодов значило бы прятать настройку ровно у тех предметов,
      где она нужнее всего.
    -->
    <label v-if="!readonly" class="field field--check">
      <input
        type="checkbox"
        class="field-check"
        :checked="releaseCodeOnWriteoff"
        @change="toggleReleaseCode"
      >
      <span>{{ t('items.release_code_on_writeoff') }}</span>
      <span class="field-hint">
        {{ t('items.release_code_on_writeoff_hint') }}
      </span>
    </label>
  </div>
</template>

<script setup lang="ts">
/**
 * Редактор кодов предмета: список строк с кнопками «−» и «+» по образцу
 * значений свойств (ItemPropertiesEditor).
 *
 * Отдельный компонент, а не поле в create/edit, потому что список нужен на
 * обеих страницах, а правила попарной группировки кнопок у них общие.
 *
 * Разбор сканирования — в composable useScanIntoField: он же нужен и полю
 * кода на формах хранилищ.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useScanIntoField } from '~/composables/useScanIntoField'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue: string[]
  readonly?: boolean
  /** Пометка «списывать по коду» живёт в карточке предмета, а не здесь. */
  releaseCodeOnWriteoff?: boolean
}>(), {
  readonly: false,
  releaseCodeOnWriteoff: false,
})

const emit = defineEmits<{
  'update:modelValue': [string[]]
  'update:releaseCodeOnWriteoff': [boolean]
}>()

/**
 * Крыжик переключается как есть, без проверок на стороне формы.
 *
 * Число кодов ничего не решает: ноль кодов — законное состояние помеченного
 * предмета, и сервер считает количество по кодам в любом случае. Проверка
 * здесь только мешала бы — она запретила бы включить режим у предмета,
 * которому коды ещё не заведены.
 */
function toggleReleaseCode(event: Event): void {
  emit('update:releaseCodeOnWriteoff', (event.target as HTMLInputElement).checked)
}

/**
 * Правка идёт через локальный буфер, а не через props.modelValue.
 *
 * Пропы обновляются при перерисовке родителя, то есть не сразу после emit:
 * между двумя событиями input, пришедшими в одну очередь, props.modelValue
 * ещё старый. Если бы правка читала его, вторая строка собрала бы новый
 * массив из старого и затерла первую. Сканер шлёт символы пачками, так что
 * это не теория: на быстром скане из списка молча пропадали бы строки.
 *
 * Буфер берёт значения из props только когда они действительно другие, а не
 * на каждый emit: иначе он успевал бы затереть правку, которая пришла
 * раньше его перерисовки.
 */
const codes = ref<string[]>([...props.modelValue])

/**
 * Список с пустой строкой в конце — то, что и рисуется на экране.
 *
 * Кнопка «+» убрана: пустая строка в конце всегда есть, и это попутно
 * избавляет от пустого списка, в который некуда целиться сканером.
 * Пустая строка — только для ввода, на сервер она не уходит (см. filledCodes
 * на страницах предмета).
 *
 * При просмотре предмет пустых строк не показывает: пустое поле у
 * предмета, который смотрят, выглядило бы как недоделка.
 */
const rows = computed(() => (props.readonly ? codes.value : ensureTrailingRow(codes.value)))

/**
 * Буфер с ровно одной пустой строкой в конце.
 *
 * Пустая строка живёт в самом буфере, а не только на экране, потому что по
 * индексам строк идут и запись значения, и перестановка, и установка курсора.
 * Если бы пустая строка дорисовывалась при отрисовке, индексы на экране и в
 * буфере разошлись бы, и правка попала бы не в то поле.
 *
 * Новые строки заводить перестаём: пока в последней строке не набрано
 * MAX_CODES кодов, пустая строка в конце есть всегда, и вводить дальше
 * можно прямо в неё. Дальше лимит сервера, и новую строку не заводим, чтобы
 * не предлагать ввод, который сервер всё равно отвергнет.
 */
function ensureTrailingRow(list: string[]): string[] {
  // Хвостовые пустые строки убираются: человек мог стереть последний код
  // целиком, и пустых строк в конце могло оказаться несколько. Внутри списка
  // пустые строки остаются — их человек оставил нарочно.
  const last = lastFilledIndex(list)
  const filled = list.slice(0, last + 1)

  return filledCount(filled) >= MAX_CODES ? filled : [...filled, '']
}

/** Индекс последней строки с кодом, а -1, если кодов нет вовсе. */
function lastFilledIndex(list: string[]): number {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    // Строка может оказаться не строкой: буфер приходит и из props, куда его
    // кладёт родитель, и пустые строки в нём местами остаются undefined.
    // Такие строки кодом не считаются.
    if ((list[index] ?? '').trim() !== '') {
      return index
    }
  }

  return -1
}

watch(
  () => props.modelValue,
  (next) => {
    if (next !== codes.value) {
      codes.value = [...next]
    }
  },
)

/** Поля по индексу — чтобы после «+» поставить в новое курсор. */
const inputs = ref<(HTMLInputElement | null)[]>([])

function setInput(el: unknown, index: number) {
  inputs.value[index] = (el as HTMLInputElement | null) ?? null
}

/**
 * Больше кодов предмету не положить: сервер отвергает такой список целиком,
 * и человек потерял бы всё, что набрал. Предел в 100 взят с запасом —
 * наклеек на единицу столько не бывает, а упереться в него на живой работе
 * не должен никто.
 */
const MAX_CODES = 100

function update(next: string[]) {
  const list = props.readonly ? next : ensureTrailingRow(next)
  codes.value = list
  emit('update:modelValue', list)
}

/**
 * Дописывает значение в строку. Следующая пустая строка появляется сама —
 * см. ensureTrailingRow: буфер всегда заканчивается пустой строкой.
 *
 * Правка по индексу строки, а не по полю поиска: одинаковые коды у предмета
 * законны, и по значению нашлась бы не та строка.
 */
function onInput(index: number, e: Event) {
  const next = [...codes.value]
  next[index] = (e.target as HTMLInputElement).value
  update(next)
}

/** Заполненных кодов в списке — их и принимает сервер, пустые строки не в счёт. */
function filledCount(list: string[]): number {
  return list.filter((code) => (code ?? '').trim() !== '').length
}

/**
 * Убирает строку и ставит курсор в то, что осталось.
 *
 * Фокус обязателен: без него он остаётся на кнопке «−», а пустое поле под
 * ней светится зелёным и читается как «сюда можно целиться сканером». На деле
 * фокуса в поле нет, сканер уходит на главную и включает поиск — как будто
 * человек целился в код.
 */
async function removeCode(index: number) {
  const next = [...codes.value]
  next.splice(index, 1)
  update(next)

  // Строки могло не остаться вовсе — тогда курсор идёт в первую, какая есть.
  await focusRow(Math.min(index, codes.value.length - 1))
}

/**
 * Переставляет строку на соседнюю позицию.
 *
 * Порядок из формы — это и есть порядок кодов на сервере: верхний становится
 * главным, и печатается на этикетку по умолчанию. Поэтому перестановка
 * здесь равносильна смене главного кода.
 */
async function moveCode(index: number, delta: number) {
  const to = index + delta

  if (to < 0 || to >= codes.value.length) {
    return
  }

  const next = [...codes.value]
  const [row] = next.splice(index, 1)
  next.splice(to, 0, row!)
  update(next)

  // Курсор переезжает на перемещённую строку. Без этого кнопка осталась бы
  // на месте экрана, но уже под другой строкой, и второе нажатие сдвинуло бы
  // не ту строку, на которую человек и указал.
  await nextTick()

  const input = inputs.value[to]
  if (input) {
    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }
}

const { onKeydown: onScanKeydown } = useScanIntoField()

/**
 * Отсканированный код сразу переводит ввод в следующую строку, и то же
 * делает Enter, которым закончен ручной ввод.
 *
 * Кодов у предмета обычно несколько — наклейка на каждую единицу, — и после
 * каждого кода возвращаться мышью куда-то за новой строкой неудобно: сканер
 * только что отдал код и стоит наготове для следующего, а ручной ввод закончен
 * Enter'ом. Новая пустая строка к этому моменту уже появилась сама (см.
 * ensureTrailingRow), здесь только переводим в неё курсор.
 *
 * В пустом поле Enter не перехватывается: там это обычное сохранение формы,
 * как и во всех остальных полях.
 *
 * Разбор скана идёт первым: он вписывает накопленный набор в поле, иначе
 * проверка «поле не пустое» смотрела бы на прежнее содержимое.
 */
function onKeydown(e: KeyboardEvent) {
  onScanKeydown(e)

  // props.readonly, а не readonly: в <script setup> пропсы не лежат в
  // отдельных переменных, и обращение к голому readonly — обращение к
  // несуществующему имени. Оно роняло обработчик целиком, и курсор никогда
  // бы не переехал.
  if (e.key !== 'Enter' || props.readonly) {
    return
  }

  const input = e.target as HTMLInputElement | null

  if (input === null || input.tagName !== 'INPUT' || input.value.trim() === '') {
    return
  }

  e.preventDefault()
  e.stopPropagation()

  focusRow(input.value.trim() === '' ? 0 : -1)
}

/**
 * Ставит курсор в пустую строку: в заданную, а при -1 — в последнюю.
 *
 * Курсор в конец строки: новый код дописывают, а не заменяют им уже
 * напечатанное.
 */
async function focusRow(index: number) {
  await nextTick()

  const row = index === -1 ? rows.value.length - 1 : index
  const input = inputs.value[row]

  if (input) {
    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }
}
</script>

<style scoped>
/*
 * Стили самой группы (input-group и кнопки) намеренно не продублированы
 * здесь: у них с этим редактором общий вид, и разъезжаться они не должны.
 * Но scoped-стили компонента не достают до соседнего компонента, поэтому
 * группу пришлось бы описать заново — и тогда её правки пришлось бы держать
 * в двух местах.
 *
 * Потому классы группы вынесены в assets/template.sass: это единственный
 * глобальный лист в приложении, и правила перенесены из ItemPropertiesEditor
 * без изменений.
 */
.codes-editor {
  width: 100%;
}

.codes-editor__row + .codes-editor__row {
  margin-top: 6px;
}

/*
 * Подсказка под кодами — свой шрифт и цвет, а не только отступ.
 *
 * .field-hint в приложении описан в scoped-блоках страниц, и до сюда не
 * достаёт: правило страницы не применяется к разметке дочернего компонента.
 * Без своих правил <p> остаётся с браузерными 16px и светлым цветом — на
 * тёмном фоне такая подсказка читается как основной текст и перебивает само
 * поле.
 *
 * Отступ свой и отличается от страничного: здесь подсказка идёт сразу за
 * группой, а не за одиночным полем, и шести пикселей хватает, чтобы она не
 * слипалась с кнопками.
 */
.codes-editor .field-hint {
  display: block;
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-dim);
}

/*
 * Кнопки перестановки стоят СЛЕВА от поля, а остальные — справа. Из-за
 * этого у группы переворачиваются края: скруглённым должен быть левый край
 * (он теперь у «↑»), а у поля правый угол должен быть прямым.
 *
 * Правила здесь, а не в общем листе, потому что группа с кнопками слева —
 * одна только эта. В свойствах кнопки справа, и там наоборот.
 */
.codes-editor__row .input-group__control {
  border-radius: 0;
}

.codes-editor__row > :first-child {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

/*
 * Перестановка — служебное действие, а не «добавить» и не «убрать», поэтому
 * она нейтрального цвета. Иначе в строке было бы три цветных кнопки, и
 * взгляд цеплялся бы за них вместо поля.
 *
 * Правая граница у кнопок убрана: её несёт поле, иначе на стыке вышла бы
 * вторая линия. Левая, наоборот, нужна — это внешний край группы.
 */
.input-group__btn--move {
  color: var(--text-muted);
  background: var(--bg-elevated);
  border-color: var(--border-strong);
  border-right: none;
  border-left: 1px solid var(--border-strong);
  /* Треугольник, а не стрелка ↑↓: в шрифте приложения стрелка рисуется
     волосом — 10px глиф в кнопке 38px, и она почти не видна. Размером это
     не лечится, помогает только заливка. */
  font-size: 15px;
}

.input-group__btn--move:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-hover);
}

/*
 * Гасится наглухо, а не прячется: кнопка на месте, и видно, что строка уже
 * стоя вверху или внизу. Спрятать её можно было бы — но тогда шапка строк
 * прыгала бы, потому что у первой строки одна стрелка, у остальных две.
 */
.input-group__btn--move:disabled {
  opacity: 0.3;
  cursor: default;
}

/*
 * Курсор в поле кода — это прицел для сканера, и это должно быть видно.
 *
 * Общее правило на фокус у группы есть (рамка светлеет), но оно слабое:
 * с полями «Название» и «Хранилище» не отличить, а здесь разница
 * в поведении — отсюда и нужен отдельный, заметный акцент.
 *
 * Зелёный — цвет, которым в приложении помечены действия и активные
 * состояния, и по той же причине подсвечивается он: зелёным в интерфейсе
 * отмечено «сюда можно целиться сканером». Оттенок взят тот же, что у
 * зелёных кнопок, но на тон светлее — иначе на тёмном фоне рамка
 * сливалась бы с заливкой соседних кнопок и не читалась как поле.
 *
 * Собственное правило вместо правки общего: иначе подсветка переехала бы
 * и на значения свойств, где сканирования нет.
 */
.codes-editor__row:focus-within .input-group__control {
  border-color: var(--accent);
}

.codes-editor__row:focus-within .input-group__control::placeholder {
  color: var(--success);
}
</style>
