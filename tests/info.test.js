import { describe, it, expect } from 'vitest';
import {
    validateForm,
    createInfo,
    searchInfos,
    filterInfos,
    sortBySeqDesc,
    formatTime,
    countChars
} from '../src/services/info.js';

const NOW = new Date(2026, 10, 16, 12, 0);

function validForm() {
    return {
        type: 'lost',
        name: '学生卡',
        location: '图书馆',
        occurredAt: '2026-11-10T10:00',
        feature: '蓝色卡套',
        contact: 'QQ123456'
    };
}

describe('validateForm 表单校验', () => {
    it('合法输入通过', () => {
        expect(validateForm(validForm(), NOW).ok).toBe(true);
    });

    it('必填缺失逐项报错', () => {
        const raw = { ...validForm(), name: ' ', location: '', contact: '' };
        const result = validateForm(raw, NOW);
        expect(result.ok).toBe(false);
        const fields = result.errors.map((e) => e.field);
        expect(fields).toContain('name');
        expect(fields).toContain('location');
        expect(fields).toContain('contact');
    });

    it('超长字段被拒绝', () => {
        const raw = { ...validForm(), name: 'x'.repeat(31) };
        const result = validateForm(raw, NOW);
        expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('晚于当前时间被拒绝', () => {
        const raw = { ...validForm(), occurredAt: '2027-01-01T00:00' };
        const result = validateForm(raw, NOW);
        expect(result.errors.some((e) => e.field === 'occurredAt')).toBe(true);
    });
});

describe('createInfo 与工具函数', () => {
    it('构造 9 个事实字段', () => {
        const info = createInfo(validForm(), NOW, 7);
        expect(Object.keys(info).sort()).toEqual(
            ['type', 'name', 'location', 'occurredAt', 'feature', 'contact', 'createdAt', 'seq', 'status'].sort()
        );
        expect(info.status).toBe('searching');
        expect(info.seq).toBe(7);
    });

    it('非法 seq 抛错', () => {
        expect(() => createInfo(validForm(), NOW, 0)).toThrow(RangeError);
    });

    it('countChars 按码点计数 emoji', () => {
        expect(countChars('a😀b')).toBe(3);
    });

    it('formatTime 非法输入返回占位', () => {
        expect(formatTime('not-a-date')).toBe('—');
    });
});

describe('searchInfos 搜索', () => {
    const list = [
        { seq: 1, type: 'lost', name: '黑色耳机', location: '图书馆', feature: '蓝牙耳机' },
        { seq: 2, type: 'found', name: '学生卡', location: '食堂', feature: '蓝色卡套' },
        { seq: 3, type: 'lost', name: '雨伞', location: '图书馆', feature: '黑色折叠' }
    ];

    it('空查询返回全部', () => {
        expect(searchInfos(list, ' ')).toHaveLength(3);
    });

    it('按名称/地点/特征匹配', () => {
        expect(searchInfos(list, '耳机')).toHaveLength(1);
        expect(searchInfos(list, '图书馆')).toHaveLength(2);
        expect(searchInfos(list, '卡套')).toHaveLength(1);
    });

    it('多关键词为 AND 关系', () => {
        expect(searchInfos(list, '图书馆 黑色')).toHaveLength(2);
        expect(searchInfos(list, '图书馆 卡套')).toHaveLength(0);
    });

    it('大小写不敏感', () => {
        expect(searchInfos([{ name: 'AirPods', location: '', feature: '' }], 'airpods')).toHaveLength(1);
    });
});

describe('filterInfos 与排序', () => {
    const list = [
        { seq: 1, type: 'lost' },
        { seq: 3, type: 'found' },
        { seq: 2, type: 'lost' }
    ];

    it('按类型过滤', () => {
        expect(filterInfos(list, 'lost')).toHaveLength(2);
        expect(filterInfos(list, 'found')).toHaveLength(1);
        expect(filterInfos(list, 'unknown')).toHaveLength(3);
    });

    it('按 seq 降序', () => {
        expect(sortBySeqDesc(list).map((i) => i.seq)).toEqual([3, 2, 1]);
    });
});
