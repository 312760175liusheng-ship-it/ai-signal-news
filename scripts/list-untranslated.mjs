import { readFile } from "node:fs/promises";

const [news, translations] = await Promise.all([
  readFile(new URL("../site/news.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../site/translations.json", import.meta.url), "utf8").then(JSON.parse),
]);

const keyFor = (url) => url.replace(/\/$/, "");
const cutoff = new Date(news.updatedAt).getTime() - 7 * 24 * 60 * 60 * 1000;
const items = news.items
  .filter((item) => new Date(item.date).getTime() >= cutoff && item.score >= 3)
  .filter((item) => translations.items?.[keyFor(item.url)]?.method !== "editorial")
  .map(({ title, summary, url, date, source, sourceHomepage, kind, region, accent, score }) => ({ title, summary, url, date, source, sourceHomepage, kind, region, accent, score }));

console.log(JSON.stringify(items, null, 2));
