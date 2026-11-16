<template>
  <article class="card" :class="{ 'is-found': isFound }" :data-seq="info.seq">
    <div class="card__top">
      <span class="badge" :class="'badge--' + type">{{ typeLabel }}</span>
      <span class="badge" :class="isFound ? 'badge--found-check' : 'badge--status-searching'">
        {{ isFound ? '✓ 已找到' : '寻找中' }}
      </span>
      <span class="card__seq">#{{ info.seq }}</span>
    </div>

    <h3 class="card__name">{{ displayText(info.name, '暂无') }}</h3>

    <ul class="card__meta">
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
        <span>{{ displayText(info.location, '暂无') }}</span>
      </li>
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
        <span>{{ formatTime(info.occurredAt) }}</span>
      </li>
    </ul>

    <p class="card__feature" :class="{ 'is-empty': !hasFeature }">{{ displayText(info.feature, '暂无描述') }}</p>

    <div class="card__contact">
      <span class="card__contact-label">联系方式</span>
      <span class="card__contact-value">{{ contactVisible ? displayText(info.contact, '暂无') : maskedContact }}</span>
      <button type="button" class="card__contact-toggle" :aria-label="contactVisible ? '隐藏联系方式' : '显示联系方式'" @click="contactVisible = !contactVisible">
        {{ contactVisible ? '隐藏' : '查看' }}
      </button>
    </div>

    <div v-if="!isFound" class="card__actions">
      <button type="button" class="btn btn--primary" aria-label="将本条信息标记为已找到" @click="applyMark(info.seq, 'card')">标记为已找到</button>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue';
import { TYPE_LABEL } from '../constants.js';
import { displayText, formatTime, normalizeStatus } from '../services/info.js';
import { useWall } from '../composables/useWall.js';

const props = defineProps({
  info: { type: Object, required: true }
});

const { applyMark } = useWall();
const contactVisible = ref(false);

const type = computed(() => (props.info.type === 'found' ? 'found' : 'lost'));
const typeLabel = computed(() => TYPE_LABEL[type.value]);
const isFound = computed(() => normalizeStatus(props.info) === 'found');
const hasFeature = computed(() => displayText(props.info.feature, '').trim() !== '');
const maskedContact = computed(() => {
  const text = displayText(props.info.contact, '');
  return text.trim() === '' ? '暂无' : '••••••';
});
</script>
