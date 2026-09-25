<template>
  <Transition name="notify">
    <div v-if="visible" :class="`notification--${type}`" class="notification">
      <button class="delete" @click="close"></button>
      <span v-for="(line, idx) in messageLines" :key="idx">{{ line }}</span>
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
