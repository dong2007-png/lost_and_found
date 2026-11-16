<template>
  <section class="publish-section" aria-label="发布信息">
    <div class="publish-area">
      <button
        type="button"
        class="publish-btn"
        :aria-expanded="state.formOpen ? 'true' : 'false'"
        aria-controls="formPanel"
        @click="toggleForm()"
      >
        <span class="publish-btn__plus" aria-hidden="true">{{ state.formOpen ? '−' : '+' }}</span>
        {{ state.formOpen ? '收起表单' : '发布信息' }}
      </button>
      <p class="publish-area__hint">发布后系统会自动与另一类信息比对</p>
    </div>

    <Transition name="form-expand">
      <div v-if="state.formOpen" id="formPanel" class="form-panel">
        <form class="publish-form" novalidate @submit.prevent="handleSubmit">
          <p class="form-note">信息保存在当前浏览器中，清理浏览器数据将同时清除</p>

          <fieldset class="field field--type" :class="{ 'is-invalid': errors.type }" aria-describedby="error-type">
            <legend class="field__label">信息类型 <span class="req" aria-hidden="true">*</span></legend>
            <div class="type-options">
              <input type="radio" id="typeLost" v-model="form.type" value="lost" aria-required="true">
              <label class="type-option" for="typeLost">丢失</label>
              <input type="radio" id="typeFound" v-model="form.type" value="found" aria-required="true">
              <label class="type-option" for="typeFound">招领</label>
            </div>
            <p class="field__error" id="error-type" role="alert">{{ errors.type }}</p>
          </fieldset>

          <div class="field" :class="{ 'is-invalid': errors.name }">
            <label class="field__label" for="fieldName">物品名称 <span class="req" aria-hidden="true">*</span></label>
            <input class="field__control" id="fieldName" ref="nameInput" v-model="form.name" type="text" aria-required="true" aria-describedby="error-name" autocomplete="off" placeholder="如：黑色华为蓝牙耳机">
            <p class="field__error" id="error-name" role="alert">{{ errors.name }}</p>
          </div>

          <div class="field" :class="{ 'is-invalid': errors.location }">
            <label class="field__label" for="fieldLocation">地点 <span class="req" aria-hidden="true">*</span></label>
            <input class="field__control" id="fieldLocation" v-model="form.location" type="text" aria-required="true" aria-describedby="error-location" autocomplete="off" placeholder="如：图书馆三楼自习区">
            <p class="field__error" id="error-location" role="alert">{{ errors.location }}</p>
          </div>

          <div class="field" :class="{ 'is-invalid': errors.occurredAt }">
            <label class="field__label" for="fieldTime">时间 <span class="req" aria-hidden="true">*</span></label>
            <input class="field__control" id="fieldTime" v-model="form.occurredAt" type="datetime-local" aria-required="true" aria-describedby="error-occurredAt">
            <p class="field__error" id="error-occurredAt" role="alert">{{ errors.occurredAt }}</p>
          </div>

          <div class="field" :class="{ 'is-invalid': errors.contact }">
            <label class="field__label" for="fieldContact">联系方式 <span class="req" aria-hidden="true">*</span></label>
            <input class="field__control" id="fieldContact" v-model="form.contact" type="text" aria-required="true" aria-describedby="error-contact error-contact-hint" autocomplete="off" placeholder="QQ / 微信 / 手机号">
            <p class="form-hint" id="error-contact-hint">联系方式默认隐藏，仅在其他用户点击查看时展示，请谨慎填写</p>
            <p class="field__error" id="error-contact" role="alert">{{ errors.contact }}</p>
          </div>

          <div class="field field--wide" :class="{ 'is-invalid': errors.feature }">
            <label class="field__label" for="fieldFeature">特征描述 <span class="optional">选填</span></label>
            <textarea class="field__control" id="fieldFeature" v-model="form.feature" rows="3" aria-describedby="error-feature" placeholder="颜色、品牌、型号、外观痕迹等，越具体越容易匹配"></textarea>
            <p class="field__error" id="error-feature" role="alert">{{ errors.feature }}</p>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn--primary">提交</button>
            <button type="button" class="btn btn--ghost" @click="handleCancel">取消</button>
          </div>
        </form>
      </div>
    </Transition>
  </section>
</template>

<script setup>
import { reactive, ref, nextTick } from 'vue';
import { useWall } from '../composables/useWall.js';

const { state, toggleForm, publish } = useWall();

const emptyForm = () => ({
  type: 'lost',
  name: '',
  location: '',
  occurredAt: '',
  feature: '',
  contact: ''
});

const form = reactive(emptyForm());
const errors = reactive({});
const nameInput = ref(null);

function clearErrors() {
  Object.keys(errors).forEach((key) => {
    delete errors[key];
  });
}

function resetForm() {
  Object.assign(form, emptyForm());
  clearErrors();
}

function handleCancel() {
  resetForm();
  toggleForm(false);
}

function handleSubmit() {
  clearErrors();
  const result = publish({ ...form });
  if (result.ok) {
    resetForm();
    return;
  }
  const fieldIds = {
    type: 'typeLost',
    name: 'fieldName',
    location: 'fieldLocation',
    occurredAt: 'fieldTime',
    feature: 'fieldFeature',
    contact: 'fieldContact'
  };
  let firstField = '';
  (result.errors || []).forEach((error) => {
    if (error && error.field) {
      if (!firstField) {
        firstField = error.field;
      }
      errors[error.field] = error.message;
    }
  });
  if (firstField) {
    nextTick(() => {
      const el = document.getElementById(fieldIds[firstField]);
      if (el) {
        el.focus();
      }
    });
  }
}
</script>
