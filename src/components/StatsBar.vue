<template>
  <section class="stats-grid" aria-label="信息统计">
    <article v-for="card in cards" :key="card.key" class="stat-card" :class="'stat-card--' + card.key">
      <p class="stat-card__label">{{ card.label }}</p>
      <p class="stat-card__value">{{ card.value }}</p>
      <p class="stat-card__hint">{{ card.hint }}</p>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useWall } from '../composables/useWall.js';

const { stats } = useWall();

const cards = computed(() => [
  { key: 'lost', label: '寻找中', value: stats.value.lost, hint: '等待被拾获的物品' },
  { key: 'found', label: '招领中', value: stats.value.found, hint: '等待失主认领' },
  { key: 'done', label: '已找回', value: stats.value.done, hint: '成功回到失主手中' },
  { key: 'matches', label: '潜在匹配', value: stats.value.matches, hint: '系统自动比对结果' }
]);
</script>
