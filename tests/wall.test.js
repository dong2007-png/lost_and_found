// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useWall } from '../src/composables/useWall.js';
import { STORAGE_CONFIG } from '../src/constants.js';
import { buildSavedDataset, serializeSavedDataset } from '../src/services/storage.js';

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
    state.editingSeq = null;
    state.focusedId = '';
}

function raw(overrides) {
    return {
        type: 'lost',
        name: '黑色耳机',
        location: '图书馆',
        occurredAt: '2026-11-10T10:00',
        feature: '蓝牙耳机',
        contact: 'QQ123456',
        ...overrides
    };
}

function savedRecord(overrides) {
    return {
        type: 'lost',
        name: '黑色耳机',
        location: '图书馆',
        occurredAt: '2026-11-10T10:00',
        feature: '蓝牙耳机',
        contact: 'QQ123456',
        createdAt: 1762730400000,
        seq: 1,
        status: 'searching',
        ...overrides
    };
}

describe('useWall 编辑 / 删除 / 清空', () => {
    beforeEach(() => {
        window.localStorage.clear();
        resetWall();
    });

    it('编辑保留 seq、createdAt 与状态', () => {
        const wall = useWall();
        wall.publish(raw(), {});
        const before = wall.state.infos[0];
        const result = wall.updateInfo(before.seq, raw({ name: '华为耳机', location: '食堂' }));
        expect(result.ok).toBe(true);
        const after = wall.state.infos[0];
        expect(after.name).toBe('华为耳机');
        expect(after.location).toBe('食堂');
        expect(after.seq).toBe(before.seq);
        expect(after.createdAt).toBe(before.createdAt);
        expect(after.status).toBe(before.status);
    });

    it('编辑非法输入返回错误且不改动原数据', () => {
        const wall = useWall();
        wall.publish(raw(), {});
        const before = wall.state.infos[0];
        const result = wall.updateInfo(before.seq, raw({ name: '' }));
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.field === 'name')).toBe(true);
        expect(wall.state.infos[0].name).toBe(before.name);
    });

    it('删除按 seq 生效并写入本地', () => {
        const wall = useWall();
        wall.publish(raw(), {});
        wall.publish(raw({ name: '校园卡' }), {});
        expect(wall.state.infos).toHaveLength(2);
        wall.deleteInfo(1);
        expect(wall.state.infos).toHaveLength(1);
        expect(wall.state.infos[0].name).toBe('校园卡');
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_CONFIG.key));
        expect(saved.items).toHaveLength(1);
    });

    it('清空全部信息并重置序号', () => {
        const wall = useWall();
        wall.publish(raw(), {});
        wall.clearAll();
        expect(wall.state.infos).toHaveLength(0);
        expect(wall.state.seqCounter).toBe(0);
    });
});

describe('useWall 导出 / 导入', () => {
    beforeEach(() => {
        window.localStorage.clear();
        resetWall();
    });

    it('导出后清空再导入可恢复数据', () => {
        const wall = useWall();
        wall.publish(raw(), {});
        wall.publish(raw({ name: '校园卡', type: 'found' }), {});
        const backup = wall.exportData();
        wall.clearAll();
        expect(wall.state.infos).toHaveLength(0);
        const result = wall.importData(backup);
        expect(result.ok).toBe(true);
        expect(result.imported).toBe(2);
        expect(wall.state.infos).toHaveLength(2);
    });

    it('导入时重复内容跳过、seq 冲突重新编号', () => {
        const wall = useWall();
        wall.publish(raw(), {});
        const dataset = {
            version: STORAGE_CONFIG.version,
            savedAt: new Date().toISOString(),
            items: [
                savedRecord(),
                savedRecord({ name: '校园卡', seq: 1 })
            ]
        };
        const result = wall.importData(JSON.stringify(dataset));
        expect(result.imported).toBe(1);
        expect(result.duplicated).toBe(1);
        expect(wall.state.infos).toHaveLength(2);
        const added = wall.state.infos.find((info) => info.name === '校园卡');
        expect(added.seq).not.toBe(1);
        expect(wall.state.seqCounter).toBeGreaterThanOrEqual(added.seq);
    });

    it('非法文件被拒绝', () => {
        const wall = useWall();
        const result = wall.importData('{not-json');
        expect(result.ok).toBe(false);
        expect(wall.state.infos).toHaveLength(0);
    });
});

describe('旧存储键迁移', () => {
    beforeEach(() => {
        window.localStorage.clear();
        resetWall();
    });

    it('旧键数据自动迁移到新键并清理旧键', () => {
        const legacyKey = 'csuLostFound.dataset';
        const text = serializeSavedDataset(buildSavedDataset([savedRecord({ name: '学生卡', seq: 5 })], new Date()));
        window.localStorage.setItem(legacyKey, text);

        const wall = useWall();
        wall.restore();

        expect(wall.state.infos).toHaveLength(1);
        expect(wall.state.infos[0].name).toBe('学生卡');
        expect(wall.state.seqCounter).toBe(5);
        expect(window.localStorage.getItem(STORAGE_CONFIG.key)).not.toBeNull();
        expect(window.localStorage.getItem(legacyKey)).toBeNull();
    });

    it('新键已有数据时不触碰旧键', () => {
        const legacyKey = 'csuLostFound.dataset';
        window.localStorage.setItem(legacyKey, serializeSavedDataset(buildSavedDataset([savedRecord({ seq: 9 })], new Date())));
        window.localStorage.setItem(STORAGE_CONFIG.key, serializeSavedDataset(buildSavedDataset([savedRecord({ name: '雨伞', seq: 2 })], new Date())));

        const wall = useWall();
        wall.restore();

        expect(wall.state.infos).toHaveLength(1);
        expect(wall.state.infos[0].name).toBe('雨伞');
        expect(window.localStorage.getItem(legacyKey)).not.toBeNull();
    });
});
