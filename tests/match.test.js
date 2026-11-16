import { describe, it, expect } from 'vitest';
import {
    nameSimilarity,
    featureSimilarity,
    locationSimilarity,
    timeSimilarity,
    computeMatches,
    resolveMark,
    markSeqsFound,
    scoreToLevel
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

describe('nameSimilarity 名称相似度', () => {
    it('完全相等得满分', () => {
        const r = nameSimilarity('学生卡', '学生卡');
        expect(r.kind).toBe('equal');
        expect(r.score).toBe(1);
    });

    it('连续子串的包含关系给高分且随长度比变化', () => {
        const r = nameSimilarity('华为蓝牙耳机', '蓝牙耳机');
        expect(r.kind).toBe('contain');
        expect(r.score).toBeGreaterThan(0.8);
        expect(r.score).toBeLessThanOrEqual(1);
    });

    it('非连续但字符完全覆盖时走 coverage 分支', () => {
        const r = nameSimilarity('黑色华为蓝牙耳机', '黑色蓝牙耳机');
        expect(r.kind).toBe('coverage');
        expect(r.coverage).toBe(1);
        expect(r.score).toBe(0.75);
    });

    it('单字名称允许召回但分数受限', () => {
        const r = nameSimilarity('雨伞', '伞');
        expect(r.kind).toBe('single-char');
        expect(r.score).toBe(0.55);
    });

    it('名称不同但字符覆盖或编辑相似时仍可得分', () => {
        const r = nameSimilarity('学生卡', '学生证');
        expect(r.score).toBeGreaterThan(0);
    });

    it('语义无关的名称不得分', () => {
        expect(nameSimilarity('黑色耳机', '黑色书包').score).toBe(0);
        expect(nameSimilarity('', '耳机').score).toBe(0);
    });
});

describe('featureSimilarity 特征相似度', () => {
    it('词典重合越多得分越高', () => {
        const one = featureSimilarity('黑色耳机', '黑色蓝牙耳机');
        const many = featureSimilarity('黑色蓝牙耳机 保护套', '黑色蓝牙耳机 保护套');
        expect(one.overlapCount).toBeGreaterThanOrEqual(1);
        expect(many.score).toBeGreaterThan(one.score);
    });

    it('空特征得 0 分而不是抛错', () => {
        const r = featureSimilarity('', '');
        expect(r.score).toBe(0);
        expect(r.overlapCount).toBe(0);
    });

    it('未命中词典的描述可用 N-gram 兜底', () => {
        const r = featureSimilarity('逸夫楼南侧长椅', '逸夫楼南侧长椅');
        expect(r.score).toBeGreaterThan(0);
    });
});

describe('locationSimilarity 地点相似度', () => {
    it('相同地点得满分', () => {
        expect(locationSimilarity('图书馆三楼', '图书馆三楼')).toBe(1);
    });

    it('包含关系给 0.8', () => {
        expect(locationSimilarity('图书馆三楼自习区', '图书馆三楼')).toBe(0.8);
    });

    it('完全不同地点不得分', () => {
        expect(locationSimilarity('食堂', '教学楼')).toBe(0);
    });
});

describe('timeSimilarity 时间维度', () => {
    it('同日得满分', () => {
        const a = new Date(2026, 10, 10, 9, 0);
        const b = new Date(2026, 10, 10, 20, 0);
        const r = timeSimilarity(a, b);
        expect(r.score).toBe(1);
        expect(r.reversed).toBe(false);
    });

    it('招领早于丢失标记为顺序存疑', () => {
        const lost = new Date(2026, 10, 12, 9, 0);
        const found = new Date(2026, 10, 10, 9, 0);
        const r = timeSimilarity(lost, found);
        expect(r.reversed).toBe(true);
    });

    it('缺失时间给中性分', () => {
        expect(timeSimilarity(null, new Date()).score).toBe(0.3);
    });
});

describe('computeMatches 综合评分', () => {
    it('名称包含 + 特征高度重合 + 同地点同日 → 高分匹配', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '黑色华为蓝牙耳机', location: '图书馆三楼', feature: '黑色华为蓝牙耳机 带保护套', occurredAt: '2026-11-10T14:00' }),
            makeInfo({ seq: 2, type: 'found', name: '黑色蓝牙耳机', location: '图书馆三楼', feature: '黑色蓝牙耳机 保护套', occurredAt: '2026-11-10T18:00' })
        ];
        const result = computeMatches(infos);
        expect(result.total).toBe(1);
        expect(result.pairs[0].score).toBeGreaterThanOrEqual(75);
        expect(result.pairs[0].level).toBe('high');
        expect(result.pairs[0].reasons).toContain('地点相同');
    });

    it('单字名称在有特征佐证时可以召回', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '伞', location: '食堂', feature: '黑色折叠雨伞', occurredAt: '2026-11-10T12:00' }),
            makeInfo({ seq: 2, type: 'found', name: '雨伞', location: '食堂', feature: '黑色折叠伞', occurredAt: '2026-11-10T15:00' })
        ];
        const result = computeMatches(infos);
        expect(result.total).toBe(1);
        expect(result.pairs[0].nameKind).toBe('single-char');
    });

    it('单字名称缺少佐证时被排除，避免误配', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '伞', location: '食堂', feature: '' }),
            makeInfo({ seq: 2, type: 'found', name: '雨伞', location: '教学楼', feature: '' })
        ];
        expect(computeMatches(infos).total).toBe(0);
    });

    it('特征为空不再一票否决（名称一致 + 同地点同日）', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T11:00' })
        ];
        const result = computeMatches(infos);
        expect(result.total).toBe(1);
        expect(result.pairs[0].score).toBe(75);
    });

    it('时间顺序存疑的配对会被降权', () => {
        const normal = [
            makeInfo({ seq: 1, type: 'lost', name: '学生卡', location: '食堂', feature: '学生卡 蓝色卡套', occurredAt: '2026-11-10T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '学生卡', location: '食堂', feature: '学生卡 蓝色卡套', occurredAt: '2026-11-11T09:00' })
        ];
        const reversed = [
            makeInfo({ seq: 1, type: 'lost', name: '学生卡', location: '食堂', feature: '学生卡 蓝色卡套', occurredAt: '2026-11-11T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '学生卡', location: '食堂', feature: '学生卡 蓝色卡套', occurredAt: '2026-11-10T09:00' })
        ];
        const normalScore = computeMatches(normal).pairs[0].score;
        const reversedPair = computeMatches(reversed).pairs[0];
        expect(reversedPair.reversed).toBe(true);
        expect(reversedPair.score).toBeLessThan(normalScore);
    });

    it('语义无关的物品不会误配', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '黑色耳机', location: '图书馆', feature: '黑色耳机' }),
            makeInfo({ seq: 2, type: 'found', name: '黑色书包', location: '图书馆', feature: '黑色书包' })
        ];
        expect(computeMatches(infos).total).toBe(0);
    });

    it('已找到的信息不再参与匹配', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T09:00' }),
            makeInfo({ seq: 2, type: 'found', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T11:00', status: 'found' })
        ];
        expect(computeMatches(infos).total).toBe(0);
    });

    it('多对匹配按分数降序排列', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '校园卡', location: '图书馆', feature: '校园卡', occurredAt: '2026-11-10T09:00' }),
            makeInfo({ seq: 2, type: 'lost', name: '黑色华为蓝牙耳机', location: '图书馆三楼', feature: '黑色华为蓝牙耳机 带保护套', occurredAt: '2026-11-10T14:00' }),
            makeInfo({ seq: 3, type: 'found', name: '校园卡', location: '图书馆', feature: '', occurredAt: '2026-11-10T11:00' }),
            makeInfo({ seq: 4, type: 'found', name: '黑色蓝牙耳机', location: '图书馆三楼', feature: '黑色蓝牙耳机 保护套', occurredAt: '2026-11-10T18:00' })
        ];
        const result = computeMatches(infos);
        expect(result.total).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < result.allPairs.length; i++) {
            expect(result.allPairs[i - 1].score).toBeGreaterThanOrEqual(result.allPairs[i].score);
        }
    });
});

describe('scoreToLevel 与标记联动', () => {
    it('分数映射三档等级', () => {
        expect(scoreToLevel(80)).toBe('high');
        expect(scoreToLevel(60)).toBe('medium');
        expect(scoreToLevel(40)).toBe('general');
    });

    it('唯一配对标记时双方同步为已找到', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '校园卡' }),
            makeInfo({ seq: 2, type: 'found', name: '校园卡' })
        ];
        const pairs = [{ lostSeq: 1, foundSeq: 2 }];
        const plan = resolveMark({ seq: 1, infos, pairs, source: 'card' });
        expect(plan.seqs).toEqual([1, 2]);
        const applied = markSeqsFound(infos, plan.seqs);
        expect(applied.changed).toEqual([1, 2]);
        expect(applied.infos.every((i) => i.status === 'found')).toBe(true);
    });

    it('多配对时只标记自身并报告失效数量', () => {
        const infos = [
            makeInfo({ seq: 1, type: 'lost', name: '校园卡' }),
            makeInfo({ seq: 2, type: 'found', name: '校园卡' }),
            makeInfo({ seq: 3, type: 'found', name: '校园卡' })
        ];
        const pairs = [{ lostSeq: 1, foundSeq: 2 }, { lostSeq: 1, foundSeq: 3 }];
        const plan = resolveMark({ seq: 1, infos, pairs, source: 'card' });
        expect(plan.seqs).toEqual([1]);
        expect(plan.invalidated).toBe(2);
        expect(plan.noticeKey).toBe('invalidated');
    });
});
