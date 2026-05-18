import { calculateBazi, baziMeta } from "./bazi.js";

const form = document.querySelector("#bazi-form");
const nowButton = document.querySelector("#fill-now");
const chartView = document.querySelector("#chart-view");
const copyButton = document.querySelector("#copy-button");
const saveCaseButton = document.querySelector("#save-case-button");
const caseNoteInput = document.querySelector("#case-note");
const caseList = document.querySelector("#case-list");
const caseCount = document.querySelector("#case-count");
const errorView = document.querySelector("#error-view");

const CASE_STORAGE_KEY = "bazi-cases";
let currentChart = null;
let selection = { luckIndex: 0, yearIndex: 0, monthIndex: 0 };

function setDefaultDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  document.querySelector("#birth-datetime").value = local.toISOString().slice(0, 16);
}

function parseDateTime(value) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { year, month, day, hour, minute };
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
  return {
    personName: String(data.get("personName") || ""),
    gender: String(data.get("gender") || "unknown"),
    birthDatetime: String(data.get("birthDatetime") || ""),
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
  form.elements.birthDatetime.value = payload.birthDatetime || "";
  form.elements.timezone.value = String(payload.timezone ?? 480);
  form.elements.ziHour.checked = payload.ziHour !== false;
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
    zodiac: "",
    tenGod: item.tenGod || "-",
    hiddenStems: [],
    nayin: item.nayin,
    shensha: item.shensha || [],
    extra,
  };
}

function renderPillarTable(pillars, chart) {
  const { luck, year, month } = getSelectedFlow(chart);
  const entries = [
    ...Object.values(pillars),
    flowAsColumn(luck, "大运", luck?.yearRange || ""),
    flowAsColumn(year, "流年", year ? String(year.year) : ""),
    flowAsColumn(month, "流月", month ? `${month.name}${month.branchMonth}` : ""),
  ].filter(Boolean);
  const labels = entries.map((pillar) => `<th>${pillar.label}${pillar.extra ? `<small>${pillar.extra}</small>` : ""}</th>`).join("");
  const stems = entries.map((pillar) => `<td>${coloredStem(pillar)}<small>${pillar.stemPolarity}${pillar.stemElement || ""}</small></td>`).join("");
  const branches = entries.map((pillar) => `<td>${coloredBranch(pillar)}<small>${pillar.branchElement || ""}${pillar.zodiac}</small></td>`).join("");
  const tenGods = entries.map((pillar) => `<td>${pillar.tenGod}</td>`).join("");
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
          <tr><th>十神</th>${tenGods}</tr>
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

function renderTenGodNotes(notes) {
  return Object.entries(notes)
    .filter(([name]) => name !== "日主")
    .map(([name, text]) => `<article><strong>${name}</strong><p>${text}</p></article>`)
    .join("");
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
      ${coloredPillar(item)}<span>${item.ageRange}</span><small>${item.yearRange}</small>
    </button>`
  ).join("");
  const yearButtons = luck.years.map((item, index) =>
    `<button class="flow-choice ${selection.yearIndex === index ? "active" : ""}" type="button" data-action="select-year" data-index="${index}">
      ${coloredPillar(item)}<span>${item.year}</span><small>${item.tenGod || ""}</small>
    </button>`
  ).join("");
  const monthButtons = year.months.map((item, index) =>
    `<button class="flow-choice ${selection.monthIndex === index ? "active" : ""}" type="button" data-action="select-month-quick" data-index="${index}">
      ${coloredPillar(item)}<span>${item.name}${item.branchMonth}</span><small>${item.startDate.slice(5)}</small>
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

function renderNatalShensha(chart) {
  const rows = chart.shensha.natal.length
    ? chart.shensha.natal.map((item) => `
        <article>
          <strong>${item.name}</strong>
          <span>${item.at} ${item.branch} · ${item.source}</span>
          <p>${item.note}</p>
        </article>
      `).join("")
    : `<p>本命四柱未触发当前内置神煞。</p>`;

  return `
    <section class="panel wide-panel">
      <div class="panel-heading">
        <h2>本命神煞</h2>
        <span>空亡 ${chart.shensha.voidBranches.join("、")}</span>
      </div>
      <p>${chart.shensha.ruleNote}</p>
      <div class="shensha-grid">${rows}</div>
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
    ${renderNatalShensha(chart)}
    <section class="panel wide-panel">
      <h2>十神速览</h2>
      <div class="ten-god-grid">${renderTenGodNotes(chart.summary.tenGodNotes)}</div>
    </section>
  `;
  copyButton.disabled = false;
  saveCaseButton.disabled = false;
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
  const data = new FormData(form);
  const datetime = data.get("birthDatetime");
  if (!datetime) {
    showError("请先填写出生日期和时间。");
    return;
  }

  try {
    currentChart = chartFromPayload(getFormPayload());
    selection = { luckIndex: 0, yearIndex: 0, monthIndex: 0 };
    renderChart(currentChart);
  } catch (error) {
    showError(error.message || "排盘失败，请检查输入。");
  }
});

chartView.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || !currentChart) return;

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
  renderChart(currentChart);
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
    renderChart(currentChart);
    clearError();
  }
});

setDefaultDateTime();
renderCaseList();
