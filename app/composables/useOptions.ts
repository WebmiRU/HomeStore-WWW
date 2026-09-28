import type { OptionData, OptionResponse } from '~/repository/modules/option'
import { isNavGroup, navTree, sortNavKeys, type NavEntry } from '~/utils/navigation'

/**
 * Умолчания повторяют то, что отдаёт сервер для пользователя без строки
 * настроек. Дублирование неприятное, но вынужденное: до первого ответа
 * настройки в клиенте нет, и без своих значений меню на миг соберётся не так.
 * Сервер остаётся источником правды: load() перезаписывает это значение его
 * ответом.
 */
const defaultOptions = (): OptionResponse => ({
  menu_order: [],
  menu_hidden: [],
  operation_mode: 'search',
  show_code_block: true,
  remember_operation_mode: true,
})

export function useOptions() {
  const { $api } = useNuxtApp()
  const state = useState<OptionResponse | null>('user-options', () => null)

  /** Настройки всегда объект: null означает «ещё не пришли», а не «пусто». */
  const options = computed<OptionResponse>(() => state.value ?? defaultOptions())
  const loaded = computed(() => state.value !== null)

  const hidden = computed(() => new Set(options.value.menu_hidden))

  async function load(): Promise<void> {
    if (import.meta.server) return
    if (state.value) return

    try {
      state.value = await $api.option.get()
    } catch {
      // Молча остаёмся на умолчаниях: настройки не должны мешать работать.
      state.value = defaultOptions()
    }
  }

  /**
   * Сохраняет изменения и подставляет то, что сохранилось на самом деле.
   *
   * Ответ сервера важнее присланного: он приводит списки ключей к виду, в
   * котором их дальше читают (убирает повторы и пустые), и подставляет
   * умолчания для полей, которых в запросе не было.
   */
  async function save(patch: OptionData): Promise<OptionResponse> {
    const saved = await $api.option.update({ ...options.value, ...patch })
    state.value = saved

    return saved
  }

  /** Сбрасывает к умолчаниям без обращения к серверу: при выходе из учётной записи. */
  function reset(): void {
    state.value = defaultOptions()
  }

  const isHidden = (key: string): boolean => hidden.value.has(key)

  /**
   * Меню, каким его видит этот пользователь: без спрятанных пунктов и в его
   * порядке. Вложенные пункты сортируются внутри своей группы.
   *
   * Права пользователей, когда они появятся, встанут здесь же — отдельным
   * фильтром перед фильтром скрытых. Смешивать их в один список не надо:
   * скрытие — это «не хочу видеть», права — «нельзя».
   */
  const visibleTree = computed<NavEntry[]>(() => {
    const order = options.value.menu_order
    const shown = (keys: string[]) => sortNavKeys(keys.filter((key) => !isHidden(key)), order)

    const topShown = shown(navTree.filter((entry) => !isNavGroup(entry)).map((entry) => entry.key))
    const top = new Map(topShown.map((key, index) => [key, index]))

    return navTree
      .filter((entry) => !isHidden(entry.key))
      .map((entry) =>
        isNavGroup(entry)
          ? { ...entry, items: shown(entry.items.map((item) => item.key)).map((key) => entry.items.find((item) => item.key === key)!) }
          : entry,
      )
      .sort((a, b) => top.get(a.key)! - top.get(b.key)!)
  })

  return { options, loaded, load, save, reset, isHidden, visibleTree }
}
