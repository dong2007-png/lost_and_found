// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import App from '../src/App.vue';
import { useWall } from '../src/composables/useWall.js';
import { STORAGE_CONFIG } from '../src/constants.js';

const settle = () => new Promise((resolve) => setTimeout(resolve, 420));

function resetWall() {
    const { state } = useWall();
    state.infos = [];
    state.activeFilter = 'all';
    state.searchQuery = '';
    state.onlySearching = false;
    state.formOpen = false;
    state.submitLock = false;
    state.seqCounter = 0;
    state.notice = '';
    state.noticeVisible = false;
    state.markLock = false;
    state.storageState = 'ok';
    state.restored = false;
}

async function publish(wrapper, data) {
    await wrapper.find('.publish-btn').trigger('click');
    await wrapper.find(data.type === 'found' ? '#typeFound' : '#typeLost').setChecked(true);
    await wrapper.find('#fieldName').setValue(data.name);
    await wrapper.find('#fieldLocation').setValue(data.location);
    await wrapper.find('#fieldTime').setValue(data.occurredAt);
    await wrapper.find('#fieldFeature').setValue(data.feature);
    await wrapper.find('#fieldContact').setValue(data.contact);
    await wrapper.find('form.publish-form').trigger('submit');
    await nextTick();
    await settle();
}

describe('App 全链路冒烟', () => {
    beforeAll(() => {
        window.localStorage.clear();
        resetWall();
    });

    it('渲染 → 发布 → 自动匹配 → 搜索 → 标记 → 本地持久化', async () => {
        const wrapper = mount(App, { attachTo: document.body });
        await nextTick();

        expect(wrapper.text()).toContain('学校失物招领墙');
        expect(wrapper.findAll('.stat-card')).toHaveLength(4);
        expect(wrapper.find('.empty-state').exists()).toBe(true);
        expect(wrapper.find('.match-empty').exists()).toBe(true);

        await publish(wrapper, {
            type: 'lost',
            name: '黑色华为蓝牙耳机',
            location: '图书馆三楼',
            occurredAt: '2026-11-10T14:00',
            feature: '黑色华为蓝牙耳机 带保护套',
            contact: 'QQ111111'
        });

        expect(wrapper.findAll('.card')).toHaveLength(1);
        expect(wrapper.find('.match-empty').exists()).toBe(true);

        await publish(wrapper, {
            type: 'found',
            name: '黑色蓝牙耳机',
            location: '图书馆三楼',
            occurredAt: '2026-11-10T18:00',
            feature: '黑色蓝牙耳机 保护套',
            contact: 'QQ222222'
        });

        const cards = wrapper.findAll('.card');
        expect(cards).toHaveLength(2);
        const matchCard = wrapper.find('.match-card');
        expect(matchCard.exists()).toBe(true);
        expect(Number(matchCard.find('.match-score__value').text())).toBeGreaterThanOrEqual(75);
        expect(matchCard.find('.match-score__label').text()).toBe('高匹配');
        expect(matchCard.text()).toContain('地点相同');

        expect(wrapper.find('.stat-card--lost .stat-card__value').text()).toBe('1');
        expect(wrapper.find('.stat-card--found .stat-card__value').text()).toBe('1');
        expect(wrapper.find('.stat-card--matches .stat-card__value').text()).toBe('1');

        const contactToggle = wrapper.find('.card__contact-toggle');
        expect(contactToggle.text()).toBe('查看');
        await contactToggle.trigger('click');
        expect(wrapper.find('.card__contact-toggle').text()).toBe('隐藏');

        await wrapper.find('.search-box__input').setValue('耳机');
        await settle();
        expect(wrapper.findAll('.card')).toHaveLength(2);
        await wrapper.find('.search-box__input').setValue('华为');
        await settle();
        expect(wrapper.findAll('.card')).toHaveLength(1);
        await wrapper.find('.search-box__input').setValue('不存在的物品');
        await settle();
        expect(wrapper.find('.empty-state').exists()).toBe(true);
        await wrapper.find('.search-box__input').setValue('');
        await settle();
        expect(wrapper.findAll('.card')).toHaveLength(2);

        const lostTab = wrapper.findAll('.filter-btn').find((btn) => btn.text() === '招领');
        await lostTab.trigger('click');
        await settle();
        expect(wrapper.findAll('.card')).toHaveLength(1);
        const allTab = wrapper.findAll('.filter-btn').find((btn) => btn.text() === '全部');
        await allTab.trigger('click');
        await settle();

        await wrapper.find('.match-card__actions .btn').trigger('click');
        await settle();

        expect(wrapper.findAll('.card.is-found')).toHaveLength(2);
        expect(wrapper.find('.match-empty').exists()).toBe(true);
        expect(wrapper.find('.stat-card--done .stat-card__value').text()).toBe('2');

        const saved = JSON.parse(window.localStorage.getItem(STORAGE_CONFIG.key));
        expect(saved.version).toBe(STORAGE_CONFIG.version);
        expect(saved.items).toHaveLength(2);
        expect(saved.items.every((item) => item.status === 'found')).toBe(true);

        wrapper.unmount();
    }, 20000);
});
