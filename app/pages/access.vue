<template>
  <div class="access-page">
    <div class="page-header">
      <h3 class="page-title">Доступ</h3>
    </div>
    <p class="page-hint">
      Права выдаются на склады и по цепочке распространяются на связанные хранилища, предметы,
      их изображения и коды. «Просмотр» — видно всё «дерево» склада, «Изменение» и «Удаление» —
      правки и удаление (изменение и удаление подразумевают просмотр).
    </p>

    <AccessGrants />
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: #ccc;
}

.page-hint {
  margin: 0 0 18px;
  font-size: 13px;
  color: #777;
  max-width: 760px;
  line-height: 1.5;
}
</style>