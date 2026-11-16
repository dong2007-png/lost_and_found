<template>
  <section class="match-panel" aria-label="潜在匹配清单">
    <div class="match-panel__head">
      <h2 class="section-title">潜在匹配</h2>
      <p class="match-panel__count" aria-live="polite">{{ MATCH_TEXT.countPrefix }}{{ matchResult.total }}{{ MATCH_TEXT.countSuffix }}</p>
    </div>
    <p class="match-panel__desc">按名称、特征、地点、时间四个维度综合评分，仅展示寻找中的信息</p>

    <p v-if="matchResult.total === 0" class="match-empty">{{ MATCH_TEXT.empty }}</p>

    <div v-else class="match-list">
      <article v-for="pair in matchResult.pairs" :key="pair.lostSeq + ':' + pair.foundSeq" class="match-card">
        <header class="match-card__head">
          <div class="match-score" :class="'match-score--' + pair.level">
            <span class="match-score__value">{{ pair.score }}</span>
            <span class="match-score__label">{{ MATCH_LEVEL_LABEL[pair.level] }}匹配</span>
          </div>
          <div class="match-score__bar" role="img" :aria-label="'匹配度 ' + pair.score + ' 分'">
            <span class="match-score__fill" :class="'match-score__fill--' + pair.level" :style="{ width: pair.score + '%' }"></span>
          </div>
          <div class="match-card__reasons">
            <span v-for="reason in pair.reasons" :key="reason" class="reason-chip">{{ reason }}</span>
            <span v-if="pair.reversed" class="reason-chip reason-chip--warn">{{ MATCH_TEXT.reversedTime }}</span>
          </div>
        </header>

        <div class="match-card__keywords">
          <span class="match-card__keywords-label">{{ MATCH_TEXT.keywordPrefix }}</span>
          <span class="match-card__chips">
            <span v-if="!pair.keywords || pair.keywords.length === 0" class="match-card__keywords-empty">—</span>
            <span v-for="word in pair.keywords" :key="word" class="keyword-chip">{{ word }}</span>
          </span>
        </div>

        <div class="match-card__body">
          <section class="match-side match-side--lost" :class="{ 'is-found': isFound(pair.lostSeq) }">
            <div class="match-side__top">
              <span class="badge badge--lost">丢失</span>
              <span v-if="isFound(pair.lostSeq)" class="badge badge--found-check">✓ 已找到</span>
            </div>
            <p class="match-side__name">{{ nameOf(pair.lostSeq) }}</p>
            <p class="match-side__feature">{{ featureOf(pair.lostSeq) }}</p>
            <p class="match-side__time">{{ MATCH_TEXT.lostTimePrefix }}{{ timeOf(pair.lostSeq) }}</p>
            <p class="match-side__location">{{ locationOf(pair.lostSeq) }}</p>
          </section>

          <div class="match-link">{{ MATCH_TEXT.same }}</div>

          <section class="match-side match-side--found" :class="{ 'is-found': isFound(pair.foundSeq) }">
            <div class="match-side__top">
              <span class="badge badge--found">招领</span>
              <span v-if="isFound(pair.foundSeq)" class="badge badge--found-check">✓ 已找到</span>
            </div>
            <p class="match-side__name">{{ nameOf(pair.foundSeq) }}</p>
            <p class="match-side__feature">{{ featureOf(pair.foundSeq) }}</p>
            <p class="match-side__time">{{ MATCH_TEXT.foundTimePrefix }}{{ timeOf(pair.foundSeq) }}</p>
            <p class="match-side__location">{{ locationOf(pair.foundSeq) }}</p>
          </section>
        </div>

        <footer class="match-card__actions">
          <p class="match-card__hint">{{ MATCH_TEXT.markHint }}</p>
          <button type="button" class="btn btn--primary" :aria-label="MATCH_TEXT.markPairLabel" @click="applyMark(pair.lostSeq, 'pair', pair.foundSeq)">标记为已找到</button>
        </footer>
      </article>
    </div>

    <p v-if="matchResult.hidden > 0" class="match-more" aria-live="polite">
      {{ MATCH_TEXT.morePrefix }}{{ matchResult.hidden }}{{ MATCH_TEXT.moreSuffix }}
    </p>
  </section>
</template>

<script setup>
import { MATCH_TEXT, MATCH_LEVEL_LABEL } from '../constants.js';
import { displayText, formatTime, normalizeStatus } from '../services/info.js';
import { useWall } from '../composables/useWall.js';

const { matchResult, infoMap, applyMark } = useWall();

function infoOf(seq) {
  return infoMap.value.get(seq) || {};
}
function nameOf(seq) {
  return displayText(infoOf(seq).name, '暂无');
}
function featureOf(seq) {
  return displayText(infoOf(seq).feature, MATCH_TEXT.noFeature);
}
function timeOf(seq) {
  return formatTime(infoOf(seq).occurredAt);
}
function locationOf(seq) {
  return displayText(infoOf(seq).location, '暂无');
}
function isFound(seq) {
  return normalizeStatus(infoOf(seq)) === 'found';
}
</script>
