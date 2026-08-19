const tabs = [
  { id: "signal", label: "重点", hint: "真正值得看的" },
  { id: "official", label: "官方", hint: "原始发布" },
  { id: "expert", label: "解读", hint: "一线作者观点" },
  { id: "china", label: "国内", hint: "官方更新" },
  { id: "zhihu", label: "知乎热榜", hint: "每日热门讨论" },
  { id: "saved", label: "收藏", hint: "稍后阅读" },
];

const state = {
  activeTab: "signal",
  query: "",
  saved: readSaved(),
  showSources: false,
  data: { items: [], sources: [], updatedAt: null },
  zhihuData: { items: [], updatedAt: null, sourceHomepage: "https://www.zhihu.com/hot" },
};

function readSaved() {
  try { return JSON.parse(localStorage.getItem("ai-signal-saved") || "[]"); }
  catch { return []; }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function safeUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "#";
  } catch { return "#"; }
}

function formatDate(value) {
  if (!value) return "尚未更新";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function recency(date, now) {
  const hours = Math.max(1, Math.floor((new Date(now).getTime() - new Date(date).getTime()) / 3_600_000));
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(date).split(" ")[0];
}

function filteredItems() {
  const query = state.query.trim().toLowerCase();
  const sevenDaysAgo = new Date(state.data.updatedAt).getTime() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = new Date(state.data.updatedAt).getTime() - 30 * 24 * 60 * 60 * 1000;
  const aiItems = state.data.items.filter((item) => item.titleZh || /[\u3400-\u9fff]/.test(item.title));
  const zhihuItems = state.zhihuData.items.map((item) => ({
    ...item,
    kind: "zhihu",
    source: "知乎热榜",
    sourceHomepage: state.zhihuData.sourceHomepage,
    date: state.zhihuData.updatedAt,
    accent: "#1772f6",
  }));
  let items = state.activeTab === "zhihu" ? zhihuItems : [...aiItems, ...(state.activeTab === "saved" ? zhihuItems : [])].filter((item) => {
    if (state.activeTab === "signal") return item.curated || (item.kind === "official" && item.score >= 5 && new Date(item.date).getTime() >= sevenDaysAgo);
    if (state.activeTab === "official") return item.kind === "official" && item.translationMethod === "editorial" && new Date(item.date).getTime() >= thirtyDaysAgo;
    if (state.activeTab === "expert") return item.kind === "expert" && item.translationMethod === "editorial" && new Date(item.date).getTime() >= thirtyDaysAgo;
    if (state.activeTab === "china") return item.region === "china" && item.translationMethod === "editorial" && new Date(item.date).getTime() >= thirtyDaysAgo;
    return state.saved.includes(item.id);
  });
  if (query) items = items.filter((item) => `${item.titleZh || ""} ${item.summaryZh || ""} ${item.title} ${item.summary} ${item.source}`.toLowerCase().includes(query));
  items.sort((a, b) => {
    if (state.activeTab === "zhihu") return a.rank - b.rank;
    if (state.activeTab === "signal" && Boolean(a.curated) !== Boolean(b.curated)) return a.curated ? -1 : 1;
    if (state.activeTab === "signal" && a.score !== b.score) return b.score - a.score;
    return new Date(b.date) - new Date(a.date);
  });
  return state.activeTab === "signal" ? items.slice(0, 5) : items;
}

function renderNav() {
  document.querySelector("#nav-list").innerHTML = tabs.map((tab) => `
    <button type="button" class="nav-item ${state.activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}">
      <span>${tab.label}</span><small>${tab.hint}</small>
    </button>`).join("");
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
    state.activeTab = button.dataset.tab;
    render();
  }));
}

function renderSources() {
  const drawer = document.querySelector("#source-drawer");
  if (state.activeTab === "zhihu") {
    drawer.hidden = true;
    return;
  }
  drawer.hidden = !state.showSources;
  drawer.innerHTML = state.data.sources.map((source) => `
    <a href="${escapeHtml(safeUrl(source.homepage))}" target="_blank" rel="noreferrer">
      <span class="source-color" style="background-color:${escapeHtml(source.accent)}"></span>
      <div><strong>${escapeHtml(source.name)}</strong><small>${source.kind === "official" ? "官方" : "专家"}</small></div>
      <span class="source-status ${source.ok === true ? "ok" : ""}">${source.ok === true ? "已更新" : source.ok === null ? "直达" : "暂不可用"}</span>
    </a>`).join("");
}

function renderArticles() {
  const items = filteredItems();
  document.querySelector("#result-count").textContent = `${items.length} 条结果`;
  const list = document.querySelector("#article-list");
  if (!items.length) {
    const saved = state.activeTab === "saved";
    list.innerHTML = `<div class="empty-state"><span>◎</span><h3>${saved ? "还没有收藏" : "本次无重大更新"}</h3><p>${saved ? "在新闻右侧点星标，稍后从这里继续读。" : "没有跨过门槛的内容，不凑数。"}</p></div>`;
    return;
  }
  list.innerHTML = items.map((item, index) => {
    const isSaved = state.saved.includes(item.id);
    const isZhihu = item.kind === "zhihu";
    const meta = isZhihu
      ? `<span class="zhihu-rank">#${String(item.rank).padStart(2, "0")}</span><a href="${escapeHtml(safeUrl(item.sourceHomepage))}" target="_blank" rel="noreferrer">知乎热榜</a><span>·</span><span>${escapeHtml(item.heat)}</span>${item.badge ? `<span class="zhihu-badge">${escapeHtml(item.badge)}</span>` : ""}`
      : `<a href="${escapeHtml(safeUrl(item.sourceHomepage))}" target="_blank" rel="noreferrer">${escapeHtml(item.source)}</a><span>·</span><time datetime="${escapeHtml(item.date)}">${escapeHtml(recency(item.date, state.data.updatedAt))}</time>${item.curated ? '<span class="curated-tag">中文精选</span>' : item.kind === "expert" ? '<span class="expert-tag">观点</span>' : ""}${item.titleZh ? '<span class="translated-tag">中文译文</span>' : ""}`;
    return `<article class="${index === 0 && state.activeTab === "signal" ? "article-card lead" : "article-card"}">
      <div class="article-accent" style="background-color:${escapeHtml(item.accent)}"></div>
      <div class="article-content">
        <div class="article-meta">${meta}</div>
        <a class="article-link" href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noreferrer"><h3>${escapeHtml(item.titleZh || item.title)}</h3>${(item.summaryZh || item.summary) ? `<p>${escapeHtml(item.summaryZh || item.summary)}</p>` : ""}</a>
        ${isZhihu ? `<div class="zhihu-stats">${item.answerCount} 个回答 · ${item.followerCount} 人关注</div>` : item.takeaway ? `<div class="takeaway">${escapeHtml(item.takeaway)}</div>` : ""}
      </div>
      <div class="article-actions"><button class="bookmark ${isSaved ? "saved" : ""}" type="button" data-save="${escapeHtml(item.id)}" aria-label="${isSaved ? "取消收藏" : "收藏"}">${isSaved ? "★" : "☆"}</button><a href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noreferrer" aria-label="打开原文">↗</a></div>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.save;
    state.saved = state.saved.includes(id) ? state.saved.filter((item) => item !== id) : [...state.saved, id];
    localStorage.setItem("ai-signal-saved", JSON.stringify(state.saved));
    renderArticles();
  }));
}

function renderRail() {
  const isZhihu = state.activeTab === "zhihu";
  document.querySelector("#rail-eyebrow").textContent = isZhihu ? "知乎热榜" : "阅读顺序";
  document.querySelector("#rail-title").textContent = isZhihu ? "把热度当入口，不把热度当结论。" : "先看“重点”，再按需要查官方原文。";
  document.querySelector("#rail-description").textContent = isZhihu ? "这里原样呈现知乎当前热门问题；点开后优先看有证据、能交叉验证的回答。" : "标题和摘要先翻译成中文；重要结论仍回到原始发布和真实应用证据。";
  document.querySelector("#rule-eyebrow").textContent = isZhihu ? "阅读建议" : "进入重点的门槛";
  document.querySelector("#rule-list").innerHTML = isZhihu
    ? "<li><span>01</span>先看标题筛选话题</li><li><span>02</span>再找有证据的回答</li><li><span>03</span>事实回到原始来源</li>"
    : "<li><span>01</span>已经开放，不是预告</li><li><span>02</span>有人真实部署</li><li><span>03</span>有结果或近期可测试</li>";
  document.querySelector("#update-description").textContent = isZhihu ? "每天北京时间约 09:00 保存一次知乎热榜快照。你的电脑关机、不开梯子，都不会影响更新。" : "每天北京时间约 09:00 在云端更新 AI 情报和知乎热榜。你的电脑关机、不开梯子，都不会影响更新。";
}

function render() {
  renderNav();
  renderSources();
  renderRail();
  const isZhihu = state.activeTab === "zhihu";
  document.querySelector("#page-title").textContent = tabs.find((tab) => tab.id === state.activeTab)?.label || "重点";
  document.querySelector("#pulse-strip").hidden = state.activeTab !== "signal";
  document.querySelector("#date-line").textContent = `${isZhihu ? "知乎当前热门讨论" : "AI 重大应用"} · ${formatDate(isZhihu ? state.zhihuData.updatedAt : state.data.updatedAt)}`;
  document.querySelector("#last-updated").textContent = `最后更新：${formatDate(isZhihu ? state.zhihuData.updatedAt : state.data.updatedAt)}`;
  document.querySelector("#official-count").textContent = state.data.items.filter((item) => item.kind === "official" && item.translationMethod === "editorial").length;
  document.querySelector("#expert-count").textContent = state.data.items.filter((item) => item.kind === "expert" && item.translationMethod === "editorial").length;
  document.querySelector("#source-count").textContent = `${state.data.sources.filter((source) => source.ok === true).length}/${state.data.sources.length}`;
  document.querySelector("#source-toggle").hidden = isZhihu;
  document.querySelector("#source-toggle").textContent = state.showSources ? "收起来源" : "查看白名单";
  renderArticles();
}

async function loadNews() {
  const button = document.querySelector("#refresh-button");
  button.disabled = true;
  button.textContent = "更新中";
  try {
    const [newsResponse, zhihuResponse] = await Promise.all([
      fetch(`news.json?v=${Date.now()}`, { cache: "no-store" }),
      fetch(`zhihu.json?v=${Date.now()}`, { cache: "no-store" }),
    ]);
    if (!newsResponse.ok || !zhihuResponse.ok) throw new Error(`HTTP ${newsResponse.status}/${zhihuResponse.status}`);
    [state.data, state.zhihuData] = await Promise.all([newsResponse.json(), zhihuResponse.json()]);
    render();
  } catch {
    document.querySelector("#article-list").innerHTML = '<div class="empty-state"><span>!</span><h3>暂时无法读取</h3><p>稍后刷新即可，已有网页不会丢失。</p></div>';
  } finally {
    button.disabled = false;
    button.textContent = "刷新";
  }
}

document.querySelector("#search-input").addEventListener("input", (event) => { state.query = event.target.value; renderArticles(); });
document.querySelector("#refresh-button").addEventListener("click", loadNews);
document.querySelector("#source-toggle").addEventListener("click", () => { state.showSources = !state.showSources; renderSources(); document.querySelector("#source-toggle").textContent = state.showSources ? "收起来源" : "查看白名单"; });
renderNav();
loadNews();
