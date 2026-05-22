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
const caseList = document.querySelector("#case-list");
const caseCount = document.querySelector("#case-count");
const errorView = document.querySelector("#error-view");

const CASE_STORAGE_KEY = "bazi-cases";
const lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
let currentChart = null;
let selection = { luckIndex: 0, yearIndex: 0, monthIndex: 0 };
let aiState = "idle";
let aiMessages = [];

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

function renderCaseList() {
  const cases = getCases();
  caseCount.textContent = String(cases.length);
  caseList.innerHTML = cases.length
    ? cases.map((item) => `
        <article class="case-card">
          <button type="button" data-case-action="load" data-id="${item.id}">
            <strong>${item.title}</strong>
            <span>${item.pillars} · ${item.payload.birthDatetime.replace("T", " ")}</span>
            ${item.note ? `<p>${item.note}</p>` : ""}
          </button>
          <button class="case-delete" type="button" data-case-action="delete" data-id="${item.id}">删除</button>
        </article>
      `).join("")
    : `<p class="muted-copy">暂无案例。排盘后可保存当前案例。</p>`;
}

function renderShensha(shensha = []) {
  if (!shensha.length) return `<div class="shensha-list muted">-</div>`;
  return `
    <div class="shensha-list">
      ${shensha.map((item) => `<span title="${item.source}：${item.note}">${item.name}</span>`).join("")}
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
        <span>${aiState === "error" ? "请求失败" : "OpenRouter"}</span>
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
    currentChart = chartFromPayload(payload);
    selection = { luckIndex: 0, yearIndex: 0, monthIndex: 0 };
    aiState = "idle";
    aiMessages = [];
    renderChart(currentChart);
    focusChartOnSmallScreen();
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
  if (!button || !currentChart) return;

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
  cases.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    note: caseNoteInput.value.trim(),
    payload,
    pillars: `${currentChart.pillars.year.text} ${currentChart.pillars.month.text} ${currentChart.pillars.day.text} ${currentChart.pillars.hour.text}`,
    savedAt: new Date().toISOString(),
  });
  setCases(cases.slice(0, 80));
  renderCaseList();
  saveCaseButton.textContent = "已保存";
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
    renderCaseList();
    return;
  }

  if (item && button.dataset.caseAction === "load") {
    setFormPayload(item.payload);
    caseNoteInput.value = item.note || "";
    currentChart = chartFromPayload(item.payload);
    selection = { luckIndex: 0, yearIndex: 0, monthIndex: 0 };
    aiState = "idle";
    aiMessages = [];
    renderChart(currentChart);
    focusChartOnSmallScreen();
    clearError();
  }
});

fillLunarDays();
setDefaultDateTime();
renderDateMode();
renderCaseList();
