<template>
  <section class="list-column" aria-label="信息卡片列表">
    <div class="list-column__head">
      <h2 class="section-title">信息广场</h2>
      <p class="section-count">{{ visibleInfos.length }} 条</p>
    </div>

    <div v-if="visibleInfos.length === 0" class="empty-state" role="status" aria-live="polite">
      <div class="empty-state__icon" aria-hidden="true">⌕</div>
      <p class="empty-state__title">{{ emptyTitle }}</p>
      <p class="empty-state__hint">{{ emptyHint }}</p>
    </div>

    <TransitionGroup v-else name="card-list" tag="div" class="card-list">
      <InfoCard v-for="info in visibleInfos" :key="info.seq" :info="info" />
    </TransitionGroup>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { EMPTY_TEXT } from '../constants.js';
import { useWall } from '../composables/useWall.js';
import InfoCard from './InfoCard.vue';

const { state, visibleInfos } = useWall();

const hasCondition = computed(() => state.searchQuery.trim() !== '' || state.onlySearching);
const emptyTitle = computed(() => (hasCondition.value ? '没有符合条件的信息' : EMPTY_TEXT[state.activeFilter] || EMPTY_TEXT.all));
const emptyHint = computed(() => (hasCondition.value ? '试试调整搜索关键词或筛选条件' : '点击上方“发布信息”登记第一条'));
</script>
