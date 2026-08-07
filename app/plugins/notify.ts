import { useNotifyPool } from '~/composables/useNotifyPool'

export default defineNuxtPlugin(() => {
  const notifyPool = useNotifyPool()

  return {
    provide: {
      notify: notifyPool,
    },
  }
})
