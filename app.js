(() => {
  "use strict";

  // =========================================================
  // CONFIG
  // - カード総数（図鑑枚数）は、将来ここに “正しいソースURL” を入れるだけで運用できます。
  // - テストページでは空のままでOK（"-"表示）。
  // =========================================================
  const CARD_TOTAL_SOURCES = [
    // 例：cards-hub の manifest が用意できたら、下のどれかに差し替え
    // "https://naoki496.github.io/cards-hub/cards-manifest.json",
    // "https://raw.githubusercontent.com/naoki496/cards-hub/refs/heads/main/cards-manifest.json",
  ];

  // ===== Keys (kokugo-dojo home.js compatible) =====
  const HKP_KEY = "hklobby.v1.hkp";
  const HIGACHA_LAST_KEY = "hklobby.v1.higacha.lastDate";

  // cache for total cards (optional)
  const CARD_TOTAL_CACHE_KEY = "hklobby.v1.cardTotal.cache";
  const CARD_TOTAL_CACHE_TS_KEY = "hklobby.v1.cardTotal.cacheTs";
  const CARD_TOTAL_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

  const MODE_KEY = "testpage.v1.mode";

  const $ = (id) => document.getElementById(id);
  const on = (node, ev, fn, opt) => node && node.addEventListener(ev, fn, opt);

  // -------------------------
  // helpers
  // -------------------------
  function todayYMD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hostnameOf(url) {
    try { return new URL(url).hostname; } catch { return ""; }
  }

  function extractUrlsKeepText(line) {
    const s = String(line ?? "");
    const urlRe = /(https?:\/\/[^\s]+)/g;
    const urls = [];
    let m;
    while ((m = urlRe.exec(s)) !== null) urls.push(m[1]);
    const textOnly = s.replace(urlRe, "").replace(/\s{2,}/g, " ").trim();
    return { textOnly, urls };
  }

  // "表示||詳細"
  function splitDetail(line) {
    const s = String(line ?? "");
    const parts = s.split("||");
    if (parts.length < 2) return { main: s.trim(), detail: null };
    const main = parts[0].trim();
    const detail = parts.slice(1).join("||").trim();
    return { main, detail: detail.length ? detail : null };
  }

  function normalize(s) {
    return String(s ?? "").trim().toLowerCase();
  }

  async function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      return r;
    } finally {
      clearTimeout(t);
    }
  }

  // -------------------------
  // HKP / HIGACHA
  // -------------------------
  function getHKP() {
    const n = Number(localStorage.getItem(HKP_KEY));
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }
  function setHKP(n) {
    const v = Math.max(0, Math.trunc(Number(n) || 0));
    localStorage.setItem(HKP_KEY, String(v));
    return v;
  }
  function addHKP(delta) {
    return setHKP(getHKP() + (Number(delta) || 0));
  }
  function canHigachaToday() {
    const last = String(localStorage.getItem(HIGACHA_LAST_KEY) || "");
    return last !== todayYMD();
  }
  function markHigachaDoneToday() {
    localStorage.setItem(HIGACHA_LAST_KEY, todayYMD());
  }

  // -------------------------
  // Content registry
  // NOTE: Names MUST remain exactly as-is.
  // -------------------------
  const FLASH_CONTENTS = [
    { name: "古文単語", href: "https://naoki496.github.io/flashcards/", sub: "読解の土台となる基礎語彙。" },
    { name: "助動詞", href: "https://naoki496.github.io/hatto-kobun-jodoushi/", sub: "意味・用法・活用形の判断。" },
    { name: "文学知識総合", href: "https://naoki496.github.io/flashcards/", sub: "作者・作品・時代背景を整理。" },
  ];

  const BLITZ_CONTENTS = [
    {
      name: "古文単語330マスター",
      expertHref: "https://naoki496.github.io/kobun-quiz/expert.html",
      startHref:  "https://naoki496.github.io/kobun-quiz/",
      expertEnabled: true,
      sub: "先ずはここから制覇しよう",
    },
    {
      name: "文学史知識マスター",
      expertHref: "",
      startHref:  "https://naoki496.github.io/bungakusi-quiz/",
      expertEnabled: false, // URL確定後に true + expertHref を入れる
      sub: "作者・作品・時代の基礎を即断で固める。",
    },
    {
      name: "漢字読解マスター",
      expertHref: "",
      startHref:  "https://naoki496.github.io/kanji-y-quiz/",
      expertEnabled: false,
      sub: "読解で差がつく漢字運用を鍛える。",
    },
  ];

  // -------------------------
  // Mode (C案 tabs)
  // -------------------------
  function setMode(mode) {
    document.body.dataset.mode = mode;
    const flash = $("panelFlash");
    const blitz = $("panelBlitz");
    const tabFlash = $("tabFlash");
    const tabBlitz = $("tabBlitz");

    const isFlash = mode === "flash";
    if (flash) flash.hidden = !isFlash;
    if (blitz) blitz.hidden = isFlash;

    tabFlash?.classList.toggle("is-on", isFlash);
    tabBlitz?.classList.toggle("is-on", !isFlash);

    localStorage.setItem(MODE_KEY, mode);
    applyFilter();
    applyCompactLabels();
  }

  // -------------------------
  // Search filter
  // -------------------------
  function applyFilter() {
    const q = normalize($("q")?.value);
    const isFlash = (document.body.dataset.mode || "flash") === "flash";
    const grid = isFlash ? $("flashGrid") : $("blitzGrid");
    if (!grid) return;

    grid.querySelectorAll("[data-name]").forEach((node) => {
      const name = normalize(node.getAttribute("data-name"));
      node.hidden = q ? !name.includes(q) : false;
    });
  }

  // -------------------------
  // Render grids
  // -------------------------
  function renderFlash() {
    const grid = $("flashGrid");
    if (!grid) return;
    grid.innerHTML = "";

    FLASH_CONTENTS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "card";
      card.setAttribute("data-name", c.name);

      card.innerHTML = `
        <div class="cardTitle">${escapeHtml(c.name)}</div>
        <div class="cardSub">${escapeHtml(c.sub || "")}</div>
        <div class="cardActions">
          <a class="aBtn primary" href="${c.href}">START</a>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderBlitz() {
    const grid = $("blitzGrid");
    if (!grid) return;
    grid.innerHTML = "";

    BLITZ_CONTENTS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "card";
      card.setAttribute("data-name", c.name);

      const expertDisabled = !c.expertEnabled || !c.expertHref;
      const expertAttrs = expertDisabled
        ? `class="aBtn danger is-disabled" aria-disabled="true" tabindex="-1"`
        : `class="aBtn danger"`;

      const expertHref = expertDisabled ? "#" : c.expertHref;

      card.innerHTML = `
        <div class="cardTitle">${escapeHtml(c.name)}</div>
        <div class="cardSub">${escapeHtml(c.sub || "")}</div>
        <div class="cardActions">
          <a ${expertAttrs} href="${expertHref}">EXPERT</a>
          <a class="aBtn primary" href="${c.startHref}">START</a>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // -------------------------
  // HUD render
  // -------------------------
  function renderHKP() {
    const el = $("hkpValue");
    if (el) el.textContent = String(getHKP());
  }

  function updateHigachaButtonState() {
    const btn = $("btnHigacha");
    if (!btn) return;
    const ok = canHigachaToday();
    btn.disabled = !ok;
    btn.classList.toggle("is-ready", ok);
    btn.classList.toggle("is-disabled", !ok);
    btn.setAttribute("aria-disabled", String(!ok));
  }

  function renderRankPlaceholder() {
    const el = $("rankValue");
    if (el) el.textContent = "-";
  }

  // -------------------------
  // Card total (図鑑枚数) hook
  // - テスト段階: "-" のままでもOK
  // - 正規運用: CARD_TOTAL_SOURCES に “真のデータソースURL” を追加すれば反映されます。
  // -------------------------
  function setCardTotalText(s) {
    const el = $("cardTotalValue");
    if (!el) return;
    el.textContent = String(s ?? "-");
  }

  function getCachedCardTotal() {
    const v = Number(localStorage.getItem(CARD_TOTAL_CACHE_KEY));
    const ts = Number(localStorage.getItem(CARD_TOTAL_CACHE_TS_KEY));
    if (!Number.isFinite(v) || !Number.isFinite(ts)) return null;
    if ((Date.now() - ts) > CARD_TOTAL_CACHE_MAX_AGE_MS) return null;
    return v;
  }

  function setCachedCardTotal(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    localStorage.setItem(CARD_TOTAL_CACHE_KEY, String(Math.max(0, Math.trunc(n))));
    localStorage.setItem(CARD_TOTAL_CACHE_TS_KEY, String(Date.now()));
  }

  function inferCardTotalFromManifestJson(obj) {
    // できるだけ汎用に：よくあるパターンを吸収
    // - { cards: [...] }
    // - { items: [...] }
    // - [ ... ]
    // - { total: 123 }
    if (!obj) return null;

    if (Array.isArray(obj)) return obj.length;

    if (Number.isFinite(obj.total)) return obj.total;

    if (Array.isArray(obj.cards)) return obj.cards.length;
    if (Array.isArray(obj.items)) return obj.items.length;

    // cardsManifest の形が { byRepo: {kobun:[...], ...} } みたいな場合も合算
    if (obj.byRepo && typeof obj.byRepo === "object") {
      let sum = 0;
      for (const k of Object.keys(obj.byRepo)) {
        const a = obj.byRepo[k];
        if (Array.isArray(a)) sum += a.length;
      }
      return sum || null;
    }

    return null;
  }

  async function fetchCardTotal() {
    // まずキャッシュがあれば即表示（体感を軽く）
    const cached = getCachedCardTotal();
    if (cached !== null) setCardTotalText(cached);

    if (!CARD_TOTAL_SOURCES.length) {
      // テスト段階：ソース未指定ならここで終了
      if (cached === null) setCardTotalText("-");
      return;
    }

    for (const url of CARD_TOTAL_SOURCES) {
      try {
        const r = await fetchWithTimeout(url, 6000);
        if (!r.ok) continue;

        const ct = (r.headers.get("content-type") || "").toLowerCase();
        let total = null;

        if (ct.includes("application/json") || url.endsWith(".json")) {
          const obj = await r.json();
          total = inferCardTotalFromManifestJson(obj);
        } else {
          // CSV等：行数カウント（ヘッダ1行がある場合は自動で除外）
          const txt = await r.text();
          const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (lines.length) {
            const headerLike = lines[0].includes(",") && /id|rarity|name|img/i.test(lines[0]);
            total = headerLike ? Math.max(0, lines.length - 1) : lines.length;
          }
        }

        if (Number.isFinite(total)) {
          const n = Math.max(0, Math.trunc(total));
          setCardTotalText(n);
          setCachedCardTotal(n);
          return;
        }
      } catch {
        // 次のソースへ
      }
    }

    // 全失敗
    if (cached === null) setCardTotalText("-");
  }

  // -------------------------
  // Compact labels (EXPERT/START -> EX/GO on narrow screens)
  // - 表示だけ短縮。導線や概念は変えません。
  // -------------------------
  function applyCompactLabels() {
    const isCompact = window.matchMedia("(max-width: 380px)").matches;

    const rewrite = (node) => {
      const t = node.textContent.trim();
      if (!node.dataset.long) node.dataset.long = t;

      if (!isCompact) {
        node.textContent = node.dataset.long;
        return;
      }
      if (t === "EXPERT" || node.dataset.long === "EXPERT") node.textContent = "EX";
      else if (t === "START" || node.dataset.long === "START") node.textContent = "GO";
    };

    document.querySelectorAll("#blitzGrid .aBtn").forEach(rewrite);
    document.querySelectorAll("#flashGrid .aBtn").forEach(rewrite);
  }
  window.addEventListener("resize", applyCompactLabels);
  window.addEventListener("orientationchange", applyCompactLabels);

  // -------------------------
  // HKP help modal
  // -------------------------
  function initHkpHelp() {
    const helpBtn = $("btnHkpHelp");
    const overlay = $("hkpHelpOverlay");
    const closeBtn = $("hkpHelpClose");
    const body = $("hkpHelpBody");
    if (!helpBtn || !overlay || !closeBtn || !body) return;

    const text =
`★HKPとは？
Higashi Kokugo Pointの略称。

BLITZ QUESTの通常10問モードを学習時、
一定条件でHKPを入手できます。
また、TOPページの「HIGACHA」を回すことでも
1HKPを入手できます。
時々2HKP入手できることも…？
※HIGACHAは1日1回まで回せます

HKPを消費することで「EXPERT MODE」への挑戦や、
その他の機能を使用できるようになるかも。`;

    let lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      body.textContent = text;
      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
      closeBtn.focus();
      document.body.style.overflow = "hidden";
    }
    function close() {
      try { (lastFocus && typeof lastFocus.focus === "function") ? lastFocus.focus() : helpBtn.focus(); } catch {}
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    on(helpBtn, "click", open);
    on(closeBtn, "click", close);
    on(overlay, "click", (e) => { if (e.target === overlay) close(); });
    on(document, "keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") close();
    });
  }

  // -------------------------
  // HIGACHA modal
  // -------------------------
  function initHigacha() {
    const btn = $("btnHigacha");
    const overlay = $("higachaOverlay");
    const closeBtn = $("higachaClose");
    const cancelBtn = $("higachaCancel");
    const drawBtn = $("higachaDraw");
    const msgEl = $("higachaMsg");
    if (!btn || !overlay || !closeBtn || !cancelBtn || !drawBtn || !msgEl) return;

    let lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      const ok = canHigachaToday();

      if (ok) {
        msgEl.textContent =
`本日のHIGACHAを実行します。

結果により +1 または +2 HKP を獲得します。`;
        drawBtn.disabled = false;
        drawBtn.style.opacity = "";
      } else {
        msgEl.textContent =
`本日のHIGACHAは使用済みです。

また明日、試せます。`;
        drawBtn.disabled = true;
        drawBtn.style.opacity = "0.45";
      }

      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }

    function close() {
      try { (lastFocus && typeof lastFocus.focus === "function") ? lastFocus.focus() : btn.focus(); } catch {}
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      renderHKP();
      updateHigachaButtonState();
    }

    on(btn, "click", open);
    on(closeBtn, "click", close);
    on(cancelBtn, "click", close);
    on(overlay, "click", (e) => { if (e.target === overlay) close(); });
    on(document, "keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") close();
    });

    on(drawBtn, "click", () => {
      if (!canHigachaToday()) {
        updateHigachaButtonState();
        return;
      }
      const gain = (Math.random() < 0.70) ? 1 : 2;
      addHKP(gain);
      markHigachaDoneToday();

      msgEl.textContent =
`RESULT

+${gain}HKP

TOTAL ${getHKP()} HKP`;

      drawBtn.disabled = true;
      drawBtn.style.opacity = "0.45";
      renderHKP();
      updateHigachaButtonState();
    });
  }

  // -------------------------
  // DETAIL modal (for MISSIONBRIEF “?”)
  // -------------------------
  function initDetailModal() {
    const overlay = $("detailOverlay");
    const btnClose = $("detailClose");
    const titleEl = $("detailTitle");
    const bodyEl = $("detailBody");
    const linksWrap = $("detailLinksWrap");
    const linksEl = $("detailLinks");
    if (!overlay || !btnClose || !titleEl || !bodyEl || !linksWrap || !linksEl) {
      return { open: () => {} };
    }

    let lastFocus = null;

    function open(titleText, detailText) {
      lastFocus = document.activeElement;

      titleEl.textContent = titleText || "DETAIL";

      const raw = String(detailText ?? "").replaceAll("\\n", "\n");

      const urlRe = /(https?:\/\/[^\s]+)/g;
      const urls = raw.match(urlRe) ?? [];
      const bodyText = raw.replace(urlRe, "").replace(/[ \t]{2,}/g, " ").trim();

      bodyEl.textContent = bodyText.length ? bodyText : raw;

      linksEl.innerHTML = "";
      if (urls.length) {
        linksWrap.style.display = "block";
        urls.forEach((u, i) => {
          const a = document.createElement("a");
          a.href = u;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = (urls.length === 1) ? "LINK" : `LINK ${i + 1}`;
          a.title = hostnameOf(u) ? `${hostnameOf(u)} — ${u}` : u;
          linksEl.appendChild(a);
        });
      } else {
        linksWrap.style.display = "none";
      }

      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      btnClose.focus();
    }

    function close() {
      try { (lastFocus && typeof lastFocus.focus === "function") ? lastFocus.focus() : null; } catch {}
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    on(btnClose, "click", close);
    on(overlay, "click", (e) => { if (e.target === overlay) close(); });
    on(document, "keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") close();
    });

    return { open };
  }

  // -------------------------
  // MISSIONBRIEF (表示||詳細 + “?” button)
  // - 上のチップ（btnBriefToggle2）と下の OPEN（btnBriefToggle）を同期
  // -------------------------
  function initBrief(detailApi) {
    const btn = $("btnBriefToggle");      // 下段
    const btn2 = $("btnBriefToggle2");    // 上段チップ
    const one = $("briefOneLine");        // 上段1行要約
    const body = $("briefBody");
    const list = $("briefList");
    if (!body || !list) return;

    function setOpen(open) {
      body.hidden = !open;
      btn?.setAttribute("aria-expanded", String(open));
      btn2?.setAttribute("aria-expanded", String(open));
      if (btn) btn.textContent = open ? "CLOSE" : "OPEN";
      if (btn2) {
        const icon = btn2.querySelector(".briefChipIcon");
        if (icon) icon.textContent = open ? "▴" : "▾";
      }
    }

    let open = false;
    on(btn, "click", () => { open = !open; setOpen(open); });
    on(btn2, "click", () => { open = !open; setOpen(open); });

    function renderLines(lines) {
      list.innerHTML = "";
      lines.forEach((line) => {
        const { main, detail } = splitDetail(line);
        const { textOnly, urls } = extractUrlsKeepText(main);
        const displayText = (textOnly && textOnly.length) ? textOnly : (urls.length ? "LINK" : main);

        const li = document.createElement("li");
        li.className = "briefItem";

        const text = document.createElement("div");
        text.className = "briefText";
        text.textContent = displayText;

        const actions = document.createElement("div");
        actions.className = "briefActions";

        if (urls.length) {
          const links = document.createElement("div");
          links.className = "briefLinks";
          urls.forEach((u, i) => {
            const a = document.createElement("a");
            a.href = u;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = (urls.length === 1) ? "LINK" : `LINK ${i + 1}`;
            a.title = hostnameOf(u) ? `${hostnameOf(u)} — ${u}` : u;
            links.appendChild(a);
          });
          actions.appendChild(links);
        }

        if (detail) {
          const q = document.createElement("button");
          q.className = "briefQ";
          q.type = "button";
          q.textContent = "?";
          q.setAttribute("aria-label", "詳細");
          on(q, "click", () => detailApi.open("DETAIL", detail));
          actions.appendChild(q);
        }

        li.appendChild(text);
        li.appendChild(actions);
        list.appendChild(li);
      });
    }

    fetch("./mission-brief.txt", { cache: "no-store" })
      .then((r) => r.ok ? r.text() : "")
      .then((txt) => {
        const lines = String(txt || "")
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (one) {
          const first = lines[0] ? splitDetail(lines[0]).main : "";
          one.textContent = first || "（未読）";
        }

        renderLines(lines.slice(0, 60));
      })
      .catch(() => {
        if (one) one.textContent = "（読み込み失敗）";
      });
  }

  function initTabs() {
    on($("tabFlash"), "click", () => setMode("flash"));
    on($("tabBlitz"), "click", () => setMode("blitz"));
  }

  function initSearch() {
    const q = $("q");
    const clear = $("btnClear");
    on(q, "input", applyFilter);
    on(clear, "click", () => {
      if (q) q.value = "";
      applyFilter();
      q?.focus();
    });
  }

  // -------------------------
  // boot
  // -------------------------
  function boot() {
    renderFlash();
    renderBlitz();

    initTabs();
    initSearch();

    const saved = localStorage.getItem(MODE_KEY);
    setMode(saved === "blitz" ? "blitz" : "flash");

    renderHKP();
    updateHigachaButtonState();
    initHkpHelp();
    initHigacha();
    renderRankPlaceholder();

    const detailApi = initDetailModal();
    initBrief(detailApi);

    // 表示短縮（狭い画面用）
    applyCompactLabels();

    // 図鑑枚数（ソース未設定なら "-" のまま）
    fetchCardTotal();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
