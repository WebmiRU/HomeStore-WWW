<template>
  <NuxtLink v-if="user" :to="`/users/${user.id}`" class="user-link">{{ user.name }}</NuxtLink>
  <span v-else class="muted">—</span>
</template>

<script setup lang="ts">
/**
 * Ссылка на пользователя.
 *
 * Имя отвечает на вопрос «чей это расход», но не отвечает на следующий: «а он
 * вообще что делает в системе». Ссылка ведёт туда, где это видно, и нужна
 * везде, где человек значится автором движения: журнал операций, журнал
 * действий, статистика сущности, движения предмета.
 *
 * Отдельный компонент, а не четыре одинаковых куска разметки: внешний вид
 * ссылки в журнале действий и в журнале операций разъехался бы при первой же
 * правке одного из них.
 */
defineProps<{
  /** Актор операции или журнала; null — человек удалён или записи не было. */
  user?: { id: number; name: string } | null
}>()
</script>

<style scoped>
.user-link {
  color: var(--link);
  text-decoration: none;
}

.user-link:hover {
  text-decoration: underline;
}
</style>
