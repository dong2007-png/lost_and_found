import { STORAGE_CONFIG, PERSIST_FIELDS, FIELD_RULES } from '../constants.js';
import { toText, countChars, parseDateTime, normalizeStatus } from './info.js';

// 单条不可信记录 → 与 createInfo 同形的 9 字段对象；非法返回 null。
// 归一过程不读时钟（savedAtMs 由调用方给出），超长字段整条丢弃、不截断。
export function normalizeSavedRecord(raw, savedAtMs) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }
    var type = raw.type === 'found' ? 'found' : (raw.type === 'lost' ? 'lost' : '');
    if (type === '') {
        return null;
    }
    var name = toText(raw.name).trim();
    var nameLength = countChars(name);
    if (nameLength < 1 || nameLength > FIELD_RULES.name.max) {
        return null;
    }
    var location = toText(raw.location).trim();
    var locationLength = countChars(location);
    if (locationLength < 1 || locationLength > FIELD_RULES.location.max) {
        return null;
    }
    var occurredAt = toText(raw.occurredAt);
    if (!parseDateTime(occurredAt)) {
        return null;
    }
    var feature = raw.feature === null || raw.feature === undefined ? '' : toText(raw.feature).trim();
    if (countChars(feature) > FIELD_RULES.feature.max) {
        return null;
    }
    var contact = toText(raw.contact).trim();
    var contactLength = countChars(contact);
    if (contactLength < 1 || contactLength > FIELD_RULES.contact.max) {
        return null;
    }
    var seq = raw.seq;
    if (!Number.isInteger(seq) || seq <= 0) {
        return null;
    }
    var createdAt = raw.createdAt;
    if (typeof createdAt !== 'number' || !isFinite(createdAt) || createdAt <= 0) {
        createdAt = savedAtMs;
    }
    if (typeof createdAt !== 'number' || !isFinite(createdAt) || createdAt <= 0) {
        createdAt = 1;
    }
    return {
        type: type,
        name: name,
        location: location,
        occurredAt: occurredAt,
        feature: feature,
        contact: contact,
        createdAt: createdAt,
        seq: seq,
        status: normalizeStatus(raw)
    };
}

// 整表归一：非法与重复 seq 计入 skipped（保留首次出现），输出按 seq 降序。
export function normalizeSavedRecords(items, savedAtMs) {
    if (!Array.isArray(items)) {
        return { records: [], skipped: 0 };
    }
    var records = [];
    var skipped = 0;
    var seen = Object.create(null);
    for (var i = 0; i < items.length; i++) {
        var record = normalizeSavedRecord(items[i], savedAtMs);
        if (!record) {
            skipped += 1;
            continue;
        }
        if (seen[record.seq]) {
            skipped += 1;
            continue;
        }
        seen[record.seq] = true;
        records.push(record);
    }
    records.sort(function (a, b) {
        return b.seq - a.seq;
    });
    return { records: records, skipped: skipped };
}

// 内存事实源 → 保存数据集（只复制白名单字段，逐条新建对象）
export function buildSavedDataset(infos, savedAt) {
    var list = Array.isArray(infos) ? infos : [];
    var when = savedAt instanceof Date && !isNaN(savedAt.getTime()) ? savedAt : new Date();
    var items = [];
    for (var i = 0; i < list.length; i++) {
        var info = list[i];
        if (!info || typeof info !== 'object' || !Number.isInteger(info.seq) || info.seq <= 0) {
            continue;
        }
        var record = {};
        for (var f = 0; f < PERSIST_FIELDS.length; f++) {
            var key = PERSIST_FIELDS[f];
            record[key] = info[key] === undefined ? '' : info[key];
        }
        items.push(record);
    }
    return {
        version: STORAGE_CONFIG.version,
        savedAt: when.toISOString(),
        items: items
    };
}

// 唯一序列化通道；失败返回空串，不向上抛错
export function serializeSavedDataset(dataset) {
    try {
        return JSON.stringify(dataset);
    } catch (err) {
        return '';
    }
}

// 整份快照闸门：非字符串/空白、超长、解析失败、结构、版本、时间逐层拒绝
export function parseSavedDataset(text) {
    function fail(reason) {
        return { ok: false, reason: reason, dataset: null };
    }
    if (typeof text !== 'string' || text.trim() === '') {
        return fail('empty');
    }
    if (text.length > STORAGE_CONFIG.maxTextChars) {
        return fail('too-large');
    }
    var dataset;
    try {
        dataset = JSON.parse(text);
    } catch (err) {
        return fail('parse-error');
    }
    if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
        return fail('bad-structure');
    }
    if (!Array.isArray(dataset.items) || typeof dataset.savedAt !== 'string') {
        return fail('bad-structure');
    }
    if (dataset.version !== STORAGE_CONFIG.version) {
        return fail('bad-version');
    }
    if (isNaN(Date.parse(dataset.savedAt))) {
        return fail('bad-savedAt');
    }
    return { ok: true, reason: 'ok', dataset: dataset };
}

// 探测可写性：只碰探测键，绝不试写数据键
export function probeStorage() {
    try {
        var storage = window.localStorage;
        if (!storage) {
            return 'unavailable';
        }
        storage.setItem(STORAGE_CONFIG.probeKey, '1');
        storage.removeItem(STORAGE_CONFIG.probeKey);
        return 'ok';
    } catch (err) {
        return 'unavailable';
    }
}

export function readRawText() {
    try {
        var text = window.localStorage.getItem(STORAGE_CONFIG.key);
        if (text === null || text === '') {
            return { ok: true, text: null, reason: 'none' };
        }
        return { ok: true, text: text, reason: 'ok' };
    } catch (err) {
        return { ok: false, text: null, reason: 'unreadable' };
    }
}

// 失败一律保留旧值：不 removeItem、不 clear、不重试
export function writeRawText(text) {
    try {
        window.localStorage.setItem(STORAGE_CONFIG.key, text);
        return { ok: true, reason: 'ok' };
    } catch (err) {
        if (err && err.name === 'QuotaExceededError') {
            return { ok: false, reason: 'quota' };
        }
        if (err && err.name === 'SecurityError') {
            return { ok: false, reason: 'denied' };
        }
        return { ok: false, reason: 'error' };
    }
}

// 启动恢复：探测 → 读取 → 解析 → 归一。零写入。
export function restoreSavedDataset() {
    function outcome(status, restored, skipped, notice, records) {
        return {
            status: status,
            restored: restored,
            skipped: skipped,
            notice: notice,
            records: records || []
        };
    }
    try {
        if (probeStorage() === 'unavailable') {
            return outcome('unavailable', 0, 0, 'unavailable');
        }
        var read = readRawText();
        if (!read.ok) {
            return outcome('unreadable', 0, 0, 'unreadable');
        }
        if (read.text === null) {
            return outcome('none', 0, 0, '');
        }
        var parsed = parseSavedDataset(read.text);
        if (!parsed.ok) {
            if (parsed.reason === 'empty') {
                return outcome('none', 0, 0, '');
            }
            return outcome('unreadable', 0, 0, 'unreadable');
        }
        var normalized = normalizeSavedRecords(parsed.dataset.items, Date.parse(parsed.dataset.savedAt));
        if (normalized.records.length === 0) {
            if (normalized.skipped > 0 || parsed.dataset.items.length > 0) {
                return outcome('unreadable', 0, normalized.skipped, 'unreadable');
            }
            return outcome('none', 0, 0, '');
        }
        if (normalized.skipped > 0) {
            return outcome('partial', normalized.records.length, normalized.skipped, 'partial', normalized.records);
        }
        return outcome('restored', normalized.records.length, 0, 'restored', normalized.records);
    } catch (err) {
        return outcome('unreadable', 0, 0, 'unreadable');
    }
}
