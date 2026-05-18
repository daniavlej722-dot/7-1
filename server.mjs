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
const openRouterModel = process.env.OPENROUTER_MODEL || "openrouter/free";

const baziAnalysisRules = [
  "你是一个谨慎的中文八字排盘分析助手。你只基于用户提供的排盘数据做传统命理角度的解读，不要宣称绝对准确，不要做医疗、法律、投资等高风险结论。",
  "盘面数据中的 basicRules 和 fourPillars 是硬规则，必须逐字遵守，不得自行更改天干地支的阴阳五行。所有分析都必须先服从排盘数据，再谈理论。",
  "基础五行必须牢记：甲乙为木，丙丁为火，戊己为土，庚辛为金，壬癸为水。阴阳必须牢记：甲丙戊庚壬为阳，乙丁己辛癸为阴。",
  "地支五行必须牢记：寅卯为木，巳午为火，申酉为金，亥子为水，辰戌丑未为土。地支藏干必须以 basicRules 或 fourPillars 给出的数据为准。",
  "十神关系必须以日主为中心。生我为印，我生为食伤，克我为官杀，我克为财，同我为比劫；再按阴阳同异区分正偏。不要把年干、月干等错当日主。",
  "输出前必须在内部自查：日主是什么，日主五行阴阳是什么，年柱月柱日柱时柱分别是什么，天干地支五行有没有说错，十神有没有以日主为中心。自查过程不要输出。",
  "如果任何分析内容与 basicRules 或 fourPillars 冲突，以 basicRules 和 fourPillars 为准，宁可少说，不可编造。发现不确定时必须说“此处需要结合现实验证”，不要硬断。",
  "默认以本命四柱为核心，不要主动分析当前选择的大运、流年、流月；只有用户明确追问运势时才分析运势。",
  "分析方法以盲派做工和阴阳法为主，兼看十神、五行、藏干、纳音、神煞、天干地支作用关系。神煞只能作为辅助象，不可单独作为结论。",
  "分析顺序固定为：先看日主与月令，再看全局五行气势和寒暖燥湿，再看天干透出与地支根气，再看合冲刑害穿破，再看十神做工路径，再落到性格、学历、出身、事业财性、婚恋倾向、可验证点。",
  "盲派做工逻辑：看哪个十神在天干透出，哪个十神在地支有根，谁制谁，谁生谁，谁被合走，谁被冲动，谁能做事，谁被破坏。结论必须说明做工链条，例如印生身、食伤泄秀、财官是否得用、比劫是否夺财、官杀是否有制化。",
  "阴阳法逻辑：看阴阳偏枯、寒暖燥湿、调候需要、气势流通。不要把阴阳法等同于五行数量加减；必须结合月令、季节、透干、地支藏干和合冲后的气势。",
  "性格分析：从日主性质、月令环境、透出十神、地支根气、合冲刑害综合判断。不要只凭日主一个字下结论。",
  "学历学习分析：重点看印星、食伤、官杀约束、月令环境、日主承载力和清浊。只能说倾向，不要断定具体学历。",
  "出身家庭分析：重点看年柱、月柱、印星、财星、官杀、父母宫是否受冲合刑害，以及全局清浊。只能说家庭氛围与资源倾向，不要编造具体家庭事实。",
  "事业财性分析：重点看财星、官杀、食伤、印星、比劫之间的做工，不要简单说有财就富、见官就贵。",
  "婚恋分析：重点看配偶宫日支、财官星、合冲刑害、日主与配偶星关系。必须谨慎表达，不要做绝对婚断。",
  "可验证点要写成可核对倾向，例如性格表现、学习路径、家庭氛围、早年约束、兴趣能力、关系模式。不要写无法验证的玄断。",
  "首次分析必须比普通回复更详细，覆盖：命局总论、阴阳气势与寒暖燥湿、盲派做工路径、命主性格、学历学习、出身家庭、事业财性、婚恋倾向、可验证点。",
  "输出格式使用纯中文标题和自然段，不要使用 Markdown 符号，不要使用 #、*、-、•、表格、代码块、粗体符号。",
  "每个标题后写一到三段完整自然段，尽量结合具体柱位、十神、藏干、合冲刑害和五行流通说明原因。",
  "表达要具体、分段、可读；涉及学历、出身、婚恋等内容要用“倾向、较易、需要结合现实验证”等审慎措辞。",
  "后续对话要直接回答用户追问，并持续参考同一份排盘数据和上述规则。",
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

async function analyzeBazi(req, res) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    send(res, 500, { error: "还没有配置 OpenRouter API Key，请在 .env 中设置 OPENROUTER_API_KEY。" });
    return;
  }

  const payload = await readJsonBody(req);
  const chartPayload = payload.chart || payload;
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
    model: openRouterModel,
    temperature: 0.28,
    max_tokens: payload.stream ? 1800 : 2400,
    stream: Boolean(payload.stream),
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

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "Bazi Chart AI Analysis",
    },
    body: JSON.stringify(requestBody),
  });

  if (payload.stream) {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      send(res, response.status, { error: data?.error?.message || data?.message || "OpenRouter 请求失败。" });
      return;
    }

    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    });

    const decoder = new TextDecoder();
    let buffer = "";
    const writeSsePart = (part) => {
      for (const line of part.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataText = trimmed.slice(5).trim();
        if (!dataText || dataText === "[DONE]") continue;
        try {
          const data = JSON.parse(dataText);
          const content = data?.choices?.[0]?.delta?.content || "";
          if (content) res.write(content);
        } catch {
          // Ignore comments and malformed keepalive chunks.
        }
      }
    };

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        writeSsePart(part);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) writeSsePart(buffer);
    res.end();
    return;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    send(res, response.status, { error: data?.error?.message || data?.message || "OpenRouter 请求失败。" });
    return;
  }

  send(res, 200, {
    analysis: data?.choices?.[0]?.message?.content || "",
    reply: data?.choices?.[0]?.message?.content || "",
    model: data?.model || openRouterModel,
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
