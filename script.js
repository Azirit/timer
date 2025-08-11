const d = document;
const timeEl = d.getElementById('time');
const minsEl = d.getElementById('mins');
const secsEl = d.getElementById('secs');
const startBtn = d.getElementById('start');
const resetBtn = d.getElementById('reset');

let remaining = 0;
let timer = null;
let paused = false;
let isCountUp = false;

function fmt(n) { 
  return String(n).padStart(2, '0'); 
}

function render(t) {
  const m = Math.floor(t / 60), s = t % 60;
  timeEl.textContent = `${fmt(m)}:${fmt(s)}`;
}

function updateDisplay() {
  const m = parseInt(minsEl.value || '0', 10);
  const s = parseInt(secsEl.value || '0', 10);
  const total = m * 60 + Math.min(59, s);
  render(total);
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
    o.start(); 
    o.stop(ctx.currentTime + 0.6);
  } catch (e) {}
  
  if ('vibrate' in navigator) navigator.vibrate([120, 60, 120]);
}

function setQuickTime(minutes) {
  minsEl.value = minutes;
  secsEl.value = 0;
  isCountUp = false;
  updateDisplay();
  updateQuickButtons();
}

function startCountUp() {
  isCountUp = true;
  remaining = 0;
  minsEl.value = 0;
  secsEl.value = 0;
  updateDisplay();
  updateQuickButtons();
  
  startBtn.disabled = false;
  resetBtn.disabled = false;
  startBtn.textContent = 'Пауза';
  startBtn.classList.add('running');

  clearInterval(timer);
  timer = setInterval(() => {
    remaining++;
    render(remaining);
  }, 1000);
  render(remaining);
}

function start() {
  if (isCountUp) {
    // Если это обратный отсчет, останавливаем его
    clearInterval(timer);
    timer = null;
    startBtn.textContent = 'Старт';
    startBtn.classList.remove('running');
    isCountUp = false;
    return;
  }

  if (timer) {
    // Если таймер уже запущен, ставим на паузу
    pause();
    return;
  }

  const m = parseInt(minsEl.value || '0', 10);
  const s = parseInt(secsEl.value || '0', 10);
  const total = paused ? remaining : (m * 60 + Math.min(59, s));
  
  if (!total) return;

  remaining = total;
  paused = false;
  startBtn.textContent = 'Пауза';
  startBtn.classList.add('running');
  resetBtn.disabled = false;

  clearInterval(timer);
  timer = setInterval(() => {
    remaining--;
    render(remaining);
    if (remaining <= 0) {
      clearInterval(timer);
      startBtn.textContent = 'Старт';
      startBtn.classList.remove('running');
      timer = null;
      beep();
    }
  }, 1000);
  render(remaining);
}

function pause() {
  if (!timer) return;
  paused = true;
  clearInterval(timer);
  timer = null;
  startBtn.textContent = 'Старт';
  startBtn.classList.remove('running');
}

function reset() {
  paused = false;
  clearInterval(timer);
  timer = null;
  remaining = 0;
  isCountUp = false;
  startBtn.textContent = 'Старт';
  startBtn.classList.remove('running');
  render(0);
  startBtn.disabled = false;
  resetBtn.disabled = true;
  minsEl.value = '';
  secsEl.value = '';
  updateQuickButtons();
}

function updateQuickButtons() {
  const quickBtns = document.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn => btn.classList.remove('active'));
  
  if (isCountUp) {
    document.querySelector('.count-up-btn').classList.add('active');
  } else {
    const mins = parseInt(minsEl.value || '0');
    if (mins > 0) {
      const btn = document.querySelector(`[data-minutes="${mins}"]`);
      if (btn) btn.classList.add('active');
    }
  }
}

// Обработчики событий
startBtn.addEventListener('click', start);
resetBtn.addEventListener('click', reset);

// Обработчики для быстрых кнопок
document.addEventListener('DOMContentLoaded', function() {
  // Добавляем обработчики для быстрых кнопок
  const quickBtns = document.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.classList.contains('count-up-btn')) {
        startCountUp();
      } else {
        const minutes = parseInt(this.dataset.minutes);
        setQuickTime(minutes);
      }
    });
  });

  // Обработчики для полей ввода
  minsEl.addEventListener('input', updateDisplay);
  secsEl.addEventListener('input', updateDisplay);
});

// Первичная отрисовка
render(0);
