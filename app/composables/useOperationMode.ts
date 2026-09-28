import type { OperationMode } from '~/repository/modules/option'

/**
 * Режим работы: обычный поиск, пополнение или списание.
 *
 * Раньше жил в sessionStorage и переживал одну вкладку браузера, а на
 * другом устройстве начинался заново. Теперь это настройка пользователя, и
 * она переезжает вместе с ним — если человек не выключил «запоминать».
 *
 * Отдельное состояние, а не чтение настроек напрямую, нужно по двум
 * причинам. Первая: настройки приезжают после монтирования, а режим
 * переключают сразу — пока человек ждёт ответа, он уже может нажать другое,
 * и ответ не должен затирать его выбор. Вторая: страница держит режим в
 * своей переменной на время показа, и переключение не должно трогать её
 * задним числом.
 */
export function useOperationMode() {
  const { options, save } = useOptions()

  /** Помнить режим или каждый раз начинать с умолчания. */
  const remember = computed(() => options.value.remember_operation_mode)

  const mode = ref<OperationMode>(
    remember.value ? options.value.operation_mode : 'search',
  )

  /** Переключал ли человек режим до того, как пришли настройки. */
  let touched = false

  // Настройки приехали позже первого отрисовки: если человек ещё ничего не
  // трогал, режим встаёт сохранённый. Если трогал — остаётся его выбор, и
  // ответ его не перебьёт.
  watch(
    () => options.value.operation_mode,
    (next) => {
      if (!touched && remember.value) mode.value = next
    },
  )

  async function persist(next: OperationMode): Promise<void> {
    touched = true
    mode.value = next

    // Запоминать выключено — режим живёт только на текущей странице, и
    // незачем слать его на сервер: он всё равно не должен пережить
    // перезагрузку.
    if (!remember.value) return

    // Сохранение не проходит молча: режим держится в настройках, и об этом
    // надо знать — иначе человек будет считать, что режим запомнился, а он
    // начнёт с чистого листа на другой вкладке.
    try {
      await save({ operation_mode: next })
    } catch {
      touched = false
    }
  }

  return { mode: readonly(mode), persist, remember }
}
