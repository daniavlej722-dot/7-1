const STEMS = [
  { char: "甲", element: "木", polarity: "阳" },
  { char: "乙", element: "木", polarity: "阴" },
  { char: "丙", element: "火", polarity: "阳" },
  { char: "丁", element: "火", polarity: "阴" },
  { char: "戊", element: "土", polarity: "阳" },
  { char: "己", element: "土", polarity: "阴" },
  { char: "庚", element: "金", polarity: "阳" },
  { char: "辛", element: "金", polarity: "阴" },
  { char: "壬", element: "水", polarity: "阳" },
  { char: "癸", element: "水", polarity: "阴" },
];

const BRANCHES = [
  { char: "子", element: "水", zodiac: "鼠", hidden: ["癸"] },
  { char: "丑", element: "土", zodiac: "牛", hidden: ["己", "癸", "辛"] },
  { char: "寅", element: "木", zodiac: "虎", hidden: ["甲", "丙", "戊"] },
  { char: "卯", element: "木", zodiac: "兔", hidden: ["乙"] },
  { char: "辰", element: "土", zodiac: "龙", hidden: ["戊", "乙", "癸"] },
  { char: "巳", element: "火", zodiac: "蛇", hidden: ["丙", "戊", "庚"] },
  { char: "午", element: "火", zodiac: "马", hidden: ["丁", "己"] },
  { char: "未", element: "土", zodiac: "羊", hidden: ["己", "丁", "乙"] },
  { char: "申", element: "金", zodiac: "猴", hidden: ["庚", "壬", "戊"] },
  { char: "酉", element: "金", zodiac: "鸡", hidden: ["辛"] },
  { char: "戌", element: "土", zodiac: "狗", hidden: ["戊", "辛", "丁"] },
  { char: "亥", element: "水", zodiac: "猪", hidden: ["壬", "甲"] },
];

const JIE_TERMS = [
  { name: "立春", target: 315, monthIndex: 0, branch: "寅", approx: [2, 4] },
  { name: "惊蛰", target: 345, monthIndex: 1, branch: "卯", approx: [3, 6] },
  { name: "清明", target: 15, monthIndex: 2, branch: "辰", approx: [4, 5] },
  { name: "立夏", target: 45, monthIndex: 3, branch: "巳", approx: [5, 6] },
  { name: "芒种", target: 75, monthIndex: 4, branch: "午", approx: [6, 6] },
  { name: "小暑", target: 105, monthIndex: 5, branch: "未", approx: [7, 7] },
  { name: "立秋", target: 135, monthIndex: 6, branch: "申", approx: [8, 8] },
  { name: "白露", target: 165, monthIndex: 7, branch: "酉", approx: [9, 8] },
  { name: "寒露", target: 195, monthIndex: 8, branch: "戌", approx: [10, 8] },
  { name: "立冬", target: 225, monthIndex: 9, branch: "亥", approx: [11, 7] },
  { name: "大雪", target: 255, monthIndex: 10, branch: "子", approx: [12, 7] },
  { name: "小寒", target: 285, monthIndex: 11, branch: "丑", approx: [1, 6] },
];

const ELEMENTS = ["木", "火", "土", "金", "水"];
const PILLAR_NAMES = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" };
const MONTH_STEM_START_BY_YEAR_STEM = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0];
const HOUR_STEM_START_BY_DAY_STEM = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
const NAYIN = [
  "海中金", "海中金", "炉中火", "炉中火", "大林木", "大林木", "路旁土", "路旁土", "剑锋金", "剑锋金",
  "山头火", "山头火", "涧下水", "涧下水", "城头土", "城头土", "白蜡金", "白蜡金", "杨柳木", "杨柳木",
  "泉中水", "泉中水", "屋上土", "屋上土", "霹雳火", "霹雳火", "松柏木", "松柏木", "长流水", "长流水",
  "砂中金", "砂中金", "山下火", "山下火", "平地木", "平地木", "壁上土", "壁上土", "金箔金", "金箔金",
  "覆灯火", "覆灯火", "天河水", "天河水", "大驿土", "大驿土", "钗钏金", "钗钏金", "桑柘木", "桑柘木",
  "大溪水", "大溪水", "沙中土", "沙中土", "天上火", "天上火", "石榴木", "石榴木", "大海水", "大海水",
];

const ELEMENT_NOTES = {
  木: "生发、规划、学习、伸展，也代表持续成长的动力。",
  火: "表达、热情、看见、传播，也代表把事情推到台前的能量。",
  土: "承载、稳定、整合、信用，也代表节奏和边界。",
  金: "规则、判断、效率、取舍，也代表标准和执行力。",
  水: "流动、记忆、洞察、连接，也代表弹性与深层思考。",
};

const TEN_GOD_NOTES = {
  比肩: "自我、同伴、主见，强时适合独立推进，也要留意固执。",
  劫财: "竞争、协作、资源流动，强时行动快，也要留意冲动分配。",
  食神: "才华、表达、享受、稳定输出，适合做长期作品。",
  伤官: "创造、突破、质疑权威，适合创新，也要注意沟通锋芒。",
  偏财: "机会、市场、人脉、灵活资源，适合主动经营外部连接。",
  正财: "秩序、收入、责任、可控资源，适合稳健积累。",
  七杀: "压力、挑战、决断、纪律，化得好是执行力和担当。",
  正官: "规范、名誉、职位、约束，适合在明确规则中建立信用。",
  偏印: "灵感、特殊知识、反常规学习，适合研究冷门或复杂问题。",
  正印: "保护、学习、贵人、资质，适合系统学习和沉淀。",
  日主: "命盘观察的中心点，其他天干与藏干都围绕日主建立关系。",
};

const SHENSHA_NOTES = {
  天乙贵人: "常用贵人星，主助力、缓冲与转圜。",
  太极贵人: "主悟性、兴趣、玄学与抽象理解能力。",
  文昌贵人: "主学习、表达、文书、考试与条理。",
  禄神: "主根气、资源、职位与稳定所得。",
  羊刃: "主刚烈、决断、竞争，也提示用力过猛。",
  桃花: "主社交、人缘、审美、吸引力。",
  驿马: "主移动、变化、出差、迁移与外部机会。",
  华盖: "主才艺、孤高、研究、宗教哲学与独处。",
  将星: "主掌控力、组织力、担当与号召。",
  红鸾: "主喜庆、人缘、感情缘分。",
  天喜: "主喜事、欢聚、情绪舒展。",
  国印贵人: "主印信、规则、资质、制度资源。",
  金舆: "主资源、待遇、生活品质。",
  空亡: "主落空、虚位、迟滞；需结合全局，不可单看。",
};

const STEM_BRANCH_SHENSHA = {
  天乙贵人: {
    甲: ["丑", "未"], 戊: ["丑", "未"], 庚: ["丑", "未"],
    乙: ["子", "申"], 己: ["子", "申"],
    丙: ["亥", "酉"], 丁: ["亥", "酉"],
    辛: ["午", "寅"],
    壬: ["卯", "巳"], 癸: ["卯", "巳"],
  },
  太极贵人: {
    甲: ["子", "午"], 乙: ["子", "午"],
    丙: ["卯", "酉"], 丁: ["卯", "酉"],
    戊: ["辰", "戌", "丑", "未"], 己: ["辰", "戌", "丑", "未"],
    庚: ["寅", "亥"], 辛: ["寅", "亥"],
    壬: ["巳", "申"], 癸: ["巳", "申"],
  },
  文昌贵人: { 甲: ["巳"], 乙: ["午"], 丙: ["申"], 丁: ["酉"], 戊: ["申"], 己: ["酉"], 庚: ["亥"], 辛: ["子"], 壬: ["寅"], 癸: ["卯"] },
  禄神: { 甲: ["寅"], 乙: ["卯"], 丙: ["巳"], 丁: ["午"], 戊: ["巳"], 己: ["午"], 庚: ["申"], 辛: ["酉"], 壬: ["亥"], 癸: ["子"] },
  羊刃: { 甲: ["卯"], 乙: ["寅"], 丙: ["午"], 丁: ["巳"], 戊: ["午"], 己: ["巳"], 庚: ["酉"], 辛: ["申"], 壬: ["子"], 癸: ["亥"] },
  国印贵人: { 甲: ["戌"], 乙: ["亥"], 丙: ["丑"], 丁: ["寅"], 戊: ["丑"], 己: ["寅"], 庚: ["辰"], 辛: ["巳"], 壬: ["未"], 癸: ["申"] },
  金舆: { 甲: ["辰"], 乙: ["巳"], 丙: ["未"], 丁: ["申"], 戊: ["未"], 己: ["申"], 庚: ["戌"], 辛: ["亥"], 壬: ["丑"], 癸: ["寅"] },
};

const GROUP_BRANCH_SHENSHA = {
  桃花: { "申子辰": "酉", "寅午戌": "卯", "巳酉丑": "午", "亥卯未": "子" },
  驿马: { "申子辰": "寅", "寅午戌": "申", "巳酉丑": "亥", "亥卯未": "巳" },
  华盖: { "申子辰": "辰", "寅午戌": "戌", "巳酉丑": "丑", "亥卯未": "未" },
  将星: { "申子辰": "子", "寅午戌": "午", "巳酉丑": "酉", "亥卯未": "卯" },
};

const YEAR_BRANCH_SHENSHA = {
  红鸾: { 子: "卯", 丑: "寅", 寅: "丑", 卯: "子", 辰: "亥", 巳: "戌", 午: "酉", 未: "申", 申: "未", 酉: "午", 戌: "巳", 亥: "辰" },
  天喜: { 子: "酉", 丑: "申", 寅: "未", 卯: "午", 辰: "巳", 巳: "辰", 午: "卯", 未: "寅", 申: "丑", 酉: "子", 戌: "亥", 亥: "戌" },
};

const VOID_BRANCHES_BY_XUN = [
  ["戌", "亥"],
  ["申", "酉"],
  ["午", "未"],
  ["辰", "巳"],
  ["寅", "卯"],
  ["子", "丑"],
];

function mod(n, m) {
  return ((n % m) + m) % m;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function normalizeDegree(deg) {
  return mod(deg, 360);
}

function signedAngleDiff(current, target) {
  return mod(current - target + 180, 360) - 180;
}

function localPartsToUtcMs({ year, month, day, hour, minute }, offsetMinutes) {
  return Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000;
}

function utcMsToJulianDay(ms) {
  return ms / 86_400_000 + 2440587.5;
}

function julianDayToUtcMs(jd) {
  return (jd - 2440587.5) * 86_400_000;
}

function apparentSunLongitude(jd) {
  const t = (jd - 2451545.0) / 36525;
  const l0 = normalizeDegree(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const m = normalizeDegree(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(degToRad(m)) +
    (0.019993 - 0.000101 * t) * Math.sin(degToRad(2 * m)) +
    0.000289 * Math.sin(degToRad(3 * m));
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  return normalizeDegree(trueLong - 0.00569 - 0.00478 * Math.sin(degToRad(omega)));
}

function findSolarTermUtcMs(year, term) {
  const [month, day] = term.approx;
  let lo = utcMsToJulianDay(Date.UTC(year, month - 1, day - 5, 0, 0));
  let hi = utcMsToJulianDay(Date.UTC(year, month - 1, day + 5, 0, 0));
  let loDiff = signedAngleDiff(apparentSunLongitude(lo), term.target);
  let hiDiff = signedAngleDiff(apparentSunLongitude(hi), term.target);

  for (let widen = 0; loDiff > 0 || hiDiff < 0; widen += 2) {
    lo = utcMsToJulianDay(Date.UTC(year, month - 1, day - 8 - widen, 0, 0));
    hi = utcMsToJulianDay(Date.UTC(year, month - 1, day + 8 + widen, 0, 0));
    loDiff = signedAngleDiff(apparentSunLongitude(lo), term.target);
    hiDiff = signedAngleDiff(apparentSunLongitude(hi), term.target);
    if (widen > 20) break;
  }

  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    const diff = signedAngleDiff(apparentSunLongitude(mid), term.target);
    if (diff < 0) lo = mid;
    else hi = mid;
  }

  return Math.round(julianDayToUtcMs((lo + hi) / 2));
}

function getTermInstancesAround(year) {
  const terms = [];
  for (const y of [year - 1, year, year + 1]) {
    for (const term of JIE_TERMS) {
      terms.push({ ...term, year: y, utcMs: findSolarTermUtcMs(y, term) });
    }
  }
  return terms.sort((a, b) => a.utcMs - b.utcMs);
}

function ganzhiFromIndex(index) {
  const stemIndex = mod(index, 10);
  const branchIndex = mod(index, 12);
  return {
    stem: STEMS[stemIndex].char,
    branch: BRANCHES[branchIndex].char,
    text: `${STEMS[stemIndex].char}${BRANCHES[branchIndex].char}`,
    stemIndex,
    branchIndex,
  };
}

function pillarIndexFromStemBranch(stemIndex, branchIndex) {
  for (let index = 0; index < 60; index += 1) {
    if (index % 10 === mod(stemIndex, 10) && index % 12 === mod(branchIndex, 12)) {
      return index;
    }
  }
  throw new Error("无效的干支组合。");
}

function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function addDays(parts, days) {
  const ms = Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute);
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

function getStemInfo(stem) {
  return STEMS.find((item) => item.char === stem);
}

function tenGod(dayStem, targetStem) {
  const day = getStemInfo(dayStem);
  const target = getStemInfo(targetStem);
  if (!day || !target) return "";

  const dayElementIndex = ELEMENTS.indexOf(day.element);
  const targetElementIndex = ELEMENTS.indexOf(target.element);
  const samePolarity = day.polarity === target.polarity;
  const producedByDay = mod(dayElementIndex + 1, 5);
  const controlledByDay = mod(dayElementIndex + 2, 5);
  const producesDay = mod(dayElementIndex + 4, 5);
  const controlsDay = mod(dayElementIndex + 3, 5);

  if (targetElementIndex === dayElementIndex) return samePolarity ? "比肩" : "劫财";
  if (targetElementIndex === producedByDay) return samePolarity ? "食神" : "伤官";
  if (targetElementIndex === controlledByDay) return samePolarity ? "偏财" : "正财";
  if (targetElementIndex === controlsDay) return samePolarity ? "七杀" : "正官";
  if (targetElementIndex === producesDay) return samePolarity ? "偏印" : "正印";
  return "";
}

function findGroupBranch(baseBranch, table) {
  const entry = Object.entries(table).find(([group]) => group.includes(baseBranch));
  return entry ? entry[1] : null;
}

function getVoidBranches(dayPillarIndex) {
  return VOID_BRANCHES_BY_XUN[Math.floor(mod(dayPillarIndex, 60) / 10)];
}

function getShenshaForBranch(branch, context) {
  const results = [];
  const push = (name, source) => {
    const existing = results.find((item) => item.name === name);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
    } else {
      results.push({ name, sources: [source], note: SHENSHA_NOTES[name] || "" });
    }
  };

  for (const [name, map] of Object.entries(STEM_BRANCH_SHENSHA)) {
    if (map[context.dayStem]?.includes(branch)) push(name, "日干");
    if (map[context.yearStem]?.includes(branch)) push(name, "年干");
  }

  for (const [name, table] of Object.entries(GROUP_BRANCH_SHENSHA)) {
    if (findGroupBranch(context.dayBranch, table) === branch) push(name, "日支三合");
    if (findGroupBranch(context.yearBranch, table) === branch) push(name, "年支三合");
  }

  for (const [name, map] of Object.entries(YEAR_BRANCH_SHENSHA)) {
    if (map[context.yearBranch] === branch) push(name, "年支");
  }

  if (context.voidBranches?.includes(branch)) push("空亡", "日柱旬空");

  return results.map((item) => ({
    name: item.name,
    source: item.sources.join("/"),
    note: item.note,
  }));
}

function getShenshaSummary(pillars) {
  const rows = [];
  for (const pillar of Object.values(pillars)) {
    for (const shensha of pillar.shensha || []) {
      rows.push({
        name: shensha.name,
        at: pillar.label,
        branch: pillar.branch,
        source: shensha.source,
        note: shensha.note,
      });
    }
  }
  return rows;
}

function formatDateTime(ms, offsetMinutes) {
  const local = new Date(ms + offsetMinutes * 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

function formatDateOnly(ms, offsetMinutes) {
  const local = new Date(ms + offsetMinutes * 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

function daysBetweenInclusive(startDate, endDate) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  return Math.max(1, Math.round((Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000) + 1);
}

function makePillar(kind, index, dayStem) {
  const base = ganzhiFromIndex(index);
  const branch = BRANCHES[base.branchIndex];
  const stemInfo = STEMS[base.stemIndex];
  return {
    kind,
    label: PILLAR_NAMES[kind] || "",
    ...base,
    stemElement: stemInfo.element,
    stemPolarity: stemInfo.polarity,
    branchElement: branch.element,
    zodiac: branch.zodiac,
    nayin: NAYIN[mod(index, 60)],
    hiddenStems: branch.hidden.map((stem) => ({
      stem,
      tenGod: dayStem ? tenGod(dayStem, stem) : "",
      element: getStemInfo(stem).element,
    })),
    tenGod: dayStem && kind !== "day" ? tenGod(dayStem, base.stem) : kind === "day" ? "日主" : "",
  };
}

function attachShensha(pillar, context) {
  return {
    ...pillar,
    shensha: getShenshaForBranch(pillar.branch, context),
  };
}

function getLuckDirection(gender, yearStemIndex) {
  const isYangYear = yearStemIndex % 2 === 0;
  const isMale = gender === "male";
  const forward = (isMale && isYangYear) || (!isMale && !isYangYear);
  return {
    forward,
    text: forward ? "顺行" : "逆行",
    rule: "阳男阴女顺行，阴男阳女逆行",
  };
}

function getMajorLuck({ gender, yearStemIndex, monthPillarIndex, birthUtcMs, birthYear, terms, offsetMinutes }) {
  if (!gender || gender === "unknown") {
    return {
      direction: { forward: true, text: "未定", rule: "填写性别后可按传统规则估算顺逆。" },
      start: null,
      cycles: [],
    };
  }

  const direction = getLuckDirection(gender, yearStemIndex);
  const boundary = direction.forward
    ? terms.find((term) => term.utcMs > birthUtcMs)
    : terms.filter((term) => term.utcMs < birthUtcMs).at(-1);
  const diffDays = Math.abs(boundary.utcMs - birthUtcMs) / 86_400_000;
  const startAgeYears = diffDays / 3;
  const fullYears = Math.floor(startAgeYears);
  const months = Math.round((startAgeYears - fullYears) * 12);
  const startLabel = `${fullYears}岁${months}个月左右`;

  const cycles = Array.from({ length: 8 }, (_, i) => {
    const step = direction.forward ? i + 1 : -(i + 1);
    const pillar = makePillar("luck", monthPillarIndex + step);
    const startAge = Number((startAgeYears + i * 10).toFixed(1));
    const startYear = birthYear + Math.floor(startAge);
    return {
      order: i + 1,
      pillar: pillar.text,
      stem: pillar.stem,
      branch: pillar.branch,
      stemElement: pillar.stemElement,
      branchElement: pillar.branchElement,
      nayin: pillar.nayin,
      startAge,
      ageRange: `${Math.floor(startAge)}-${Math.floor(startAge + 9)}岁`,
      yearRange: `${startYear}-${startYear + 9}`,
      startYear,
      endYear: startYear + 9,
    };
  });

  return {
    direction,
    start: {
      boundaryName: boundary.name,
      boundaryTime: formatDateTime(boundary.utcMs, offsetMinutes),
      daysToBoundary: Number(diffDays.toFixed(2)),
      startAgeYears: Number(startAgeYears.toFixed(2)),
      label: startLabel,
      note: "起运按“三天一岁”粗略换算，未做真太阳时与流派差异修正。",
    },
    cycles,
  };
}

function makeAnnualItem(year, dayStem, context) {
  const pillarIndex = mod(year - 4, 60);
  const pillar = attachShensha(makePillar("annual", pillarIndex, dayStem), context);
  return {
    year,
    pillar: pillar.text,
    stem: pillar.stem,
    branch: pillar.branch,
    stemElement: pillar.stemElement,
    branchElement: pillar.branchElement,
    tenGod: pillar.tenGod,
    zodiac: pillar.zodiac,
    nayin: pillar.nayin,
    shensha: pillar.shensha,
  };
}

function getAnnualLuck(startYear, dayStem, context) {
  return Array.from({ length: 9 }, (_, index) => {
    const year = startYear - 2 + index;
    return makeAnnualItem(year, dayStem, context);
  });
}

function getTargetAnnualLuck(targetYear, dayStem, context) {
  return Array.from({ length: 11 }, (_, index) => makeAnnualItem(targetYear - 5 + index, dayStem, context));
}

function getMonthlyLuck(targetYear, dayStem, context, offsetMinutes) {
  const yearStemIndex = mod(targetYear - 4, 10);
  const terms = getTermInstancesAround(targetYear);

  return JIE_TERMS.map((term) => {
    const termYear = term.name === "小寒" ? targetYear + 1 : targetYear;
    const boundary = terms.find((item) => item.year === termYear && item.name === term.name);
    const nextBoundary = boundary ? terms.find((item) => item.utcMs > boundary.utcMs) : null;
    const stemIndex = mod(MONTH_STEM_START_BY_YEAR_STEM[yearStemIndex] + term.monthIndex, 10);
    const branchIndex = BRANCHES.findIndex((branch) => branch.char === term.branch);
    const pillarIndex = pillarIndexFromStemBranch(stemIndex, branchIndex);
    const pillar = attachShensha(makePillar("monthFlow", pillarIndex, dayStem), context);
    const startDate = boundary ? formatDateOnly(boundary.utcMs, offsetMinutes) : "";
    const endDate = nextBoundary ? formatDateOnly(nextBoundary.utcMs - 86_400_000, offsetMinutes) : "";
    return {
      name: term.name,
      monthIndex: term.monthIndex + 1,
      branchMonth: `${term.branch}月`,
      startsAt: boundary ? formatDateTime(boundary.utcMs, offsetMinutes) : "",
      endsAt: nextBoundary ? formatDateTime(nextBoundary.utcMs, offsetMinutes) : "",
      startDate,
      endDate,
      dayCount: startDate && endDate ? daysBetweenInclusive(startDate, endDate) : 0,
      pillar: pillar.text,
      stem: pillar.stem,
      branch: pillar.branch,
      stemElement: pillar.stemElement,
      branchElement: pillar.branchElement,
      tenGod: pillar.tenGod,
      nayin: pillar.nayin,
      shensha: pillar.shensha,
    };
  });
}

function getLuckCycleDetail(cycle, dayStem, context, offsetMinutes) {
  const pillar = attachShensha(makePillar("luck", pillarIndexFromStemBranch(
    STEMS.findIndex((stem) => stem.char === cycle.stem),
    BRANCHES.findIndex((branch) => branch.char === cycle.branch),
  ), dayStem), context);
  const years = Array.from({ length: 10 }, (_, index) => {
    const year = cycle.startYear + index;
    return {
      ...makeAnnualItem(year, dayStem, context),
      months: getMonthlyLuck(year, dayStem, context, offsetMinutes),
    };
  });

  return {
    ...cycle,
    stemElement: pillar.stemElement,
    branchElement: pillar.branchElement,
    tenGod: pillar.tenGod,
    shensha: pillar.shensha,
    years,
  };
}

function getTransitLuck({ targetYear, dayStem, context, offsetMinutes }) {
  return {
    targetYear,
    annual: getTargetAnnualLuck(targetYear, dayStem, context),
    monthly: getMonthlyLuck(targetYear, dayStem, context, offsetMinutes),
    note: "流年以公历年份干支列示；流月以该年立春起十二节气月列示。",
  };
}

function getAnnualLuckLegacy(startYear, dayStem) {
  return Array.from({ length: 9 }, (_, index) => {
    const year = startYear - 2 + index;
    const pillarIndex = mod(year - 4, 60);
    const pillar = makePillar("annual", pillarIndex, dayStem);
    return {
      year,
      pillar: pillar.text,
      stem: pillar.stem,
      branch: pillar.branch,
      tenGod: pillar.tenGod,
      zodiac: pillar.zodiac,
      nayin: pillar.nayin,
    };
  });
}

function getSeasonHint(monthBranch) {
  const groups = {
    木旺: ["寅", "卯"],
    土旺: ["辰", "戌", "丑", "未"],
    火旺: ["巳", "午"],
    金旺: ["申", "酉"],
    水旺: ["亥", "子"],
  };
  const match = Object.entries(groups).find(([, branches]) => branches.includes(monthBranch));
  return match ? `${monthBranch}月令偏向${match[0].replace("旺", "")}气，观察日主强弱时要优先看月令。` : "月令需要结合透干与藏干共同观察。";
}

function summarize(pillars) {
  const counts = Object.fromEntries(ELEMENTS.map((element) => [element, 0]));

  for (const pillar of Object.values(pillars)) {
    counts[pillar.stemElement] += 1;
    counts[pillar.branchElement] += 1;
    for (const hidden of pillar.hiddenStems) {
      counts[hidden.element] += 0.35;
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    elements: counts,
    strongestElements: sorted.filter(([, value]) => value === sorted[0][1]).map(([element]) => element),
    weakestElements: sorted.filter(([, value]) => value === sorted.at(-1)[1]).map(([element]) => element),
    missingElements: Object.entries(counts).filter(([, value]) => value === 0).map(([element]) => element),
    elementNotes: ELEMENT_NOTES,
    tenGodNotes: TEN_GOD_NOTES,
    seasonHint: getSeasonHint(pillars.month.branch),
  };
}

export function calculateBazi(input) {
  const localParts = {
    year: Number(input.year),
    month: Number(input.month),
    day: Number(input.day),
    hour: Number(input.hour),
    minute: Number(input.minute || 0),
  };
  const offsetMinutes = Number(input.offsetMinutes ?? 480);
  const gender = input.gender || "unknown";
  const name = input.name || "";
  const targetYear = Number(input.targetYear || new Date().getFullYear());
  const useZiHourDayChange = input.useZiHourDayChange !== false;
  const birthUtcMs = localPartsToUtcMs(localParts, offsetMinutes);
  const terms = getTermInstancesAround(localParts.year);
  const lichun = terms.find((term) => term.year === localParts.year && term.name === "立春");
  const baziYear = birthUtcMs < lichun.utcMs ? localParts.year - 1 : localParts.year;
  const yearPillarIndex = mod(baziYear - 4, 60);
  const yearStemIndex = mod(yearPillarIndex, 10);

  const jie = terms.filter((term) => term.utcMs <= birthUtcMs).at(-1);
  const monthStemIndex = mod(MONTH_STEM_START_BY_YEAR_STEM[yearStemIndex] + jie.monthIndex, 10);
  const monthBranchIndex = BRANCHES.findIndex((branch) => branch.char === jie.branch);
  const monthPillarIndex = pillarIndexFromStemBranch(monthStemIndex, monthBranchIndex);

  const dayParts = useZiHourDayChange && localParts.hour >= 23 ? addDays(localParts, 1) : localParts;
  const jdn = gregorianToJdn(dayParts.year, dayParts.month, dayParts.day);
  const dayPillarIndex = mod(jdn - 11, 60);
  const dayStemIndex = mod(dayPillarIndex, 10);

  const hourBranchIndex = localParts.hour === 23 ? 0 : Math.floor((localParts.hour + 1) / 2);
  const hourStemIndex = mod(HOUR_STEM_START_BY_DAY_STEM[dayStemIndex] + hourBranchIndex, 10);
  const hourPillarIndex = pillarIndexFromStemBranch(hourStemIndex, hourBranchIndex);

  const dayPillarBase = ganzhiFromIndex(dayPillarIndex);
  const dayStem = dayPillarBase.stem;
  const shenshaContext = {
    dayStem,
    dayBranch: dayPillarBase.branch,
    yearStem: ganzhiFromIndex(yearPillarIndex).stem,
    yearBranch: ganzhiFromIndex(yearPillarIndex).branch,
    voidBranches: getVoidBranches(dayPillarIndex),
  };
  const basePillars = {
    year: makePillar("year", yearPillarIndex, dayStem),
    month: makePillar("month", monthPillarIndex, dayStem),
    day: makePillar("day", dayPillarIndex, dayStem),
    hour: makePillar("hour", hourPillarIndex, dayStem),
  };
  const pillars = {
    year: attachShensha(basePillars.year, shenshaContext),
    month: attachShensha(basePillars.month, shenshaContext),
    day: attachShensha(basePillars.day, shenshaContext),
    hour: attachShensha(basePillars.hour, shenshaContext),
  };
  const majorLuck = getMajorLuck({ gender, yearStemIndex, monthPillarIndex, birthUtcMs, birthYear: localParts.year, terms, offsetMinutes });
  majorLuck.cycles = majorLuck.cycles.map((cycle) => getLuckCycleDetail(cycle, dayStem, shenshaContext, offsetMinutes));
  const annualLuck = getAnnualLuck(localParts.year, dayStem, shenshaContext);
  const transitLuck = getTransitLuck({ targetYear, dayStem, context: shenshaContext, offsetMinutes });

  return {
    input: {
      ...localParts,
      name,
      gender,
      targetYear,
      timezone: `UTC${offsetMinutes >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0")}:${String(Math.abs(offsetMinutes) % 60).padStart(2, "0")}`,
      useZiHourDayChange,
    },
    solarTime: {
      birthLocal: formatDateTime(birthUtcMs, offsetMinutes),
      birthUtc: new Date(birthUtcMs).toISOString(),
      dayPillarDate: `${dayParts.year}-${String(dayParts.month).padStart(2, "0")}-${String(dayParts.day).padStart(2, "0")}`,
    },
    solarTerms: {
      yearBoundary: {
        name: "立春",
        localTime: formatDateTime(lichun.utcMs, offsetMinutes),
      },
      monthBoundary: {
        name: jie.name,
        localTime: formatDateTime(jie.utcMs, offsetMinutes),
      },
    },
    pillars,
    dayMaster: {
      stem: dayStem,
      element: getStemInfo(dayStem).element,
      polarity: getStemInfo(dayStem).polarity,
    },
    majorLuck,
    annualLuck,
    transitLuck,
    shensha: {
      voidBranches: shenshaContext.voidBranches,
      natal: getShenshaSummary(pillars),
      notes: SHENSHA_NOTES,
      ruleNote: "神煞采用常见速查规则：天乙等按日干/年干取，桃花驿马华盖将星按年支与日支三合局取，红鸾天喜按年支取，空亡按日柱旬空取。不同门派会有增删或取法差异。",
    },
    summary: summarize(pillars),
    note: "本排盘按节气定年、月柱；日柱采用公历日期的儒略日干支循环。神煞为常用规则版，不同流派对真太阳时、子时换日、神煞取法可能有差异。",
  };
}

export const baziMeta = { STEMS, BRANCHES, ELEMENTS };
