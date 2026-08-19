import { readFile, writeFile } from "node:fs/promises";

const newsPath = new URL("../site/news.json", import.meta.url);
const translationsPath = new URL("../site/translations.json", import.meta.url);
const [news, translations] = await Promise.all([
  readFile(newsPath, "utf8").then(JSON.parse),
  readFile(translationsPath, "utf8").then(JSON.parse),
]);

const keyFor = (url) => url.replace(/\/$/, "");
news.items = news.items.map((item) => {
  const translated = translations.items?.[keyFor(item.url)];
  if (!translated || translated.method !== "editorial") return item;
  return {
    ...item,
    titleZh: translated.titleZh,
    summaryZh: translated.summaryZh,
    translationMethod: "editorial",
    curated: translated.curated || undefined,
    takeaway: translated.takeaway || item.takeaway,
  };
});

await writeFile(newsPath, `${JSON.stringify(news, null, 2)}\n`);
console.log(`Applied ${news.items.filter((item) => item.translationMethod === "editorial").length} reviewed Chinese translations.`);
