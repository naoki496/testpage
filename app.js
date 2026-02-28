(() => {
  "use strict";

  // ========= Keys =========
  const HKP_KEY = "hklobby.v1.hkp";
  const HIGACHA_LAST_KEY = "hklobby.v1.higacha.lastDate";
  const MODE_KEY = "testpage.v1.mode";

  // MISSIONBRIEF badge state
  const BRIEF_SIG_KEY = "hklobby.v1.missionBrief.signature";
  const BRIEF_SEEN_KEY = "hklobby.v1.missionBrief.seenSignature";

  // FLASH “learning gauge” (proxy) by click count
  const FLASH_USAGE_KEY = "hklobby.v1.flashUsage"; // JSON {slug: count}

  const $ = (id) => document.getElementById(id);
  const on = (node, ev, fn, opt) => node && node.addEventListener(ev, fn, opt);

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

  // Simple signature for text (stable enough for badge)
  function signatureOf(text) {
    const s = String(text ?? "").replace(/\r\n/g, "\n").trim();
    let h = 2166136261; // FNV-1a-ish
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function slugify(name) {
    return String(name ?? "")
      .toLowerCase()
      .replace(/[^\w\u3040-\u30ff\u3400-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  // ========= Contents (names must NOT change) =========
  const FLASH_CONTENTS = [
    { name: "古文単語", href: "https://naoki496.github.io/flashcards/" },
    { name: "助動詞", href: "https://naoki496.github.io/hatto-kobun-jodoushi/" },
    { name: "文学知識総合", href: "https://naoki496.github.io/bungaku/" },
  ];

  const BLITZ_CONTENTS = [
    {
      name: "古文単語330マスター",
      expertHref: "https://naoki496.github.io/kobun-quiz/expert.html",
      normalHref: "https://naoki496.github.io/kobun-quiz/",
      expertEnabled: true,
    },
    {
      name: "文学史知識マスター",
      expertHref: "",
      normalHref: "https://naoki496.github.io/bungakusi-quiz/",
      expertEnabled: false,
    },
    {
      name: "漢字読解マスター",
      expertHref: "",
      normalHref: "https://naoki496.github.io/kanji-y-quiz/",
      expertEnabled: false,
    },
  ];

  // ========= Mode tabs =========
  function setMode(mode) {
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
  }

  // ========= HKP / HIGACHA =========
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
  function renderHKP() {
    const el = $("hkpValue");
    if (el) el.textContent = String(getHKP());
  }
  function canHigachaToday() {
    const last = String(localStorage.getItem(HIGACHA_LAST_KEY) || "");
    return last !== todayYMD();
  }
  function markHigachaDoneToday() {
    localStorage.setItem(HIGACHA_LAST_KEY, todayYMD());
  }
  function updateHigachaButtonState() {
    const btn = $("btnHigacha");
    if (!btn) return;
    const ok = canHigachaToday();
    btn.disabled = !ok;
    btn.classList.toggle("is-disabled", !ok);
    btn.setAttribute("aria-disabled", String(!ok));
  }

  // ========= Rank / total placeholders =========
  function renderRankPlaceholder() {
    const el = $("rankValue");
    if (el) el.textContent = "-";
  }
  function disableCardTotal() {
    const el = $("cardTotalValue");
    if (el) el.textContent = "-";
  }

  // ========= Generic overlay close binding =========
  function bindOverlayClose(overlayId, closeId) {
    const overlay = $(overlayId);
    const closeBtn = $(closeId);
    if (!overlay || !closeBtn) return { open: () => {}, close: () => {}, overlay: null };

    let lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }
    function close() {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      try { lastFocus?.focus?.(); } catch {}
    }

    on(closeBtn, "click", close);
    on(overlay, "click", (e) => { if (e.target === overlay) close(); });
    on(document, "keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") close();
    });

    return { open, close, overlay };
  }

  // ========= FLASH gauge (proxy by usage) =========
  function loadFlashUsage() {
    try {
      const raw = localStorage.getItem(FLASH_USAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function saveFlashUsage(obj) {
    try { localStorage.setItem(FLASH_USAGE_KEY, JSON.stringify(obj || {})); } catch {}
  }
  function bumpFlashUsage(slug) {
    const usage = loadFlashUsage();
    usage[slug] = (Number(usage[slug]) || 0) + 1;
    saveFlashUsage(usage);
    return usage[slug];
  }
  function usageToPct(count) {
    // 0.. ~20 で伸びやすく、その後はゆるやかに（「薄い」ゲージ向け）
    const c = Math.max(0, Number(count) || 0);
    const pct = 100 * (1 - Math.exp(-c / 12));
    return Math.max(0, Math.min(100, pct));
  }

  // ========= EXPERT FX =========
  function playExpertFxThenNavigate(url) {
    const fx = $("fxOverlay");
    if (!fx) {
      location.href = url;
      return;
    }
    fx.style.display = "flex";
    fx.setAttribute("aria-hidden", "false");
    // 0.36s + small buffer
    setTimeout(() => { location.href = url; }, 380);
  }

  // ========= Render grids =========
  function renderFlash() {
    const grid = $("flashGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const usage = loadFlashUsage();

    FLASH_CONTENTS.forEach((c) => {
      const slug = slugify(c.name);
      const count = usage[slug] ?? 0;
      const pct = usageToPct(count);

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <div class="cardActions">
          <a class="aBtn primary hasGauge" data-flashslug="${escapeHtml(slug)}" href="${c.href}">
            ${escapeHtml(c.name)}
            <span class="gauge" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>
          </a>
        </div>
      `;
      grid.appendChild(card);
    });

    // click hook -> bump usage
    grid.querySelectorAll('a[data-flashslug]').forEach((a) => {
      a.addEventListener("click", () => {
        const slug = a.getAttribute("data-flashslug") || "";
        const newCount = bumpFlashUsage(slug);
        const pct = usageToPct(newCount);
        const bar = a.querySelector(".gauge > i");
        if (bar) bar.style.width = `${pct.toFixed(1)}%`;
      }, { passive: true });
    });
  }

  function renderBlitz() {
    const grid = $("blitzGrid");
    if (!grid) return;
    grid.innerHTML = "";

    BLITZ_CONTENTS.forEach((c, idx) => {
      const card = document.createElement("div");
      card.className = "card";

      const expertDisabled = !c.expertEnabled || !c.expertHref;
      const expertAttrs = expertDisabled
        ? `class="aBtn danger is-disabled" aria-disabled="true" tabindex="-1"`
        : `class="aBtn danger" data-expert="1" data-expert-url="${escapeHtml(c.expertHref)}"`;
      const expertHref = expertDisabled ? "#" : c.expertHref;

      card.innerHTML = `
        <div class="cardTitle">${escapeHtml(c.name)}</div>
        <div class="cardActions">
          <a class="aBtn primary" href="${c.normalHref}">NORMAL</a>
          <a ${expertAttrs} href="${expertHref}">EXPERT</a>
        </div>
      `;
      grid.appendChild(card);
    });

    // EXPERT FX hook (enabled only)
    grid.querySelectorAll('a[data-expert="1"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const url = a.getAttribute("data-expert-url");
        if (!url) return;
        e.preventDefault();
        playExpertFxThenNavigate(url);
      });
    });
  }

  // ========= HKP Help modal =========
  function initHkpHelp() {
    const helpBtn = $("btnHkpHelp");
    const body = $("hkpHelpBody");
    if (!helpBtn || !body) return;

    const { open } = bindOverlayClose("hkpHelpOverlay", "hkpHelpClose");
    const text =
`★HKPとは？
Higashi Kokugo Pointの略称。

BLITZ QUESTの通常10問モードを学習時、
一定条件でHKPを入手できます。
また、TOPページの「HIGACHA」を回すことでも
1HKPを入手できます。
時々2HKP入手できることも…？
※HIGACHAは1日1回まで回せます`;

    on(helpBtn, "click", () => {
      body.textContent = text;
      open();
    });
  }

  // ========= HIGACHA modal =========
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
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      try { lastFocus?.focus?.(); } catch {}
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

  // ========= MISSIONBRIEF + badge =========
  function setBriefBadge(kind /* "NEW"|"UPDATE"|null */) {
    const badge = $("briefBadge");
    if (!badge) return;
    if (!kind) {
      badge.hidden = true;
      badge.classList.remove("is-new");
      return;
    }
    badge.hidden = false;
    badge.textContent = kind;
    badge.classList.toggle("is-new", kind === "NEW");
  }

  function markBriefSeen(sig) {
    try { localStorage.setItem(BRIEF_SEEN_KEY, String(sig || "")); } catch {}
    setBriefBadge(null);
  }

  function initBrief() {
    const btn = $("btnBriefOpen");
    const one = $("briefOneLine");
    const list = $("briefList");
    if (!btn || !one || !list) return;

    const { open, close } = bindOverlayClose("briefOverlay", "briefClose");

    let currentSig = "";

    function openAndMark() {
      open();
      if (currentSig) markBriefSeen(currentSig);
    }
    on(btn, "click", openAndMark);

    fetch("./mission-brief.txt", { cache: "no-store" })
      .then((r) => r.ok ? r.text() : "")
      .then((txt) => {
        const raw = String(txt || "");
        const lines = raw
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);

        one.textContent = lines[0] || "（未読）";
        list.innerHTML = lines.slice(0, 80).map((line) => {
          return `<li class="briefItem"><div class="briefText">${escapeHtml(line)}</div></li>`;
        }).join("");

        currentSig = signatureOf(raw);
        try { localStorage.setItem(BRIEF_SIG_KEY, currentSig); } catch {}

        // decide badge
        const seen = String(localStorage.getItem(BRIEF_SEEN_KEY) || "");
        const head = (lines[0] || "");
        const headUpper = head.toUpperCase();

        // explicit prefix wins
        if (headUpper.startsWith("NEW:")) {
          setBriefBadge("NEW");
        } else if (headUpper.startsWith("UPDATE:")) {
          setBriefBadge("UPDATE");
        } else {
          // content changed since last seen -> UPDATE
          if (currentSig && seen && currentSig !== seen) setBriefBadge("UPDATE");
          else if (currentSig && !seen) setBriefBadge("NEW"); // first time -> NEW
          else setBriefBadge(null);
        }
      })
      .catch(() => {
        one.textContent = "（読み込み失敗）";
        list.innerHTML = "";
        setBriefBadge("UPDATE"); // “何かある”だけ伝える
      });
  }

  // ========= Install (always visible) =========
  function initInstall() {
    const btn = $("btnInstall");
    const hint = $("installHint");
    if (!btn) return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }

    let deferredPrompt = null;

    function setAvailable(available, msg) {
      btn.classList.toggle("is-disabled", !available);
      btn.setAttribute("aria-disabled", String(!available));
      if (!hint) return;

      if (available) {
        hint.hidden = true;
        hint.textContent = "";
        return;
      }
      if (msg) {
        hint.hidden = false;
        hint.textContent = msg;
      } else {
        hint.hidden = true;
        hint.textContent = "";
      }
    }

    setAvailable(false);

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setAvailable(true);
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      setAvailable(false, "インストール済みです（ホーム画面から起動できます）。");
    });

    on(btn, "click", async () => {
      if (!deferredPrompt) {
        setAvailable(false, "この環境ではインストールが利用できません（既にインストール済み／またはブラウザ制限の可能性）。");
        return;
      }
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null;
      setAvailable(false, "インストールが完了しない場合は、共有メニューから「ホーム画面に追加」をお試しください。");
    });
  }

  // ========= Logo fallback (show fallback only after all candidates fail) =========
  function initLogoFallback() {
    const img = $("topLogo");
    const fb = $("logoFallback");
    if (!img || !fb) return;

    const candidates = [
      "./H.K.LOBBY.png",
      "./H.K.LOBBY.PNG",
      "./H.K.LOBBY.webp",
      "./H.K.LOBBY.WEBP",
      "./H.K.LOBBY.jpg",
      "./H.K.LOBBY.JPG",
      "./H.K.LOBBY.jpeg",
      "./H.K.LOBBY.JPEG",
    ];

    let i = 0;
    fb.hidden = true;
    img.hidden = false;

    img.addEventListener("error", () => {
      i++;
      if (i >= candidates.length) {
        img.hidden = true;
        fb.hidden = false;
        return;
      }
      img.src = candidates[i];
    });

    img.src = candidates[0];
  }

  function initTabs() {
    on($("tabFlash"), "click", () => setMode("flash"));
    on($("tabBlitz"), "click", () => setMode("blitz"));
  }

  function boot() {
    initLogoFallback();

    renderFlash();
    renderBlitz();

    initTabs();

    const saved = localStorage.getItem(MODE_KEY);
    setMode(saved === "blitz" ? "blitz" : "flash");

    renderHKP();
    updateHigachaButtonState();
    renderRankPlaceholder();
    disableCardTotal();

    initHkpHelp();
    initHigacha();
    initBrief();
    initInstall();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
