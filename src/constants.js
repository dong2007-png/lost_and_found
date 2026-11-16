export var MAX_LEN = {
    name: 30,
    location: 50,
    feature: 200,
    contact: 50
};

export var FIELD_RULES = {
    name: { required: true, max: MAX_LEN.name, label: '物品名称' },
    location: { required: true, max: MAX_LEN.location, label: '地点' },
    occurredAt: { required: true, label: '时间' },
    feature: { required: false, max: MAX_LEN.feature, label: '特征描述' },
    contact: { required: true, max: MAX_LEN.contact, label: '联系方式' }
};

export var MESSAGES = {
    typeRequired: '请选择信息类型',
    nameRequired: '请填写物品名称',
    nameTooLong: '物品名称不能超过 30 个字',
    locationRequired: '请填写地点',
    locationTooLong: '地点不能超过 50 个字',
    timeInvalid: '请选择有效时间，且不能晚于当前时间',
    featureTooLong: '特征描述不能超过 200 个字',
    contactRequired: '请填写联系方式',
    contactTooLong: '联系方式不能超过 50 个字'
};

export var EMPTY_TEXT = {
    all: '暂无信息，点击“发布信息”发布第一条吧',
    lost: '暂无丢失信息',
    found: '暂无招领信息'
};

export var TYPE_LABEL = {
    lost: '丢失',
    found: '招领'
};

export var ITEM_STATUS = {
    searching: 'searching',
    found: 'found'
};

export var STATUS_LABEL = {
    searching: '寻找中',
    found: '✓ 已找到'
};

/*
 * 本地保存唯一口径：存储键名 / 探测键 / 格式版本 / 读取容量上限。
 * 键名不含版本号，版本只存在于保存数据集的 version 字段。
 */
export var STORAGE_CONFIG = {
    key: 'csuLostFound.dataset',
    probeKey: 'csuLostFound.probe',
    version: 1,
    maxTextChars: 4000000
};

// 可落盘字段白名单：与 createInfo 的 9 个事实字段同名同义
export var PERSIST_FIELDS = [
    'type', 'name', 'location', 'occurredAt', 'feature', 'contact', 'createdAt', 'seq', 'status'
];

export var STORAGE_TEXT = {
    formNote: '信息保存在当前浏览器中，清理浏览器数据将同时清除',
    restored: '已恢复上次保存的 {N} 条信息',
    partial: '已恢复 {M} 条信息，另有 {K} 条无法读取已跳过',
    unreadable: '本地数据无法读取，已以空白数据开始',
    unavailable: '当前浏览器无法保存，本次内容在关闭页面后不会保留',
    writeFailed: '当前无法保存，刷新或关闭页面后本次内容将丢失'
};

export var MATCH_LEVEL_LABEL = {
    high: '高',
    medium: '中',
    general: '一般'
};

export var MATCH_LEVEL_RANK = {
    high: 0,
    medium: 1,
    general: 2
};

// 四维评分模型：名称 / 特征 / 地点 / 时间，输出 0~100 综合分
export var MATCH_SCORE = {
    weights: { name: 0.45, feature: 0.25, location: 0.15, time: 0.15 },
    minScore: 35,
    highScore: 75,
    mediumScore: 55,
    orderPenalty: 0.6,
    emptyTimeScore: 0.3,
    singleCharNameScore: 0.55
};

export var MATCH_RULES = {
    coverageThreshold: 0.6,
    minNameLength: 2,
    minOverlap: 1,
    renderLimit: 50,
    keywordLimit: 3
};

export var MATCH_TEXT = {
    empty: '暂无潜在匹配，系统会在有新信息或状态变更后自动比对',
    same: '可能是同一物品',
    countPrefix: '共 ',
    countSuffix: ' 对',
    morePrefix: '另有 ',
    moreSuffix: ' 对潜在匹配',
    keywordPrefix: '重合特征：',
    levelPrefix: '匹配度：',
    scoreSuffix: ' 分',
    reversedTime: '时间顺序存疑',
    reasonNameEqual: '名称一致',
    reasonNameSimilar: '名称相近',
    reasonFeature: '特征重合',
    reasonLocation: '地点相同',
    reasonSameDay: '同日发生',
    lostTimePrefix: '丢失时间：',
    foundTimePrefix: '招领时间：',
    markHint: '标记后双方物品状态将同步为已找到，且不可撤销',
    noFeature: '暂无描述',
    markPairLabel: '将本条配对双方标记为已找到'
};

export var MATCH_NOTICE = {
    marked: '已标记为已找到',
    synced: '已标记为已找到，配对双方状态已同步',
    invalidated: '已标记为已找到，相关 {N} 条配对已失效',
    missingOpponent: '该配对信息异常，已标记可定位的一侧'
};

// 名称与特征共用：颜色 / 品类 / 材质外观 / 配件
export var MATCH_DICT = [
    '白色', '黑色', '蓝色', '红色', '粉色', '银色', '灰色', '绿色', '黄色', '紫色', '透明', '米色',
    '耳机', '充电盒', '耳机盒', '雨伞', '学生卡', '校园卡', '水杯', '保温杯', '手机', '钥匙',
    '书包', '钱包', '电脑', '平板', '手表', '眼镜', '外套', '证件', '身份证', '饭卡', '数据线',
    '充电器', '笔记本', '笔袋', '手套', '围巾', '无线', '蓝牙', '有线', '降噪', '折叠',
    '划痕', '磨损', '贴纸', '挂件', '破损', '裂纹', '掉漆', '全新', '带壳', '保护套', '挂绳',
    '刻字', '钥匙扣'
];

// 单字虚词、数量量词与动作场景短语
export var MATCH_STOP = [
    '的', '了', '和', '与', '有', '在', '是', '就', '也', '都', '被', '把', '给', '我', '你',
    '他', '她', '它', '一', '个', '只', '副', '张', '块', '部', '台', '件', '条', '位', '两',
    '几', '带', '着', '这', '那', '此',
    '捡到', '拾到', '丢失', '遗失', '丢了', '掉了', '发现', '看到', '找到', '归还', '认领',
    '位于', '大概', '左右'
];

export var MATCH_DICT_MAP = Object.create(null);
for (var d = 0; d < MATCH_DICT.length; d += 1) {
    MATCH_DICT_MAP[MATCH_DICT[d]] = true;
}

export var MATCH_STOP_SORTED = MATCH_STOP.slice().sort(function (a, b) {
    return b.length - a.length;
});
export var MATCH_STOP_RE = new RegExp(MATCH_STOP_SORTED.join('|'), 'g');
