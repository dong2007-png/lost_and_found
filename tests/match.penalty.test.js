import { describe, it, expect } from 'vitest';
import {
    detectCategory,
    extractColors,
    hasColorConflict,
    computeMatches
} from '../src/services/match.js';

function makeInfo(overrides) {
    return {
        type: 'lost',
        name: '',
        location: '',
        occurredAt: '2026-11-10T10:00',
        feature: '',
        contact: '12345',
        createdAt: 1762730400000,
        seq: 1,
        status: 'searching',
        ...overrides
    };
}

function pairOf(lost, found) {
    return computeMatches([lost, found]).pairs[0] || null;
}

describe('品类推断与颜色负信号', () => {
    it('按名称与特征识别品类', () => {
        expect(detectCategory({ name: '蓝牙耳机', feature: '' })).toBe('电子数码');
        expect(detectCategory({ name: '校园卡', feature: '' })).toBe('证件卡片');
        expect(detectCategory({ name: '伞', feature: '黑色折叠' })).toBe('雨具');
        expect(detectCategory({ name: '未知物品', feature: '' })).toBe('');
    });

    it('提取颜色并识别冲突', () => {
        expect(extractColors('黑色华为耳机')).toEqual(['黑色']);
        expect(hasColorConflict({ name: '水杯', feature: '黑色保温杯' }, { name: '水杯', feature: '白色保温杯' })).toBe(true);
        expect(hasColorConflict({ name: '水杯', feature: '黑色保温杯' }, { name: '水杯', feature: '黑色白色保温杯' })).toBe(false);
        expect(hasColorConflict({ name: '水杯', feature: '' }, { name: '水杯', feature: '白色保温杯' })).toBe(false);
    });

    it('颜色冲突会被降权并给出差异提示', () => {
        const same = pairOf(
            makeInfo({ seq: 1, type: 'lost', name: '水杯', location: '图书馆', feature: '黑色保温杯', occurredAt: '2026-11-10T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '水杯', location: '图书馆', feature: '黑色保温杯', occurredAt: '2026-11-10T11:00' })
        );
        const conflict = pairOf(
            makeInfo({ seq: 1, type: 'lost', name: '水杯', location: '图书馆', feature: '黑色保温杯', occurredAt: '2026-11-10T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '水杯', location: '图书馆', feature: '白色保温杯', occurredAt: '2026-11-10T11:00' })
        );
        expect(same).not.toBeNull();
        expect(conflict).not.toBeNull();
        expect(conflict.colorConflict).toBe(true);
        expect(conflict.score).toBeLessThan(same.score);
        expect(conflict.differences).toContain('颜色不同');
    });

    it('品类冲突会被降权并给出差异提示', () => {
        const base = {
            location: '图书馆',
            occurredAt: '2026-11-10T09:00'
        };
        const sameCategory = pairOf(
            makeInfo({ seq: 1, type: 'lost', name: '苹果', feature: '苹果手机 黑色', ...base }),
            makeInfo({ seq: 2, type: 'found', name: '苹果', feature: '苹果手机 黑色', ...base })
        );
        const conflictCategory = pairOf(
            makeInfo({ seq: 1, type: 'lost', name: '苹果', feature: '苹果手机 黑色', ...base }),
            makeInfo({ seq: 2, type: 'found', name: '苹果', feature: '苹果笔记本 黑色', ...base })
        );
        expect(sameCategory.categoryConflict).toBe(false);
        expect(conflictCategory.categoryConflict).toBe(true);
        expect(conflictCategory.score).toBeLessThan(sameCategory.score);
        expect(conflictCategory.differences).toContain('品类不同');
    });
});

describe('时间顺序宽限规则', () => {
    it('同日内招领早于丢失不再降权', () => {
        const forward = pairOf(
            makeInfo({ seq: 1, type: 'lost', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T18:00' })
        );
        const reversed = pairOf(
            makeInfo({ seq: 1, type: 'lost', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T18:00' }),
            makeInfo({ seq: 2, type: 'found', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T09:00' })
        );
        expect(forward.score).toBe(75);
        expect(reversed.score).toBe(forward.score);
        expect(reversed.reversed).toBe(true);
        expect(reversed.differences).not.toContain('时间顺序存疑');
    });

    it('跨日顺序存疑仍降权并提示', () => {
        const forward = pairOf(
            makeInfo({ seq: 1, type: 'lost', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-11T09:00' })
        );
        const reversed = pairOf(
            makeInfo({ seq: 1, type: 'lost', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-11T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T09:00' })
        );
        expect(reversed.score).toBeLessThan(forward.score);
        expect(reversed.differences).toContain('时间顺序存疑');
    });
});

describe('金标准样本对拍', () => {
    const cases = [
        {
            name: '高度一致的蓝牙耳机应得高分',
            lost: { name: '黑色华为蓝牙耳机', location: '图书馆三楼', feature: '黑色华为蓝牙耳机 带保护套', occurredAt: '2026-11-10T14:00' },
            found: { name: '黑色蓝牙耳机', location: '图书馆三楼', feature: '黑色蓝牙耳机 保护套', occurredAt: '2026-11-10T18:00' },
            expectMatch: true,
            minScore: 75
        },
        {
            name: '同名同地点同日的校园卡即使无特征也应入围',
            lost: { name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T09:00' },
            found: { name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T11:00' },
            expectMatch: true,
            minScore: 75
        },
        {
            name: '名称无关的物品不应匹配',
            lost: { name: '黑色耳机', location: '图书馆', feature: '黑色耳机' },
            found: { name: '黑色书包', location: '图书馆', feature: '黑色书包' },
            expectMatch: false
        },
        {
            name: '同名但不同地点的水杯仍可入围但给出差异提示',
            lost: { name: '保温杯', location: '图书馆', feature: '黑色保温杯', occurredAt: '2026-11-10T09:00' },
            found: { name: '保温杯', location: '学生食堂', feature: '黑色保温杯', occurredAt: '2026-11-10T11:00' },
            expectMatch: true,
            expectDiff: '地点不同'
        },
        {
            name: '雨伞与书包不应匹配',
            lost: { name: '雨伞', location: '食堂', feature: '黑色折叠伞' },
            found: { name: '书包', location: '食堂', feature: '黑色书包' },
            expectMatch: false
        }
    ];

    cases.forEach((item, index) => {
        it(item.name, () => {
            const result = computeMatches([
                makeInfo({ seq: 1, type: 'lost', ...item.lost }),
                makeInfo({ seq: 2, type: 'found', ...item.found })
            ]);
            if (!item.expectMatch) {
                expect(result.total).toBe(0);
                return;
            }
            expect(result.total).toBeGreaterThanOrEqual(1);
            const pair = result.pairs[0];
            if (item.minScore) {
                expect(pair.score).toBeGreaterThanOrEqual(item.minScore);
            }
            if (item.expectDiff) {
                expect(pair.differences).toContain(item.expectDiff);
            }
        });
    });
});
