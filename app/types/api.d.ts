import type CodeModule from '../repository/modules/code'

declare module '#app' {
  interface NuxtApp {
    $api: {
      code: CodeModule
    }
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: {
      code: CodeModule
    }
  }
}

export {}
