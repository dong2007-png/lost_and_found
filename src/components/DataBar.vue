<template>
  <section class="data-bar" aria-label="数据管理">
    <div class="data-bar__actions">
      <button type="button" class="link-btn" @click="handleExport">导出备份</button>
      <button type="button" class="link-btn" @click="openFilePicker">导入恢复</button>
      <input ref="fileInput" class="data-bar__file" type="file" accept=".json,application/json" aria-label="选择备份文件" @change="handleImport">
      <button v-if="!confirmClear" type="button" class="link-btn link-btn--danger" @click="confirmClear = true">清空数据</button>
      <span v-else class="data-bar__confirm" role="alert">
        确认清空全部 {{ stats.total }} 条信息？
        <button type="button" class="link-btn link-btn--danger" @click="handleClear">确认</button>
        <button type="button" class="link-btn" @click="confirmClear = false">取消</button>
      </span>
    </div>
    <p class="data-bar__meta">本地共 {{ stats.total }} 条 · 建议定期导出备份</p>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { useWall } from '../composables/useWall.js';

const { stats, exportData, importData, clearAll, showNotice } = useWall();
const fileInput = ref(null);
const confirmClear = ref(false);

function handleExport() {
  const text = exportData();
  if (!text) {
    showNotice('导出失败，请稍后重试');
    return;
  }
  if (stats.value.total === 0) {
    showNotice('当前没有可导出的信息');
    return;
  }
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  link.href = url;
  link.download = 'lost-found-backup-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showNotice('备份文件已开始下载');
}

function openFilePicker() {
  if (fileInput.value) {
    fileInput.value.click();
  }
}

function handleImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    importData(String(reader.result || ''));
    event.target.value = '';
  };
  reader.onerror = () => {
    showNotice('文件读取失败，请重试');
    event.target.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function handleClear() {
  confirmClear.value = false;
  clearAll();
}
</script>
