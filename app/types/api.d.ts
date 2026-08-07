import type CodeModule from '../repository/modules/code'
import type ItemModule from '../repository/modules/item'
import type LabelPresetModule from '../repository/modules/labelPreset'
import type StoreModule from '../repository/modules/store'
import type { NotifyItem } from '../composables/useNotifyPool'

declare module '#app' {
  interface NuxtApp {
    $api: {
      code: CodeModule
      item: ItemModule
      labelPreset: LabelPresetModule
      store: StoreModule
    }
    $notify: {
      items: Ref<NotifyItem[]>
      add: (message: string, options?: { type?: string; timer?: number }) => number
      remove: (id: number) => void
    }
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: {
      code: CodeModule
      item: ItemModule
      labelPreset: LabelPresetModule
      store: StoreModule
    }
  }
}

export {}
