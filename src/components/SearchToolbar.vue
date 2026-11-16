<template>
  <div class="toolbar">
    <div class="search-box">
      <svg class="search-box__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m20 20-3.5-3.5"></path>
      </svg>
      <input
        v-model="state.searchQuery"
        class="search-box__input"
        type="search"
        placeholder="搜索物品名称、地点或特征，空格分隔多关键词"
        aria-label="搜索信息"
      >
      <button v-if="state.searchQuery" type="button" class="search-box__clear" aria-label="清空搜索" @click="state.searchQuery = ''">×</button>
    </div>

    <nav class="filter-bar" role="tablist" aria-label="信息类型筛选">
      <button
        v-for="item in filters"
        :key="item.value"
        type="button"
        class="filter-btn"
        :class="{ 'is-active': state.activeFilter === item.value }"
        role="tab"
        :aria-selected="state.activeFilter === item.value ? 'true' : 'false'"
        @click="setFilter(item.value)"
      >{{ item.label }}</button>
    </nav>

    <label class="switch">
      <input v-model="state.onlySearching" type="checkbox">
      <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
      <span class="switch__label">仅看寻找中</span>
    </label>

    <button v-if="hasConditions" type="button" class="link-btn toolbar__reset" @click="resetConditions">重置条件</button>
  </div>
</template>

<script setup>
import { useWall } from '../composables/useWall.js';

const { state, setFilter, resetConditions, hasConditions } = useWall();
const filters = [
  { value: 'all', label: '全部' },
  { value: 'lost', label: '丢失' },
  { value: 'found', label: '招领' }
];
</script>
