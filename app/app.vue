пвпав<template>
  <div
    class="page"
    @keydown.prevent="handleKeydown"
    tabindex="0"
    ref="pageRef"
  >
    <div class="current-input">{{ currentInput }}</div>

    <div v-if="savedLines.length" class="saved-block">
      <div v-for="(line, idx) in savedLines" :key="idx" class="saved-line">
        {{ line }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const currentInput = ref('')
const savedLines = ref<string[]>([])
const pageRef = ref<HTMLElement | null>(null)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (currentInput.value.trim()) {
      savedLines.value.push(currentInput.value)
      currentInput.value = ''
    }
    return
  }

  if (e.key === 'Backspace') {
    currentInput.value = currentInput.value.slice(0, -1)
    return
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    currentInput.value += e.key
  }
}

onMounted(() => {
  nextTick(() => {
    pageRef.value?.focus()
  })
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40px;
  outline: none;
}

.current-input {
  font-size: 24px;
  min-height: 40px;
}

.saved-block {
  margin-top: 40px;
}

.saved-line {
  font-size: 16px;
  padding: 4px 0;
}
</style>
