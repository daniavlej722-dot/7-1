import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");

function loadEnv() {
  try {
    const envText = readFileSync(join(__dirname, ".env"), "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!match) continue;
      const [, key, rawValue] = match;
      const value = rawValue.replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional. The app can also be started with shell env vars.
  }
}

loadEnv();

const port = Number(process.env.PORT || 5173);
const preferredFreeModel = "openai/gpt-oss-120b:free";
const configuredModel = process.env.OPENROUTER_MODEL || preferredFreeModel;
const openRouterModel = configuredModel === "openrouter/free" ? preferredFreeModel : configuredModel;
const fallbackModels = [
  openRouterModel,
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
].filter((model, index, models) => models.indexOf(model) === index);

const baziAnalysisRules = [
  "你是中文八字分析助手，只基于用户提供的排盘数据分析，不能编造现实事实。",
  "basicRules、fourPillars、hiddenStems、tenGod 是硬规则，必须服从。不得自行改天干地支五行、藏干和十神。",
  "天干五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水。阴阳：甲丙戊庚壬阳，乙丁己辛癸阴。",
  "地支五行：寅卯木、巳午火、申酉金、亥子水、辰戌丑未土。藏干以排盘数据为准。",
  "十神必须以日主为中心：生我为印，我生为食伤，克我为官杀，我克为财，同我为比劫，再分正偏。",
  "如果数据中提供 professionalProfile，必须优先参考其中的月令、透干、根气、十神分组和专业要点，不得与其相反。",
  "默认只分析本命四柱，不分析当前选择的大运、流年、流月，除非用户明确追问。",
  "方法以盲派做工和阴阳法为主：看月令气势、寒暖燥湿、透干根气、合冲刑害、十神之间谁生谁克谁制化。",
  "输出必须是中文自然段，标题可用“命局总论、做工与气势、性格学历出身、事业婚恋、可验证点”。",
  "禁止输出内部核对、自查、Markdown 符号、表格、代码块、#、*、-、•、✓、---。",
  "结论要谨慎，用倾向、较易、需要验证等表达。发现数据不足时直说需要现实验证。",
].join("\n");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rawPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const normalizedPath = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    send(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const body = await readFileAsync(filePath);
    res.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    send(res, 404, { error: "Not found" });
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_200_000) {
        req.destroy();
        reject(new Error("请求内容太大。"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("请求格式不是有效 JSON。"));
      }
    });
    req.on("error", reject);
  });
}

function compact(value, maxLength = 16000) {
  const text = JSON.stringify(value, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...内容已截断` : text;
}

function cleanAiText(text = "") {
  return String(text)
    .replace(/^[\s\S]{0,500}?内部核对[:：][\s\S]*?(?=\n\s*(命局总论|总论|阴阳气势|盲派做工|性格|学历|出身|事业|婚恋|可验证点)\s*\n)/, "")
    .replace(/^[\s\S]{0,500}?自查[:：][\s\S]*?(?=\n\s*(命局总论|总论|阴阳气势|盲派做工|性格|学历|出身|事业|婚恋|可验证点)\s*\n)/, "")
    .replace(/^我将.*?(核对|检查).*?\n+/m, "")
    .replace(/^[\s-–—]{3,}$/gm, "")
    .replace(/[✓✔]/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatPillar(pillar = {}) {
  return `${pillar.label || ""}${pillar.pillar || `${pillar.stem || ""}${pillar.branch || ""}`}（天干${pillar.stem || ""}${pillar.stemElement || ""}${pillar.stemTenGod ? `为${pillar.stemTenGod}` : ""}，地支${pillar.branch || ""}${pillar.branchElement || ""}${pillar.branchTenGod ? `为${pillar.branchTenGod}` : ""}）`;
}

function formatRelations(relations = {}) {
  const stems = relations.stems?.length ? relations.stems.join("；") : "天干未见特别强的合冲提示";
  const branches = relations.branches?.length ? relations.branches.join("；") : "地支未见特别强的合冲提示";
  return `天干作用：${stems}。地支作用：${branches}。`;
}

function buildRuleBasedAnalysis(chart = {}) {
  const pillars = chart.fourPillars || {};
  const professional = chart.professionalProfile || {};
  const pillarText = ["year", "month", "day", "hour"].map((key) => formatPillar(pillars[key])).filter(Boolean).join("；");
  const elementText = chart.elements
    ? Object.entries(chart.elements).map(([element, value]) => `${element}${Number(value).toFixed(1)}`).join("、")
    : "五行分布需结合原盘查看";
  const missingText = chart.missingElements?.length ? `缺${chart.missingElements.join("、")}` : "五行不见明显全缺";
  const hiddenText = Object.values(pillars).map((pillar) => {
    const hidden = pillar.hiddenStems?.map((item) => `${item.stem}${item.element}${item.tenGod ? `(${item.tenGod})` : ""}`).join("、") || "无";
    return `${pillar.label || ""}藏干：${hidden}`;
  }).join("；");
  const day = pillars.day || {};
  const month = pillars.month || {};
  const year = pillars.year || {};
  const hour = pillars.hour || {};
  const professionalLines = Array.isArray(professional.lines) && professional.lines.length
    ? professional.lines.join(" ")
    : "专业要点需结合月令、透干、根气、十神分组和作用关系继续校准。";
  const tenGodGroups = Array.isArray(professional.tenGodGroups) && professional.tenGodGroups.length
    ? professional.tenGodGroups.map((item) => `${item.group}${Number(item.value || 0).toFixed(1)}`).join("、")
    : "十神分组待补充";

  return cleanAiText(`
命局总论
本命以${chart.dayMaster || `${day.stem || ""}${day.stemElement || ""}`}为日主，四柱为：${pillarText}。月柱${month.pillar || ""}为命局环境，分析时先看月令气势，再看天干透出与地支根气。五行分布为${elementText}，${missingText}。${chart.seasonHint || ""} 此处为传统命理角度的倾向分析，仍需结合现实验证。

做工与气势
盲派看做工，先看十神在何处透出、何处有根。年柱偏向早年与家庭背景，月柱偏向父母环境、学习规则与社会入口，日柱看自身与配偶宫，时柱看后续发挥与子女晚景。当前盘面中，${year.label || "年柱"}天干为${year.stemTenGod || "-"}，${month.label || "月柱"}天干为${month.stemTenGod || "-"}，日干为${day.stemTenGod || "日主"}，时干为${hour.stemTenGod || "-"}。${hiddenText}。${formatRelations(chart.relations)}这些作用关系是判断做工是否顺畅、是否有冲动破坏的重点。程序结构化研判提示：${professionalLines} 十神分组为${tenGodGroups}。

性格学历出身
性格上先从日主与月令看基本气质，再看比劫、印星、食伤、官杀和财星的组合。若比劫明显，通常自我意识、行动力和竞争心较强；印星明显，多重学习吸收、长辈资源与规则保护；食伤明显，多表达、技术、才艺和想法输出；官杀明显，多压力、规矩、目标感和外部约束；财星明显，多现实感、资源意识与经营欲。学历学习主要看印星、食伤、官杀是否清楚有力，以及月柱环境是否能承载。出身家庭重点看年柱、月柱和印财官的配合，不能单凭一处硬断。

事业婚恋
事业财性看财星、官杀、食伤、印星、比劫之间是否形成可用链条。财星不是单纯等于有钱，重点看财有没有根、有没有被比劫争夺、有没有食伤生财、有没有官杀承接。婚恋看日支配偶宫、财官星和合冲刑害，若日支被冲动或关系星受制，感情上较易有拉扯；若关系星清楚且有生扶，较易形成稳定关系。此处只能看倾向，具体应以经历验证。

可验证点
可先验证三类信息：一是性格上是否有明显的主动性、压力感、表达欲或规则感；二是学习与家庭中是否存在长辈要求、资源支持、早年约束或迁动变化；三是事业上更适合凭专业输出、经营资源、规则平台还是个人行动力来做事。后续可以继续追问某一项，我会围绕同一张盘细化。
`);
}

async function analyzeBazi(req, res) {
  const payload = await readJsonBody(req);
  const chartPayload = payload.chart || payload;
  if (payload.localFirst) {
    const reply = buildRuleBasedAnalysis(chartPayload);
    send(res, 200, {
      analysis: reply,
      reply,
      model: "local-rule-based",
      usage: null,
    });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const reply = `${buildRuleBasedAnalysis(chartPayload)}\n\n当前未配置在线 AI Key，以上为本地规则初析。配置后可以继续进行自由追问。`;
    send(res, 200, {
      analysis: reply,
      reply,
      model: "local-rule-based",
      usage: null,
    });
    return;
  }

  const userMessages = Array.isArray(payload.messages)
    ? payload.messages
      .filter((message) => ["user", "assistant"].includes(message.role) && message.content)
      .slice(-12)
      .map((message) => ({ role: message.role, content: String(message.content).slice(0, 4000) }))
    : [];
  const conversation = userMessages.length
    ? userMessages
    : [{ role: "user", content: "请先对当前排盘做一次完整分析。" }];
  const requestBody = {
    temperature: 0.2,
    max_tokens: 1100,
    stream: false,
    messages: [
      {
        role: "system",
        content: baziAnalysisRules,
      },
      {
        role: "user",
        content: `以下是当前八字排盘数据，后续对话都以这份数据为基础：\n${compact(chartPayload)}`,
      },
      ...conversation,
    ],
  };

  let data = null;
  let usedModel = openRouterModel;
  let lastError = null;

  for (const model of fallbackModels) {
    usedModel = model;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "Bazi Chart AI Analysis",
        },
        body: JSON.stringify({ ...requestBody, model }),
        signal: controller.signal,
      });
      const candidate = await response.json().catch(() => ({}));
      const content = candidate?.choices?.[0]?.message?.content || "";

      if (response.ok && content.trim()) {
        data = candidate;
        break;
      }

      lastError = candidate?.error?.message || candidate?.message || "AI服务请求失败。";
    } catch (error) {
      lastError = error.name === "AbortError" ? "当前免费模型响应超时，已尝试切换备用模型。" : error.message;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!data) {
    send(res, 502, { error: lastError || "AI服务请求失败。" });
    return;
  }
  const reply = cleanAiText(data?.choices?.[0]?.message?.content || "");

  if (payload.stream) {
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    });
    res.end(reply);
    return;
  }

  send(res, 200, {
    analysis: reply,
    reply,
    model: data?.model || usedModel,
    usage: data?.usage || null,
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST" && url.pathname === "/api/analyze") {
      await analyzeBazi(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res);
      return;
    }

    send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    send(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Bazi chart app running at http://localhost:${port}`);
});
