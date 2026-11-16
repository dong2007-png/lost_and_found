import { describe, it, expect } from 'vitest';
import {
    parseSavedDataset,
    buildSavedDataset,
    serializeSavedDataset,
    normalizeSavedRecords,
    normalizeSavedRecord
} from '../src/services/storage.js';
import { STORAGE_CONFIG } from '../src/constants.js';

function validRecord() {
    return {
        type: 'lost',
        name: '学生卡',
        location: '图书馆',
        occurredAt: '2026-11-10T10:00',
        feature: '蓝色卡套',
        contact: 'QQ123456',
        createdAt: 1762730400000,
        seq: 1,
        status: 'searching'
    };
}

describe('parseSavedDataset 快照闸门', () => {
    it('空文本与非法 JSON 被拒绝', () => {
        expect(parseSavedDataset('').reason).toBe('empty');
        expect(parseSavedDataset('{oops').reason).toBe('parse-error');
    });

    it('版本不一致被拒绝', () => {
        const text = JSON.stringify({ version: 999, savedAt: new Date().toISOString(), items: [] });
        expect(parseSavedDataset(text).reason).toBe('bad-version');
    });

    it('合法快照通过', () => {
        const text = JSON.stringify({ version: STORAGE_CONFIG.version, savedAt: new Date().toISOString(), items: [] });
        expect(parseSavedDataset(text).ok).toBe(true);
    });
});

describe('normalizeSavedRecord 不可信数据归一', () => {
    it('合法记录保留', () => {
        const record = normalizeSavedRecord(validRecord(), 1762730400000);
        expect(record).not.toBeNull();
        expect(record.name).toBe('学生卡');
    });

    it('缺类型/非法时间/超长字段整条丢弃', () => {
        expect(normalizeSavedRecord({ ...validRecord(), type: 'other' }, 1)).toBeNull();
        expect(normalizeSavedRecord({ ...validRecord(), occurredAt: 'bad' }, 1)).toBeNull();
        expect(normalizeSavedRecord({ ...validRecord(), name: 'x'.repeat(31) }, 1)).toBeNull();
    });

    it('非法 createdAt 回退到 savedAtMs', () => {
        const record = normalizeSavedRecord({ ...validRecord(), createdAt: -5 }, 123456);
        expect(record.createdAt).toBe(123456);
    });
});

describe('normalizeSavedRecords 整表归一', () => {
    it('重复 seq 计入 skipped 并按 seq 降序', () => {
        const items = [validRecord(), { ...validRecord(), seq: 1 }, { ...validRecord(), seq: 3 }, { ...validRecord(), seq: 0 }];
        const result = normalizeSavedRecords(items, 1762730400000);
        expect(result.records.map((r) => r.seq)).toEqual([3, 1]);
        expect(result.skipped).toBe(2);
    });
});

describe('buildSavedDataset 序列化', () => {
    it('只保留白名单字段', () => {
        const dataset = buildSavedDataset([{ ...validRecord(), hack: 'x' }], new Date(2026, 10, 16));
        expect(dataset.items[0].hack).toBeUndefined();
        expect(Object.keys(dataset.items[0])).toHaveLength(9);
        expect(dataset.version).toBe(STORAGE_CONFIG.version);
    });

    it('序列化输出可被 parseSavedDataset 接受', () => {
        const dataset = buildSavedDataset([validRecord()], new Date(2026, 10, 16));
        const text = serializeSavedDataset(dataset);
        expect(parseSavedDataset(text).ok).toBe(true);
    });
});
