import { reactive, computed } from 'vue';
import {
    filterInfos,
    searchInfos,
    sortBySeqDesc,
    validateForm,
    createInfo,
    normalizeStatus,
    toText
} from '../services/info.js';
import { computeMatches, resolveMark, markSeqsFound } from '../services/match.js';
import {
    buildSavedDataset,
    serializeSavedDataset,
    writeRawText,
    restoreSavedDataset,
    parseSavedDataset,
    normalizeSavedRecords,
    removeStorageKey
} from '../services/storage.js';
import { STORAGE_TEXT, MATCH_NOTICE, ITEM_STATUS } from '../constants.js';

var state = reactive({
    infos: [],
    activeFilter: 'all',
    searchQuery: '',
    onlySearching: false,
    formOpen: false,
    submitLock: false,
    seqCounter: 0,
    notice: '',
    noticeVisible: false,
    markLock: false,
    storageState: 'ok',
    restored: false,
    editingSeq: null,
    focusedId: ''
});

var noticeTimer = null;
var focusTimer = null;

function showNotice(text) {
    if (!text) {
        return;
    }
    state.notice = text;
    state.noticeVisible = true;
    if (noticeTimer) {
        clearTimeout(noticeTimer);
    }
    noticeTimer = setTimeout(function () {
        state.noticeVisible = false;
    }, 3600);
}

function storageNoticeFor(outcome) {
    if (!outcome || !outcome.notice) {
        return '';
    }
    if (outcome.notice === 'restored') {
        return STORAGE_TEXT.restored.replace('{N}', String(outcome.restored));
    }
    if (outcome.notice === 'partial') {
        return STORAGE_TEXT.partial
            .replace('{M}', String(outcome.restored))
            .replace('{K}', String(outcome.skipped));
    }
    if (outcome.notice === 'unreadable') {
        return STORAGE_TEXT.unreadable;
    }
    if (outcome.notice === 'unavailable') {
        return STORAGE_TEXT.unavailable;
    }
    return '';
}

function saveCurrentInfos() {
    if (state.storageState === 'unavailable') {
        return { ok: false, reason: 'skipped-unavailable' };
    }
    try {
        var text = serializeSavedDataset(buildSavedDataset(state.infos, new Date()));
        if (text === '') {
            state.storageState = 'write-failed';
            showNotice(STORAGE_TEXT.writeFailed);
            return { ok: false, reason: 'write-failed' };
        }
        var written = writeRawText(text);
        if (!written.ok) {
            state.storageState = 'write-failed';
            showNotice(STORAGE_TEXT.writeFailed);
            return { ok: false, reason: 'write-failed' };
        }
        state.storageState = 'ok';
        return { ok: true, reason: 'ok' };
    } catch (err) {
        state.storageState = 'write-failed';
        showNotice(STORAGE_TEXT.writeFailed);
        return { ok: false, reason: 'write-failed' };
    }
}

function noticeTextFor(key, invalidated) {
    if (key === 'synced') {
        return MATCH_NOTICE.synced;
    }
    if (key === 'invalidated') {
        var count = Number.isInteger(invalidated) ? invalidated : 0;
        return MATCH_NOTICE.invalidated.replace('{N}', String(count));
    }
    if (key === 'missing-opponent') {
        return MATCH_NOTICE.missingOpponent;
    }
    return MATCH_NOTICE.marked;
}

function fingerprint(record) {
    return [record.type, record.name, record.location, record.occurredAt, record.contact]
        .map(toText)
        .join('|');
}

export function useWall() {
    var matchResult = computed(function () {
        try {
            return computeMatches(state.infos);
        } catch (err) {
            console.error('匹配重算失败', err);
            return { pairs: [], total: 0, hidden: 0, allPairs: [] };
        }
    });

    var infoMap = computed(function () {
        var map = new Map();
        for (var i = 0; i < state.infos.length; i++) {
            var info = state.infos[i];
            if (info && Number.isInteger(info.seq)) {
                map.set(info.seq, info);
            }
        }
        return map;
    });

    var visibleInfos = computed(function () {
        var list = filterInfos(state.infos, state.activeFilter);
        list = searchInfos(list, state.searchQuery);
        if (state.onlySearching) {
            list = list.filter(function (info) {
                return normalizeStatus(info) === ITEM_STATUS.searching;
            });
        }
        return sortBySeqDesc(list);
    });

    var stats = computed(function () {
        var lost = 0;
        var found = 0;
        var done = 0;
        for (var i = 0; i < state.infos.length; i++) {
            var info = state.infos[i];
            if (!info) {
                continue;
            }
            if (normalizeStatus(info) === ITEM_STATUS.found) {
                done += 1;
            } else if (info.type === 'lost') {
                lost += 1;
            } else if (info.type === 'found') {
                found += 1;
            }
        }
        return { lost: lost, found: found, done: done, matches: matchResult.value.total, total: state.infos.length };
    });

    var matchCountBySeq = computed(function () {
        var map = new Map();
        var pairs = matchResult.value.allPairs || [];
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            map.set(pair.lostSeq, (map.get(pair.lostSeq) || 0) + 1);
            map.set(pair.foundSeq, (map.get(pair.foundSeq) || 0) + 1);
        }
        return map;
    });

    var editingInfo = computed(function () {
        if (!Number.isInteger(state.editingSeq)) {
            return null;
        }
        return infoMap.value.get(state.editingSeq) || null;
    });

    var hasConditions = computed(function () {
        return state.activeFilter !== 'all' || state.searchQuery.trim() !== '' || state.onlySearching;
    });

    function setFilter(filter) {
        state.activeFilter = filter === 'lost' || filter === 'found' ? filter : 'all';
    }

    function resetConditions() {
        state.activeFilter = 'all';
        state.searchQuery = '';
        state.onlySearching = false;
    }

    function toggleForm(force) {
        state.formOpen = typeof force === 'boolean' ? force : !state.formOpen;
        if (!state.formOpen) {
            state.editingSeq = null;
        }
    }

    function focusOn(id) {
        if (!id) {
            return;
        }
        state.focusedId = id;
        if (focusTimer) {
            clearTimeout(focusTimer);
        }
        setTimeout(function () {
            var el = typeof document !== 'undefined' ? document.getElementById(id) : null;
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 60);
        focusTimer = setTimeout(function () {
            state.focusedId = '';
        }, 2400);
    }

    function startEdit(seq) {
        if (!Number.isInteger(seq)) {
            return;
        }
        state.editingSeq = seq;
        state.formOpen = true;
        focusOn('publish-form-anchor');
    }

    function cancelEdit() {
        state.editingSeq = null;
    }

    function locateMatchFor(seq) {
        var pairs = matchResult.value.pairs;
        for (var i = 0; i < pairs.length; i++) {
            if (pairs[i].lostSeq === seq || pairs[i].foundSeq === seq) {
                focusOn('pair-' + pairs[i].lostSeq + '-' + pairs[i].foundSeq);
                return;
            }
        }
    }

    function publish(raw, options) {
        if (state.submitLock) {
            return { ok: false, errors: [] };
        }
        state.submitLock = true;
        try {
            var result = validateForm(raw, new Date());
            if (!result.ok) {
                return result;
            }
            var info = createInfo(raw, new Date(), state.seqCounter + 1);
            state.infos.unshift(info);
            state.seqCounter = info.seq;
            saveCurrentInfos();
            resetConditions();
            if (!options || !options.keepOpen) {
                state.formOpen = false;
            }
            showNotice('发布成功，已为你自动比对潜在匹配');
            return { ok: true, errors: [] };
        } catch (err) {
            console.error('提交失败', err);
            return { ok: false, errors: [] };
        } finally {
            state.submitLock = false;
        }
    }

    function updateInfo(seq, raw) {
        if (!Number.isInteger(seq) || state.submitLock) {
            return { ok: false, errors: [] };
        }
        state.submitLock = true;
        try {
            var result = validateForm(raw, new Date());
            if (!result.ok) {
                return result;
            }
            var index = -1;
            for (var i = 0; i < state.infos.length; i++) {
                if (state.infos[i] && state.infos[i].seq === seq) {
                    index = i;
                    break;
                }
            }
            if (index < 0) {
                return { ok: false, errors: [] };
            }
            var old = state.infos[index];
            var next = createInfo(raw, new Date(old.createdAt), old.seq);
            next.status = normalizeStatus(old);
            var list = state.infos.slice();
            list[index] = next;
            state.infos = list;
            state.editingSeq = null;
            state.formOpen = false;
            saveCurrentInfos();
            showNotice('信息已更新');
            return { ok: true, errors: [] };
        } catch (err) {
            console.error('更新失败', err);
            return { ok: false, errors: [] };
        } finally {
            state.submitLock = false;
        }
    }

    function deleteInfo(seq) {
        if (!Number.isInteger(seq)) {
            return;
        }
        state.infos = state.infos.filter(function (info) {
            return !info || info.seq !== seq;
        });
        if (state.editingSeq === seq) {
            state.editingSeq = null;
        }
        saveCurrentInfos();
        showNotice('已删除该信息');
    }

    function clearAll() {
        state.infos = [];
        state.seqCounter = 0;
        state.editingSeq = null;
        saveCurrentInfos();
        showNotice('已清空全部信息');
    }

    function exportData() {
        return serializeSavedDataset(buildSavedDataset(state.infos, new Date()));
    }

    function importData(text) {
        var parsed = parseSavedDataset(text);
        if (!parsed.ok) {
            showNotice('导入失败：文件无法解析或版本不兼容');
            return { ok: false, imported: 0, duplicated: 0, skipped: 0 };
        }
        var normalized = normalizeSavedRecords(parsed.dataset.items, Date.parse(parsed.dataset.savedAt), { allowDuplicateSeq: true });
        var existingPrints = Object.create(null);
        var usedSeq = Object.create(null);
        var maxSeq = state.seqCounter;
        var i;
        for (i = 0; i < state.infos.length; i++) {
            var info = state.infos[i];
            if (!info) {
                continue;
            }
            existingPrints[fingerprint(info)] = true;
            usedSeq[info.seq] = true;
            if (info.seq > maxSeq) {
                maxSeq = info.seq;
            }
        }
        var imported = 0;
        var duplicated = 0;
        var added = [];
        for (i = 0; i < normalized.records.length; i++) {
            var record = normalized.records[i];
            var print = fingerprint(record);
            if (existingPrints[print]) {
                duplicated += 1;
                continue;
            }
            var seq = record.seq;
            if (usedSeq[seq]) {
                maxSeq += 1;
                seq = maxSeq;
            }
            usedSeq[seq] = true;
            existingPrints[print] = true;
            var copy = {};
            for (var key in record) {
                if (Object.prototype.hasOwnProperty.call(record, key)) {
                    copy[key] = record[key];
                }
            }
            copy.seq = seq;
            added.push(copy);
            imported += 1;
        }
        if (imported > 0) {
            state.infos = added.concat(state.infos);
            state.seqCounter = maxSeq;
            saveCurrentInfos();
        }
        showNotice('导入完成：新增 ' + imported + ' 条，重复 ' + duplicated + ' 条，无效 ' + normalized.skipped + ' 条');
        return { ok: true, imported: imported, duplicated: duplicated, skipped: normalized.skipped };
    }

    function applyMark(seq, source, opponentSeq) {
        if (!Number.isInteger(seq) || state.markLock) {
            return;
        }
        state.markLock = true;
        try {
            var plan = resolveMark({
                seq: seq,
                infos: state.infos,
                pairs: matchResult.value.allPairs,
                source: source,
                opponentSeq: opponentSeq
            });
            if (!plan.seqs || plan.seqs.length === 0) {
                return;
            }
            var applied = markSeqsFound(state.infos, plan.seqs);
            if (applied.changed.length === 0) {
                return;
            }
            state.infos = applied.infos;
            showNotice(noticeTextFor(plan.noticeKey, plan.invalidated));
            saveCurrentInfos();
        } catch (err) {
            console.error('标记处理失败', err);
        } finally {
            state.markLock = false;
        }
    }

    function restore() {
        if (state.restored) {
            return;
        }
        state.restored = true;
        try {
            var outcome = restoreSavedDataset();
            if (outcome.status === 'unavailable') {
                state.storageState = 'unavailable';
            }
            if (outcome.records.length > 0) {
                state.infos = outcome.records;
                state.seqCounter = outcome.records[0].seq;
                if (outcome.legacyKey) {
                    var saved = saveCurrentInfos();
                    if (saved.ok) {
                        removeStorageKey(outcome.legacyKey);
                    }
                }
            }
            var notice = storageNoticeFor(outcome);
            if (notice) {
                showNotice(notice);
            }
        } catch (err) {
            console.error('本地数据恢复失败', err);
        }
    }

    return {
        state: state,
        stats: stats,
        visibleInfos: visibleInfos,
        matchResult: matchResult,
        infoMap: infoMap,
        matchCountBySeq: matchCountBySeq,
        editingInfo: editingInfo,
        hasConditions: hasConditions,
        setFilter: setFilter,
        resetConditions: resetConditions,
        toggleForm: toggleForm,
        startEdit: startEdit,
        cancelEdit: cancelEdit,
        focusOn: focusOn,
        locateMatchFor: locateMatchFor,
        publish: publish,
        updateInfo: updateInfo,
        deleteInfo: deleteInfo,
        clearAll: clearAll,
        exportData: exportData,
        importData: importData,
        applyMark: applyMark,
        restore: restore,
        showNotice: showNotice
    };
}
