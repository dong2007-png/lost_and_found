<template>
  <div class="app-shell">
    <div class="hero-glow" aria-hidden="true"></div>
    <header class="page-header container">
      <div class="hero-text">
        <p class="hero-eyebrow">CAMPUS · LOST &amp; FOUND</p>
        <h1 class="page-title">学校失物招领墙</h1>
        <p class="page-subtitle">丢失的物品在这里寻找，拾到的好物在这里归还。发布信息即可自动比对潜在匹配。</p>
      </div>
      <div class="hero-badge" aria-hidden="true">
        <span class="hero-badge__ring"></span>
        <span class="hero-badge__core">匹配</span>
      </div>
    </header>

    <main class="page-main container">
      <StatsBar />
      <SearchToolbar />
      <PublishForm />

      <div class="main-body">
        <InfoList />
        <MatchPanel />
      </div>

      <footer class="page-footer">
        <p>信息仅保存在当前浏览器，清理浏览器数据将同时清除。联系方式默认隐藏，点击卡片可查看。</p>
      </footer>
    </main>

    <ToastNotice />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useWall } from './composables/useWall.js';
import StatsBar from './components/StatsBar.vue';
import SearchToolbar from './components/SearchToolbar.vue';
import PublishForm from './components/PublishForm.vue';
import InfoList from './components/InfoList.vue';
import MatchPanel from './components/MatchPanel.vue';
import ToastNotice from './components/ToastNotice.vue';

const { restore } = useWall();
onMounted(restore);
</script>
