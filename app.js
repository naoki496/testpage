(() => {
  "use strict";

  // =========================
  // Keys
  // =========================
  const HKP_KEY = "hklobby.v1.hkp";
  const HIGACHA_LAST_KEY = "hklobby.v1.higacha.lastDate";
  const MODE_KEY = "testpage.v1.mode";

  // Mission brief badge
  const BRIEF_SIG_KEY  = "hklobby.v1.missionBrief.signature";
  const BRIEF_SEEN_KEY = "hklobby.v1.missionBrief.seenSignature";

  // Daily 50
  // st = {date, rewarded, touched}
  const DAILY_STATE_KEY = "hklobby.v1.flashDaily50";
  const DAILY_DEBUG = false; // testpage: true / 本番: false 推奨

  // FLASH apps should store today's seen count here (numbers)
  const FLASH_TODAY_KEYS = [
    "hk.flash.kobun.todaySeen",
    "hk.flash.jodoushi.todaySeen",
    "hk.flash.bungaku.todaySeen",
  ];

  // =========================
  // DOM helpers
  // =========================
  const $ = (id) => document.getElementById(id);
  const on = (node, ev, fn, opt) => node && node.addEventListener(ev, fn, opt);

  function todayYMD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function ymdToDate(ymd) {
    const [y, m, d] = String(ymd || "").split("-").map((v) => Number(v));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function diffDays(fromYMD, toYMD) {
    const a = ymdToDate(fromYMD);
    const b = ymdToDate(toYMD);
    if (!a || !b) return 0;
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / 86400000);
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

  // =========================
  // Contents
  // =========================
  const FLASH_CONTENTS = [
    { name: "古文単語330", href: "https://naoki496.github.io/flashcards/" },
    { name: "助動詞確認", href: "https://naoki496.github.io/hatto-kobun-jodoushi/" },
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
      name: "文学知識マスター",
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

  // =========================
  // Mode tabs
  // =========================
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

  // =========================
  // HKP / HIGACHA
  // =========================
  function getHKP() {
    const n = Number(localStorage.getItem(HKP_KEY));
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }

  function renderHKP() {
    const el = $("hkpValue");
    if (el) el.textContent = String(getHKP());
  }

  function setHKP(n) {
    const v = Math.max(0, Math.trunc(Number(n) || 0));
    localStorage.setItem(HKP_KEY, String(v));
    renderHKP();
    return v;
  }

  function addHKP(delta) {
    const next = getHKP() + (Number(delta) || 0);
    return setHKP(next);
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

  function renderRankPlaceholder() {
    const el = $("rankValue");
    if (el) el.textContent = "-";
  }

  function disableCardTotal() {
    const el = $("cardTotalValue");
    if (el) el.textContent = "-";
  }

  // =========================
  // Overlay close binding
  // =========================
  function bindOverlayClose(overlayId, closeId) {
    const overlay = $(overlayId);
    const closeBtn = $(closeId);
    if (!overlay || !closeBtn) return { open: () => {}, close: () => {} };

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

    return { open, close };
  }

  // =========================
  // EXPERT FX (dark +集中発光)
  // =========================
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

  function clearFxOverlay() {
    const fx = $("fxOverlay");
    if (!fx) return;
    fx.style.display = "none";
    fx.setAttribute("aria-hidden", "true");
  }

  // =========================
  // Render grids
  // =========================
  function renderFlash() {
    const grid = $("flashGrid");
    if (!grid) return;
    grid.innerHTML = "";

    FLASH_CONTENTS.forEach((c) => {
      const a = document.createElement("a");
      a.className = "aBtn primary";
      a.href = c.href;
      a.textContent = c.name;
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
      const expertLabel = expertDisabled ? "EXPERT（LOCK）" : "EXPERT";

      const expertAttrs = expertDisabled
        ? `class="aBtn danger is-disabled" aria-disabled="true" tabindex="-1"`
        : `class="aBtn danger" data-expert="1" data-expert-url="${escapeHtml(c.expertHref)}"`;

      card.innerHTML = `
        <div class="cardTitle">${escapeHtml(c.name)}</div>
        <div class="cardActions">
          <a class="aBtn primary" href="${c.normalHref}">NORMAL</a>
          <a ${expertAttrs} href="${expertDisabled ? "#" : c.expertHref}">${expertLabel}</a>
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

  // =========================
  // HKP Help
  // =========================
  function initHkpHelp() {
    const helpBtn = $("btnHkpHelp");
    const body = $("hkpHelpBody");
    if (!helpBtn || !body) return;

    const { open } = bindOverlayClose("hkpHelpOverlay", "hkpHelpClose");
    const text =
`★HKPとは？
Higashi Kokugo Point の略称。

BLITZQUESTの学習時、
一定条件でHKPを入手できます。
TOPページの「HIGACHA」を回すことでも
HKPを入手できます。
時々+2になることも…？

※HIGACHAは1日1回まで`;

    on(helpBtn, "click", () => {
      body.textContent = text;
      open();
    });
  }

  // =========================
  // Daily50 Help  ※仕様変更反映
  // =========================
  function initDailyHelp() {
    const btn = $("btnDailyHelp");
    const body = $("dailyHelpBody");
    if (!btn || !body) return;

    const { open } = bindOverlayClose("dailyHelpOverlay", "dailyHelpClose");
    const text =
`FLASH DAILY 50 とは？

FLASHCARDで「本日見たカード合計」が
一定枚数に到達すると、その日に限り
 +1HKP を付与（1日1回まで）。

ただし、放置しすぎると逆に
Dailyゲージが減少することも。

※カウントは端末の保存データ（localStorage）に記録されます。`;

    on(btn, "click", () => {
      body.textContent = text;
      open();
    });
  }

  // =========================
  // HIGACHA modal
  // =========================
  function initHigacha() {
    const btn = $("btnHigacha");
    const overlay = $("higachaOverlay");
    const closeBtn = $("higachaClose");
    const cancelBtn = $("higachaCancel");
    const drawBtn = $("higachaDraw");
    const msgEl = $("higachaMsg");
    if (!btn || !overlay || !closeBtn || !cancelBtn || !drawBtn || !msgEl) return;

    const { open, close } = (() => {
      let lastFocus = null;
      function _open() {
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
      function _close() {
        overlay.style.display = "none";
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        try { lastFocus?.focus?.(); } catch {}
        renderHKP();
        updateHigachaButtonState();
      }
      return { open:_open, close:_close };
    })();

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
      updateHigachaButtonState();
    });
  }

  // =========================
  // Mission brief + badge
  // =========================
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

    const { open, close } = bindOverlayClose("briefOverlay", "briefClose");
    let currentSig = "";

    function openBrief() {
      btn.classList.add("is-open");
      open();
      if (currentSig) {
        markBriefSeen(currentSig);
        btn.classList.add("is-seen");
      }
    }
    function closeBrief() {
      btn.classList.remove("is-open");
      close();
    }

    on(btn, "click", openBrief);
    on($("briefClose"), "click", closeBrief);
    on($("briefOverlay"), "click", (e) => { if (e.target === $("briefOverlay")) closeBrief(); });
    on(document, "keydown", (e) => {
      const ov = $("briefOverlay");
      if (e.key === "Escape" && ov && ov.style.display === "flex") closeBrief();
    });

    fetch("./mission-brief.txt", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((txt) => {
        const raw = String(txt || "");
        const lines = raw
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);

        const head = (lines[0] || "（未読）");
        const headUpper = head.toUpperCase();
        const headClean = headUpper.startsWith("NEW:") ? head.replace(/^NEW:\s*/i, "") :
                          headUpper.startsWith("UPDATE:") ? head.replace(/^UPDATE:\s*/i, "") :
                          head;

        one.textContent = headClean || "（未読）";

        list.innerHTML = lines.slice(0, 80).map((line) => {
          const up = line.toUpperCase();
          const clean = up.startsWith("NEW:") ? line.replace(/^NEW:\s*/i, "") :
                        up.startsWith("UPDATE:") ? line.replace(/^UPDATE:\s*/i, "") :
                        line;
          return `<li class="briefItem"><div class="briefText">${escapeHtml(clean)}</div></li>`;
        }).join("");

        currentSig = signatureOf(raw);
        try { localStorage.setItem(BRIEF_SIG_KEY, currentSig); } catch {}

        const seen = String(localStorage.getItem(BRIEF_SEEN_KEY) || "");

        if (headUpper.startsWith("NEW:")) setBriefBadge("NEW");
        else if (headUpper.startsWith("UPDATE:")) setBriefBadge("UPDATE");
        else {
          if (currentSig && seen && currentSig !== seen) setBriefBadge("UPDATE");
          else if (currentSig && !seen) setBriefBadge("NEW");
          else setBriefBadge(null);
        }

        if (currentSig && seen && currentSig === seen) btn.classList.add("is-seen");
      })
      .catch(() => {
        one.textContent = "（読み込み失敗）";
        list.innerHTML = "";
        setBriefBadge("UPDATE");
      });
  }

  // =========================
  // Install
  // =========================
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

  // =========================
  // Daily 50 logic  ※仕様変更反映
  // =========================
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

  // ✅ st の互換移行（旧: {date, progressed, streak, touched} でも壊さない）
  function normalizeDailyStateObject(st, today) {
    const o = (st && typeof st === "object") ? st : {};
    const date = String(o.date || today);

    // 旧仕様フィールドから推定
    const legacyProgressed = !!o.progressed;
    const legacyStreak = Math.max(0, Math.trunc(Number(o.streak) || 0));

    // 新仕様：rewarded（その日に+HKP付与済みか）
    const rewarded = !!o.rewarded || legacyProgressed || false;

    const touched = !!o.touched;

    return { date, rewarded, touched, __legacyStreak: legacyStreak };
  }

  function ensureDailyState() {
    const t = todayYMD();
    let stRaw = loadDailyState();
    let st = normalizeDailyStateObject(stRaw, t);

    // 日付が違うなら当日状態へリセット（1日1回ルール用）
    if (st.date !== t) {
      // 旧ロジックの減衰などは不要（仕様変更）
      // ただし touched は日次管理に必要なので reset
      st = { date: t, rewarded: false, touched: false };
      saveDailyState(st);
      return st;
    }

    // 当日でも、必要フィールドを補完
    st.date = t;
    st.rewarded = !!st.rewarded;
    st.touched = !!st.touched;

    // 旧streakが残っていても使わない（保存から落とす）
    saveDailyState({ date: st.date, rewarded: st.rewarded, touched: st.touched });
    return st;
  }

  function renderDailyUI(seen) {
    const seenEl = $("dailySeen");
    if (seenEl) seenEl.textContent = String(seen);

    const ring = $("dailyRingProg");
    const pct = Math.max(0, Math.min(100, (seen / 50) * 100));

    const barFill = $("dailyBarFill");
    if (barFill) barFill.style.width = pct.toFixed(1) + "%";

    if (ring) {
      const r = 22;
      const circ = 2 * Math.PI * r;
      ring.style.strokeDasharray = String(circ);
      ring.style.strokeDashoffset = String(circ * (1 - pct / 100));
    }

    const dbg = $("dailyDbg");
    if (dbg) dbg.hidden = !DAILY_DEBUG;
  }

  // ✅ 50到達で +1HKP（1日1回まで）
  function tryProgressDaily(st) {
    const seen = getTodaySeenTotal();

    if (seen > 0 && !st.touched) {
      st.touched = true;
      saveDailyState({ date: st.date, rewarded: st.rewarded, touched: st.touched });
    }

    renderDailyUI(seen);

    // すでに当日付与済みなら何もしない（100枚でも2回目は不可）
    if (st.rewarded) return;

    // 50未満なら付与しない
    if (seen < 50) return;

    // ✅ ここで1回だけ +1
    addHKP(1);
    st.rewarded = true;
    st.touched = true;
    saveDailyState({ date: st.date, rewarded: st.rewarded, touched: st.touched });

    renderDailyUI(seen);
  }

  function initDailyDebugControls() {
    if (!DAILY_DEBUG) return;

    const add10 = $("dbgAdd10");
    const add50 = $("dbgAdd50");
    const reset = $("dbgResetDaily");
    if (!add10 || !add50 || !reset) return;

    function bumpAny(n) {
      const k = FLASH_TODAY_KEYS[0];
      localStorage.setItem(k, String(readNum(k) + n));
    }

    on(add10, "click", () => {
      bumpAny(10);
      const st = ensureDailyState();
      tryProgressDaily(st);
    });

    on(add50, "click", () => {
      bumpAny(50);
      const st = ensureDailyState();
      tryProgressDaily(st);
    });

    on(reset, "click", () => {
      FLASH_TODAY_KEYS.forEach((k) => localStorage.setItem(k, "0"));
      const t = todayYMD();
      const st = { date: t, rewarded: false, touched: false };
      saveDailyState(st);
      const now = ensureDailyState();
      tryProgressDaily(now);
      renderHKP();
    });
  }

  // =========================
  // Sync on return (重要)
  // =========================
  function syncStatus() {
    clearFxOverlay();
    renderHKP();
    updateHigachaButtonState();
    const st = ensureDailyState();
    tryProgressDaily(st);
  }

  function initSyncHooks() {
    window.addEventListener("focus", syncStatus);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncStatus();
    });
    window.addEventListener("pageshow", syncStatus);

    window.addEventListener("storage", (e) => {
      if (!e) return;
      if (
        e.key === HKP_KEY ||
        e.key === HIGACHA_LAST_KEY ||
        e.key === DAILY_STATE_KEY ||
        (e.key && FLASH_TODAY_KEYS.includes(e.key))
      ) {
        syncStatus();
      }
    });
  }

  function initTabs() {
    on($("tabFlash"), "click", () => setMode("flash"));
    on($("tabBlitz"), "click", () => setMode("blitz"));
  }

  function boot() {
    clearFxOverlay();

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
    initDailyHelp();
    initHigacha();
    initBrief();
    initInstall();

    initDailyDebugControls();

    const st = ensureDailyState();
    tryProgressDaily(st);

    initSyncHooks();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
