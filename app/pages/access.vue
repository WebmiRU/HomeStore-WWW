<template>
  <div class="access-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('nav.access') }}</h3>
    </div>
    <p class="page-hint">
      {{ t('access_page.hint') }}
    </p>

    <AccessGrants />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
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