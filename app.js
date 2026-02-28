(() => {
  "use strict";

  const HKP_KEY = "hklobby.v1.hkp";
  const MODE_KEY = "testpage.v1.mode";

  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  /* ===== DATA ===== */
  const FLASH_CONTENTS = [
    { name: "古文単語", href: "https://naoki496.github.io/flashcards/" },
    { name: "助動詞", href: "https://naoki496.github.io/hatto-kobun-jodoushi/" },
    { name: "文学知識総合", href: "https://naoki496.github.io/bungaku/" }
  ];

  const BLITZ_CONTENTS = [
    {
      name: "古文単語330マスター",
      normal: "https://naoki496.github.io/kobun-quiz/",
      expert: "https://naoki496.github.io/kobun-quiz/expert.html",
      expertEnabled: true
    },
    {
      name: "文学史知識マスター",
      normal: "https://naoki496.github.io/bungakusi-quiz/",
      expertEnabled: false
    },
    {
      name: "漢字読解マスター",
      normal: "https://naoki496.github.io/kanji-y-quiz/",
      expertEnabled: false
    }
  ];

  /* ===== MODE ===== */
  function setMode(mode){
    $("panelFlash").hidden = mode !== "flash";
    $("panelBlitz").hidden = mode !== "blitz";
    $("tabFlash").classList.toggle("is-on", mode==="flash");
    $("tabBlitz").classList.toggle("is-on", mode==="blitz");
    localStorage.setItem(MODE_KEY, mode);
  }

  /* ===== RENDER ===== */
  function renderFlash(){
    const g = $("flashGrid");
    g.innerHTML = "";
    FLASH_CONTENTS.forEach(c=>{
      const d = document.createElement("div");
      d.className = "card";
      d.innerHTML = `
        <div class="cardActions">
          <a class="aBtn primary" href="${c.href}">${c.name}</a>
        </div>`;
      g.appendChild(d);
    });
  }

  function renderBlitz(){
    const g = $("blitzGrid");
    g.innerHTML = "";
    BLITZ_CONTENTS.forEach(c=>{
      const d = document.createElement("div");
      d.className = "card";
      d.innerHTML = `
        <div class="cardTitle">${c.name}</div>
        <div class="cardActions">
          <a class="aBtn primary" href="${c.normal}">NORMAL</a>
          ${
            c.expertEnabled
              ? `<a class="aBtn danger" href="${c.expert}">EXPERT</a>`
              : `<a class="aBtn danger is-disabled">EXPERT</a>`
          }
        </div>`;
      g.appendChild(d);
    });
  }

  /* ===== HKP ===== */
  function renderHKP(){
    $("hkpValue").textContent = localStorage.getItem(HKP_KEY) || "0";
  }

  /* ===== BRIEF ===== */
  function initBrief(){
    on($("btnBriefOpen"),"click",()=>$("briefOverlay").style.display="flex");
    on($("briefClose"),"click",()=>$("briefOverlay").style.display="none");

    fetch("./mission-brief.txt",{cache:"no-store"})
      .then(r=>r.text())
      .then(t=>{
        const lines=t.split(/\r?\n/).filter(Boolean);
        $("briefOneLine").textContent=lines[0]||"（未読）";
        $("briefList").innerHTML=lines.map(l=>`<li class="briefItem"><div class="briefText">${l}</div></li>`).join("");
      });
  }

  /* ===== INIT ===== */
  document.addEventListener("DOMContentLoaded",()=>{
    renderFlash();
    renderBlitz();
    renderHKP();
    initBrief();

    on($("tabFlash"),"click",()=>setMode("flash"));
    on($("tabBlitz"),"click",()=>setMode("blitz"));

    setMode(localStorage.getItem(MODE_KEY)||"flash");
  });
})();
