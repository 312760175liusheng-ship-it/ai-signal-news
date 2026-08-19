import { readFile } from "node:fs/promises";

const [html, data, zhihu] = await Promise.all([
  readFile(new URL("../site/index.html", import.meta.url), "utf8"),
  readFile(new URL("../site/news.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../site/zhihu.json", import.meta.url), "utf8").then(JSON.parse),
]);

if (!html.includes("Signal") || !html.includes("app.js")) throw new Error("index.html is incomplete");
if (!Array.isArray(data.items) || !Array.isArray(data.sources) || !data.updatedAt) throw new Error("news.json has an invalid shape");
if (data.items.some((item) => !item.title || !item.url || !item.source || !item.date)) throw new Error("news.json contains an incomplete item");
const translated = data.items.filter((item) => item.translationMethod === "editorial" && item.titleZh).length;
if (!translated) throw new Error("news.json has no Chinese translations");
if (data.items.some((item) => item.translationMethod === "editorial" && (!item.titleZh || (item.summary && !item.summaryZh)))) throw new Error("A reviewed translation is incomplete");
if (!zhihu.updatedAt || !Array.isArray(zhihu.items) || !zhihu.items.length) throw new Error("zhihu.json has an invalid shape");
if (zhihu.items.length > 30 || zhihu.items.some((item) => !item.id || !item.rank || !item.title || !item.url || !item.heat)) throw new Error("zhihu.json contains an incomplete item");
if (zhihu.items.some((item) => !item.url.startsWith("https://www.zhihu.com/question/"))) throw new Error("zhihu.json contains a non-Zhihu link");
console.log(`Validated ${data.items.length} AI news items, ${translated} reviewed Chinese translations, ${data.sources.length} AI sources and ${zhihu.items.length} Zhihu hot-list items.`);
