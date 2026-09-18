<template>
  <div class="journal-page">
    <div class="page-header">
      <h3 class="page-title">Журнал действий</h3>
    </div>

    <div class="journal-controls">
      <div class="control-group">
        <span class="control-label">Период:</span>
        <button
          v-for="range in ranges"
          :key="range.value"
          type="button"
          class="ctl-btn"
          :class="{ active: period === range.value }"
          @click="setPeriod(range.value)"
        >
          {{ range.label }}
        </button>
      </div>

      <div class="control-group">
        <span class="control-label">Шаг:</span>
        <button
          v-for="g in granularities"
          :key="g.value"
          type="button"
          class="ctl-btn"
          :class="{ active: granularity === g.value }"
          @click="setGranularity(g.value)"
        >
          {{ g.label }}
        </button>
      </div>

      <div class="control-group">
        <span class="control-label">Объект:</span>
        <select v-model="entityFilter" class="ctl-select" @change="applyEntityFilter">
          <option value="">Все объекты</option>
          <option v-for="et in entityOptions" :key="et.value" :value="et.value">
            {{ et.label }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="statsLoading" class="loading">Загрузка статистики...</div>
    <div v-else-if="statsError" class="error">{{ statsError }}</div>

    <div v-else class="charts-grid">
      <section class="chart-card chart-card--wide">
        <h4 class="chart-title">Активность за период</h4>
        <div v-if="activityPoints.length" class="bars-chart" :class="{ 'bars-chart--hourly': granularity === 'hour' }">
          <div
            v-for="(p, i) in activityPoints"
            :key="i"
            class="bar-col"
            :title="`${p.bucket}: ${p.count}`"
          >
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ height: barHeight(p.count) }"
              ></div>
            </div>
            <div class="bar-label">{{ barLabel(p.bucket) }}</div>
          </div>
          <div class="bars-empty" v-if="!activityTotal">За выбранный период событий нет</div>
        </div>
        <div v-else class="empty">Нет данных</div>
      </section>

      <section class="chart-card">
        <h4 class="chart-title">По действиям</h4>
        <div v-if="actionPoints.length" class="hbar-list">
          <div v-for="p in actionPoints" :key="p.key ?? p.bucket" class="hbar-row">
            <span class="hbar-label" :title="p.key ?? ''">{{ actionLabel(p.key) }}</span>
            <div class="hbar-track">
              <div class="hbar-fill" :style="{ width: barWidth(p.count, actionPoints) }"></div>
            </div>
            <span class="hbar-count">{{ p.count }}</span>
          </div>
        </div>
        <div v-else class="empty">Нет данных</div>
      </section>

      <section class="chart-card">
        <h4 class="chart-title">По объектам</h4>
        <div v-if="entityPoints.length" class="hbar-list">
          <div v-for="p in entityPoints" :key="p.key ?? p.bucket" class="hbar-row">
            <span class="hbar-label" :title="p.key ?? ''">{{ entityLabel(p.key) }}</span>
            <div class="hbar-track">
              <div class="hbar-fill" :style="{ width: barWidth(p.count, entityPoints) }"></div>
            </div>
            <span class="hbar-count">{{ p.count }}</span>
          </div>
        </div>
        <div v-else class="empty">Нет данных</div>
      </section>
    </div>

    <hr class="section-divider" />

    <div class="journal-table-head">
      <h3 class="page-title">Записи</h3>
      <span class="total" v-if="meta.total">Всего: {{ meta.total }}</span>
    </div>

    <div v-if="listLoading" class="loading">Загрузка записей...</div>
    <div v-else-if="listError" class="error">{{ listError }}</div>

    <template v-else>
      <table class="journal-table" v-if="entries.length">
        <thead>
          <tr>
            <th>Когда</th>
            <th>Действие</th>
            <th>Объект</th>
            <th>Кто</th>
            <th>Детали</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td data-label="Когда">{{ formatDate(entry.created_at) }}</td>
            <td data-label="Действие">
              <span class="action-badge" :class="actionBadgeClass(entry.action)">
                {{ actionLabel(entry.action) }}
              </span>
            </td>
            <td data-label="Объект">
              <template v-if="entry.entity_type">
                {{ entityLabel(entry.entity_type) }}
                <span class="entity-id" v-if="entry.entity_id">#{{ entry.entity_id }}</span>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td data-label="Кто">
              <span v-if="entry.actor">{{ entry.actor.name }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td data-label="Детали" class="details-cell">
              <span class="details-text">{{ summarize(entry) }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Записей не найдено</div>

      <div class="pagination" v-if="meta.last_page > 1">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          @click="goToPage((meta.current_page || 1) - 1)"
          class="page-btn"
        >
          ← Назад
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          @click="goToPage((meta.current_page || 1) + 1)"
          class="page-btn"
        >
          Вперёд →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { actionLabel, entityLabel, actionBadgeClass, formatDate, summarize } from '~/utils/auditLabels'
import type {
  AuditLogEntry,
  AuditLogStatsPoint,
} from '~/repository/modules/auditLog'

const { $api } = useNuxtApp()
const route = useRoute()
const router = useRouter()

// ---- объекты ----
const ENTITY_LABELS_FOR_FILTER: Record<string, string> = {
  item: 'Предметы',
  store: 'Хранилища',
  warehouse: 'Склады',
  label_preset: 'Шаблоны',
  label_list: 'Этикетки',
  access_grant: 'Доступ',
  user: 'Пользователи',
}

// ---- период и шаг ----
const ranges = [
  { label: '7 дней', value: '7' },
  { label: '30 дней', value: '30' },
  { label: '90 дней', value: '90' },
  { label: 'Всё время', value: 'all' },
]
const granularities = [
  { label: 'дни', value: 'day' },
  { label: 'часы', value: 'hour' },
]

const period = ref<string>('30')
const granularity = ref<'day' | 'hour'>('day')
const entityFilter = ref<string>('')

const entityOptions = Object.entries(ENTITY_LABELS_FOR_FILTER).map(([value, label]) => ({ value, label }))

// ---- статистика ----
const statsLoading = ref(true)
const statsError = ref<string | null>(null)
const activityPoints = ref<AuditLogStatsPoint[]>([])
const actionPoints = ref<AuditLogStatsPoint[]>([])
const entityPoints = ref<AuditLogStatsPoint[]>([])

const activityTotal = computed(() => activityPoints.value.reduce((s, p) => s + p.count, 0))

function maxOf(points: AuditLogStatsPoint[]): number {
  return Math.max(1, ...points.map((p) => p.count))
}

function barHeight(count: number): string {
  return `${Math.round((count / maxOf(activityPoints.value)) * 100)}%`
}

function barWidth(count: number, points: AuditLogStatsPoint[]): string {
  return `${Math.round((count / maxOf(points)) * 100)}%`
}

function barLabel(bucket: string | null): string {
  if (!bucket) return ''
  const [date, time] = bucket.split(' ')
  const d = new Date(date.length === 10 ? date + 'T00:00:00' : bucket)
  if (granularity.value === 'hour' && time) {
    return `${d.getDate()}.${d.getMonth() + 1} ${time}`
  }
  return `${d.getDate()}.${d.getMonth() + 1}`
}

function rangeParams(): { date_from?: string; date_to?: string } {
  if (period.value === 'all') return {}
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - (Number(period.value) - 1))
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  }
}

async function loadStats() {
  statsLoading.value = true
  statsError.value = null
  const range = rangeParams()
  try {
    const [activity, actions, entities] = await Promise.all([
      $api.auditLog.stats({ group_by: 'day', granularity: granularity.value, ...range }),
      $api.auditLog.stats({ group_by: 'action', granularity: granularity.value, ...range }),
      $api.auditLog.stats({ group_by: 'entity', granularity: granularity.value, ...range }),
    ])
    activityPoints.value = activity
    actionPoints.value = actions
    entityPoints.value = entities
  } catch (err: any) {
    statsError.value = err?.data?.error || err?.message || String(err)
  } finally {
    statsLoading.value = false
  }
}

// ---- записи ----
const entries = ref<AuditLogEntry[]>([])
const listLoading = ref(true)
const listError = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number; total: number }>({
  current_page: 0,
  last_page: 0,
  total: 0,
})

async function loadList() {
  listLoading.value = true
  listError.value = null
  const page = Number(route.query.page) || 1
  try {
    const result = await $api.auditLog.list({
      page,
      entity_type: entityFilter.value || undefined,
      ...rangeParams(),
    })
    entries.value = result.data
    meta.value = {
      current_page: result.meta.current_page,
      last_page: result.meta.last_page,
      total: result.meta.total,
    }
  } catch (err: any) {
    listError.value = err?.data?.error || err?.message || String(err)
  } finally {
    listLoading.value = false
  }
}

function setPeriod(value: string) {
  period.value = value
  router.push({ query: { ...route.query, page: undefined } })
  loadStats()
  loadList()
}

function setGranularity(value: 'day' | 'hour') {
  granularity.value = value
  loadStats()
}

function applyEntityFilter() {
  router.push({ query: { ...route.query, page: undefined } })
  loadList()
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

onMounted(() => {
  loadStats()
  loadList()
})

watch(() => route.query.page, () => loadList())
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: #ccc;
}

.journal-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-bottom: 16px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-label {
  font-size: 13px;
  color: #777;
}

.ctl-btn {
  padding: 5px 12px;
  font-size: 13px;
  background: #2a2a2a;
  color: #aaa;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.ctl-btn:hover {
  background: #333;
  color: #ddd;
}

.ctl-btn.active {
  background: #2a2a3a;
  color: #aaf;
  border-color: #3a3a5a;
}

.ctl-select {
  padding: 5px 10px;
  font-size: 13px;
  font-family: inherit;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.chart-card {
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  padding: 14px;
  min-height: 180px;
}

.chart-card--wide {
  grid-column: 1 / -1;
}

.chart-title {
  margin: 0 0 12px;
  font-size: 14px;
  color: #999;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.bars-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 140px;
  padding-top: 8px;
}

.bars-chart--hourly {
  overflow-x: auto;
}

.bar-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  flex: 1 1 0;
  min-width: 18px;
  height: 100%;
}

.bar-track {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 110px;
  justify-content: center;
}

.bar-fill {
  width: 70%;
  max-width: 26px;
  min-height: 2px;
  background: linear-gradient(to top, #3a3a5a, #5a5a8a);
  border-radius: 2px 2px 0 0;
}

.bar-label {
  margin-top: 6px;
  font-size: 11px;
  color: #666;
  white-space: nowrap;
}

.bars-empty {
  font-size: 13px;
  color: #666;
}

.hbar-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hbar-label {
  flex: 0 0 120px;
  font-size: 13px;
  color: #bbb;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hbar-track {
  flex: 1;
  background: #2a2a2a;
  border-radius: 3px;
  height: 14px;
}

.hbar-fill {
  height: 100%;
  background: linear-gradient(to right, #3a5a3a, #5a8a5a);
  border-radius: 3px;
  min-width: 2px;
}

.hbar-count {
  flex: 0 0 32px;
  font-size: 12px;
  color: #999;
  text-align: right;
}

.section-divider {
  border: none;
  height: 1px;
  margin: 24px 0 14px;
  background: #333;
}

.journal-table-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 10px;
}

.total {
  font-size: 13px;
  color: #777;
}

.loading,
.error,
.empty {
  padding: 20px;
  color: #888;
}

.error {
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
}

.journal-table {
  width: 100%;
  border-collapse: collapse;
}

.journal-table th,
.journal-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
  vertical-align: top;
}

.journal-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.journal-table td {
  color: #ccc;
}

.journal-table tr:hover td {
  background: #252525;
}

.action-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
  background: #2a2a2a;
  color: #bbb;
  border: 1px solid #444;
}

.badge--success {
  background: #1d2f1d;
  color: #9cc;
  border-color: #2f4f2f;
}

.badge--danger {
  background: #331a1a;
  color: #f9a;
  border-color: #553;
}

.badge--auth {
  background: #2a2a3a;
  color: #aaf;
  border-color: #3a3a5a;
}

.badge--op {
  background: #2f2a1d;
  color: #dcc;
  border-color: #554;
}

.badge--label {
  background: #1d2a33;
  color: #9cc;
  border-color: #2f4f60;
}

.entity-id {
  color: #666;
  font-size: 12px;
}

.muted {
  color: #666;
}

.details-cell .details-text {
  color: #999;
  font-size: 13px;
}

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

@media (max-width: 900px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .journal-table,
  .journal-table tbody,
  .journal-table tr,
  .journal-table td {
    display: block;
  }

  .journal-table thead {
    display: none;
  }

  .journal-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .journal-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .journal-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .journal-table tr:hover td {
    background: transparent;
  }
}
</style>