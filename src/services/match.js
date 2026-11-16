import {
    MATCH_DICT_MAP,
    MATCH_STOP_RE,
    MATCH_RULES,
    MATCH_LEVEL_RANK,
    MATCH_SCORE,
    MATCH_TEXT,
    ITEM_STATUS
} from '../constants.js';
import { toText, countChars, parseDateTime, normalizeStatus, findInfo } from './info.js';

/* ---------- 匹配引擎（纯函数） ---------- */
export function normalizeText(value) {
    var text = toText(value);
    if (text === '') {
        return '';
    }
    var chars = Array.from(text);
    var converted = '';
    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        var code = ch.charCodeAt(0);
        if (code >= 0xFF01 && code <= 0xFF5E) {
            ch = String.fromCharCode(code - 0xFEE0);
        } else if (code === 0x3000) {
            ch = ' ';
        }
        converted += ch;
    }
    converted = converted.toLowerCase();
    converted = converted.replace(/[^0-9a-z一-龥぀-ヿ]+/g, ' ');
    converted = converted.replace(/\s+/g, ' ').trim();
    return converted;
}

export function normalizeName(name) {
    return normalizeText(name).replace(/\s+/g, '');
}

export function levenshtein(a, b) {
    var ca = Array.from(a);
    var cb = Array.from(b);
    if (ca.length === 0) {
        return cb.length;
    }
    if (cb.length === 0) {
        return ca.length;
    }
    var prev = [];
    var i;
    var j;
    for (j = 0; j <= cb.length; j++) {
        prev[j] = j;
    }
    for (i = 1; i <= ca.length; i++) {
        var cur = [i];
        for (j = 1; j <= cb.length; j++) {
            var cost = ca[i - 1] === cb[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        }
        prev = cur;
    }
    return prev[cb.length];
}

export function charNgrams(value, n) {
    var size = Number.isInteger(n) && n > 0 ? n : 2;
    var chars = Array.from(toText(value).replace(/\s+/g, ''));
    var out = [];
    var seen = Object.create(null);
    if (chars.length === 0) {
        return out;
    }
    if (chars.length < size) {
        return [chars.join('')];
    }
    for (var i = 0; i + size <= chars.length; i++) {
        var gram = chars.slice(i, i + size).join('');
        if (!seen[gram]) {
            seen[gram] = true;
            out.push(gram);
        }
    }
    return out;
}

export function jaccardSimilarity(a, b) {
    var listA = Array.isArray(a) ? a : [];
    var listB = Array.isArray(b) ? b : [];
    if (listA.length === 0 || listB.length === 0) {
        return 0;
    }
    var setB = Object.create(null);
    var i;
    for (i = 0; i < listB.length; i++) {
        setB[listB[i]] = true;
    }
    var inter = 0;
    var unionSet = Object.create(null);
    for (i = 0; i < listA.length; i++) {
        unionSet[listA[i]] = true;
        if (setB[listA[i]]) {
            inter += 1;
        }
    }
    for (i = 0; i < listB.length; i++) {
        unionSet[listB[i]] = true;
    }
    var union = Object.keys(unionSet).length;
    return union === 0 ? 0 : inter / union;
}

export function nameMatchNormalized(na, nb) {
    var charsA = Array.from(na);
    var charsB = Array.from(nb);
    if (na === '' || nb === '') {
        return { matched: false, kind: 'none', coverage: 0, shorterLength: 0 };
    }
    var shorterLength = Math.min(charsA.length, charsB.length);
    if (na === nb) {
        return { matched: true, kind: 'equal', coverage: 1, shorterLength: shorterLength };
    }
    var longerChars = charsA.length >= charsB.length ? charsA : charsB;
    var shorterChars = charsA.length >= charsB.length ? charsB : charsA;
    var longerText = longerChars.join('');
    var shorterText = shorterChars.join('');
    if (shorterChars.length >= MATCH_RULES.minNameLength && longerText.indexOf(shorterText) >= 0) {
        return { matched: true, kind: 'contain', coverage: 1, shorterLength: shorterChars.length };
    }
    if (shorterChars.length >= MATCH_RULES.minNameLength) {
        var uniq = [];
        var seen = Object.create(null);
        for (var i = 0; i < shorterChars.length; i++) {
            if (!seen[shorterChars[i]]) {
                seen[shorterChars[i]] = true;
                uniq.push(shorterChars[i]);
            }
        }
        var common = 0;
        for (var j = 0; j < uniq.length; j++) {
            if (longerText.indexOf(uniq[j]) >= 0) {
                common += 1;
            }
        }
        var coverage = uniq.length > 0 ? common / uniq.length : 0;
        if (coverage >= MATCH_RULES.coverageThreshold) {
            return { matched: true, kind: 'coverage', coverage: coverage, shorterLength: shorterChars.length };
        }
        return { matched: false, kind: 'none', coverage: coverage, shorterLength: shorterChars.length };
    }
    return { matched: false, kind: 'none', coverage: 0, shorterLength: shorterLength };
}

// 名称相似度：完全相等 / 包含 / 单字包含 / 字符覆盖 / 编辑距离，输出 0~1 连续分
export function nameSimilarity(nameA, nameB) {
    var na = normalizeName(nameA);
    var nb = normalizeName(nameB);
    if (na === '' || nb === '') {
        return { score: 0, kind: 'none', coverage: 0 };
    }
    if (na === nb) {
        return { score: 1, kind: 'equal', coverage: 1 };
    }
    var charsA = Array.from(na);
    var charsB = Array.from(nb);
    var longer = charsA.length >= charsB.length ? na : nb;
    var shorter = charsA.length >= charsB.length ? nb : na;
    var shorterLength = Math.min(charsA.length, charsB.length);
    var longerLength = Math.max(charsA.length, charsB.length);
    if (longer.indexOf(shorter) >= 0) {
        if (shorterLength === 1) {
            return { score: MATCH_SCORE.singleCharNameScore, kind: 'single-char', coverage: 1 };
        }
        return { score: 0.8 + 0.2 * (shorterLength / longerLength), kind: 'contain', coverage: 1 };
    }
    var base = nameMatchNormalized(na, nb);
    if (base.matched && base.kind === 'coverage') {
        return { score: Math.min(0.75, base.coverage * 0.75), kind: 'coverage', coverage: base.coverage };
    }
    if (shorterLength >= 2) {
        var similarity = 1 - levenshtein(na, nb) / longerLength;
        if (similarity >= 0.6) {
            return { score: similarity * 0.6, kind: 'similar', coverage: base.coverage || 0 };
        }
    }
    return { score: 0, kind: 'none', coverage: base.coverage || 0 };
}

export function nameMatches(nameA, nameB) {
    return nameMatchNormalized(normalizeName(nameA), normalizeName(nameB));
}

export function extractKeywords(feature) {
    var words = [];
    var sequence = [];
    var text = normalizeText(feature);
    if (text === '') {
        return { words: words, sequence: sequence };
    }
    text = text.replace(MATCH_STOP_RE, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    if (text === '') {
        return { words: words, sequence: sequence };
    }

    function pushKeyword(word) {
        sequence.push(word);
        if (words.indexOf(word) < 0) {
            words.push(word);
        }
    }

    var parts = text.split(' ');
    for (var p = 0; p < parts.length; p++) {
        var part = parts[p];
        if (part === '') {
            continue;
        }
        var chars = Array.from(part);
        var hitAny = false;
        var i = 0;
        while (i < chars.length) {
            var matched = null;
            for (var len = 4; len >= 2; len--) {
                if (i + len <= chars.length) {
                    var candidate = chars.slice(i, i + len).join('');
                    if (MATCH_DICT_MAP[candidate]) {
                        matched = candidate;
                        break;
                    }
                }
            }
            if (matched) {
                pushKeyword(matched);
                i += Array.from(matched).length;
                hitAny = true;
            } else {
                i += 1;
            }
        }
        if (!hitAny && chars.length >= 2) {
            pushKeyword(part);
        }
    }
    return { words: words, sequence: sequence };
}

export function overlapKeywords(wordsA, wordsB, shorterSequence) {
    var a = Array.isArray(wordsA) ? wordsA : [];
    var b = Array.isArray(wordsB) ? wordsB : [];
    var setA = Object.create(null);
    var setB = Object.create(null);
    var i;
    for (i = 0; i < a.length; i++) {
        setA[a[i]] = true;
    }
    for (i = 0; i < b.length; i++) {
        setB[b[i]] = true;
    }
    var count = 0;
    for (i = 0; i < a.length; i++) {
        if (setB[a[i]]) {
            count += 1;
        }
    }
    var keywords = [];
    var seen = Object.create(null);
    var seq = Array.isArray(shorterSequence) ? shorterSequence : [];
    for (i = 0; i < seq.length; i++) {
        var word = seq[i];
        if (!seen[word] && setA[word] && setB[word]) {
            seen[word] = true;
            keywords.push(word);
            if (keywords.length >= MATCH_RULES.keywordLimit) {
                break;
            }
        }
    }
    return { count: count, keywords: keywords };
}

// 特征相似度：词典重合优先，未命中片段用 bigram Jaccard 兜底；空特征不再一票否决
export function featureSimilarity(featureA, featureB) {
    var ka = extractKeywords(featureA);
    var kb = extractKeywords(featureB);
    var shorterSequence = countChars(toText(featureA).trim()) <= countChars(toText(featureB).trim())
        ? ka.sequence
        : kb.sequence;
    var overlap = overlapKeywords(ka.words, kb.words, shorterSequence);
    var dictScore = 0;
    if (overlap.count >= 3) {
        dictScore = 1;
    } else if (overlap.count === 2) {
        dictScore = 0.8;
    } else if (overlap.count === 1) {
        dictScore = 0.55;
    }
    var textA = normalizeText(featureA).replace(MATCH_STOP_RE, ' ').trim();
    var textB = normalizeText(featureB).replace(MATCH_STOP_RE, ' ').trim();
    var gramScore = 0;
    if (textA !== '' && textB !== '') {
        var jaccard = jaccardSimilarity(charNgrams(textA, 2), charNgrams(textB, 2));
        gramScore = Math.min(1, jaccard * 2.5);
    }
    return {
        score: Math.max(dictScore, gramScore),
        dictScore: dictScore,
        gramScore: gramScore,
        keywords: overlap.keywords,
        overlapCount: overlap.count
    };
}

// 地点相似度：归一化后相同 / 包含 / bigram 重合
export function locationSimilarity(locationA, locationB) {
    var la = normalizeText(locationA).replace(/\s+/g, '');
    var lb = normalizeText(locationB).replace(/\s+/g, '');
    if (la === '' || lb === '') {
        return 0;
    }
    if (la === lb) {
        return 1;
    }
    var charsA = Array.from(la);
    var charsB = Array.from(lb);
    var longer = charsA.length >= charsB.length ? la : lb;
    var shorter = charsA.length >= charsB.length ? lb : la;
    if (Array.from(shorter).length >= 2 && longer.indexOf(shorter) >= 0) {
        return 0.8;
    }
    var jaccard = jaccardSimilarity(charNgrams(la, 2), charNgrams(lb, 2));
    if (jaccard >= 0.34) {
        return 0.6;
    }
    if (jaccard >= 0.2) {
        return 0.35;
    }
    return 0;
}

export function sameDayDates(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

export function sameCalendarDay(t1, t2) {
    var d1 = parseDateTime(t1);
    var d2 = parseDateTime(t2);
    if (!d1 || !d2) {
        return false;
    }
    return sameDayDates(d1, d2);
}

// 时间维度：同日 / 3 天 / 7 天 / 30 天分档；招领早于丢失视为顺序存疑并降权
export function timeSimilarity(lostTime, foundTime) {
    if (!lostTime || !foundTime) {
        return { score: MATCH_SCORE.emptyTimeScore, reversed: false, gapMs: Infinity, sameDay: false };
    }
    var diff = foundTime.getTime() - lostTime.getTime();
    var reversed = diff < 0;
    var gapMs = Math.abs(diff);
    var days = gapMs / 86400000;
    var sameDay = sameDayDates(lostTime, foundTime);
    var score;
    if (sameDay) {
        score = 1;
    } else if (days <= 3) {
        score = 0.75;
    } else if (days <= 7) {
        score = 0.5;
    } else if (days <= 30) {
        score = 0.25;
    } else {
        score = 0.1;
    }
    return { score: score, reversed: reversed, gapMs: gapMs, sameDay: sameDay };
}

export function gradeMatch(nameKind, overlapCount, sameDay) {
    if (nameKind !== 'equal' && nameKind !== 'contain' && nameKind !== 'coverage') {
        return 'general';
    }
    var count = Number.isFinite(overlapCount) ? overlapCount : 0;
    var day = sameDay === true;
    if (nameKind === 'equal' && count >= 2 && day) {
        return 'high';
    }
    if (nameKind === 'equal' || day) {
        return 'medium';
    }
    return 'general';
}

export function scoreToLevel(score) {
    if (score >= MATCH_SCORE.highScore) {
        return 'high';
    }
    if (score >= MATCH_SCORE.mediumScore) {
        return 'medium';
    }
    return 'general';
}

export function buildReasons(nameKind, featureScore, locationScore, sameDay) {
    var reasons = [];
    if (nameKind === 'equal') {
        reasons.push(MATCH_TEXT.reasonNameEqual);
    } else if (nameKind !== 'none') {
        reasons.push(MATCH_TEXT.reasonNameSimilar);
    }
    if (featureScore > 0) {
        reasons.push(MATCH_TEXT.reasonFeature);
    }
    if (locationScore >= 0.8) {
        reasons.push(MATCH_TEXT.reasonLocation);
    }
    if (sameDay) {
        reasons.push(MATCH_TEXT.reasonSameDay);
    }
    return reasons;
}

export function scorePair(lostPrepared, foundPrepared) {
    var nameResult = nameSimilarity(lostPrepared.info.name, foundPrepared.info.name);
    if (nameResult.score <= 0) {
        return null;
    }
    var feature = featureSimilarity(lostPrepared.info.feature, foundPrepared.info.feature);
    var location = locationSimilarity(lostPrepared.info.location, foundPrepared.info.location);
    var time = timeSimilarity(lostPrepared.time, foundPrepared.time);

    // 单字名称召回需要佐证：特征词典重合或地点高度一致，避免"伞"误配一切
    if (nameResult.kind === 'single-char' && feature.overlapCount < 1 && location < 0.8) {
        return null;
    }

    var weights = MATCH_SCORE.weights;
    var base = weights.name * nameResult.score +
        weights.feature * feature.score +
        weights.location * location +
        weights.time * time.score;
    var score = Math.round(base * 100 * (time.reversed ? MATCH_SCORE.orderPenalty : 1));
    if (score < MATCH_SCORE.minScore) {
        return null;
    }
    var level = scoreToLevel(score);
    return {
        lostSeq: lostPrepared.seq,
        foundSeq: foundPrepared.seq,
        score: score,
        level: level,
        levelRank: MATCH_LEVEL_RANK[level],
        keywords: feature.keywords,
        overlapCount: feature.overlapCount,
        timeGapMs: time.gapMs,
        sameDay: time.sameDay,
        reversed: time.reversed,
        reasons: buildReasons(nameResult.kind, feature.score, location, time.sameDay),
        nameKind: nameResult.kind,
        nameScore: nameResult.score,
        featureScore: feature.score,
        locationScore: location,
        timeScore: time.score,
        newerSeq: Math.max(lostPrepared.seq, foundPrepared.seq)
    };
}

export function comparePairs(a, b) {
    var scoreA = Number.isFinite(a.score) ? a.score : 0;
    var scoreB = Number.isFinite(b.score) ? b.score : 0;
    if (scoreA !== scoreB) {
        return scoreB - scoreA;
    }
    if (a.levelRank !== b.levelRank) {
        return a.levelRank - b.levelRank;
    }
    var gapA = Number.isFinite(a.timeGapMs) ? a.timeGapMs : Number.MAX_VALUE;
    var gapB = Number.isFinite(b.timeGapMs) ? b.timeGapMs : Number.MAX_VALUE;
    if (gapA !== gapB) {
        return gapA - gapB;
    }
    if (a.newerSeq !== b.newerSeq) {
        return b.newerSeq - a.newerSeq;
    }
    if (a.lostSeq !== b.lostSeq) {
        return a.lostSeq - b.lostSeq;
    }
    return a.foundSeq - b.foundSeq;
}

export function prepareMatchList(items) {
    var out = [];
    for (var i = 0; i < items.length; i++) {
        try {
            var info = items[i];
            if (!Number.isInteger(info.seq)) {
                continue;
            }
            out.push({
                info: info,
                seq: info.seq,
                normalized: normalizeName(info.name),
                keywords: extractKeywords(info.feature),
                featureLength: countChars(toText(info.feature).trim()),
                time: parseDateTime(info.occurredAt)
            });
        } catch (err) {
            console.error('匹配预处理失败，已跳过一条信息', err);
        }
    }
    return out;
}

export function computeMatches(infos, options) {
    var list = Array.isArray(infos) ? infos : [];
    var limit = options && Number.isInteger(options.limit) && options.limit > 0
        ? options.limit
        : MATCH_RULES.renderLimit;
    var lostList = [];
    var foundList = [];
    var i;
    var info;

    for (i = 0; i < list.length; i++) {
        info = list[i];
        if (!info || typeof info !== 'object') {
            continue;
        }
        if (normalizeStatus(info) !== ITEM_STATUS.searching) {
            continue;
        }
        if (info.type === 'lost') {
            lostList.push(info);
        } else if (info.type === 'found') {
            foundList.push(info);
        }
    }

    var preparedLost = prepareMatchList(lostList);
    var preparedFound = prepareMatchList(foundList);
    var pairs = [];

    for (i = 0; i < preparedLost.length; i++) {
        for (var j = 0; j < preparedFound.length; j++) {
            var pair = scorePair(preparedLost[i], preparedFound[j]);
            if (pair) {
                pairs.push(pair);
            }
        }
    }

    pairs.sort(comparePairs);

    var seen = Object.create(null);
    var deduped = [];
    for (i = 0; i < pairs.length; i++) {
        var key = pairs[i].lostSeq + ':' + pairs[i].foundSeq;
        if (seen[key]) {
            continue;
        }
        seen[key] = true;
        deduped.push(pairs[i]);
    }

    var total = deduped.length;
    var top = deduped.slice(0, limit);
    return {
        pairs: top,
        total: total,
        hidden: total - top.length,
        allPairs: deduped
    };
}

export function benchMatch(infos) {
    var start = typeof performance !== 'undefined' && performance.now ? performance.now() : 0;
    var result = computeMatches(infos);
    var end = typeof performance !== 'undefined' && performance.now ? performance.now() : 0;
    return { total: result.total, pairs: result.pairs.length, durationMs: end - start };
}

/* ---------- 状态联动引擎（纯函数） ---------- */
export function resolveMark(input) {
    var data = input && typeof input === 'object' ? input : {};
    var seq = data.seq;
    var infos = Array.isArray(data.infos) ? data.infos : [];
    var pairs = Array.isArray(data.pairs) ? data.pairs : [];
    var source = data.source === 'pair' ? 'pair' : 'card';

    if (!Number.isInteger(seq)) {
        return { seqs: [], mode: 'single', invalidated: 0, noticeKey: 'marked' };
    }
    var self = findInfo(infos, seq);
    if (!self) {
        return { seqs: [], mode: 'single', invalidated: 0, noticeKey: 'marked' };
    }
    if (normalizeStatus(self) === ITEM_STATUS.found) {
        return { seqs: [], mode: 'single', invalidated: 0, noticeKey: 'already' };
    }

    if (source === 'pair') {
        var otherSeq = data.opponentSeq;
        var other = Number.isInteger(otherSeq) ? findInfo(infos, otherSeq) : null;
        var seqs = [seq];
        if (other && other.seq !== seq && normalizeStatus(other) !== ITEM_STATUS.found) {
            seqs.push(other.seq);
        }
        return {
            seqs: seqs,
            mode: 'pair',
            invalidated: 1,
            noticeKey: other ? 'synced' : 'missing-opponent'
        };
    }

    var related = [];
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        if (pair && (pair.lostSeq === seq || pair.foundSeq === seq)) {
            related.push(pair);
        }
    }

    if (related.length === 0) {
        return { seqs: [seq], mode: 'single', invalidated: 0, noticeKey: 'marked' };
    }
    if (related.length === 1) {
        var only = related[0];
        var opponentSeq = only.lostSeq === seq ? only.foundSeq : only.lostSeq;
        var opponent = findInfo(infos, opponentSeq);
        var cascade = [seq];
        if (opponent && normalizeStatus(opponent) !== ITEM_STATUS.found) {
            cascade.push(opponentSeq);
        }
        return {
            seqs: cascade,
            mode: 'cascade-one',
            invalidated: 1,
            noticeKey: cascade.length === 2 ? 'synced' : 'marked'
        };
    }
    // 多配对：只标记自身，绝不遍历全部对手方求闭包
    return {
        seqs: [seq],
        mode: 'invalidate-many',
        invalidated: related.length,
        noticeKey: 'invalidated'
    };
}

export function markSeqsFound(infos, seqs) {
    var list = Array.isArray(infos) ? infos : [];
    var seqSet = Object.create(null);
    var i;
    if (Array.isArray(seqs)) {
        for (i = 0; i < seqs.length; i++) {
            if (Number.isInteger(seqs[i])) {
                seqSet[seqs[i]] = true;
            }
        }
    }
    var out = [];
    var changed = [];
    for (i = 0; i < list.length; i++) {
        var info = list[i];
        if (info && Number.isInteger(info.seq) && seqSet[info.seq] &&
            normalizeStatus(info) !== ITEM_STATUS.found) {
            var copy = {};
            for (var k in info) {
                if (Object.prototype.hasOwnProperty.call(info, k)) {
                    copy[k] = info[k];
                }
            }
            copy.status = ITEM_STATUS.found;
            out.push(copy);
            changed.push(info.seq);
        } else {
            out.push(info);
        }
    }
    return { infos: out, changed: changed };
}

export function pruneMatches(pairs, changedSeqs) {
    var list = Array.isArray(pairs) ? pairs : [];
    var seqSet = Object.create(null);
    var i;
    if (Array.isArray(changedSeqs)) {
        for (i = 0; i < changedSeqs.length; i++) {
            if (Number.isInteger(changedSeqs[i])) {
                seqSet[changedSeqs[i]] = true;
            }
        }
    }
    return list.filter(function (pair) {
        if (!pair) {
            return false;
        }
        return !seqSet[pair.lostSeq] && !seqSet[pair.foundSeq];
    });
}
