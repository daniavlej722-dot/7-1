import { calculateBazi, baziMeta } from "./bazi.js";

const form = document.querySelector("#bazi-form");
const nowButton = document.querySelector("#fill-now");
const chartView = document.querySelector("#chart-view");
const dateMode = document.querySelector("#date-mode");
const solarDateRow = document.querySelector("#solar-date-row");
const lunarDateRow = document.querySelector("#lunar-date-row");
const dateHint = document.querySelector("#date-hint");
const copyButton = document.querySelector("#copy-button");
const saveCaseButton = document.querySelector("#save-case-button");
const caseNoteInput = document.querySelector("#case-note");
const caseTagsInput = document.querySelector("#case-tags");
const caseList = document.querySelector("#case-list");
const caseCount = document.querySelector("#case-count");
const errorView = document.querySelector("#error-view");
const navButtons = [...document.querySelectorAll("[data-module]")];
const backupShortcut = document.querySelector("#backup-shortcut");
const initialChartViewHtml = chartView.innerHTML;

const CASE_STORAGE_KEY = "bazi-cases";
const REPORT_STORAGE_KEY = "bazi-reports";
const KNOWLEDGE_STORAGE_KEY = "bazi-knowledge";
const BUSINESS_SETTINGS_KEY = "bazi-business-settings";
const TEN_GOD_GROUPS = {
  比劫: ["比肩", "劫财"],
  食伤: ["食神", "伤官"],
  财星: ["正财", "偏财"],
  官杀: ["正官", "七杀"],
  印星: ["正印", "偏印"],
};
const lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DEMO_PAYLOAD = {
  personName: "示例盘",
  gender: "male",
  dateMode: "solar",
  birthDatetime: "2000-03-04T16:30",
  lunarYear: 2000,
  lunarMonth: 1,
  lunarDay: 29,
  lunarTime: "16:30",
  lunarLeap: false,
  timezone: 480,
  ziHour: true,
};
let currentChart = null;
let selection = { luckIndex: 0, yearIndex: 0, monthIndex: 0 };
let aiState = "idle";
let aiMessages = [];
let activeModule = "workbench";
let currentReportDraft = "";
let caseQuery = "";
let activeCaseId = "";

function setDefaultDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  document.querySelector("#birth-datetime").value = local.toISOString().slice(0, 16);
  const lunar = solarDateToLunarParts(now);
  form.elements.lunarYear.value = lunar.year;
  form.elements.lunarMonth.value = String(lunar.month);
  form.elements.lunarDay.value = String(lunar.day);
  form.elements.lunarLeap.checked = lunar.isLeap;
  form.elements.lunarTime.value = local.toISOString().slice(11, 16);
  renderDateHint();
}

function openChartFromPayload(payload, { caseId = "", focus = true } = {}) {
  setFormPayload(payload);
  currentChart = chartFromPayload(payload);
  selection = { luckIndex: 0, yearIndex: 0, monthIndex: 0 };
  aiState = "idle";
  aiMessages = [];
  activeCaseId = caseId;
  activeModule = "workbench";
  updateNav();
  renderChart(currentChart);
  clearError();
  if (focus) focusChartOnSmallScreen();
}

function parseDateTime(value) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { year, month, day, hour, minute };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fillLunarDays() {
  const daySelect = form.elements.lunarDay;
  daySelect.innerHTML = Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    return `<option value="${day}">${day}</option>`;
  }).join("");
}

function parseChineseMonth(text) {
  const map = { 正: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12, 冬: 11, 腊: 12 };
  return map[text] || 0;
}

function solarDateToLunarParts(date) {
  const text = lunarFormatter.format(date);
  const match = text.match(/^(\d+)年(闰?)(.+)月(\d+)$/);
  if (!match) throw new Error("当前浏览器不支持农历换算。");
  return {
    year: Number(match[1]),
    isLeap: match[2] === "闰",
    month: parseChineseMonth(match[3]),
    day: Number(match[4]),
    text,
  };
}

function lunarToSolarDate({ year, month, day, isLeap }) {
  const start = new Date(year - 1, 11, 1, 12, 0, 0);
  const end = new Date(year + 1, 2, 31, 12, 0, 0);

  for (let time = start.getTime(); time <= end.getTime(); time += 86_400_000) {
    const date = new Date(time);
    const lunar = solarDateToLunarParts(date);
    if (lunar.year === year && lunar.month === month && lunar.day === day && lunar.isLeap === isLeap) {
      return date;
    }
  }

  throw new Error("没有找到对应的公历日期，请检查农历年月日或闰月选项。");
}

function buildBirthDatetimeFromForm(data) {
  if (data.get("dateMode") !== "lunar") {
    return String(data.get("birthDatetime") || "");
  }

  const year = Number(data.get("lunarYear"));
  const month = Number(data.get("lunarMonth"));
  const day = Number(data.get("lunarDay"));
  const time = String(data.get("lunarTime") || "00:00");
  const [hour, minute] = time.split(":").map(Number);
  const solar = lunarToSolarDate({ year, month, day, isLeap: data.get("lunarLeap") === "on" });
  return `${solar.getFullYear()}-${pad2(solar.getMonth() + 1)}-${pad2(solar.getDate())}T${pad2(hour)}:${pad2(minute)}`;
}

function renderDateMode() {
  const isLunar = dateMode.value === "lunar";
  solarDateRow.hidden = isLunar;
  lunarDateRow.hidden = !isLunar;
  form.elements.birthDatetime.required = !isLunar;
  form.elements.lunarYear.required = isLunar;
  form.elements.lunarTime.required = isLunar;
  renderDateHint();
}

function renderDateHint() {
  try {
    if (dateMode.value === "lunar") {
      const data = new FormData(form);
      const birthDatetime = buildBirthDatetimeFromForm(data);
      dateHint.textContent = birthDatetime ? `换算公历：${birthDatetime.replace("T", " ")}` : "";
      return;
    }

    const value = form.elements.birthDatetime.value;
    if (!value) {
      dateHint.textContent = "";
      return;
    }
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const lunar = solarDateToLunarParts(new Date(year, month - 1, day, hour, minute || 0));
    dateHint.textContent = `对应农历：${lunar.text} ${pad2(hour)}:${pad2(minute || 0)}`;
  } catch (error) {
    dateHint.textContent = error.message;
  }
}

function getCases() {
  try {
    return JSON.parse(localStorage.getItem(CASE_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setCases(cases) {
  localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(cases));
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateFormatter.format(date).replaceAll("/", "-");
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function caseReviewDate(item) {
  if (item.reviewAt) return item.reviewAt;
  const settings = getBusinessSettings();
  return addDays(new Date(item.savedAt || Date.now()), settings.reviewReminderDays).toISOString();
}

function caseServiceStatus(item) {
  const note = String(item.note || "").trim();
  if (!note) return { label: "待补记录", tone: "warn" };
  const reviewAt = new Date(caseReviewDate(item));
  if (!Number.isNaN(reviewAt.getTime()) && reviewAt <= new Date()) {
    return { label: "可复盘", tone: "hot" };
  }
  if (item.lastReviewedAt) return { label: "已复盘", tone: "calm" };
  return { label: "已记录", tone: "calm" };
}

function caseActionHint(item) {
  const status = caseServiceStatus(item);
  if (status.label === "待补记录") return "建议补齐来访背景、已验证点和断语摘要。";
  if (status.label === "可复盘") return `到达复盘日：${formatShortDate(caseReviewDate(item))}，建议回看反馈并补结论。`;
  if (status.label === "已复盘") return `下一次复盘：${formatShortDate(caseReviewDate(item))}。`;
  return `下一次复盘：${formatShortDate(caseReviewDate(item))}。`;
}

function markCaseReviewed(id) {
  const settings = getBusinessSettings();
  const cases = getCases().map((item) => {
    if (item.id !== id) return item;
    const now = new Date();
    return {
      ...item,
      lastReviewedAt: now.toISOString(),
      reviewAt: addDays(now, settings.reviewReminderDays).toISOString(),
    };
  });
  setCases(cases);
  renderCaseList();
  if (activeModule === "cases") renderCasesModule();
}

function parseTags(value = "") {
  return String(value)
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function caseSearchText(item) {
  return [
    item.title,
    item.pillars,
    item.note,
    item.payload?.birthDatetime,
    ...(item.tags || []),
  ].join(" ").toLowerCase();
}

function filterCases(cases) {
  const query = caseQuery.trim().toLowerCase();
  if (!query) return cases;
  return cases.filter((item) => caseSearchText(item).includes(query));
}

function buildCaseSummaryText(item) {
  const status = caseServiceStatus(item);
  return [
    `案例：${item.title}`,
    `四柱：${item.pillars}`,
    `出生：${item.payload?.birthDatetime?.replace("T", " ") || "-"}`,
    `状态：${status.label}`,
    `复盘：${formatShortDate(caseReviewDate(item))}`,
    item.tags?.length ? `标签：${item.tags.join("、")}` : "标签：-",
    item.note ? `备注：${item.note}` : "备注：待补充",
  ].join("\n");
}

function getReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setReports(reports) {
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
}

function defaultKnowledgeTemplates() {
  return [
    { id: "base-work", category: "盲派做工", title: "做工总纲", content: "先看月令定环境，再看天干透出定明处做事；地支藏干看根气和暗线，合冲刑害看事情如何被牵动、交换或打断。" },
    { id: "ten-god-route", category: "十神路径", title: "十神成事", content: "比劫看自我与竞争，食伤看表达与产出，财星看资源与经营，官杀看规则压力与职位，印星看学习保护与资质。先分组，再看透干、通根、制化。" },
    { id: "yin-yang", category: "阴阳法", title: "寒暖燥湿", content: "阴阳法不只看五行数量，要以月令为核心，结合季节寒暖燥湿、透干明暗、地支藏气和合冲后的气势来定调。" },
    { id: "verify", category: "验证话术", title: "学习验证", content: "询问学习阶段是否有规则压力、长辈要求、兴趣表达、证书资质、换专业或阶段性转向；用反馈校准印星、食伤和官杀的实际作用。" },
  ];
}

function getKnowledgeTemplates() {
  try {
    const stored = JSON.parse(localStorage.getItem(KNOWLEDGE_STORAGE_KEY) || "[]");
    return stored.length ? stored : defaultKnowledgeTemplates();
  } catch {
    return defaultKnowledgeTemplates();
  }
}

function setKnowledgeTemplates(items) {
  localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(items));
}

function defaultBusinessSettings() {
  return {
    appName: "八字排盘工作台",
    aiModel: "openai/gpt-oss-120b:free",
    ziHourDefault: true,
    trueSolarTime: false,
    reportPrice: 199,
    monthlyPrice: 399,
    freeQuota: 3,
    deliveryMode: "可编辑报告 + 复制文本",
    reportTone: "温和、谨慎、便于核验",
    reviewReminderDays: 30,
  };
}

function getBusinessSettings() {
  try {
    return { ...defaultBusinessSettings(), ...JSON.parse(localStorage.getItem(BUSINESS_SETTINGS_KEY) || "{}") };
  } catch {
    return defaultBusinessSettings();
  }
}

function setBusinessSettings(settings) {
  localStorage.setItem(BUSINESS_SETTINGS_KEY, JSON.stringify(settings));
}

function applyBusinessSettings() {
  const settings = getBusinessSettings();
  form.elements.ziHour.checked = Boolean(settings.ziHourDefault);
}

function buildLocalBackup() {
  return {
    app: "bazi-service-workbench",
    version: 1,
    exportedAt: new Date().toISOString(),
    cases: getCases(),
    reports: getReports(),
    knowledge: getKnowledgeTemplates(),
    settings: getBusinessSettings(),
  };
}

function downloadTextFile(filename, text, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function restoreLocalBackup(data) {
  if (!data || typeof data !== "object") throw new Error("备份文件格式不正确。");
  if (!Array.isArray(data.cases) || !Array.isArray(data.reports) || !Array.isArray(data.knowledge)) {
    throw new Error("备份文件缺少案例、报告或知识库数据。");
  }
  setCases(data.cases);
  setReports(data.reports);
  setKnowledgeTemplates(data.knowledge);
  setBusinessSettings({ ...defaultBusinessSettings(), ...(data.settings || {}) });
  applyBusinessSettings();
  renderCaseList();
}

function getFormPayload() {
  const data = new FormData(form);
  const birthDatetime = buildBirthDatetimeFromForm(data);
  return {
    personName: String(data.get("personName") || ""),
    gender: String(data.get("gender") || "unknown"),
    dateMode: String(data.get("dateMode") || "solar"),
    birthDatetime,
    lunarYear: Number(data.get("lunarYear") || 0),
    lunarMonth: Number(data.get("lunarMonth") || 1),
    lunarDay: Number(data.get("lunarDay") || 1),
    lunarTime: String(data.get("lunarTime") || "00:00"),
    lunarLeap: data.get("lunarLeap") === "on",
    timezone: Number(data.get("timezone") || 480),
    ziHour: data.get("ziHour") === "on",
  };
}

function chartFromPayload(payload) {
  return calculateBazi({
    ...parseDateTime(payload.birthDatetime),
    offsetMinutes: payload.timezone,
    name: payload.personName,
    gender: payload.gender,
    useZiHourDayChange: payload.ziHour,
  });
}

function setFormPayload(payload) {
  form.elements.personName.value = payload.personName || "";
  form.elements.gender.value = payload.gender || "unknown";
  form.elements.dateMode.value = payload.dateMode || "solar";
  form.elements.birthDatetime.value = payload.birthDatetime || "";
  form.elements.lunarYear.value = payload.lunarYear || "";
  form.elements.lunarMonth.value = String(payload.lunarMonth || 1);
  form.elements.lunarDay.value = String(payload.lunarDay || 1);
  form.elements.lunarTime.value = payload.lunarTime || "00:00";
  form.elements.lunarLeap.checked = Boolean(payload.lunarLeap);
  form.elements.timezone.value = String(payload.timezone ?? 480);
  form.elements.ziHour.checked = payload.ziHour !== false;
  renderDateMode();
}

function renderTags(tags = []) {
  return tags.length ? `<div class="tag-list">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : "";
}

function renderStatusPill(status) {
  return `<span class="status-pill ${status.tone}">${escapeHtml(status.label)}</span>`;
}

function renderCaseList() {
  const cases = getCases();
  caseCount.textContent = String(cases.length);
  caseList.innerHTML = cases.length
    ? cases.map((item) => {
      const status = caseServiceStatus(item);
      return `
        <article class="case-card">
          <button type="button" data-case-action="load" data-id="${escapeHtml(item.id)}">
            <strong>${escapeHtml(item.title)} ${renderStatusPill(status)}</strong>
            <span>${escapeHtml(item.pillars)} · ${escapeHtml(item.payload.birthDatetime.replace("T", " "))}</span>
            ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
            <small>复盘：${formatShortDate(caseReviewDate(item))}</small>
            ${renderTags(item.tags)}
          </button>
          <button class="case-delete" type="button" data-case-action="delete" data-id="${escapeHtml(item.id)}">删除</button>
        </article>
      `;
    }).join("")
    : `<p class="muted-copy">暂无案例。排盘后可保存当前案例。</p>`;
}

function renderShensha(shensha = []) {
  if (!shensha.length) return `<div class="shensha-list muted">-</div>`;
  return `
    <div class="shensha-list">
      ${shensha.map((item) => `<span title="${escapeHtml(item.source)}：${escapeHtml(item.note)}">${escapeHtml(item.name)}</span>`).join("")}
    </div>
  `;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtml(value = "") {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function elementClass(element) {
  return `element-${element || "none"}`;
}

function coloredStem(item) {
  return `<strong class="${elementClass(item.stemElement)}">${item.stem}</strong>`;
}

function coloredBranch(item) {
  return `<strong class="${elementClass(item.branchElement)}">${item.branch}</strong>`;
}

function coloredPillar(item) {
  return `<strong><span class="${elementClass(item.stemElement)}">${item.stem}</span><span class="${elementClass(item.branchElement)}">${item.branch}</span></strong>`;
}

function coloredPillarWithTenGod(item) {
  return `
    <span class="flow-pillar">
      <small>${item.tenGod || ""}</small>
      <b class="${elementClass(item.stemElement)}">${item.stem}</b>
      <b class="${elementClass(item.branchElement)}">${item.branch}</b>
      <em>${item.branchTenGod || ""}</em>
    </span>
  `;
}

function elementFromStem(stem) {
  const found = baziMeta.STEMS.find((item) => item.char === stem);
  return found?.element || "";
}

function elementFromNayin(nayin = "") {
  return baziMeta.ELEMENTS.find((element) => nayin.endsWith(element)) || "";
}

function coloredHiddenStems(hiddenStems) {
  if (!hiddenStems.length) return "-";
  return hiddenStems.map((item) => `<span class="${elementClass(item.element || elementFromStem(item.stem))}">${item.stem}<small>${item.tenGod}</small></span>`).join(" ");
}

function coloredNayin(nayin) {
  return `<span class="${elementClass(elementFromNayin(nayin))}">${nayin}</span>`;
}

function flowAsColumn(item, label, extra = "") {
  if (!item) return null;
  return {
    label,
    stem: item.stem,
    branch: item.branch,
    stemPolarity: "",
    stemElement: item.stemElement,
    branchElement: item.branchElement,
    tenGod: item.tenGod || "-",
    branchTenGod: item.branchTenGod || "",
    hiddenStems: item.hiddenStems || [],
    nayin: item.nayin,
    shensha: item.shensha || [],
    extra,
  };
}

function getDisplayColumns(pillars, chart) {
  const { luck, year, month } = getSelectedFlow(chart);
  return [
    ...Object.values(pillars),
    flowAsColumn(luck, "大运", luck?.yearRange || ""),
    flowAsColumn(year, "流年", year ? String(year.year) : ""),
    flowAsColumn(month, "流月", month ? `${month.name}${month.branchMonth}` : ""),
  ].filter(Boolean);
}

function renderPillarTable(pillars, chart) {
  const entries = getDisplayColumns(pillars, chart);
  const labels = entries.map((pillar) => `<th>${pillar.label}${pillar.extra ? `<small>${pillar.extra}</small>` : ""}</th>`).join("");
  const stems = entries.map((pillar) => `<td class="stem-cell"><small>${pillar.tenGod || ""}</small>${coloredStem(pillar)}<em>${pillar.stemPolarity}${pillar.stemElement || ""}</em></td>`).join("");
  const branches = entries.map((pillar) => `<td class="branch-cell">${coloredBranch(pillar)}<small>${pillar.branchTenGod || ""}</small></td>`).join("");
  const hidden = entries.map((pillar) => `<td class="hidden-cell">${coloredHiddenStems(pillar.hiddenStems)}</td>`).join("");
  const nayin = entries.map((pillar) => `<td>${coloredNayin(pillar.nayin)}</td>`).join("");
  const shensha = entries.map((pillar) => `<td>${renderShensha(pillar.shensha)}</td>`).join("");

  return `
    <section class="pillar-table-panel">
      <table class="pillar-table">
        <thead><tr><th></th>${labels}</tr></thead>
        <tbody>
          <tr><th>天干</th>${stems}</tr>
          <tr><th>地支</th>${branches}</tr>
          <tr><th>藏干</th>${hidden}</tr>
          <tr><th>纳音</th>${nayin}</tr>
          <tr><th>神煞</th>${shensha}</tr>
        </tbody>
      </table>
    </section>
  `;
}

function getSelectedFlow(chart) {
  const luck = chart.majorLuck.cycles[selection.luckIndex];
  const year = luck?.years?.[selection.yearIndex];
  const month = year?.months?.[selection.monthIndex];
  return { luck, year, month };
}

const STEM_COMBOS = [
  ["甲", "己", "合土"], ["乙", "庚", "合金"], ["丙", "辛", "合水"], ["丁", "壬", "合木"], ["戊", "癸", "合火"],
];
const STEM_CLASHES = [["甲", "庚"], ["乙", "辛"], ["丙", "壬"], ["丁", "癸"]];
const BRANCH_LIUHE = [
  ["子", "丑", "六合土"], ["寅", "亥", "六合木"], ["卯", "戌", "六合火"], ["辰", "酉", "六合金"], ["巳", "申", "六合水"], ["午", "未", "六合土"],
];
const BRANCH_CLASHES = [["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"]];
const BRANCH_HARMS = [["子", "未"], ["丑", "午"], ["寅", "巳"], ["卯", "辰"], ["申", "亥"], ["酉", "戌"]];
const BRANCH_BREAKS = [["子", "酉"], ["丑", "辰"], ["寅", "亥"], ["卯", "午"], ["巳", "申"], ["未", "戌"]];
const BRANCH_PUNISH = [["寅", "巳"], ["巳", "申"], ["申", "寅"], ["丑", "未"], ["未", "戌"], ["戌", "丑"], ["子", "卯"]];
const BRANCH_SELF_PUNISH = ["辰", "午", "酉", "亥"];
const BRANCH_SANHE = [
  { branches: ["申", "子", "辰"], name: "三合水" },
  { branches: ["亥", "卯", "未"], name: "三合木" },
  { branches: ["寅", "午", "戌"], name: "三合火" },
  { branches: ["巳", "酉", "丑"], name: "三合金" },
];
const BRANCH_SANHUI = [
  { branches: ["寅", "卯", "辰"], name: "三会木" },
  { branches: ["巳", "午", "未"], name: "三会火" },
  { branches: ["申", "酉", "戌"], name: "三会金" },
  { branches: ["亥", "子", "丑"], name: "三会水" },
];

function hasPair(a, b, x, y) {
  return (a === x && b === y) || (a === y && b === x);
}

function relationText(items, relation) {
  const names = items.map((item) => `${item.label}${item.char}`).join("、");
  return `<span>${names}<strong>${relation}</strong></span>`;
}

function findRelations(columns) {
  const stemRelations = [];
  const branchRelations = [];

  for (let i = 0; i < columns.length; i += 1) {
    for (let j = i + 1; j < columns.length; j += 1) {
      const a = columns[i];
      const b = columns[j];
      const combo = STEM_COMBOS.find(([x, y]) => hasPair(a.stem, b.stem, x, y));
      if (combo) stemRelations.push(relationText([{ label: a.label, char: a.stem }, { label: b.label, char: b.stem }], combo[2]));
      if (STEM_CLASHES.some(([x, y]) => hasPair(a.stem, b.stem, x, y))) {
        stemRelations.push(relationText([{ label: a.label, char: a.stem }, { label: b.label, char: b.stem }], "天干冲"));
      }

      const liuhe = BRANCH_LIUHE.find(([x, y]) => hasPair(a.branch, b.branch, x, y));
      if (liuhe) branchRelations.push(relationText([{ label: a.label, char: a.branch }, { label: b.label, char: b.branch }], liuhe[2]));
      if (BRANCH_CLASHES.some(([x, y]) => hasPair(a.branch, b.branch, x, y))) {
        branchRelations.push(relationText([{ label: a.label, char: a.branch }, { label: b.label, char: b.branch }], "六冲"));
      }
      if (BRANCH_HARMS.some(([x, y]) => hasPair(a.branch, b.branch, x, y))) {
        branchRelations.push(relationText([{ label: a.label, char: a.branch }, { label: b.label, char: b.branch }], "六害"));
      }
      if (BRANCH_BREAKS.some(([x, y]) => hasPair(a.branch, b.branch, x, y))) {
        branchRelations.push(relationText([{ label: a.label, char: a.branch }, { label: b.label, char: b.branch }], "六破"));
      }
      if (BRANCH_PUNISH.some(([x, y]) => hasPair(a.branch, b.branch, x, y))) {
        branchRelations.push(relationText([{ label: a.label, char: a.branch }, { label: b.label, char: b.branch }], "相刑"));
      }
      if (a.branch === b.branch && BRANCH_SELF_PUNISH.includes(a.branch)) {
        branchRelations.push(relationText([{ label: a.label, char: a.branch }, { label: b.label, char: b.branch }], "自刑"));
      }
    }
  }

  for (const group of [...BRANCH_SANHE, ...BRANCH_SANHUI]) {
    const hits = group.branches.map((branch) => columns.find((column) => column.branch === branch)).filter(Boolean);
    if (hits.length === 3) {
      branchRelations.push(relationText(hits.map((item) => ({ label: item.label, char: item.branch })), group.name));
    }
  }

  return { stemRelations, branchRelations };
}

function renderRelations(chart) {
  const columns = getDisplayColumns(chart.pillars, chart);
  const { stemRelations, branchRelations } = findRelations(columns);
  const empty = `<span class="muted-relation">暂无明显关系</span>`;

  return `
    <section class="relations-panel">
      <div>
        <strong>天干作用</strong>
        <div class="relation-list">${stemRelations.length ? stemRelations.join("") : empty}</div>
      </div>
      <div>
        <strong>地支作用</strong>
        <div class="relation-list">${branchRelations.length ? branchRelations.join("") : empty}</div>
      </div>
    </section>
  `;
}

function compactShensha(shensha = []) {
  return shensha.map((item) => `${item.name}（${item.source}）`);
}

function compactPillar(pillar) {
  if (!pillar) return null;
  return {
    label: pillar.label,
    pillar: pillar.pillar || pillar.text,
    stem: pillar.stem,
    stemPolarity: pillar.stemPolarity,
    stemElement: pillar.stemElement,
    stemTenGod: pillar.tenGod,
    branch: pillar.branch,
    branchElement: pillar.branchElement,
    branchTenGod: pillar.branchTenGod,
    hiddenStems: (pillar.hiddenStems || []).map((item) => ({
      stem: item.stem,
      element: item.element,
      tenGod: item.tenGod,
    })),
    nayin: pillar.nayin,
    shensha: compactShensha(pillar.shensha),
    extra: pillar.extra,
  };
}

function basicRuleReference() {
  return {
    heavenlyStems: Object.fromEntries(baziMeta.STEMS.map((item) => [item.char, `${item.polarity}${item.element}`])),
    earthlyBranches: Object.fromEntries(baziMeta.BRANCHES.map((item) => [item.char, `${item.element}，藏干${item.hidden.join("、")}`])),
    note: "天干五行必须按此表：甲乙木、丙丁火、戊己土、庚辛金、壬癸水。地支五行必须按此表：寅卯木、巳午火、申酉金、亥子水、辰戌丑未土。",
  };
}

function buildAiPayload(chart) {
  const columns = Object.values(chart.pillars);
  const relations = findRelations(columns);
  const professional = buildProfessionalProfile(chart);
  return {
    name: chart.input.name || "",
    gender: chart.input.gender,
    solarTime: chart.solarTime.birthLocal,
    timezone: chart.input.timezone,
    dayMaster: `${chart.dayMaster.stem}${chart.dayMaster.polarity}${chart.dayMaster.element}`,
    basicRules: basicRuleReference(),
    fourPillars: Object.fromEntries(Object.entries(chart.pillars).map(([key, pillar]) => [key, compactPillar(pillar)])),
    elements: chart.summary.elements,
    missingElements: chart.summary.missingElements,
    seasonHint: chart.summary.seasonHint,
    professionalProfile: {
      tags: professional.tags,
      lines: professional.lines,
      tenGodGroups: professional.tenGods.rankedGroups.map((item) => ({
        group: item.group,
        value: Number(item.value.toFixed(2)),
      })),
      visibleTenGods: professional.tenGods.visible,
      hiddenTenGods: professional.tenGods.hidden,
      dayMasterRoots: professional.tenGods.rootLabels,
    },
    relations: {
      stems: relations.stemRelations.map((item) => item.replace(/<[^>]+>/g, " ")),
      branches: relations.branchRelations.map((item) => item.replace(/<[^>]+>/g, " ")),
    },
    natalShensha: compactShensha(chart.shensha.natal),
    note: chart.note,
    caseNote: caseNoteInput.value.trim(),
  };
}

function formatAiText(text) {
  const cleaned = String(text)
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/^\s*>+\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n");

  return escapeHtml(cleaned)
    .replace(/\n{2,}/g, "\n\n")
    .split("\n\n")
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderAiPanel() {
  const canStart = currentChart && aiState !== "loading";
  const messages = aiMessages.length
    ? aiMessages.map((message) => `
        <article class="ai-message ${message.role === "user" ? "from-user" : "from-ai"}">
          <span>${message.role === "user" ? "你" : "AI"}</span>
          <div>${formatAiText(message.content)}</div>
        </article>
      `).join("")
    : `<p class="ai-placeholder">点击本面板的“开启AI对话”生成盲派做工与阴阳法初始分析，也可以在这里继续追问性格、学历、出身等细节。</p>`;
  const loading = aiState === "loading"
    ? `<article class="ai-message from-ai"><span>AI</span><div><p>正在思考当前排盘...</p></div></article>`
    : "";

  return `
    <section class="panel wide-panel ai-panel">
      <div class="panel-heading">
        <h2>AI对话</h2>
        <span>${aiState === "error" ? "请求失败" : "AI辅助"}</span>
      </div>
      <div class="ai-start-row">
        <button type="button" data-action="start-ai-chat" ${canStart ? "" : "disabled"}>
          ${aiState === "loading" ? "AI回复中..." : aiMessages.length ? "重新开启对话" : "开启AI对话"}
        </button>
      </div>
      <div class="ai-chat-log">${messages}${loading}</div>
      <form class="ai-chat-form" data-ai-chat-form>
        <textarea name="aiQuestion" rows="3" placeholder="例如：这个命主性格怎么看？学历出身有什么象？做工点在哪里？" ${aiState === "loading" ? "disabled" : ""}></textarea>
        <div>
          <button type="submit" ${aiState === "loading" ? "disabled" : ""}>发送</button>
          <button class="secondary" type="button" data-action="clear-ai-chat" ${aiMessages.length || aiState === "loading" ? "" : "disabled"}>清空</button>
        </div>
      </form>
    </section>
  `;
}

function renderModuleShell(title, subtitle, content) {
  chartView.classList.remove("empty-state");
  chartView.classList.add("chart-content");
  chartView.innerHTML = `
    <section class="module-page">
      <div class="module-hero">
        <span class="eyebrow">服务模块</span>
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
      ${content}
    </section>
  `;
}

function renderCasesModule() {
  const cases = getCases();
  const filteredCases = filterCases(cases);
  const allTags = [...new Set(cases.flatMap((item) => item.tags || []))].slice(0, 14);
  const savedThisMonth = cases.filter((item) => item.savedAt?.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const dueCases = cases.filter((item) => caseServiceStatus(item).label === "可复盘").length;
  const incompleteCases = cases.filter((item) => caseServiceStatus(item).label === "待补记录").length;
  const serviceQueue = cases
    .map((item) => ({ item, status: caseServiceStatus(item) }))
    .filter(({ status }) => ["待补记录", "可复盘"].includes(status.label))
    .slice(0, 4);
  const content = `
    <section class="module-stats">
      <article><strong>${cases.length}</strong><span>累计案例</span></article>
      <article><strong>${savedThisMonth}</strong><span>本月新增</span></article>
      <article><strong>${dueCases}</strong><span>可复盘</span></article>
      <article><strong>${incompleteCases}</strong><span>待补记录</span></article>
    </section>
    ${serviceQueue.length ? `
      <section class="service-queue">
        <div class="panel-heading">
          <h2>待跟进</h2>
          <span>${serviceQueue.length}项</span>
        </div>
        <div class="queue-list">
          ${serviceQueue.map(({ item, status }) => `
            <article class="queue-item ${status.tone}">
              <div>
                <strong>${escapeHtml(item.title)} ${renderStatusPill(status)}</strong>
                <span>${escapeHtml(caseActionHint(item))}</span>
              </div>
              <button class="secondary" type="button" data-action="load-module-case" data-id="${escapeHtml(item.id)}">处理</button>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}
    <section class="module-card">
      <div class="panel-heading">
        <h2>案例资产库</h2>
        <span>本地存储</span>
      </div>
      <div class="case-search-row">
        <input data-case-search type="search" placeholder="搜索姓名、四柱、标签、备注" value="${escapeHtml(caseQuery)}" />
        <button class="secondary" type="button" data-action="clear-case-search" ${caseQuery ? "" : "disabled"}>清空</button>
      </div>
      ${allTags.length ? `<div class="tag-filter-row">${allTags.map((tag) => `<button class="secondary" type="button" data-action="filter-case-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>` : ""}
      <div class="case-board">
        ${filteredCases.length ? filteredCases.map((item) => {
          const status = caseServiceStatus(item);
          return `
          <article class="case-board-card ${status.tone}">
            <div>
              <strong>${escapeHtml(item.title)} ${renderStatusPill(status)}</strong>
              <span>${escapeHtml(item.pillars)} · ${escapeHtml(item.payload.birthDatetime.replace("T", " "))}</span>
              <span>保存：${formatShortDate(item.savedAt)} · 复盘：${formatShortDate(caseReviewDate(item))}</span>
              ${item.lastReviewedAt ? `<span>上次复盘：${formatShortDate(item.lastReviewedAt)}</span>` : ""}
              ${renderTags(item.tags)}
              ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
            </div>
            <div class="case-card-actions">
              <button class="secondary" type="button" data-action="load-module-case" data-id="${escapeHtml(item.id)}">打开</button>
              <button class="secondary" type="button" data-action="copy-case-summary" data-id="${escapeHtml(item.id)}">复制摘要</button>
              <button class="secondary" type="button" data-action="mark-case-reviewed" data-id="${escapeHtml(item.id)}">标记复盘</button>
            </div>
          </article>
        `;
        }).join("") : `<p class="muted-copy">${cases.length ? "没有匹配的案例。" : "暂无案例。先在左侧排盘并保存，就会进入案例资产库。"}</p>`}
      </div>
    </section>
  `;
  renderModuleShell("案例中心", "把每一次咨询整理成可检索、可复盘、可继续跟进的案例资料。", content);
}

function chartSignature(chart) {
  if (!chart) return "";
  return `${chart.pillars.year.text} ${chart.pillars.month.text} ${chart.pillars.day.text} ${chart.pillars.hour.text}`;
}

function hiddenStemLine(pillar) {
  return (pillar.hiddenStems || []).map((item) => `${item.stem}${item.element}${item.tenGod ? `(${item.tenGod})` : ""}`).join("、") || "-";
}

function relationLine(chart) {
  const relations = findRelations(Object.values(chart.pillars));
  const stems = relations.stemRelations.length ? relations.stemRelations.map(stripHtml).join("；") : "未见明显天干合冲";
  const branches = relations.branchRelations.length ? relations.branchRelations.map(stripHtml).join("；") : "未见明显地支合冲刑害破";
  return `天干：${stems}\n地支：${branches}`;
}

function rankedElements(summary) {
  return Object.entries(summary.elements)
    .sort((a, b) => b[1] - a[1])
    .map(([element, value]) => `${element}${Number(value).toFixed(1)}`);
}

function rankedElementEntries(summary) {
  return Object.entries(summary.elements)
    .sort((a, b) => b[1] - a[1])
    .map(([element, value]) => ({ element, value: Number(value) }));
}

function relationPreview(relations) {
  const items = [...relations.stemRelations, ...relations.branchRelations].map(stripHtml);
  return items.length ? items.slice(0, 3).join("；") : "未见明显合冲刑害破";
}

function countTenGodProfile(chart) {
  const counts = Object.fromEntries(Object.keys(TEN_GOD_GROUPS).map((group) => [group, 0]));
  const visible = [];
  const hidden = [];
  const rootLabels = [];

  Object.values(chart.pillars).forEach((pillar) => {
    if (pillar.tenGod && pillar.tenGod !== "日主") {
      visible.push(`${pillar.label}干${pillar.stem}${pillar.tenGod}`);
      const group = Object.entries(TEN_GOD_GROUPS).find(([, gods]) => gods.includes(pillar.tenGod))?.[0];
      if (group) counts[group] += 1;
    }

    (pillar.hiddenStems || []).forEach((item, index) => {
      if (item.tenGod && item.tenGod !== "日主") {
        hidden.push(`${pillar.label}支藏${item.stem}${item.tenGod}`);
        const group = Object.entries(TEN_GOD_GROUPS).find(([, gods]) => gods.includes(item.tenGod))?.[0];
        if (group) counts[group] += index === 0 ? 0.55 : 0.35;
      }
      if (item.element === chart.dayMaster.element) rootLabels.push(`${pillar.label}${pillar.branch}`);
    });
  });

  const rankedGroups = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([group, value]) => ({ group, value }));

  return {
    counts,
    rankedGroups,
    visible,
    hidden,
    rootLabels: [...new Set(rootLabels)],
  };
}

function buildProfessionalProfile(chart) {
  const relations = findRelations(getDisplayColumns(chart.pillars, chart));
  const tenGods = countTenGodProfile(chart);
  const elementEntries = rankedElementEntries(chart.summary);
  const strongest = elementEntries[0];
  const weakest = elementEntries[elementEntries.length - 1];
  const monthElement = chart.pillars.month.branchElement;
  const topGods = tenGods.rankedGroups.filter((item) => item.value > 0).slice(0, 2);
  const relationCount = relations.stemRelations.length + relations.branchRelations.length;
  const lines = [
    `月令以${chart.pillars.month.branch}${monthElement}为环境底色，先定寒暖燥湿，再看透干是否能成事。`,
    tenGods.visible.length ? `天干明处：${tenGods.visible.join("、")}。` : "天干明处十神不多，需重看地支藏干与月令。 ",
    tenGods.rootLabels.length ? `日主根气：${chart.dayMaster.stem}${chart.dayMaster.element}在${tenGods.rootLabels.join("、")}见根。` : `日主${chart.dayMaster.stem}${chart.dayMaster.element}明根不显，需看印比帮扶与流运引动。`,
    `五行偏向：${strongest.element}较显，${weakest.element}较弱；不宜只按数量定旺衰，要回到月令和通根。`,
    relationCount ? `作用关系：${relationPreview(relations)}，这些位置是核验变化与应事的入口。` : "作用关系不重，重点看十神位置、根气和岁运引动。",
  ];

  return {
    monthElement,
    strongest,
    weakest,
    tenGods,
    topGods,
    lines,
    tags: [
      `月令${chart.pillars.month.branch}${monthElement}`,
      tenGods.rootLabels.length ? "日主有根" : "根气待核",
      ...topGods.map((item) => `${item.group}较显`),
      relationCount ? "关系需核" : "结构较静",
    ],
  };
}

function buildConsultationSummary(chart) {
  const { luck, year, month } = getSelectedFlow(chart);
  const relations = findRelations(getDisplayColumns(chart.pillars, chart));
  const elements = rankedElements(chart.summary).join("、");
  const professional = buildProfessionalProfile(chart);
  const flow = luck && year
    ? `${luck.pillar}大运，${year.year}${year.pillar}流年${month ? `，${month.name}${month.pillar}流月` : ""}`
    : "未展开大运流年";
  return [
    `四柱：${chartSignature(chart)}`,
    `日主：${chart.dayMaster.stem}${chart.dayMaster.polarity}${chart.dayMaster.element}`,
    `出生时间：${chart.solarTime.birthLocal}`,
    `五行气势：${elements}`,
    `月令提示：${chart.summary.seasonHint}`,
    `专业要点：${professional.lines.join(" ")}`,
    `当前流运：${flow}`,
    `作用关系：${relationPreview(relations)}`,
  ].join("\n");
}

function buildVerificationChecklist(chart) {
  const relations = findRelations(getDisplayColumns(chart.pillars, chart));
  const elements = rankedElements(chart.summary);
  const missing = chart.summary.missingElements.length ? chart.summary.missingElements.join("、") : "无明显全缺";
  const professional = buildProfessionalProfile(chart);
  const topGodText = professional.topGods.length ? professional.topGods.map((item) => item.group).join("、") : "十神主线";
  return [
    "核验问题清单",
    `1. 日主为${chart.dayMaster.stem}${chart.dayMaster.polarity}${chart.dayMaster.element}，请核对性格中是否更明显体现主动性、规则感、压力感或表达欲。`,
    `2. 五行气势较明显的是${elements.slice(0, 2).join("、")}，缺失为${missing}，请核对生活中对应的学习、行动、资源、规则或流动性表现。`,
    `3. 月令为${chart.solarTerms.monthBoundary.name}，${professional.lines[0]}请核对早年环境、家庭要求、学习节奏和身体感受。`,
    `4. 十神主线提示为${topGodText}，请分别核对自我竞争、表达产出、资源经营、规则压力、学习资质哪一类最常出现。`,
    `5. 根气提示：${professional.tenGods.rootLabels.length ? professional.tenGods.rootLabels.join("、") : "日主明根不显"}，请核对做事是持续稳定，还是容易靠外部环境激发。`,
    `6. 作用关系提示：${relationPreview(relations)}，请核对关系、迁动、情绪拉扯或阶段变化是否对应。`,
    "7. 事业方向请核对更像专业输出、规则平台、资源经营、个人行动，还是多线并行。",
    "8. 婚恋关系请核对稳定承接、吸引拉扯、距离变化、沟通锋芒中哪一类更明显。",
  ].join("\n");
}

function buildCaseNoteTemplate(chart) {
  return [
    "来访背景：",
    "",
    "已核验信息：",
    `四柱：${chartSignature(chart)}`,
    `日主：${chart.dayMaster.stem}${chart.dayMaster.polarity}${chart.dayMaster.element}`,
    "",
    "重点问题：",
    "",
    "断语摘要：",
    "",
    "待核验：",
    "",
    "复盘结论：",
  ].join("\n");
}

function serviceCompleteness(chart) {
  const checks = [
    { label: "姓名备注", done: Boolean(chart.input.name?.trim()) },
    { label: "性别", done: chart.input.gender !== "unknown" },
    { label: "案例备注", done: Boolean(caseNoteInput.value.trim()) },
    { label: "案例标签", done: parseTags(caseTagsInput.value).length > 0 },
    { label: "报告底稿", done: Boolean(currentReportDraft.trim()) },
  ];
  const done = checks.filter((item) => item.done).length;
  return { checks, done, total: checks.length };
}

function serviceStageItems(chart) {
  return [
    { label: "建档", meta: "出生信息", done: Boolean(chart.solarTime?.birthLocal) },
    { label: "核验", meta: "备注与标签", done: Boolean(caseNoteInput.value.trim()) && parseTags(caseTagsInput.value).length > 0 },
    { label: "初稿", meta: "报告底稿", done: Boolean(currentReportDraft.trim()) },
    { label: "复盘", meta: "保存案例", done: getCases().some((item) => item.pillars === chartSignature(chart)) },
  ];
}

function renderProfessionalPanel(chart) {
  const profile = buildProfessionalProfile(chart);
  return `
    <div class="professional-panel">
      <div class="professional-head">
        <strong>专业研判要点</strong>
        <span>${profile.tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join("")}</span>
      </div>
      <div class="professional-lines">
        ${profile.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>
    </div>
  `;
}

function renderConsultationPanel(chart) {
  const { luck, year, month } = getSelectedFlow(chart);
  const relations = findRelations(getDisplayColumns(chart.pillars, chart));
  const elements = rankedElements(chart.summary);
  const completeness = serviceCompleteness(chart);
  const stages = serviceStageItems(chart);
  const flowText = luck && year
    ? `${luck.pillar}大运 · ${year.year}${year.pillar} · ${month ? `${month.name}${month.pillar}` : "未选流月"}`
    : "填写性别后展开大运、流年、流月";
  const missing = chart.summary.missingElements.length ? chart.summary.missingElements.join("、") : "无明显全缺";

  return `
    <section class="consultation-panel">
      <div class="panel-heading">
        <h2>咨询研判台</h2>
        <span>当前盘面</span>
      </div>
      <div class="insight-grid">
        <article>
          <span>核验信息</span>
          <strong>${chart.solarTime.birthLocal}</strong>
          <p>${chart.input.gender === "unknown" ? "性别未填，大运顺逆暂不估算。" : `${chart.input.gender === "male" ? "男命" : "女命"}，${chart.majorLuck.direction.text}。`}</p>
        </article>
        <article>
          <span>记录完整度</span>
          <strong>${completeness.done}/${completeness.total}</strong>
          <p>${completeness.checks.filter((item) => !item.done).map((item) => item.label).join("、") || "资料已较完整。"}</p>
        </article>
        <article>
          <span>五行气势</span>
          <strong>${elements.slice(0, 2).join(" / ")}</strong>
          <p>缺失：${missing}。${chart.summary.seasonHint}</p>
        </article>
        <article>
          <span>流运焦点</span>
          <strong>${flowText}</strong>
          <p>上方选择会同步进入原盘右侧与作用关系。</p>
        </article>
        <article>
          <span>作用关系</span>
          <strong>${relations.stemRelations.length + relations.branchRelations.length} 项</strong>
          <p>${relationPreview(relations)}</p>
        </article>
      </div>
      ${renderProfessionalPanel(chart)}
      <div class="quick-actions">
        <button type="button" data-action="save-case-inline">保存为案例</button>
        <button class="secondary" type="button" data-action="generate-report-inline">生成报告底稿</button>
        <button class="secondary" type="button" data-action="copy-consultation-summary">复制研判摘要</button>
        <button class="secondary" type="button" data-action="copy-verification-checklist">复制核验问题</button>
        <button class="secondary" type="button" data-action="fill-note-template">填入记录模板</button>
        <button class="secondary" type="button" data-action="go-cases">查看案例库</button>
      </div>
      <div class="service-checklist">
        ${stages.map((item) => `
          <span class="${item.done ? "done" : ""}">
            <i></i>
            <strong>${item.label}</strong>
            <small>${item.meta}</small>
          </span>
        `).join("")}
      </div>
    </section>
  `;
}

function buildReportDraft(chart) {
  const settings = getBusinessSettings();
  const pillars = chart.pillars;
  const elements = Object.entries(chart.summary.elements).map(([element, value]) => `${element}${value.toFixed(1)}`).join("、");
  const shensha = chart.shensha.natal.map((item) => `${item.name}(${item.source})`).join("、") || "-";
  const title = chart.input.name ? `${chart.input.name} 八字分析报告` : `${chartSignature(chart)} 八字分析报告`;
  const professional = buildProfessionalProfile(chart);

  return [
    title,
    "",
    "一、命盘信息",
    `出生时间：${chart.solarTime.birthLocal}`,
    `四柱：${chartSignature(chart)}`,
    `日主：${chart.dayMaster.stem}${chart.dayMaster.polarity}${chart.dayMaster.element}`,
    `月令：${chart.solarTerms.monthBoundary.name}（${chart.solarTerms.monthBoundary.localTime}）`,
    `记录方式：${settings.deliveryMode}`,
    `报告语气：${settings.reportTone}`,
    caseNoteInput.value.trim() ? `案例备注：${caseNoteInput.value.trim()}` : "案例备注：待补充",
    "",
    "二、四柱结构",
    `年柱：${pillars.year.text}，天干${pillars.year.stem}${pillars.year.stemElement}为${pillars.year.tenGod}，地支${pillars.year.branch}${pillars.year.branchElement}为${pillars.year.branchTenGod}，藏干${hiddenStemLine(pillars.year)}。`,
    `月柱：${pillars.month.text}，天干${pillars.month.stem}${pillars.month.stemElement}为${pillars.month.tenGod}，地支${pillars.month.branch}${pillars.month.branchElement}为${pillars.month.branchTenGod}，藏干${hiddenStemLine(pillars.month)}。`,
    `日柱：${pillars.day.text}，天干${pillars.day.stem}${pillars.day.stemElement}为日主，地支${pillars.day.branch}${pillars.day.branchElement}为${pillars.day.branchTenGod}，藏干${hiddenStemLine(pillars.day)}。`,
    `时柱：${pillars.hour.text}，天干${pillars.hour.stem}${pillars.hour.stemElement}为${pillars.hour.tenGod}，地支${pillars.hour.branch}${pillars.hour.branchElement}为${pillars.hour.branchTenGod}，藏干${hiddenStemLine(pillars.hour)}。`,
    "",
    "三、五行气势与阴阳",
    `五行分布：${elements}。${chart.summary.seasonHint}`,
    `缺失提示：${chart.summary.missingElements.length ? chart.summary.missingElements.join("、") : "五行不见明显全缺"}。此处应结合月令、透干、藏干和合冲后的气势判断，不宜只看数量。`,
    "",
    "三-1、专业研判要点",
    ...professional.lines,
    `十神分组：${professional.tenGods.rankedGroups.map((item) => `${item.group}${item.value.toFixed(1)}`).join("、")}。`,
    `明处十神：${professional.tenGods.visible.join("、") || "无明显透出"}。`,
    "",
    "四、做工路径",
    "盲派做工先看十神在天干是否透出、在地支是否有根，再看谁生谁、谁克谁、谁被合走、谁被冲动。当前盘面可重点围绕月柱环境、日支配偶宫、时柱后续发挥来校准。",
    relationLine(chart),
    "",
    "五、神煞辅助",
    `本命神煞：${shensha}。神煞只作辅助取象，不单独作为结论。`,
    "",
    "六、咨询验证点",
    buildVerificationChecklist(chart).split("\n").slice(1).join("\n"),
    "",
    "七、咨询师修订",
    "此处填写人工判断、客户反馈、应期验证和最终交付话术。",
  ].join("\n");
}

function reportQualityChecks(draft) {
  const text = String(draft || "");
  return [
    { label: "命盘信息", done: text.includes("一、命盘信息") && text.includes("四柱：") },
    { label: "专业研判", done: text.includes("专业研判要点") },
    { label: "做工路径", done: text.includes("四、做工路径") },
    { label: "验证点", done: text.includes("咨询验证点") },
    { label: "人工修订", done: text.includes("咨询师修订") },
  ];
}

function reportFileName() {
  const base = currentChart ? (currentChart.input.name || chartSignature(currentChart).replace(/\s+/g, "")) : "bazi-report";
  return `${base}-${new Date().toISOString().slice(0, 10)}.txt`;
}

function renderReportsModule() {
  const hasChart = Boolean(currentChart);
  const reports = getReports();
  const latestReports = reports.slice(0, 5);
  const draft = currentReportDraft;
  const qualityChecks = reportQualityChecks(draft);
  const qualityDone = qualityChecks.filter((item) => item.done).length;
  const sections = [
    ["命盘摘要", hasChart ? `${currentChart.pillars.year.text} ${currentChart.pillars.month.text} ${currentChart.pillars.day.text} ${currentChart.pillars.hour.text}` : "等待生成命盘"],
    ["结构分析", "日主、月令、五行气势、寒暖燥湿"],
    ["做工路径", "十神透藏、合冲刑害、用事链条"],
    ["验证清单", "性格、学历、出身、事业、婚恋"],
    ["整理版本", "咨询师修订后保存为可复用文本"],
  ];
  const content = `
    <section class="module-card">
      <div class="panel-heading">
        <h2>报告整理台</h2>
        <span>${hasChart ? "可生成底稿" : "先排盘"}</span>
      </div>
      <div class="report-outline">
        ${sections.map(([title, text], index) => `
          <article>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>${title}</strong>
              <p>${text}</p>
            </div>
          </article>
        `).join("")}
      </div>
      <div class="report-actions">
        <button type="button" data-action="generate-report" ${hasChart ? "" : "disabled"}>${draft ? "重新生成底稿" : "生成报告底稿"}</button>
        <button class="secondary" type="button" data-action="save-report" ${draft ? "" : "disabled"}>保存版本</button>
        <button class="secondary" type="button" data-action="copy-report" ${draft ? "" : "disabled"}>复制报告</button>
        <button class="secondary" type="button" data-action="export-report" ${draft ? "" : "disabled"}>导出文本</button>
      </div>
    </section>
    ${draft ? `
      <section class="module-card">
        <div class="panel-heading">
          <h2>报告质检</h2>
          <span>${qualityDone}/${qualityChecks.length}</span>
        </div>
        <div class="quality-list">
          ${qualityChecks.map((item) => `<span class="${item.done ? "done" : ""}"><i></i>${item.label}</span>`).join("")}
        </div>
      </section>
      <section class="module-card">
        <div class="panel-heading">
          <h2>可编辑报告底稿</h2>
          <span>${draft.length} 字符</span>
        </div>
        <textarea class="report-editor" data-report-editor>${escapeHtml(draft)}</textarea>
      </section>
    ` : ""}
    <section class="module-card">
      <div class="panel-heading">
        <h2>报告版本</h2>
        <span>${reports.length}</span>
      </div>
      <div class="report-version-list">
        ${latestReports.length ? latestReports.map((item) => `
          <article>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.pillars)} · ${new Date(item.savedAt).toLocaleString("zh-CN")}</span>
            </div>
            <div class="template-actions">
              <button class="secondary" type="button" data-action="load-report" data-id="${item.id}">载入</button>
              <button class="secondary" type="button" data-action="delete-report" data-id="${item.id}">删除</button>
            </div>
          </article>
        `).join("") : `<p class="muted-copy">暂无报告版本。生成底稿并保存后会出现在这里。</p>`}
      </div>
    </section>
    <section class="module-grid-panel">
      <article><strong>模板管理</strong><span>不同场景对应不同报告模板</span></article>
      <article><strong>人工校准</strong><span>AI初稿必须经过咨询师确认</span></article>
      <article><strong>版本记录</strong><span>保存每次整理后的版本和时间</span></article>
    </section>
  `;
  renderModuleShell("报告中心", "把排盘结果整理成清晰、可修订、便于复盘的咨询记录。", content);
}

function renderKnowledgeModule() {
  const cards = [
    ["盲派做工", "十神透藏、制化、做事链条、宫位取象"],
    ["阴阳法", "寒暖燥湿、阴阳偏枯、气势流通"],
    ["十神模板", "比劫、印星、食伤、财星、官杀断语库"],
    ["作用关系", "天干五合四冲、地支六合六冲刑害破"],
    ["神煞规则", "贵人、桃花、驿马、华盖、空亡等辅助象"],
    ["验证话术", "来访者可核对的问题清单和追问路径"],
  ];
  const templates = getKnowledgeTemplates();
  const categories = [...new Set(templates.map((item) => item.category))];
  const content = `
    <section class="knowledge-grid">
      ${cards.map(([title, text]) => `
        <article>
          <strong>${title}</strong>
          <p>${text}</p>
          <button class="secondary" type="button" data-action="prefill-knowledge" data-category="${escapeHtml(title)}">写入模板</button>
        </article>
      `).join("")}
    </section>
    <section class="module-card">
      <div class="panel-heading">
        <h2>断语模板库</h2>
        <span>${templates.length}</span>
      </div>
      <div class="knowledge-editor">
        <input data-knowledge-title type="text" placeholder="模板标题" />
        <input data-knowledge-category type="text" placeholder="分类，例如：盲派做工" />
        <textarea data-knowledge-content placeholder="写入你的断语、验证问题或分析规则"></textarea>
        <button type="button" data-action="save-knowledge-template">保存模板</button>
      </div>
      <div class="tag-filter-row">
        ${categories.map((category) => `<span>${escapeHtml(category)}</span>`).join("")}
      </div>
      <div class="knowledge-template-list">
        ${templates.map((item) => `
          <article>
            <div>
              <span>${escapeHtml(item.category)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.content)}</p>
            </div>
            <div class="template-actions">
              <button class="secondary" type="button" data-action="copy-knowledge-template" data-id="${escapeHtml(item.id)}">复制</button>
              <button class="secondary" type="button" data-action="append-knowledge-note" data-id="${escapeHtml(item.id)}">加入备注</button>
              <button class="secondary" type="button" data-action="delete-knowledge-template" data-id="${escapeHtml(item.id)}">删除</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
  renderModuleShell("知识库", "把理论、断语、验证经验沉淀成可复用内容，让每次服务更稳定。", content);
}

function renderSettingsModule() {
  const settings = getBusinessSettings();
  const content = `
    <section class="module-grid-panel">
      <article><strong>AI辅助</strong><span>模型、提示词版本、回复风格</span></article>
      <article><strong>排盘规则</strong><span>真太阳时、子时换日、神煞取法、流派偏好</span></article>
      <article><strong>服务偏好</strong><span>报告语气、跟进周期、交付方式</span></article>
      <article><strong>数据安全</strong><span>隐私提醒、备份导出、设备迁移</span></article>
    </section>
    <section class="module-card">
      <div class="panel-heading">
        <h2>使用偏好</h2>
        <span>本地保存</span>
      </div>
      <div class="settings-form">
        <label>
          <span>工作台名称</span>
          <input data-setting="appName" type="text" value="${escapeHtml(settings.appName)}" />
        </label>
        <label>
          <span>AI模型</span>
          <input data-setting="aiModel" type="text" value="${escapeHtml(settings.aiModel)}" />
        </label>
        <label>
          <span>报告语气</span>
          <input data-setting="reportTone" type="text" value="${escapeHtml(settings.reportTone || defaultBusinessSettings().reportTone)}" />
        </label>
        <label>
          <span>复盘提醒天数</span>
          <input data-setting="reviewReminderDays" type="number" min="0" value="${settings.reviewReminderDays ?? defaultBusinessSettings().reviewReminderDays}" />
        </label>
        <label>
          <span>常用记录数量</span>
          <input data-setting="freeQuota" type="number" min="0" value="${settings.freeQuota}" />
        </label>
        <label>
          <span>整理方式</span>
          <input data-setting="deliveryMode" type="text" value="${escapeHtml(settings.deliveryMode)}" />
        </label>
        <label class="switch-row settings-switch">
          <input data-setting="ziHourDefault" type="checkbox" ${settings.ziHourDefault ? "checked" : ""} />
          <span>默认按 23 点子时换日</span>
        </label>
        <label class="switch-row settings-switch">
          <input data-setting="trueSolarTime" type="checkbox" ${settings.trueSolarTime ? "checked" : ""} />
          <span>真太阳时开关预留</span>
        </label>
      </div>
      <div class="report-actions">
        <button type="button" data-action="save-business-settings">保存配置</button>
        <button class="secondary" type="button" data-action="reset-business-settings">恢复默认</button>
      </div>
    </section>
    <section class="module-card">
      <h2>体验建议</h2>
      <p>先把案例记录、报告整理和知识库维护好，再考虑账号、云端同步和多人协作。服务体验稳定，比功能堆叠更重要。</p>
    </section>
    <section class="module-card" data-backup-section>
      <div class="panel-heading">
        <h2>数据备份</h2>
        <span>本地迁移</span>
      </div>
      <p>当前版本的数据保存在本机浏览器。可以用备份文件迁移案例、报告、知识库和配置。</p>
      <div class="report-actions">
        <button type="button" data-action="export-local-backup">导出本地数据</button>
        <button class="secondary" type="button" data-action="import-local-backup">导入备份文件</button>
      </div>
      <input data-backup-file type="file" accept="application/json" hidden />
    </section>
  `;
  renderModuleShell("系统设置", "管理排盘规则、AI辅助、记录方式和数据备份，让长期使用更稳。", content);
}

function updateNav() {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.module === activeModule);
  });
}

function renderWorkbench() {
  if (currentChart) {
    renderChart(currentChart);
    return;
  }
  chartView.classList.add("empty-state");
  chartView.classList.remove("chart-content");
  chartView.innerHTML = initialChartViewHtml;
}

function renderActiveModule() {
  updateNav();
  if (activeModule === "workbench") renderWorkbench();
  if (activeModule === "cases") renderCasesModule();
  if (activeModule === "reports") renderReportsModule();
  if (activeModule === "knowledge") renderKnowledgeModule();
  if (activeModule === "settings") renderSettingsModule();
}

function setActiveModule(module) {
  activeModule = module;
  renderActiveModule();
}

function renderWorkflowPanel() {
  const steps = [
    ["建档", "输入与保存"],
    ["排盘", "四柱流运"],
    ["核验", "关系神煞"],
    ["初析", "AI底稿"],
    ["校准", "人工修订"],
    ["交付", "报告导出"],
  ];

  return `
    <section class="business-panel">
      <div class="panel-heading">
        <h2>咨询流程</h2>
        <span>轻量闭环</span>
      </div>
      <div class="workflow-steps">
        ${steps.map(([name, meta]) => `
          <div>
            <strong>${name}</strong>
            <span>${meta}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function shouldUsePlainAiMode() {
  return window.matchMedia("(max-width: 900px)").matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function fetchPlainAiReply(requestBody) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "AI回复失败。");
  return data.reply || data.analysis || "";
}

async function sendAiMessage(content, { reset = false, showUser = true, localFirst = false } = {}) {
  if (!currentChart || aiState === "loading") return;
  const question = content.trim();
  if (!question) return;

  const visibleMessages = reset ? [] : [...aiMessages];
  if (showUser) visibleMessages.push({ role: "user", content: question });
  const requestMessages = showUser ? visibleMessages : [...visibleMessages, { role: "user", content: question }];
  aiMessages = visibleMessages;
  aiState = "loading";
  clearError();
  renderChart(currentChart);

  try {
    const assistantMessage = { role: "assistant", content: "" };
    aiMessages = [...visibleMessages];
    const requestBody = {
      chart: buildAiPayload(currentChart),
      messages: requestMessages,
      localFirst,
    };
    let reply = "";

    if (localFirst || shouldUsePlainAiMode()) {
      reply = await fetchPlainAiReply(requestBody);
    } else {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestBody,
            stream: true,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "AI回复失败。");
        }
        if (!response.body || !response.body.getReader) {
          throw new Error("当前浏览器不支持流式显示。");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lastRender = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply += decoder.decode(value, { stream: true });
          assistantMessage.content = reply;
          if (!aiMessages.includes(assistantMessage)) aiMessages = [...visibleMessages, assistantMessage];
          const now = performance.now();
          if (now - lastRender > 120) {
            lastRender = now;
            renderChart(currentChart);
          }
        }
      } catch (streamError) {
        if (reply.trim()) {
          assistantMessage.content = reply;
          if (!aiMessages.includes(assistantMessage)) aiMessages = [...visibleMessages, assistantMessage];
        } else {
          assistantMessage.content = "正在切换兼容模式重试...";
          aiMessages = [...visibleMessages, assistantMessage];
          renderChart(currentChart);
          reply = await fetchPlainAiReply(requestBody);
        }
      }
    }

    if (!reply.trim()) {
      assistantMessage.content = "正在切换兼容模式重试...";
      aiMessages = [...visibleMessages, assistantMessage];
      renderChart(currentChart);
      reply = await fetchPlainAiReply(requestBody);
    }

    assistantMessage.content = reply.trim() || "AI暂时没有返回内容，请重新发送一次。";
    if (!aiMessages.includes(assistantMessage)) aiMessages = [...visibleMessages, assistantMessage];
    aiState = "done";
  } catch (error) {
    aiMessages = [...visibleMessages, { role: "assistant", content: error.message || "AI回复失败。" }];
    aiState = "error";
  }

  renderChart(currentChart);
}

function renderElementBars(summary) {
  const max = Math.max(...Object.values(summary.elements));
  return baziMeta.ELEMENTS.map((element) => {
    const value = summary.elements[element];
    const width = max ? Math.round((value / max) * 100) : 0;
    return `
      <div class="element-row">
        <span>${element}</span>
        <div class="bar"><i style="width:${width}%"></i></div>
        <strong>${value.toFixed(1)}</strong>
      </div>
    `;
  }).join("");
}

function renderFlowPicker(chart) {
  const { luck, year } = getSelectedFlow(chart);
  if (!luck || !year) {
    return `
      <section class="flow-picker">
        <span class="eyebrow">流运选择</span>
        <p>填写性别后可选择大运、流年、流月。</p>
      </section>
    `;
  }

  const luckButtons = chart.majorLuck.cycles.map((item, index) =>
    `<button class="flow-choice ${selection.luckIndex === index ? "active" : ""}" type="button" data-action="select-luck" data-index="${index}">
      ${coloredPillarWithTenGod(item)}<span>${item.ageRange}</span><small>${item.yearRange}</small>
    </button>`
  ).join("");
  const yearButtons = luck.years.map((item, index) =>
    `<button class="flow-choice ${selection.yearIndex === index ? "active" : ""}" type="button" data-action="select-year" data-index="${index}">
      ${coloredPillarWithTenGod(item)}<span>${item.year}</span>
    </button>`
  ).join("");
  const monthButtons = year.months.map((item, index) =>
    `<button class="flow-choice ${selection.monthIndex === index ? "active" : ""}" type="button" data-action="select-month-quick" data-index="${index}">
      ${coloredPillarWithTenGod(item)}<span>${item.name}${item.branchMonth}</span><small>${item.startDate.slice(5)}</small>
    </button>`
  ).join("");

  return `
    <section class="flow-picker">
      <div class="flow-choice-row">
        <span>大运</span>
        <div>${luckButtons}</div>
      </div>
      <div class="flow-choice-row">
        <span>流年</span>
        <div>${yearButtons}</div>
      </div>
      <div class="flow-choice-row">
        <span>流月</span>
        <div>${monthButtons}</div>
      </div>
    </section>
  `;
}

function renderChart(chart) {
  chartView.classList.remove("empty-state");
  chartView.classList.add("chart-content");
  chartView.innerHTML = `
    <section class="summary-band">
      <div>
        <span class="eyebrow">${chart.input.name ? chart.input.name : "日主"}</span>
        <strong>${chart.dayMaster.stem}</strong>
        <small>${chart.dayMaster.polarity}${chart.dayMaster.element}</small>
      </div>
      <div>
        <span class="eyebrow">四柱</span>
        <strong>${chart.pillars.year.text} ${chart.pillars.month.text} ${chart.pillars.day.text} ${chart.pillars.hour.text}</strong>
        <small>${chart.solarTime.birthLocal}</small>
      </div>
      <div>
        <span class="eyebrow">月令</span>
        <strong>${chart.solarTerms.monthBoundary.name}</strong>
        <small>${chart.solarTerms.monthBoundary.localTime}</small>
      </div>
    </section>
    ${renderPillarTable(chart.pillars, chart)}
    ${renderFlowPicker(chart)}
    ${renderRelations(chart)}
    ${renderConsultationPanel(chart)}
    ${renderWorkflowPanel()}
    ${renderAiPanel()}
    <section class="lower-grid">
      <div class="panel">
        <h2>五行分布</h2>
        ${renderElementBars(chart.summary)}
        <p class="hint">${chart.summary.seasonHint}</p>
      </div>
      <div class="panel">
        <h2>排盘说明</h2>
        <p>${chart.note}</p>
        <p>年界：${chart.solarTerms.yearBoundary.name} ${chart.solarTerms.yearBoundary.localTime}</p>
        <p>日柱日期：${chart.solarTime.dayPillarDate}</p>
        <p>大运方向：${chart.majorLuck.direction.text}（${chart.majorLuck.direction.rule}）</p>
        <p>起运：${chart.majorLuck.start ? `${chart.majorLuck.start.label}，参考节气「${chart.majorLuck.start.boundaryName}」${chart.majorLuck.start.boundaryTime}` : "填写性别后可估算"}</p>
      </div>
    </section>
  `;
  copyButton.disabled = false;
  saveCaseButton.disabled = false;
}

function focusChartOnSmallScreen() {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  document.querySelector(".result-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showError(message) {
  errorView.textContent = message;
  errorView.hidden = false;
}

function clearError() {
  errorView.hidden = true;
  errorView.textContent = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearError();
  const payload = getFormPayload();
  const datetime = payload.birthDatetime;
  if (!datetime) {
    showError("请先填写出生日期和时间。");
    return;
  }

  try {
    openChartFromPayload(payload);
  } catch (error) {
    showError(error.message || "排盘失败，请检查输入。");
  }
});

form.addEventListener("input", (event) => {
  if (event.target.closest("#birth-datetime, #lunar-date-row")) renderDateHint();
});

form.addEventListener("change", (event) => {
  if (event.target === dateMode) renderDateMode();
  if (event.target.closest("#birth-datetime, #lunar-date-row")) renderDateHint();
});

chartView.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action === "use-demo-chart") {
    caseNoteInput.value = "";
    caseTagsInput.value = "";
    currentReportDraft = "";
    openChartFromPayload(DEMO_PAYLOAD);
    return;
  }

  if (button.dataset.action === "use-current-chart") {
    setDefaultDateTime();
    currentReportDraft = "";
    form.requestSubmit();
    return;
  }

  if (button.dataset.action === "load-module-case") {
    const item = getCases().find((entry) => entry.id === button.dataset.id);
    if (!item) return;
    caseNoteInput.value = item.note || "";
    caseTagsInput.value = (item.tags || []).join(", ");
    openChartFromPayload(item.payload, { caseId: item.id });
    return;
  }

  if (button.dataset.action === "mark-case-reviewed") {
    markCaseReviewed(button.dataset.id);
    return;
  }

  if (button.dataset.action === "copy-case-summary") {
    const item = getCases().find((entry) => entry.id === button.dataset.id);
    if (!item) return;
    navigator.clipboard.writeText(buildCaseSummaryText(item));
    button.textContent = "已复制";
    setTimeout(() => {
      if (activeModule === "cases") renderCasesModule();
    }, 900);
    return;
  }

  if (button.dataset.action === "clear-case-search") {
    caseQuery = "";
    renderCasesModule();
    return;
  }

  if (button.dataset.action === "filter-case-tag") {
    caseQuery = button.dataset.tag || "";
    renderCasesModule();
    return;
  }

  if (button.dataset.action === "generate-report") {
    if (!currentChart) return;
    currentReportDraft = buildReportDraft(currentChart);
    renderReportsModule();
    return;
  }

  if (button.dataset.action === "save-report") {
    if (!currentChart || !currentReportDraft.trim()) return;
    const reports = getReports();
    reports.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: currentChart.input.name ? `${currentChart.input.name} 分析报告` : `${chartSignature(currentChart)} 分析报告`,
      pillars: chartSignature(currentChart),
      content: currentReportDraft,
      savedAt: new Date().toISOString(),
    });
    setReports(reports.slice(0, 120));
    renderReportsModule();
    return;
  }

  if (button.dataset.action === "copy-report") {
    if (!currentReportDraft.trim()) return;
    navigator.clipboard.writeText(currentReportDraft);
    button.textContent = "已复制";
    setTimeout(() => {
      if (activeModule === "reports") renderReportsModule();
    }, 900);
    return;
  }

  if (button.dataset.action === "export-report") {
    if (!currentReportDraft.trim()) return;
    downloadTextFile(reportFileName(), currentReportDraft);
    return;
  }

  if (button.dataset.action === "load-report") {
    const report = getReports().find((item) => item.id === button.dataset.id);
    if (!report) return;
    currentReportDraft = report.content || "";
    renderReportsModule();
    return;
  }

  if (button.dataset.action === "delete-report") {
    setReports(getReports().filter((item) => item.id !== button.dataset.id));
    renderReportsModule();
    return;
  }

  if (button.dataset.action === "prefill-knowledge") {
    const category = button.dataset.category || "";
    const titleInput = chartView.querySelector("[data-knowledge-title]");
    const categoryInput = chartView.querySelector("[data-knowledge-category]");
    const contentInput = chartView.querySelector("[data-knowledge-content]");
    if (titleInput && categoryInput && contentInput) {
      titleInput.value = `${category}模板`;
      categoryInput.value = category;
      contentInput.value = "";
      contentInput.focus();
    }
    return;
  }

  if (button.dataset.action === "save-knowledge-template") {
    const title = chartView.querySelector("[data-knowledge-title]")?.value.trim();
    const category = chartView.querySelector("[data-knowledge-category]")?.value.trim();
    const content = chartView.querySelector("[data-knowledge-content]")?.value.trim();
    if (!title || !category || !content) return;
    const templates = getKnowledgeTemplates();
    templates.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      category,
      content,
    });
    setKnowledgeTemplates(templates.slice(0, 160));
    renderKnowledgeModule();
    return;
  }

  if (button.dataset.action === "delete-knowledge-template") {
    const id = button.dataset.id;
    const templates = getKnowledgeTemplates().filter((item) => item.id !== id);
    setKnowledgeTemplates(templates.length ? templates : defaultKnowledgeTemplates());
    renderKnowledgeModule();
    return;
  }

  if (button.dataset.action === "copy-knowledge-template") {
    const item = getKnowledgeTemplates().find((entry) => entry.id === button.dataset.id);
    if (!item) return;
    navigator.clipboard.writeText(`${item.title}\n${item.content}`);
    button.textContent = "已复制";
    setTimeout(() => {
      if (activeModule === "knowledge") renderKnowledgeModule();
    }, 900);
    return;
  }

  if (button.dataset.action === "append-knowledge-note") {
    const item = getKnowledgeTemplates().find((entry) => entry.id === button.dataset.id);
    if (!item) return;
    const block = `【${item.category}｜${item.title}】\n${item.content}`;
    caseNoteInput.value = caseNoteInput.value.trim()
      ? `${caseNoteInput.value.trim()}\n\n${block}`
      : block;
    button.textContent = "已加入";
    setTimeout(() => {
      if (activeModule === "knowledge") renderKnowledgeModule();
    }, 900);
    return;
  }

  if (button.dataset.action === "save-business-settings") {
    const settings = { ...getBusinessSettings() };
    chartView.querySelectorAll("[data-setting]").forEach((field) => {
      const key = field.dataset.setting;
      if (field.type === "checkbox") {
        settings[key] = field.checked;
      } else if (field.type === "number") {
        settings[key] = Number(field.value || 0);
      } else {
        settings[key] = field.value.trim();
      }
    });
    setBusinessSettings(settings);
    applyBusinessSettings();
    renderSettingsModule();
    return;
  }

  if (button.dataset.action === "reset-business-settings") {
    setBusinessSettings(defaultBusinessSettings());
    applyBusinessSettings();
    renderSettingsModule();
    return;
  }

  if (button.dataset.action === "export-local-backup") {
    const backup = buildLocalBackup();
    downloadTextFile(`bazi-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    return;
  }

  if (button.dataset.action === "import-local-backup") {
    chartView.querySelector("[data-backup-file]")?.click();
    return;
  }

  if (!currentChart) return;

  if (button.dataset.action === "save-case-inline") {
    saveCaseButton.click();
    return;
  }

  if (button.dataset.action === "generate-report-inline") {
    currentReportDraft = buildReportDraft(currentChart);
    setActiveModule("reports");
    return;
  }

  if (button.dataset.action === "copy-consultation-summary") {
    navigator.clipboard.writeText(buildConsultationSummary(currentChart));
    button.textContent = "已复制";
    setTimeout(() => {
      if (activeModule === "workbench") renderChart(currentChart);
    }, 900);
    return;
  }

  if (button.dataset.action === "copy-verification-checklist") {
    navigator.clipboard.writeText(buildVerificationChecklist(currentChart));
    button.textContent = "已复制";
    setTimeout(() => {
      if (activeModule === "workbench") renderChart(currentChart);
    }, 900);
    return;
  }

  if (button.dataset.action === "fill-note-template") {
    const template = buildCaseNoteTemplate(currentChart);
    caseNoteInput.value = caseNoteInput.value.trim()
      ? `${caseNoteInput.value.trim()}\n\n${template}`
      : template;
    caseNoteInput.focus();
    renderChart(currentChart);
    return;
  }

  if (button.dataset.action === "go-cases") {
    setActiveModule("cases");
    return;
  }

  if (button.dataset.action === "clear-ai-chat") {
    aiState = "idle";
    aiMessages = [];
    renderChart(currentChart);
    return;
  }

  if (button.dataset.action === "start-ai-chat") {
    sendAiMessage("请严格按排盘数据分析，不要输出核对过程。以盲派做工角度和阴阳法为主，对本命八字做一版完整初始分析，重点写命局气势、做工路径、性格、学历学习、出身家庭、事业财性、婚恋倾向和可验证点。不要分析当前选择的大运、流年、流月。", { reset: true, showUser: false, localFirst: true });
    return;
  }

  if (!["select-luck", "select-year", "select-month", "select-month-quick"].includes(button.dataset.action)) return;

  const index = Number(button.dataset.index);
  if (button.dataset.action === "select-luck") {
    selection = { luckIndex: index, yearIndex: 0, monthIndex: 0 };
  }
  if (button.dataset.action === "select-year") {
    selection = { ...selection, yearIndex: index, monthIndex: 0 };
  }
  if (button.dataset.action === "select-month") {
    selection = {
      ...selection,
      yearIndex: Number(button.dataset.yearIndex),
      monthIndex: index,
    };
  }
  if (button.dataset.action === "select-month-quick") {
    selection = { ...selection, monthIndex: index };
  }
  aiState = "idle";
  aiMessages = [];
  renderChart(currentChart);
});

chartView.addEventListener("submit", (event) => {
  const chatForm = event.target.closest("[data-ai-chat-form]");
  if (!chatForm) return;
  event.preventDefault();
  const input = chatForm.elements.aiQuestion;
  sendAiMessage(input.value);
});

chartView.addEventListener("input", (event) => {
  if (event.target.matches("[data-case-search]")) {
    caseQuery = event.target.value;
    renderCasesModule();
    return;
  }

  if (event.target.matches("[data-report-editor]")) {
    currentReportDraft = event.target.value;
  }
});

chartView.addEventListener("change", async (event) => {
  if (!event.target.matches("[data-backup-file]")) return;
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const ok = window.confirm("导入备份会覆盖当前本地案例、报告、知识库和配置，确认继续吗？");
    if (!ok) return;
    restoreLocalBackup(data);
    currentReportDraft = "";
    renderActiveModule();
  } catch (error) {
    showError(error.message || "导入失败，请检查备份文件。");
  }
});

copyButton.addEventListener("click", async () => {
  if (!currentChart) return;
  await navigator.clipboard.writeText(JSON.stringify(currentChart, null, 2));
  copyButton.textContent = "已复制";
  setTimeout(() => {
    copyButton.textContent = "复制排盘数据";
  }, 1400);
});
nowButton.addEventListener("click", setDefaultDateTime);

saveCaseButton.addEventListener("click", () => {
  if (!currentChart) return;
  const payload = getFormPayload();
  const title = payload.personName || `${currentChart.pillars.year.text}${currentChart.pillars.month.text}${currentChart.pillars.day.text}${currentChart.pillars.hour.text}`;
  const cases = getCases();
  const now = new Date().toISOString();
  const reviewAt = addDays(new Date(), getBusinessSettings().reviewReminderDays).toISOString();
  const pillars = `${currentChart.pillars.year.text} ${currentChart.pillars.month.text} ${currentChart.pillars.day.text} ${currentChart.pillars.hour.text}`;
  const existingIndex = activeCaseId
    ? cases.findIndex((item) => item.id === activeCaseId)
    : cases.findIndex((item) => item.pillars === pillars
      && item.payload?.birthDatetime === payload.birthDatetime
      && (item.payload?.personName || "") === (payload.personName || ""));
  const existing = existingIndex >= 0 ? cases[existingIndex] : null;
  const entry = {
    ...existing,
    id: existing?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    note: caseNoteInput.value.trim(),
    tags: parseTags(caseTagsInput.value),
    payload,
    pillars,
    savedAt: existing?.savedAt || now,
    updatedAt: now,
    reviewAt: existing?.reviewAt || reviewAt,
  };
  if (existingIndex >= 0) cases.splice(existingIndex, 1);
  cases.unshift(entry);
  activeCaseId = entry.id;
  setCases(cases.slice(0, 80));
  renderCaseList();
  if (activeModule === "cases") renderCasesModule();
  if (activeModule === "workbench") renderChart(currentChart);
  saveCaseButton.textContent = existing ? "已更新" : "已保存";
  setTimeout(() => {
    saveCaseButton.textContent = "保存案例";
  }, 1200);
});

caseList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-case-action]");
  if (!button) return;

  const cases = getCases();
  const item = cases.find((entry) => entry.id === button.dataset.id);

  if (button.dataset.caseAction === "delete") {
    setCases(cases.filter((entry) => entry.id !== button.dataset.id));
    if (activeCaseId === button.dataset.id) activeCaseId = "";
    renderCaseList();
    if (activeModule === "cases") renderCasesModule();
    return;
  }

  if (item && button.dataset.caseAction === "load") {
    caseNoteInput.value = item.note || "";
    caseTagsInput.value = (item.tags || []).join(", ");
    openChartFromPayload(item.payload, { caseId: item.id });
  }
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveModule(button.dataset.module);
  });
});

backupShortcut?.addEventListener("click", () => {
  setActiveModule("settings");
  setTimeout(() => {
    chartView.querySelector("[data-backup-section]")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
});

fillLunarDays();
setDefaultDateTime();
applyBusinessSettings();
renderDateMode();
renderCaseList();
