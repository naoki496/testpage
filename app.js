(() => {
  "use strict";

  // =========================
  // helpers
  // =========================
  const $ = (id) => document.getElementById(id);
  const on = (node, ev, fn, opt) => node && node.addEventListener(ev, fn, opt);

  // ===== storage keys (shared) =====
  const KEY = {
    rank: "hklobby.v1.rank",
    hkp: "hklobby.v1.hkp",
    cardTotal: "hklobby.v1.cardTotal",
    dailySeen: "hklobby.v1.dailySeen",
    dailyLimit: "hklobby.v1.dailyLimit",
    higacha: "hklobby.v1.higacha",
    missionRead: "hklobby.v1.missionRead",
  };

  function clamp01(x){
    x = Number(x);
    if (!isFinite(x)) return 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function safeInt(v, fallback=0){
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  // =========================
  // STATUS render
  // =========================
  function renderStatus(){
    const rank = localStorage.getItem(KEY.rank) ?? "-";
    const hkp  = safeInt(localStorage.getItem(KEY.hkp), 0);
    const total = safeInt(localStorage.getItem(KEY.cardTotal), 0);

    const dailySeen = safeInt(localStorage.getItem(KEY.dailySeen), 0);
    const dailyLimit = safeInt(localStorage.getItem(KEY.dailyLimit), 50);

    const rankEl = $("rankValue");
    const hkpEl = $("hkpValue");
    const totalEl = $("cardTotalValue");

    if (rankEl) rankEl.textContent = rank;
    if (hkpEl) hkpEl.textContent = String(hkp);
    if (totalEl) totalEl.textContent = String(total || "-");

    // Daily bar
    const seenEl = $("dailySeen");
    const fillEl = $("dailyBarFill");
    if (seenEl) seenEl.textContent = String(dailySeen);

    const p = dailyLimit > 0 ? (dailySeen / dailyLimit) : 0;
    if (fillEl) fillEl.style.width = `${Math.round(clamp01(p)*100)}%`;
  }

  // =========================
  // overlays
  // =========================
  function bindOverlayClose(overlayId, closeId){
    const ov = $(overlayId);
    const x = $(closeId);

    function open(){
      if (!ov) return;
      ov.style.display = "flex";
      ov.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function close(){
      if (!ov) return;
      ov.style.display = "none";
      ov.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    on(x, "click", close);
    on(ov, "click", (e) => {
      if (e.target === ov) close();
    });

    return { open, close };
  }

  // =========================
  // HKP Help
  // =========================
  function initHkpHelp(){
    const btn = $("btnHkpHelp");
    const body = $("hkpHelpBody");
    if (!btn || !body) return;

    const { open } = bindOverlayClose("hkpHelpOverlay", "hkpHelpClose");
    const text =
`HKP（Higashi Kokugo Point）とは？

各コンテンツの学習で獲得できるポイントです。
獲得量や条件はコンテンツ側の仕様に準拠します。`;

    on(btn, "click", () => {
      body.textContent = text;
      open();
    });
  }

  
  // =========================
  // Daily50 Help
  // =========================
  function initDailyHelp() {
    const btn = $("btnDailyHelp");
    const body = $("dailyHelpBody");
    if (!btn || !body) return;

    const { open } = bindOverlayClose("dailyHelpOverlay", "dailyHelpClose");
    const text =
`FLASH DAILY 50 とは？

FLASHCARD（古文単語330 / 助動詞確認 / 文学知識総合）で
「本日見たカード枚数（合計）」をカウントします。

・目標：50
・データは端末内（localStorage）に保存されます。`;

    on(btn, "click", () => {
      body.textContent = text;
      open();
    });
  }

  // =========================
  // Mission brief loader
  // =========================
  async function initMission(){
    const btn = $("btnMission");
    const body = $("missionBody");
    const badge = $("missionBadge");
    const unread = $("missionUnread");
    if (!btn || !body) return;

    const readKey = KEY.missionRead;
    const markRead = () => localStorage.setItem(readKey, "1");

    async function loadText(){
      try{
        const res = await fetch("./mission-brief.txt", { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed");
        return await res.text();
      }catch{
        return "（mission-brief.txt が見つかりませんでした）";
      }
    }

    let opened = false;
    on(btn, "click", async () => {
      opened = !opened;
      if (opened){
        body.hidden = false;
        const text = await loadText();
        body.textContent = text;

        // mark read
        markRead();
        if (badge) badge.textContent = "UPDATE";
        if (unread) unread.textContent = "";
      }else{
        body.hidden = true;
      }
    });

    // initial unread state
    const read = localStorage.getItem(readKey) === "1";
    if (unread) unread.textContent = read ? "" : "（未読）";
  }

  // =========================
  // HIGACHA modal / draw
  // =========================
  function initHigacha(){
    const btn = $("btnHigacha");
    const btnOpen = $("btnHigachaOpen");
    const btnClose = $("btnHigachaClose");
    const ov = $("higachaOverlay");
    const draw = $("btnDraw");

    const { open, close } = bindOverlayClose("higachaOverlay", "higachaClose");

    function canDraw(){
      const last = localStorage.getItem(KEY.higacha);
      if (!last) return true;
      const d = new Date(last);
      if (isNaN(d.getTime())) return true;

      const now = new Date();
      // same local date => already drawn
      return !(now.getFullYear() === d.getFullYear() &&
               now.getMonth() === d.getMonth() &&
               now.getDate() === d.getDate());
    }

    function setDisabled(disabled){
      if (btn) btn.classList.toggle("is-disabled", disabled);
      if (btn) btn.disabled = disabled;
      if (btnOpen) btnOpen.disabled = disabled;
    }

    function refresh(){
      setDisabled(!canDraw());
    }

    // open from status button
    on(btn, "click", () => {
      refresh();
      if (!canDraw()) return;
      open();
    });

    // open from bottom button
    on(btnOpen, "click", () => {
      refresh();
      if (!canDraw()) return;
      open();
    });

    // close helper
    on(btnClose, "click", close);
    on(ov, "click", (e) => {
      if (e.target === ov) close();
    });

    // draw
    on(draw, "click", () => {
      if (!canDraw()) return;

      localStorage.setItem(KEY.higacha, new Date().toISOString());
      close();
      refresh();
      alert("DRAWしました（このデモでは結果演出は省略）");
    });

    refresh();
  }

  // =========================
  // install prompt (PWA)
  // =========================
  function initInstall(){
    const btn = $("btnInstall");
    if (!btn) return;

    let deferredPrompt = null;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btn.hidden = false;
    });

    on(btn, "click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.hidden = true;
    });
  }

  // =========================
  // bottom shortcuts
  // =========================
  function initBottom(){
    const btnHkp = $("btnHkp");
    const btnDaily = $("btnDaily");

    const { open: openHkp } = bindOverlayClose("hkpHelpOverlay", "hkpHelpClose");
    const { open: openDaily } = bindOverlayClose("dailyHelpOverlay", "dailyHelpClose");

    on(btnHkp, "click", () => openHkp());
    on(btnDaily, "click", () => openDaily());
  }

  // =========================
  // boot
  // =========================
  function boot(){
    renderStatus();
    initHkpHelp();
    initDailyHelp();
    initMission();
    initHigacha();
    initInstall();
    initBottom();

    // live update when other tabs update storage
    window.addEventListener("storage", renderStatus);

    // periodic refresh (safe)
    setInterval(renderStatus, 1500);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
