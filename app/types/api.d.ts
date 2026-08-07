import type CodeModule from '../repository/modules/code'
import type ItemModule from '../repository/modules/item'
import type StoreModule from '../repository/modules/store'

declare module '#app' {
  interface NuxtApp {
    $api: {
      code: CodeModule
      item: ItemModule
      store: StoreModule
    }
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: {
      code: CodeModule
      item: ItemModule
      store: StoreModule
    }
  }
}

export {}
