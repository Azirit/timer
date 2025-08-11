const d = document;
const live = d.getElementById('aria-live');
const timeEl = d.getElementById('time');
const minsEl = d.getElementById('mins');
const secsEl = d.getElementById('secs');
const startBtn = d.getElementById('start');
const resetBtn = d.getElementById('reset');

let remaining = 0;
let timer = null;
let paused = false;
let isCountUp = false;

function announce(msg){ if(live){ live.textContent = msg; } }

function fmt(n) { return String(n).padStart(2, '0'); }
function render(t) {
  const m = Math.floor(t / 60), s = t % 60;
  const out = `${fmt(m)}:${fmt(s)}`;
  timeEl.textContent = out;
  timeEl.setAttribute('aria-label', `Оставшееся время ${m} минут ${s} секунд`);
}
function updateDisplay() {
  const m = parseInt(minsEl.value || '0', 10);
  const s = parseInt(secsEl.value || '0', 10);
  const total = m * 60 + Math.min(59, s);
  render(total);
}
function setButtonState(running) {
  if (running) {
    startBtn.classList.add('running');
    startBtn.textContent = 'Пауза';
    startBtn.setAttribute('aria-label', 'Пауза');
    startBtn.setAttribute('title', 'Пауза (Space/Enter)');
  } else {
    startBtn.classList.remove('running');
    startBtn.textContent = 'Старт';
    startBtn.setAttribute('aria-label', 'Старт');
    startBtn.setAttribute('title', 'Старт (Space/Enter)');
  }
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.6);
  } catch (e) {}
  if ('vibrate' in navigator) navigator.vibrate([120, 60, 120]);
  announce('Таймер завершён');
}

function setQuickTime(minutes) {
  minsEl.value = minutes;
  secsEl.value = 0;
  isCountUp = false;
  updateDisplay();
  updateQuickButtons();
  announce(`Установлено ${minutes} минут`);
}

function startCountUp() {
  isCountUp = true;
  remaining = paused ? remaining : 0;
  if (!paused) { minsEl.value = 0; secsEl.value = 0; updateDisplay(); }
  updateQuickButtons();
  resetBtn.disabled = false;
  setButtonState(true);
  clearInterval(timer);
  timer = setInterval(() => { remaining++; render(remaining); }, 1000);
  render(remaining);
  announce('Запущен счёт от нуля');
}

function start() {
  if (timer) { pause(); return; }
  if (isCountUp && paused) { paused = false; startCountUp(); return; }

  const m = parseInt(minsEl.value || '0', 10);
  const s = parseInt(secsEl.value || '0', 10);
  const total = paused ? remaining : (m * 60 + Math.min(59, s));
  if (!total && !paused) { startCountUp(); return; }
  if (!total) return;

  isCountUp = false;
  remaining = total;
  paused = false;
  resetBtn.disabled = false;
  setButtonState(true);
  clearInterval(timer);
  timer = setInterval(() => {
    remaining--; render(remaining);
    if (remaining <= 0) { clearInterval(timer); timer=null; setButtonState(false); beep(); }
  }, 1000);
  render(remaining);
  announce('Таймер запущен');
}

function pause() {
  if (!timer) return;
  paused = true;
  clearInterval(timer); timer = null;
  setButtonState(false);
  announce('Таймер на паузе');
}

function reset() {
  paused = false; clearInterval(timer); timer = null;
  remaining = 0; isCountUp = false; setButtonState(false);
  render(0); startBtn.disabled = false; resetBtn.disabled = true;
  minsEl.value = ''; secsEl.value = ''; updateQuickButtons();
  announce('Сброс таймера');
}

function updateQuickButtons() {
  const quickBtns = document.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn => btn.classList.remove('active'));
  quickBtns.forEach(btn => btn.setAttribute('aria-pressed','false'));
  if (isCountUp) {
    const el = document.querySelector('.count-up-btn');
    if(el){ el.classList.add('active'); el.setAttribute('aria-pressed','true'); }
  } else {
    const mins = parseInt(minsEl.value || '0');
    if (mins > 0) {
      const btn = document.querySelector(`[data-minutes="${mins}"]`);
      if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); }
    }
  }
}

// Клавиатура
function onKey(e){
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { e.preventDefault(); start(); }
  if (k === 'r') { e.preventDefault(); reset(); }
  if (['1','3','5','6','7','0'].includes(k)) {
    e.preventDefault();
    if (k === '0') { startCountUp(); }
    else { setQuickTime(parseInt(k,10)); }
  }
}

d.addEventListener('keydown', onKey);

startBtn.addEventListener('click', start);
resetBtn.addEventListener('click', reset);

document.addEventListener('DOMContentLoaded', function() {
  const quickBtns = document.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.classList.contains('count-up-btn')) { startCountUp(); }
      else { const minutes = parseInt(this.dataset.minutes); setQuickTime(minutes); }
    });
  });
  minsEl.addEventListener('input', updateDisplay);
  secsEl.addEventListener('input', updateDisplay);
});

render(0);

