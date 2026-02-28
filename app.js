(() => {
  "use strict";

  // ========= Keys =========
  const HKP_KEY = "hklobby.v1.hkp";
  const HIGACHA_LAST_KEY = "hklobby.v1.higacha.lastDate";
  const MODE_KEY = "testpage.v1.mode";

  // Mission brief badge
  const BRIEF_SIG_KEY = "hklobby.v1.missionBrief.signature";
  const BRIEF_SEEN_KEY = "hklobby.v1.missionBrief.seenSignature";

  // Daily 50 system
  const DAILY_STATE_KEY = "hklobby.v1.flashDaily50"; // {date, progressed, streak(0-4)}
  const DAILY_DEBUG = true; // テストpageではtrue、本番ではfalse推奨

  // FLASH apps should store today's seen count here (numbers)
  const FLASH_TODAY_KEYS = [
    "hk.flash.kobun.todaySeen",
    "hk.flash.jodoushi.todaySeen",
    "hk.flash.bungaku.todaySeen",
  ];

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

  function signatureOf(text) {
    const s = String(text ?? "").replace(/\r\n/g, "\n").trim();
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  // ========= Contents (names must NOT change on UI text) =========
  const FLASH_CONTENTS = [
    { name: "古文単語", href: "https://naoki496.github.io/flashcards/" },
    { name: "助動詞", href: "https://naoki496.github.io/hatto-kobun-jodoushi/" },
    { name: "文学知識総合", href: "https://naoki496.github.io/bungaku/" },
  ];

  const BLITZ_CONTENTS = [
    {
      name: "古文単語330マスター",
      normalHref: "https://naoki496.github.io/kobun-quiz/",
      expertHref: "https://naoki496.github.io/kobun-quiz/expert.html",
      expertEnabled: true,
    },
    {
      name: "文学史知識マスター",
      normalHref: "https://naoki496.github.io/bungakusi-quiz/",
      expertHref: "",
      expertEnabled: false,
    },
    {
      name: "漢字読解マスター",
      normalHref: "https://naoki496.github.io/kanji-y-quiz/",
      expertHref: "",
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

  // ========= Overlay close binding =========
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

  // ========= EXPERT FX =========
  function playExpertFxThenNavigate(url) {
    const fx = $("fxOverlay");
    if (!fx) {
      location.href = url;
      return;
    }
    fx.style.display = "flex";
    fx.setAttribute("aria-hidden", "false");
    setTimeout(() => { location.href = url; }, 380);
  }

  // ========= Render grids =========
  function renderFlash() {
    const grid = $("flashGrid");
    if (!grid) return;
    grid.innerHTML = "";

    FLASH_CONTENTS.forEach((c) => {
      const a = document.createElement("a");
      a.className = "aBtn primary hasGauge";
      a.href = c.href;
      a.innerHTML = `${escapeHtml(c.name)}<span class="gauge" aria-hidden="true"><i style="width:0%"></i></span>`;
      grid.appendChild(a);
    });
  }

  function renderBlitz() {
    const grid = $("blitzGrid");
    if (!grid) return;
    grid.innerHTML = "";

    BLITZ_CONTENTS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "card";

      const expertDisabled = !c.expertEnabled || !c.expertHref;
      const expertAttrs = expertDisabled
        ? `class="aBtn danger is-disabled" aria-disabled="true" tabindex="-1"`
        : `class="aBtn danger" data-expert="1" data-expert-url="${escapeHtml(c.expertHref)}"`;

      card.innerHTML = `
        <div class="cardTitle">${escapeHtml(c.name)}</div>
        <div class="cardActions">
          <a class="aBtn primary" href="${c.normalHref}">NORMAL</a>
          <a ${expertAttrs} href="${expertDisabled ? "#" : c.expertHref}">EXPERT</a>
        </div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll('a[data-expert="1"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const url = a.getAttribute("data-expert-url");
        if (!url) return;
        e.preventDefault();
        playExpertFxThenNavigate(url);
      });
    });
  }

  // ========= HKP Help =========
  function initHkpHelp() {
    const helpBtn = $("btnHkpHelp");
    const body = $("hkpHelpBody");
    if (!helpBtn || !body) return;

    const { open } = bindOverlayClose("hkpHelpOverlay", "hkpHelpClose");
    const text =
`★HKPとは？
Higashi Kokugo Pointの略称。

BLITZ QUESTの学習時、
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

  // ========= HIGACHA =========
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

    on(drawBtn, "click", () => {
      if (!canHigachaToday()) return;
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
  function setBriefBadge(kind) {
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

    const { open } = bindOverlayClose("briefOverlay", "briefClose");
    let currentSig = "";

    on(btn, "click", () => {
      open();
      if (currentSig) markBriefSeen(currentSig);
    });

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

        const seen = String(localStorage.getItem(BRIEF_SEEN_KEY) || "");
        const head = (lines[0] || "");
        const headUpper = head.toUpperCase();

        if (headUpper.startsWith("NEW:")) setBriefBadge("NEW");
        else if (headUpper.startsWith("UPDATE:")) setBriefBadge("UPDATE");
        else {
          if (currentSig && seen && currentSig !== seen) setBriefBadge("UPDATE");
          else if (currentSig && !seen) setBriefBadge("NEW");
          else setBriefBadge(null);
        }
      })
      .catch(() => {
        one.textContent = "（読み込み失敗）";
        list.innerHTML = "";
        setBriefBadge("UPDATE");
      });
  }

  // ========= Install =========
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

  // ========= Logo fallback =========
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

  // ========= Daily 50 logic =========
  function readNum(key) {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }

  function loadDailyState() {
    try {
      const raw = localStorage.getItem(DAILY_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveDailyState(st) {
    try { localStorage.setItem(DAILY_STATE_KEY, JSON.stringify(st)); } catch {}
  }

  function getTodaySeenTotal() {
    return FLASH_TODAY_KEYS.reduce((sum, k) => sum + readNum(k), 0);
  }

  function ensureDailyState() {
    const t = todayYMD();
    let st = loadDailyState();
    if (!st || st.date !== t) {
      st = { date: t, progressed: false, streak: Number(st?.streak) || 0 };
      // 日付が変わっても streak は保持（5到達まで積み上げ）
      saveDailyState(st);
    }
    st.streak = Math.max(0, Math.min(4, Math.trunc(Number(st.streak) || 0)));
    st.progressed = !!st.progressed;
    return st;
  }

  function renderDailyUI(seen, st) {
    const seenEl = $("dailySeen");
    const fillEl = $("dailyBarFill");
    if (seenEl) seenEl.textContent = String(seen);

    const pct = Math.max(0, Math.min(100, (seen / 50) * 100));
    if (fillEl) fillEl.style.width = `${pct.toFixed(1)}%`;

    const steps = [$("step1"), $("step2"), $("step3"), $("step4"), $("step5")];
    const s = (Number(st?.streak) || 0);
    steps.forEach((el, idx) => {
      if (!el) return;
      el.classList.toggle("on", idx < s);
    });

    const dbg = $("dailyDbg");
    if (dbg) dbg.hidden = !DAILY_DEBUG;
  }

  function tryProgressDaily(st) {
    // 1日1回：seen>=50 のときだけ進行
    const seen = getTodaySeenTotal();
    renderDailyUI(seen, st);

    if (st.progressed) return; // 今日すでに進行済み
    if (seen < 50) return;

    // 進行
    st.progressed = true;
    st.streak = Math.min(5, (Number(st.streak) || 0) + 1);

    // 5回到達で +2 HKP / streak reset
    if (st.streak >= 5) {
      addHKP(2);
      st.streak = 0;
      // “達成演出”は必要なら後で（今は堅牢優先）
    }

    saveDailyState(st);
    renderHKP();
    renderDailyUI(seen, st);
  }

  function initDailyDebugControls() {
    if (!DAILY_DEBUG) return;
    const add10 = $("dbgAdd10");
    const add50 = $("dbgAdd50");
    const reset = $("dbgResetDaily");

    function bumpAll(n) {
      // kobunに寄せて入れる（テスト用）
      const k = FLASH_TODAY_KEYS[0];
      localStorage.setItem(k, String(readNum(k) + n));
    }

    on(add10, "click", () => {
      bumpAll(10);
      const st = ensureDailyState();
      tryProgressDaily(st);
    });
    on(add50, "click", () => {
      bumpAll(50);
      const st = ensureDailyState();
      tryProgressDaily(st);
    });
    on(reset, "click", () => {
      // 今日のseenを0、今日の進行フラグをfalse（streakは維持）
      FLASH_TODAY_KEYS.forEach((k) => localStorage.setItem(k, "0"));
      const t = todayYMD();
      const prev = loadDailyState();
      const st = { date: t, progressed: false, streak: Number(prev?.streak) || 0 };
      saveDailyState(st);
      tryProgressDaily(st);
    });
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

    // Daily 50
    initDailyDebugControls();
    const st = ensureDailyState();
    tryProgressDaily(st);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
