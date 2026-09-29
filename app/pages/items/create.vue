<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('items.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else @submit.prevent="save" class="create-form">
      <section v-if="activeTab === 'main'" class="tab-section">
        <label class="field">
          <span class="field-label">{{ t('form.title') }}</span>
          <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
        </label>

        <label class="field">
          <span class="field-label">{{ t('form.title_print') }}</span>
          <input v-model="form.title_print" type="text" class="field-input" maxlength="500" />
        </label>

        <label class="field">
          <span class="field-label">{{ t('form.vendor') }}</span>
          <select v-model="form.vendor_id" class="field-select">
            <option :value="null">{{ t('placeholders.none') }}</option>
            <option v-for="option in vendorOptions" :key="option.id" :value="option.id">
              {{ option.title }}
            </option>
          </select>
          <span class="field-hint">{{ t('items.vendor_hint') }}</span>
        </label>

        <label class="field">
          <span class="field-label">{{ t('form.store') }}</span>
          <select v-model.number="form.store_id" class="field-select">
            <option :value="null">{{ t('placeholders.none') }}</option>
            <optgroup v-for="group in storeGroups" :key="group.label" :label="group.label">
              <option
                v-for="opt in group.options"
                :key="opt.id"
                :value="opt.id"
              >{{ opt.own ? '●' : '○' }} {{ '\u2014'.repeat(opt.depth) }}{{ opt.depth > 0 ? ' ' : '' }}{{ opt.title }}</option>
            </optgroup>
          </select>
          <span class="field-hint">{{ t('items.own_storage_hint') }}</span>
        </label>

        <label class="field">
          <span class="field-label">{{ t('form.category') }}</span>
          <select v-model="form.category_id" class="field-select" @change="onCategoryChange">
            <option :value="null">{{ t('placeholders.none') }}</option>
            <option v-for="option in categoryOptions" :key="option.id" :value="option.id">
              {{ '—'.repeat(option.depth) }}{{ option.depth > 0 ? ' ' : '' }}{{ option.title }}
            </option>
          </select>
          <span class="field-hint">{{ t('items.category_hint') }}</span>
        </label>

        <div class="field">
          <span class="field-label">{{ t('items.codes') }}</span>
          <ItemCodesEditor
            v-model="codes"
            v-model:release-code-on-writeoff="releaseCodeOnWriteoff"
          />
        </div>

        <label class="field">
          <span class="field-label">{{ t('form.quantity') }}</span>
          <!--
            Количество помеченного предмета — это число его кодов, и сервер
            считает его сам после сохранения. Поле остаётся видимым, но
            не редактируется: выставленное руками число разошлось бы с
            наклейками, и списание пошло бы не по тем единицам.
          -->
          <input
            v-model="quantityInput"
            type="number"
            class="field-input"
            step="1"
            :placeholder="t('items.quantity_placeholder')"
            :readonly="releaseCodeOnWriteoff || partialProperties.length > 0"
          />
          <span v-if="releaseCodeOnWriteoff" class="field-hint">
            {{ t('items.quantity_by_codes_hint') }}
          </span>
        </label>
      </section>

      <section v-if="activeTab === 'properties'" class="tab-section">
        <div v-if="propertiesLoading" class="loading">{{ t('form.loading') }}</div>
        <ItemPropertiesEditor
          v-else
          v-model="properties"
          :defaultProperties="categoryProperties"
          :availableProperties="allProperties"
          :dictionaries="dictionaries"
          :resetKey="propertiesKey"
        />

        <!--
          Настройка расхода — под значениями свойств: расходуется именно то, что
          введено выше, и без этих значений настраивать нечего. Создаваемый
          предмет ещё не сохранён, поэтому список строится из полей ввода, а не
          из ответа сервера.
        -->
        <div v-if="!propertiesLoading" class="field partial-block">
          <span class="field-label">{{ t('items.partial_title') }}</span>
          <ItemPartialWriteoffEditor v-model="partialProperties" :properties="partialCandidates" />
        </div>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <button type="button" @click="saveAndCopy" class="btn-save-copy" :disabled="saving">{{ t('form.save_and_clone') }}</button>
        <NuxtLink to="/items" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import type { StoreResponse } from '~/repository/modules/store'
import type { CategoryResponse } from '~/repository/modules/category'
import type { VendorResponse } from '~/repository/modules/vendor'
import type { DictionaryResponse } from '~/repository/modules/dictionary'
import type { PropertyResponse } from '~/repository/modules/property'
import type { ItemPropertyInput, ItemPartialPropertyInput } from '~/repository/modules/item'
import { useStoreSelectOptions, type StoreSelectGroup } from '~/composables/storeSelectOptions'
import { categorySelectOptions } from '~/composables/categorySelectOptions'
import { vendorSelectOptions } from '~/composables/vendorSelectOptions'
import { useCodeConflictNotice } from '~/composables/useCodeConflictNotice'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const { notifyCodeConflicts } = useCodeConflictNotice()
const router = useRouter()
const route = useRoute()

const scannedCode = typeof route.query.code === 'string' ? route.query.code : ''
const copyTitle = typeof route.query.copy_title === 'string' ? route.query.copy_title : ''
const copyTitlePrint = typeof route.query.copy_title_print === 'string' ? route.query.copy_title_print : ''
const copyStoreId = typeof route.query.copy_store_id === 'string' ? Number(route.query.copy_store_id) : null
const copyVendorId = typeof route.query.copy_vendor_id === 'string' ? Number(route.query.copy_vendor_id) : null
const copyQuantity = typeof route.query.copy_quantity === 'string' ? route.query.copy_quantity : ''
// Копия предмета наследует категорию и заполненные ею свойства: иначе
// после «создать копию» пришлось бы вбивать всё заново.
const copyCategoryId = typeof route.query.copy_category_id === 'string' ? Number(route.query.copy_category_id) : null
const copyProperties = parseCopiedProperties(route.query.copy_properties)
const copyPartialProperties = parseCopiedPartialProperties(route.query.copy_partial_properties)
const copyCodes = parseCopiedCodes(route.query.copy_codes, route.query.code)

/**
 * Коды копии — из ?copy_codes, а если его нет, из прежнего ?copy_code.
 *
 * Второе нужно не для красоты: ссылку «создать копию» могли сохранить
 * закладкой или передать в мессенджере до того, как появился список, и
 * такой ссылкой ещё пользуются.
 */
function parseCopiedCodes(raw: unknown, scanned: unknown): string[] {
  if (typeof raw === 'string' && raw !== '') {
    try {
      const parsed = JSON.parse(raw)

      if (Array.isArray(parsed)) {
        const list = parsed.filter((c): c is string => typeof c === 'string')

        if (list.length > 0) {
          return list
        }
      }
    } catch {
      // Ссылка могла прийти обрезанной — падаем на пустой список.
    }
  }

  // Параметр ссылки приходит и массивом (код повторился в адресе), и вовсе
  // отсутствует. Берём первый непустой вариант: без этого в списке кодов
  // оказывалось undefined, и любое обращение к нему падало — страница
  // создания не открывалась вовсе.
  const candidates = (Array.isArray(scanned) ? scanned : [scanned])
    .filter((value): value is string => typeof value === 'string' && value !== '')

  return candidates.length > 0 ? [candidates[0]] : ['']
}

/** Настройки расхода из ссылки «создать копию». */
function parseCopiedPartialProperties(raw: unknown): ItemPartialPropertyInput[] {
  if (typeof raw !== 'string' || raw === '') return []

  try {
    const parsed = JSON.parse(raw)

    return Array.isArray(parsed) ? (parsed as ItemPartialPropertyInput[]) : []
  } catch {
    return []
  }
}

function parseCopiedProperties(raw: unknown): ItemPropertyInput[] {
  if (typeof raw !== 'string' || raw === '') return []

  try {
    const parsed = JSON.parse(raw)

    return Array.isArray(parsed) ? (parsed as ItemPropertyInput[]) : []
  } catch {
    // Ссылка могла прийти обрезанной — начинаем с пустых значений.
    return []
  }
}

const tabs = computed(() => [
  { key: 'main', label: t('items.main_tab') },
  { key: 'properties', label: t('form.properties_tab') },
])

// TabBar живёт на query, поэтому и здесь вкладка берётся из адреса, а не из
// локального состояния: иначе переход по табу не совпал бы с содержимым.
const activeTab = computed(() => {
  const q = route.query.tab
  if (typeof q === 'string' && tabs.value.some((t) => t.key === q)) {
    return q
  }
  return 'main'
})

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const form = reactive({
  title: copyTitle,
  title_print: copyTitlePrint,
  store_id: copyStoreId,
  vendor_id: copyVendorId !== null && Number.isFinite(copyVendorId) ? copyVendorId : null,
  category_id: copyCategoryId !== null && Number.isFinite(copyCategoryId) ? copyCategoryId : null,
})

/**
 * Коды приходят из трёх источников, и все три равноправны: скан на главной
 * открывает эту форму уже с кодом в ?code=, «создать копию» передаёт коды
 * оригинала, а дальше список пополняется кнопками.
 *
 * Строка в списке всегда есть, даже когда пустая: пустое поле нужно, чтобы
 * было куда прицелиться сканером, а на сервер пустые строки не уходят.
 */
const codes = ref<string[]>(copyCodes)

/**
 * Пометка «списывать по коду»: сервер хранит её у предмета, отдельным полем.
 *
 * По умолчанию выключена, и это осознанно. Пометка меняет смысл списания —
 * вместо «сколько угодно единиц» получается «ровно одна единица и один код на
 * каждую», — и включённая по умолчанию галочка вводила бы в заблуждение
 * невнимательных: человек поставил бы её, не читая, и потом удивлялся бы,
 * почему списание идёт не так. Включать её нужно осознанно, прочитав подсказку.
 */
const releaseCodeOnWriteoff = ref(false)

const quantityInput = ref(copyQuantity)

/**
 * Количество помеченного предмета — это число его кодов.
 *
 * Пересчёт идёт на лету, при каждой правке списка кодов, а не после
 * сохранения: иначе человек видел бы напротив своих кодов чужое число и
 * удивлялся, откуда оно взялось, только после сохранения. Сервер при
 * сохранении считает так же — здесь то же самое число нужно, чтобы форма
 * показывала то, что будет записано.
 */
watch(
  [codes, releaseCodeOnWriteoff],
  () => {
    if (!releaseCodeOnWriteoff.value) {
      return
    }

    // Пустые строки кодом не считаются: строки в списке бывают, и последняя
    // из них всегда пустая под следующий код.
    //
    // Ноль кодов — это ноль, а не пустое поле: пустое количество в интерфейсе
    // значит «единичный экземпляр», то есть ровно одна штука, и предмет без
    // кодов выглядел бы сразу непустым. Написать сюда надо именно 0.
    const count = codes.value.filter((code) => code.trim() !== '').length

    quantityInput.value = String(count)
  },
  { immediate: true },
)

const storeGroups = computed<StoreSelectGroup[]>(() => useStoreSelectOptions(stores.value))

const stores = ref<StoreResponse[]>([])
const categories = ref<CategoryResponse[]>([])
const vendors = ref<VendorResponse[]>([])
const dictionaries = ref<DictionaryResponse[]>([])
const allProperties = ref<PropertyResponse[]>([])

/** Свойства, которые редактор расхода может предложить: заполненные и числовые. */
const partialCandidates = computed(() => {
  const byId = new Map(allProperties.value.map((property) => [property.id, property]))

  return properties.value.map((entry) => {
    const property = byId.get(entry.property_id)
    const value = entry.values
      .map((item) => item.value)
      .find((item) => item !== null && item !== undefined && String(item).trim() !== '')

    return {
      property_id: entry.property_id,
      title: property?.title ?? String(entry.property_id),
      type: property?.type ?? 'text',
      value: value ?? null,
    }
  })
})

/**
 * Два режима списания взаимоисключающи, и выключает включающий: там единица —
 * код, здесь — запас свойства, а при обоих включённых количество уменьшалось бы
 * двумя несовместимыми способами. Молча снимать нельзя — человек должен знать,
 * что режим сменился.
 */
watch(
  partialProperties,
  (value) => {
    if (value.length > 0 && releaseCodeOnWriteoff.value) {
      releaseCodeOnWriteoff.value = false
      $notify.add(t('items.partial_exclusive_hint'), { type: 'info', timer: 8 })
    }
  },
  { deep: true },
)

watch(
  releaseCodeOnWriteoff,
  (value) => {
    if (value && partialProperties.value.length > 0) {
      partialProperties.value = []
      $notify.add(t('items.partial_exclusive_hint'), { type: 'info', timer: 8 })
    }
  },
)

const categoryOptions = computed(() => categorySelectOptions(categories.value))

const vendorOptions = computed(() => vendorSelectOptions(vendors.value))

const properties = ref<ItemPropertyInput[]>(copyProperties)

/**
 * Настройки расхода частями: какие свойства и с каким шагом.
 *
 * Объявлена рядом со значениями свойств, а не в месте первого упоминания:
 * редактор расхода работает с теми же полями, и держать их врозь значило бы
 * потом искать, откуда берётся список кандидатов.
 */
const partialProperties = ref<ItemPartialPropertyInput[]>(copyPartialProperties)
const categoryProperties = ref<PropertyResponse[]>([])
const propertiesLoading = ref(false)
/** Редактор перечитывает значения только при смене ключа — так его не затирает собственная выдача. */
const propertiesKey = ref('')

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [list, all, dicts, props, vendorList] = await Promise.all([
      $api.store.list(),
      $api.category.all(),
      $api.dictionary.all(),
      $api.property.all(),
      $api.vendor.all(),
    ])
    stores.value = list
    categories.value = all
    vendors.value = vendorList
    dictionaries.value = dicts
    allProperties.value = props
    if (form.category_id !== null) {
      await loadProperties(form.category_id)
    }
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function loadProperties(categoryId: number | null) {
  propertiesLoading.value = true
  try {
    categoryProperties.value = categoryId === null ? [] : await $api.category.properties(categoryId)
    propertiesKey.value = String(categoryId)
  } catch (err: any) {
    categoryProperties.value = []
    $notify.add(formatApiError(err, t('categories.properties_load_failed')), { type: 'error', timer: 10 })
  } finally {
    propertiesLoading.value = false
  }
}

/**
 * Смена категории меняет только набор по умолчанию: то, что пользователь
 * добавил и заполнил руками, остаётся — набор по умолчанию ничего не запрещает.
 */
async function onCategoryChange() {
  await loadProperties(form.category_id)
}

/** Пустые строки на сервер не уходят: он сам придумает код, если не пришлют ни одного. */
function filledCodes(): string[] {
  return codes.value.map((c) => c.trim()).filter((c) => c !== '')
}

function itemPayload() {
  return {
    title: form.title,
    title_print: form.title_print || null,
    store_id: form.store_id,
    category_id: form.category_id,
    vendor_id: form.vendor_id,
    codes: filledCodes(),
    // При одном коде высвобождать нечего, и сервер всё равно не станет
    // ничего освобождать: помечаем явно, чтобы в базе не лежала пометка,
    // которая ничего не значит.
    release_code_on_writeoff: releaseCodeOnWriteoff.value && filledCodes().length > 1,
    quantity: String(quantityInput.value).trim() === '' ? null : Number(quantityInput.value),
    properties: properties.value,
    partial_properties: partialProperties.value,
  }
}

async function save() {
  saving.value = true
  try {
    const created = await $api.item.create(itemPayload())
    $notify.add(t('form.created', { title: t('items.one') }), { type: 'success' })
    // Коллизии по кодам предупреждаем до перехода: после перехода на карточку
    // уведомление ещё висит, а если человек уйдёт дальше — предупреждение о
    // совпадении кода уже не увидит.
    notifyCodeConflicts(created)
    router.push(`/items/${created.payload.id}`)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

async function saveAndCopy() {
  saving.value = true
  try {
    await $api.item.create(itemPayload())
    $notify.add(t('form.created', { title: t('items.one') }), { type: 'success' })
    router.push({
      path: '/items/create',
      query: {
        copy_title: form.title,
        copy_title_print: form.title_print,
        copy_store_id: form.store_id,
        copy_category_id: form.category_id,
        copy_vendor_id: form.vendor_id,
        // Все коды, а не только главный. Как и раньше, значения просто
        // переносятся в форму: сервер заведёт копии строк кода, и эти
        // значения станут общими у двух предметов — то же, что делало
        // «создать копию» с единственным кодом.
        copy_codes: JSON.stringify(filledCodes()),
        copy_quantity: quantityInput.value,
        copy_properties: JSON.stringify(properties.value),
        copy_partial_properties: JSON.stringify(partialProperties.value),
      },
    })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: var(--text-secondary);
}

.create-tabs {
  margin: 14px 0 20px;
}

/*
 * Отступ блока настроек расхода от значений свойств: это отдельная настройка
 * предмета, а не ещё одно поле в том же списке.
 */
.partial-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.loading,
.error {
  color: var(--text-muted);
  padding: 12px 0;
}

.error {
  color: var(--danger);
}

.create-form {
  width: 100%;
}

.tab-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.tab-section .field {
  margin-bottom: 0;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.field-input:focus,
.field-select:focus {
  border-color: var(--border-strong);
}

.field-select {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.field-hint {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.btn-save {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: var(--accent);
}

.btn-save:disabled,
.btn-save-copy:disabled {
  opacity: 0.5;
  cursor: default;
}

/*
 * Кнопка действия «создать копию» — вторая по значимости, поэтому она спокойная,
 * а не акцентная: главная кнопка рядом («Сохранить») должна оставаться
 * единственной яркой.
 *
 * Раньше здесь стоял синий фон вместе с акцентным текстом и акцентной рамкой —
 * на сиреневой теме получался сиреневый текст на синем, кнопка не читалась.
 */
.btn-save-copy {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  color: var(--text);
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.btn-save-copy:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-hover);
  border-color: var(--accent);
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-muted);
  text-decoration: none;
  border: 1px dashed var(--border-strong);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.btn-cancel:hover {
  color: var(--text);
  background: var(--bg-hover);
  border-style: solid;
}

@media (max-width: 768px) {
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
