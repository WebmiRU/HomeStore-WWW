<template>
  <Transition name="notify">
    <div v-if="visible" :class="`notification--${type}`" class="notification">
      <button class="delete" @click="close"></button>
      <span v-for="(line, idx) in messageLines" :key="idx">{{ line }}</span>
      <NuxtLink
        v-for="(link, idx) in links"
        :key="`l${idx}`"
        :to="link.to"
        class="notification__link"
        @click="close"
      >{{ link.label }}</NuxtLink>
      <span v-if="more" class="notification__more">{{ more }}</span>
      <div v-if="timer" class="progress" :style="{ animationDuration: timer + 's' }"></div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const props = defineProps({
  id: {
    type: Number,
    required: true,
  },
  message: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    default: 'success',
  },
  timer: {
    type: Number,
    default: 5,
  },
  /**
   * Ссылки под текстом. Нужны уведомлениям, в которых перечисляют предметы:
   * названия без возможности на них перейти пришлось бы искать вручную.
   */
  links: {
    type: Array as PropType<Array<{ label: string; to: string }>>,
    default: () => [],
  },
  /** Подпись про то, что список не показан целиком, например «…». */
  more: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close'])
const visible = ref(true)
const messageLines = computed(() => props.message.split('\n').filter(Boolean))

function close() {
  visible.value = false
  setTimeout(() => {
    emit('close', props.id)
  }, 300)
}

onMounted(() => {
  if (props.timer > 0) {
    setTimeout(() => {
      close()
    }, props.timer * 1000)
  }
})
</script>

<style scoped>
.notify-enter-active,
.notify-leave-active {
  transition: all 0.3s ease;
}
.notify-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.notify-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
