const $=id=>document.getElementById(id);
const DAILY_MAX=50;

function setRing(val){
  const r=22,c=2*Math.PI*r;
  const p=Math.min(val/DAILY_MAX,1);
  $('dailyRingProg').style.strokeDashoffset=c*(1-p);
  $('dailySeen').textContent=val;
}

$('btnHkpHelp').onclick=()=>{$('hkpModal').style.display='flex'};
$('btnDailyHelp').onclick=()=>{$('dailyModal').style.display='flex'};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('.overlay').style.display='none');

setRing(0);
