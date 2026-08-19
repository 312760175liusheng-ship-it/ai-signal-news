import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "site/news.json");

const feeds = [
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", homepage: "https://openai.com/news/", kind: "official", region: "global", accent: "#101010" },
  { name: "Google AI", url: "https://blog.google/innovation-and-ai/technology/ai/rss/", homepage: "https://blog.google/innovation-and-ai/technology/ai/", kind: "official", region: "global", accent: "#4285f4" },
  { name: "DeepMind", url: "https://deepmind.google/blog/rss.xml", homepage: "https://deepmind.google/blog/", kind: "official", region: "global", accent: "#6b63ff" },
  { name: "NVIDIA", url: "https://blogs.nvidia.com/blog/category/generative-ai/feed/", homepage: "https://blogs.nvidia.com/blog/category/generative-ai/", kind: "official", region: "global", accent: "#76b900" },
  { name: "Qwen", url: "https://github.com/QwenLM/Qwen3/releases.atom", homepage: "https://qwenlm.github.io/", kind: "official", region: "china", accent: "#6d55f7" },
  { name: "DeepSeek", url: "https://github.com/deepseek-ai/DeepSeek-V3/releases.atom", homepage: "https://github.com/deepseek-ai", kind: "official", region: "china", accent: "#315efb" },
  { name: "Ethan Mollick", url: "https://www.oneusefulthing.org/feed", homepage: "https://www.oneusefulthing.org/", kind: "expert", region: "global", accent: "#d55a2a" },
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", homepage: "https://simonwillison.net/", kind: "expert", region: "global", accent: "#8d5bd3" },
  { name: "Nathan Lambert", url: "https://www.interconnects.ai/feed", homepage: "https://www.interconnects.ai/", kind: "expert", region: "global", accent: "#1f7a6b" },
  { name: "Jack Clark", url: "https://jack-clark.net/feed/", homepage: "https://jack-clark.net/", kind: "expert", region: "global", accent: "#3c6393" },
];

const directSources = [
  { name: "Anthropic", homepage: "https://www.anthropic.com/news", kind: "official", region: "global", accent: "#d97757" },
  { name: "Microsoft AI", homepage: "https://blogs.microsoft.com/ai/", kind: "official", region: "global", accent: "#00a4ef" },
  { name: "Meta AI", homepage: "https://ai.meta.com/blog/", kind: "official", region: "global", accent: "#0866ff" },
  { name: "xAI", homepage: "https://x.ai/news", kind: "official", region: "global", accent: "#202020" },
  { name: "字节 Seed", homepage: "https://seed.bytedance.com/zh/blog", kind: "official", region: "china", accent: "#2f6bff" },
  { name: "腾讯混元", homepage: "https://hunyuan.tencent.com/", kind: "official", region: "china", accent: "#1677ff" },
  { name: "百度文心", homepage: "https://yiyan.baidu.com/", kind: "official", region: "china", accent: "#315efb" },
];

function decodeXml(value = "") {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#39;|&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value = "") {
  return decodeXml(value).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function field(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decodeXml(match[1]).trim();
  }
  return "";
}

function cleanUrl(value) {
  try {
    const url = new URL(decodeXml(value).trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function scoreItem(title, summary, kind) {
  const text = `${title} ${summary}`.toLowerCase();
  const strong = ["launch", "introduc", "release", "available", "deploy", "adoption", "customer", "agent", "coding", "work", "education", "health", "science", "robot", "voice", "video", "image", "api", "open source", "case study", "发布", "上线", "开源", "应用", "智能体", "产品", "教育", "医疗", "科研", "部署"];
  const noise = ["funding", "appoint", "hiring", "job", "conference", "award", "webinar", "融资", "招聘", "任命", "活动", "大会"];
  let score = kind === "official" ? 3 : 2;
  for (const keyword of strong) if (text.includes(keyword)) score += 1;
  for (const keyword of noise) if (text.includes(keyword)) score -= 2;
  return Math.max(0, Math.min(10, score));
}

function parseFeed(xml, source) {
  const isAtom = /<feed[\s>]/i.test(xml);
  const blocks = isAtom ? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [] : xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 12).flatMap((block, index) => {
    const title = stripHtml(field(block, ["title"]));
    const rawSummary = stripHtml(field(block, ["description", "summary", "content:encoded", "content"]));
    const summary = rawSummary.startsWith(title) ? rawSummary.slice(title.length).trim() : rawSummary;
    const rawDate = field(block, ["pubDate", "published", "updated", "dc:date"]);
    const alternate = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
    const url = cleanUrl(alternate || stripHtml(field(block, ["link", "guid"])));
    if (!title || !url) return [];
    const parsedDate = new Date(rawDate);
    const date = Number.isNaN(parsedDate.getTime()) ? new Date(Date.now() - index * 60_000).toISOString() : parsedDate.toISOString();
    return [{
      id: `${source.name}-${url}`, title, summary: summary.slice(0, 280), url, date,
      source: source.name, sourceHomepage: source.homepage, kind: source.kind, region: source.region,
      accent: source.accent, score: scoreItem(title, summary, source.kind),
      takeaway: source.kind === "expert" ? "专家观点：帮助理解影响，不替代官方事实。" : undefined,
    }];
  });
}

async function loadPrevious() {
  try { return JSON.parse(await readFile(outputPath, "utf8")); }
  catch { return { items: [] }; }
}

async function loadSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(source.url, { headers: { "User-Agent": "AI-Signal-Radar/1.0 (+https://github.com/312760175liusheng-ship-it/ai-signal-news)" }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { ok: true, items: parseFeed(await response.text(), source) };
  } catch (error) {
    console.warn(`${source.name}: ${error.message}`);
    return { ok: false, items: [] };
  } finally { clearTimeout(timeout); }
}

const previous = await loadPrevious();
const loaded = await Promise.all(feeds.map(loadSource));
const now = new Date();
const cutoff = now.getTime() - 90 * 24 * 60 * 60 * 1000;
const liveItems = loaded.flatMap((result) => result.items);
const failedNames = new Set(feeds.filter((_, index) => !loaded[index].ok).map((source) => source.name));
const fallbackItems = (previous.items || []).filter((item) => failedNames.has(item.source));
const items = Array.from(new Map([...liveItems, ...fallbackItems].map((item) => [item.url.replace(/\/$/, ""), item])).values())
  .filter((item) => new Date(item.date).getTime() >= cutoff)
  .sort((a, b) => new Date(b.date) - new Date(a.date));
const sources = [
  ...feeds.map((source, index) => ({ name: source.name, homepage: source.homepage, kind: source.kind, region: source.region, accent: source.accent, ok: loaded[index].ok })),
  ...directSources.map((source) => ({ ...source, ok: null })),
];

await writeFile(outputPath, `${JSON.stringify({ updatedAt: now.toISOString(), items, sources }, null, 2)}\n`);
console.log(`Updated ${items.length} items from ${loaded.filter((result) => result.ok).length}/${feeds.length} feeds.`);
