<template>
  <Transition name="toast">
    <div v-if="state.noticeVisible" class="toast" role="status" aria-live="polite">
      <span class="toast__dot" aria-hidden="true"></span>
      <p class="toast__text">{{ state.notice }}</p>
    </div>
  </Transition>
</template>

<script setup>
import { useWall } from '../composables/useWall.js';

const { state } = useWall();
</script>
