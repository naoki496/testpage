(() => {
  "use strict";

  // ===== Keys (kokugo-dojo home.js compatible) =====
  const HKP_KEY = "hklobby.v1.hkp";
  const HIGACHA_LAST_KEY = "hklobby.v1.higacha.lastDate";

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
  // Content registry (Names MUST remain exactly as-is)
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
  const MODE_KEY = "testpage.v1.mode";
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
  }

  // -------------------------
  // Search filter
  // -------------------------
  function normalize(s) {
    return String(s ?? "").trim().toLowerCase();
  }
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
      try { (lastFocus && lastFocus.focus) ? lastFocus.focus() : helpBtn.focus(); } catch {}
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

      // "\n" を改行として扱う
      const raw = String(detailText ?? "").replaceAll("\\n", "\n");

      // URL抽出（本文はURL除去、リンク領域はURLがある時だけ表示）
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
  // -------------------------
  function initBrief(detailApi) {
    const btn = $("btnBriefToggle");
    const body = $("briefBody");
    const list = $("briefList");
    if (!btn || !body || !list) return;

    function setOpen(open) {
      body.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "CLOSE" : "OPEN";
    }

    let open = false;
    on(btn, "click", () => { open = !open; setOpen(open); });

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
        renderLines(lines.slice(0, 60));
      })
      .catch(() => {});
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
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
