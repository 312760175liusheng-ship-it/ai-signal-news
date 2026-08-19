import { readFile, writeFile } from "node:fs/promises";

const outputPath = new URL("../site/zhihu.json", import.meta.url);
const endpoint = "https://api.zhihu.com/topstory/hot-lists/total?limit=30";

function cleanText(value = "") {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanSummary(value = "") {
  return cleanText(value).replace(/https?:\/\/\S+/gi, "").trim().slice(0, 160);
}

async function loadPrevious() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return { updatedAt: null, sourceHomepage: "https://www.zhihu.com/hot", items: [] };
  }
}

const previous = await loadPrevious();
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20_000);

try {
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; Signal-News/1.0; +https://github.com/312760175liusheng-ship-it/ai-signal-news)",
    },
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = await response.json();
  if (!Array.isArray(payload.data) || !payload.data.length) throw new Error("empty hot list");

  const items = payload.data.slice(0, 30).flatMap((item, index) => {
    const target = item?.target;
    const id = cleanText(target?.url).split("/").filter(Boolean).pop() || "";
    const title = cleanText(target?.title);
    if (!id || !title) return [];
    return [{
      id: `zhihu-${id}`,
      rank: index + 1,
      title,
      summary: cleanSummary(target?.excerpt),
      url: `https://www.zhihu.com/question/${id}`,
      heat: cleanText(item?.detail_text),
      answerCount: Number(target?.answer_count) || 0,
      followerCount: Number(target?.follower_count) || 0,
      badge: item?.card_label?.type === "new" ? "新" : item?.card_label?.type === "hot" ? "热" : "",
    }];
  });

  if (!items.length) throw new Error("no valid hot-list items");
  const data = {
    updatedAt: new Date().toISOString(),
    sourceHomepage: "https://www.zhihu.com/hot",
    sourceNote: "知乎官方热榜接口快照",
    items,
  };
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Updated ${items.length} Zhihu hot-list items.`);
} catch (error) {
  if (!previous.items?.length) throw error;
  console.warn(`Zhihu hot list unavailable; kept previous snapshot: ${error.message}`);
} finally {
  clearTimeout(timeout);
}
