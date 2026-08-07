import type CodeModule from '../repository/modules/code'
import type ItemModule from '../repository/modules/item'

declare module '#app' {
  interface NuxtApp {
    $api: {
      code: CodeModule
      item: ItemModule
    }
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: {
      code: CodeModule
      item: ItemModule
    }
  }
}

export {}
