import { readFile } from "node:fs/promises";

const [html, data] = await Promise.all([
  readFile(new URL("../site/index.html", import.meta.url), "utf8"),
  readFile(new URL("../site/news.json", import.meta.url), "utf8").then(JSON.parse),
]);

if (!html.includes("Signal") || !html.includes("app.js")) throw new Error("index.html is incomplete");
if (!Array.isArray(data.items) || !Array.isArray(data.sources) || !data.updatedAt) throw new Error("news.json has an invalid shape");
if (data.items.some((item) => !item.title || !item.url || !item.source || !item.date)) throw new Error("news.json contains an incomplete item");
const translated = data.items.filter((item) => item.translationMethod === "editorial" && item.titleZh).length;
if (!translated) throw new Error("news.json has no Chinese translations");
if (data.items.some((item) => item.translationMethod === "editorial" && (!item.titleZh || (item.summary && !item.summaryZh)))) throw new Error("A reviewed translation is incomplete");
console.log(`Validated ${data.items.length} news items, ${translated} reviewed Chinese translations and ${data.sources.length} sources.`);
