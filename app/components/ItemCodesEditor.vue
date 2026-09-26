<template>
  <div class="codes-editor">
    <div v-for="(code, index) in codes" :key="index" class="input-group codes-editor__row">
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
          title="Выше"
          :disabled="index === 0"
          @click="moveCode(index, -1)"
        >▲</button>
        <button
          type="button"
          class="input-group__btn input-group__btn--move input-group__btn--icon"
          title="Ниже"
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
        placeholder="отсканируйте или введите код"
        :readonly="readonly"
        autocomplete="off"
        @input="onInput(index, $event)"
        @keydown="onKeydown($event)"
      />

      <!--
        Ровно те же кнопки, что у значений свойств: «−» убирает строку,
        «+» заводит новую. Разница одна — здесь строки не группируются
        попарно, поэтому «−» не растягивается на две кнопки: он и в верхних
        строках последний в группе, и скругление достаётся ему.
      -->
      <button
        v-if="!readonly"
        type="button"
        class="input-group__btn input-group__btn--minus input-group__btn--icon"
        :title="index === 0 ? 'Очистить код' : 'Убрать код'"
        @click="removeCode(index)"
      >−</button>

      <button
        v-if="!readonly && index === codes.length - 1"
        type="button"
        class="input-group__btn input-group__btn--icon input-group__btn--add"
        title="Добавить ещё код"
        @click="addCode"
      >+</button>
    </div>

    <p class="field-hint">
      Кодов может быть несколько — по одному на наклейку. Верхний считается главным:
      он печатается на этикетке по умолчанию и показывается в карточке. Поставьте курсор
      в поле — и сканер вставит код прямо в него, а не уведёт на главную.
    </p>
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
import { nextTick, ref, watch } from 'vue'
import { useScanIntoField } from '~/composables/useScanIntoField'

const props = withDefaults(defineProps<{
  modelValue: string[]
  readonly?: boolean
}>(), {
  readonly: false,
})

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

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

function update(next: string[]) {
  codes.value = next
  emit('update:modelValue', next)
}

function onInput(index: number, e: Event) {
  const next = [...codes.value]
  next[index] = (e.target as HTMLInputElement).value
  update(next)
}

async function addCode() {
  update([...codes.value, ''])

  // Курсор — в конец новой строки: иначе после «+» пришлось бы снова брать
  // мышь, а весь смысл кнопки в том, чтобы продолжить ввод. В конец, а не в
  // начало: новый код дописывают, а не заменяют им уже напечатанное.
  await nextTick()

  const input = inputs.value[codes.value.length - 1]
  if (input) {
    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }
}

function removeCode(index: number) {
  const next = [...codes.value]
  next.splice(index, 1)
  // Последняя строка не исчезает: предмет без кода всё равно получит
  // сгенерированный UUID, но пустое поле на форме выглядит как ошибка
  // и мешает прицелиться сканером. Пустая строка просто не уходит на сервер.
  update(next.length > 0 ? next : [''])
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

function onKeydown(e: KeyboardEvent) {
  onScanKeydown(e)
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
  color: #777;
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
  color: #9a9a9a;
  background: #2e2e2e;
  border-color: #444;
  border-right: none;
  border-left: 1px solid #444;
  /* Треугольник, а не стрелка ↑↓: в шрифте приложения стрелка рисуется
     волосом — 10px глиф в кнопке 38px, и она почти не видна. Размером это
     не лечится, помогает только заливка. */
  font-size: 15px;
}

.input-group__btn--move:hover:not(:disabled) {
  color: #ddd;
  background: #3a3a3a;
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
  border-color: #4a9a52;
}

.codes-editor__row:focus-within .input-group__control::placeholder {
  color: #6a8a70;
}
</style>
