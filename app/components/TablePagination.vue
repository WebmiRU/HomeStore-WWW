<template>
  <div class="pagination" v-if="lastPage > 1">
    <button
      :disabled="page <= 1"
      @click="$emit('go', page - 1)"
      class="page-btn"
    >
      ← {{ t('common.back') }}
    </button>
    <span class="page-info">{{ page }} / {{ lastPage }}</span>
    <button
      :disabled="page >= lastPage"
      @click="$emit('go', page + 1)"
      class="page-btn"
    >
      {{ t('common.forward') }} →
    </button>
  </div>
</template>

<script setup lang="ts">
// Пагинация индексных таблиц.
//
// Раньше разметка и стили этой полосы жили в странице предметов, а список
// хранилищ и поиск обходились без постраничного вывода. Три копии одного и
// того же разъезжались: добавили в одну — забыли про другую. Здесь она одна.

const { t } = useI18n()

withDefaults(defineProps<{
  page: number
  lastPage: number
}>(), {
  page: 1,
  lastPage: 1,
})

defineEmits<{ go: [page: number] }>()
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.page-btn {
  padding: 6px 14px;
  font-size: 13px;
  background: #333;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: #444;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: #888;
}
</style>
