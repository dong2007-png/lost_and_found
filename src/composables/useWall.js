import { reactive, computed } from 'vue';
import {
    filterInfos,
    searchInfos,
    sortBySeqDesc,
    validateForm,
    createInfo,
    normalizeStatus
} from '../services/info.js';
import { computeMatches, resolveMark, markSeqsFound } from '../services/match.js';
import {
    buildSavedDataset,
    serializeSavedDataset,
    writeRawText,
    restoreSavedDataset
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
    restored: false
});

var noticeTimer = null;

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

    function setFilter(filter) {
        state.activeFilter = filter === 'lost' || filter === 'found' ? filter : 'all';
    }

    function toggleForm(force) {
        state.formOpen = typeof force === 'boolean' ? force : !state.formOpen;
    }

    function publish(raw) {
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
            setFilter('all');
            state.searchQuery = '';
            state.onlySearching = false;
            state.formOpen = false;
            showNotice('发布成功，已为你自动比对潜在匹配');
            return { ok: true, errors: [] };
        } catch (err) {
            console.error('提交失败', err);
            return { ok: false, errors: [] };
        } finally {
            state.submitLock = false;
        }
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
        setFilter: setFilter,
        toggleForm: toggleForm,
        publish: publish,
        applyMark: applyMark,
        restore: restore,
        showNotice: showNotice
    };
}
