const d = document;
const live = d.getElementById('aria-live');
const timeEl = d.getElementById('time');
const minsEl = d.getElementById('mins');
const secsEl = d.getElementById('secs');
const startBtn = d.getElementById('start');
const resetBtn = d.getElementById('reset');
const fsBtn = document.getElementById('fsbtn');
const micBtn = document.getElementById('micbtn');

let remainingMs = 0;
let timer = null;
let paused = false;
let isCountUp = false;
let wakeLock = null;
let buttonMode = 'ready'; // 'ready' | 'running' | 'paused'

let recog = null;

function announce(msg){ if(live){ live.textContent = msg; } }
const clamp = (n,min,max)=> Math.min(max, Math.max(min,n));

function fmt2(n){ return String(n).padStart(2,'0'); }
function renderMs(ms){
  const totalCs = Math.max(0, Math.floor(ms/10)); // сотые
  const cs = totalCs % 100; // 0..99
  const sec = Math.floor(totalCs/100) % 60;
  const min = Math.floor(totalCs/6000);
  timeEl.textContent = `${fmt2(min)}:${fmt2(sec)}:${fmt2(cs)}`;
  timeEl.setAttribute('aria-label', `Оставшееся время ${min} минут ${sec} секунд и ${cs} сотых`);
}

function inputsToMs(){
  const m = clamp(parseInt(minsEl.value || '0',10),0,99);
  const s = clamp(parseInt(secsEl.value || '0',10),0,59);
  return (m*60 + s) * 1000;
}

function isFullscreen(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
async function toggleFullscreen(){
  try{
    if (!isFullscreen()){
      const root = document.documentElement;
      await (root.requestFullscreen?.() || root.webkitRequestFullscreen?.());
      fsBtn?.setAttribute('data-state','on');
    } else {
      await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
      fsBtn?.setAttribute('data-state','off');
    }
  }catch(e){}
}

fsBtn?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', ()=>{
  fsBtn?.setAttribute('data-state', isFullscreen() ? 'on' : 'off');
});

// локализация текста на кнопке пуск через data-атрибуты
function setButtonState(mode){
  buttonMode = mode;
  const startLabel = startBtn.getAttribute('data-label-start') || 'Пуск';
  const pauseLabel = startBtn.getAttribute('data-label-pause') || 'Пауза';
  const resumeLabel = startBtn.getAttribute('data-label-resume') || 'Возобновить';
  if (mode === 'running'){
    startBtn.classList.add('running'); startBtn.textContent = pauseLabel; startBtn.setAttribute('aria-label', pauseLabel);
  } else if (mode === 'paused'){
    startBtn.classList.remove('running'); startBtn.textContent = resumeLabel; startBtn.setAttribute('aria-label', resumeLabel);
  } else {
    startBtn.classList.remove('running'); startBtn.textContent = startLabel; startBtn.setAttribute('aria-label', startLabel);
  }
}

function renderFromInputs(){ renderMs(inputsToMs()); }

async function requestWakeLock(){
  try{ if ('wakeLock' in navigator){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release',()=>{ wakeLock=null; }); } }
  catch(e){}
}
function releaseWakeLock(){ try{ wakeLock?.release(); wakeLock=null; }catch(e){} }

function beep(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.6);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.6);
  }catch(e){}
  if('vibrate' in navigator) navigator.vibrate([120,60,120]);
  announce('Таймер завершён');
}

function stopAndReady(){
  clearInterval(timer); timer=null; paused=false; isCountUp=false;
  setButtonState('ready'); resetBtn.disabled = true; releaseWakeLock();
}

function setQuickTime(minutes){
  stopAndReady();
  minsEl.value = clamp(minutes,0,99);
  secsEl.value = 0;
  renderFromInputs(); updateQuickButtons();
  announce(`Установлено ${minutes} минут`);
}

function runLoop(updateFn){
  let last = performance.now();
  clearInterval(timer);
  timer = setInterval(()=>{
    const now = performance.now(); const delta = Math.round(now - last); last = now; updateFn(delta);
  }, 10); // 10мс тик
}

function startCountUp(resume=false){
  isCountUp = true;
  if (!resume){ remainingMs = 0; minsEl.value = 0; secsEl.value = 0; renderFromInputs(); }
  updateQuickButtons(); resetBtn.disabled = false; setButtonState('running'); requestWakeLock();
  runLoop((delta)=>{ remainingMs += delta; renderMs(remainingMs); });
  renderMs(remainingMs);
  announce(resume ? 'Продолжен счёт от нуля' : 'Запущен счёт от нуля');
}

function startCountdown(resume=false){
  if (!resume){ remainingMs = inputsToMs(); }
  if (!remainingMs){ startCountUp(); return; }
  isCountUp = false; paused=false; resetBtn.disabled=false; setButtonState('running'); requestWakeLock();
  runLoop((delta)=>{
    remainingMs -= delta; renderMs(remainingMs);
    if (remainingMs <= 0){ clearInterval(timer); timer=null; setButtonState('ready'); releaseWakeLock(); beep(); }
  });
  renderMs(remainingMs);
  announce(resume ? 'Таймер возобновлён' : 'Таймер запущен');
}

function start(){
  if (buttonMode === 'running'){ pause(); return; }
  if (buttonMode === 'paused'){ if (isCountUp) startCountUp(true); else startCountdown(true); return; }
  const totalMs = inputsToMs();
  if (!totalMs){ startCountUp(false); return; }
  startCountdown(false);
}

function pause(){
  if (!timer) return; paused = true; clearInterval(timer); timer=null; setButtonState('paused'); releaseWakeLock(); announce('Таймер на паузе'); }

function reset(){
  paused=false; clearInterval(timer); timer=null; remainingMs=0; isCountUp=false; setButtonState('ready'); renderMs(0); startBtn.disabled=false; resetBtn.disabled=true; minsEl.value=''; secsEl.value=''; updateQuickButtons(); releaseWakeLock(); announce('Сброс таймера'); }

function updateQuickButtons(){
  const quickBtns = document.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn=>{ btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); });
  if (isCountUp){ const el = document.querySelector('.count-up-btn'); if(el){ el.classList.add('active'); el.setAttribute('aria-pressed','true'); } }
  else { const mins = parseInt(minsEl.value||'0'); if (mins>0){ const btn=d.querySelector(`[data-minutes="${mins}"]`); if(btn){ btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); } } }
}

function supportedSpeech(){ return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window; }
function createRecognizer(){
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition; if(!Ctor) return null;
  const r = new Ctor();
  r.lang = document.documentElement.lang === 'en' ? 'en-US' : 'ru-RU';
  r.interimResults = false; r.maxAlternatives = 1; return r;
}

function parseTimeCommand(text){
  const t = text.toLowerCase().replaceAll(',', '.').replace(/\s+/g,' ').trim();
  // команды управления
  if (/(старт|пуск|запусти|поехали|start|go|begin)/.test(t)) return {cmd:'start'};
  if (/(пауза|останови|pause|hold|stop)/.test(t)) return {cmd:'pause'};
  if (/(сброс|reset|clear)/.test(t)) return {cmd:'reset'};

  // время: минуты и секунды
  // ru: "установи время на 3 минуты 40 секунд", "3 мин 5 сек"
  const ru = /(?:(\d{1,2})\s*(?:мин|минут[уы]?))?\s*(?:(\d{1,2})\s*(?:сек|секунд[уы]?))?/;
  const en = /(?:(\d{1,2})\s*(?:m|minute|minutes))?\s*(?:(\d{1,2})\s*(?:s|sec|second|seconds))?/;
  let m=null,s=null;
  const m1 = ru.exec(t) || en.exec(t);
  if (m1){ m = m1[1] ? parseInt(m1[1]) : 0; s = m1[2] ? parseInt(m1[2]) : 0; }
  if (m===null && s===null){
    // простая форма: "3:40" или "3 40"
    const x = /^(\d{1,2})[:\s](\d{1,2})$/.exec(t);
    if (x){ m=parseInt(x[1]); s=parseInt(x[2]); }
  }
  if (Number.isInteger(m) || Number.isInteger(s)){
    m = clamp(m||0,0,99); s = clamp(s||0,0,59);
    return {cmd:'set', m, s};
  }
  return null;
}

function startMic(){
  if (!supportedSpeech()) { announce('Голосовой ввод не поддерживается'); return; }
  recog = createRecognizer(); if (!recog) return;
  micBtn?.setAttribute('aria-pressed','true');
  try{ recog.start(); }catch(e){}
  recog.onresult = (e)=>{
    const text = e.results[0][0].transcript || ''; announce('Распознано: '+text);
    const res = parseTimeCommand(text);
    if (!res){ micBtn?.setAttribute('aria-pressed','false'); return; }
    if (res.cmd==='start'){ start(); }
    else if (res.cmd==='pause'){ pause(); }
    else if (res.cmd==='reset'){ reset(); }
    else if (res.cmd==='set'){
      minsEl.value = res.m; secsEl.value = res.s; renderFromInputs(); updateQuickButtons(); resetBtn.disabled=false; setButtonState('ready');
    }
    micBtn?.setAttribute('aria-pressed','false');
  };
  recog.onend = ()=>{ micBtn?.setAttribute('aria-pressed','false'); };
  recog.onerror = ()=>{ micBtn?.setAttribute('aria-pressed','false'); };
}

micBtn?.addEventListener('click', startMic);

if ('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('/service-worker.js').catch(()=>{}); }); }

function onKey(e){
  const k=e.key.toLowerCase();
  if (k===' '||k==='enter'){ e.preventDefault(); start(); }
  if (k==='r'){ e.preventDefault(); reset(); }
  if(['1','3','5','6','7','0'].includes(k)){ e.preventDefault(); if(k==='0') setQuickTime(0); else setQuickTime(parseInt(k,10)); }
}

d.addEventListener('keydown', onKey);
startBtn.addEventListener('click', start);
resetBtn.addEventListener('click', reset);

document.addEventListener('DOMContentLoaded', function(){
  const quickBtns = document.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn=>{ btn.addEventListener('click', function(){ if(this.classList.contains('count-up-btn')) setQuickTime(0); else setQuickTime(parseInt(this.dataset.minutes)); }); });
  const onEdit = ()=>{ clearInterval(timer); timer=null; paused=false; isCountUp=false; resetBtn.disabled=true; setButtonState('ready'); renderFromInputs(); releaseWakeLock(); updateQuickButtons(); };
  minsEl.addEventListener('input', onEdit);
  secsEl.addEventListener('input', onEdit);
});

renderMs(0);

