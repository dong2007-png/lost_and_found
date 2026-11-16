import { FIELD_RULES, MESSAGES, ITEM_STATUS } from '../constants.js';

/* ---------- 安全文本与格式化工具 ---------- */
export function toText(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
}

// 按 Unicode 码点计数，保证 emoji 等代理对按 1 个字符计
export function countChars(text) {
    return Array.from(toText(text)).length;
}

export function displayText(value, fallback) {
    var text = toText(value);
    if (text.trim() === '' && typeof fallback === 'string') {
        return fallback;
    }
    return text;
}

// 解析 datetime-local 字符串（本地时间语义），非法值返回 null
export function parseDateTime(value) {
    var text = toText(value).trim();
    if (text === '') {
        return null;
    }
    var match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
    var date;
    if (match) {
        var year = Number(match[1]);
        var month = Number(match[2]);
        var day = Number(match[3]);
        var hour = Number(match[4]);
        var minute = Number(match[5]);
        var second = match[6] ? Number(match[6]) : 0;
        date = new Date(year, month - 1, day, hour, minute, second, 0);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
            date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
            return null;
        }
        return date;
    }
    date = new Date(text);
    if (isNaN(date.getTime())) {
        return null;
    }
    return date;
}

export function formatTime(value) {
    var date = parseDateTime(value);
    if (!date) {
        return '—';
    }
    var pad = function (n) {
        return String(n).length < 2 ? '0' + n : String(n);
    };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
        ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

/* ---------- 领域层：校验与构造（纯函数） ---------- */
export function validateForm(raw, now) {
    var data = raw && typeof raw === 'object' ? raw : {};
    var errors = [];
    var current = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

    if (data.type !== 'lost' && data.type !== 'found') {
        errors.push({ field: 'type', message: MESSAGES.typeRequired });
    }

    var textFields = ['name', 'location'];
    for (var i = 0; i < textFields.length; i++) {
        var field = textFields[i];
        var value = toText(data[field]).trim();
        if (value === '') {
            errors.push({ field: field, message: MESSAGES[field + 'Required'] });
        } else if (countChars(value) > FIELD_RULES[field].max) {
            errors.push({ field: field, message: MESSAGES[field + 'TooLong'] });
        }
    }

    var occurredDate = parseDateTime(data.occurredAt);
    if (!occurredDate || Math.floor(occurredDate.getTime() / 60000) > Math.floor(current.getTime() / 60000)) {
        errors.push({ field: 'occurredAt', message: MESSAGES.timeInvalid });
    }

    var feature = toText(data.feature).trim();
    if (countChars(feature) > FIELD_RULES.feature.max) {
        errors.push({ field: 'feature', message: MESSAGES.featureTooLong });
    }

    var contact = toText(data.contact).trim();
    if (contact === '') {
        errors.push({ field: 'contact', message: MESSAGES.contactRequired });
    } else if (countChars(contact) > FIELD_RULES.contact.max) {
        errors.push({ field: 'contact', message: MESSAGES.contactTooLong });
    }

    return { ok: errors.length === 0, errors: errors };
}

export function createInfo(raw, now, seq) {
    if (!Number.isInteger(seq) || seq <= 0) {
        throw new RangeError('seq 必须是正整数');
    }
    if (!(now instanceof Date) || isNaN(now.getTime())) {
        throw new RangeError('now 必须是有效时间');
    }
    var data = raw && typeof raw === 'object' ? raw : {};
    return {
        type: data.type === 'found' ? 'found' : 'lost',
        name: toText(data.name).trim(),
        location: toText(data.location).trim(),
        occurredAt: toText(data.occurredAt),
        feature: toText(data.feature).trim(),
        contact: toText(data.contact).trim(),
        createdAt: now.getTime(),
        seq: seq,
        status: ITEM_STATUS.searching
    };
}

export function normalizeStatus(info) {
    if (!info || typeof info !== 'object') {
        return ITEM_STATUS.searching;
    }
    return info.status === ITEM_STATUS.found ? ITEM_STATUS.found : ITEM_STATUS.searching;
}

export function filterInfos(list, filter) {
    var items = Array.isArray(list) ? list : [];
    var value = filter === 'lost' || filter === 'found' ? filter : 'all';
    if (value === 'all') {
        return items.slice();
    }
    return items.filter(function (info) {
        return info && info.type === value;
    });
}

export function sortBySeqDesc(list) {
    var items = Array.isArray(list) ? list.slice() : [];
    items.sort(function (a, b) {
        var seqA = a && Number.isFinite(a.seq) ? a.seq : 0;
        var seqB = b && Number.isFinite(b.seq) ? b.seq : 0;
        return seqB - seqA;
    });
    return items;
}

export function searchInfos(list, query) {
    var items = Array.isArray(list) ? list : [];
    var text = toText(query).trim().toLowerCase();
    if (text === '') {
        return items.slice();
    }
    var terms = text.split(/\s+/);
    return items.filter(function (info) {
        if (!info || typeof info !== 'object') {
            return false;
        }
        var haystack = (toText(info.name) + ' ' + toText(info.location) + ' ' + toText(info.feature)).toLowerCase();
        for (var i = 0; i < terms.length; i++) {
            if (terms[i] !== '' && haystack.indexOf(terms[i]) < 0) {
                return false;
            }
        }
        return true;
    });
}

export function findInfo(infos, seq) {
    for (var i = 0; i < infos.length; i++) {
        if (infos[i] && infos[i].seq === seq) {
            return infos[i];
        }
    }
    return null;
}
