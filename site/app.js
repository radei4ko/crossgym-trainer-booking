const API = 'https://n8n.morthain.com/webhook';
const API_BOOK = API + '/trainer-booking-book';
const API_MINE = API + '/trainer-booking-mine';
const API_CANCEL = API + '/trainer-booking-cancel';
const API_SCHEDULE = API + '/trainer-booking-schedule';
const API_ADMIN = API + '/trainer-booking-admin';

const ADMIN_TELEGRAM_ID = '7656322828';

const CLUBS = [
  { id: "c2", name: "CrossGYM — 95 квартал", addr: "пр. Гагаріна, 4а (Плаза)", phone: "+380981080779", accent: "#4CAF50" },
  { id: "c3", name: "CrossGYM — Вечірній", addr: "б-р Вечірній, 18а", phone: "+380981080779", accent: "#E8402A" }
];
const CLUB_INSTAGRAM = 'crossgym_baza_team';
const SESSION_PRICE = 200;
const HOURS = { weekday: { opens: 7, closes: 21 }, weekend: { opens: 9, closes: 20 } };
const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
const CHEV = '<svg class="chev" width="9" height="15" viewBox="0 0 9 15" fill="none"><path d="M1 1L7.5 7.5L1 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BACKARROW = '<svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M8 1.5 2 8l6 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function clubStatus() {
  const now = new Date();
  const day = now.getDay();
  const h = HOURS[(day === 0 || day === 6) ? 'weekend' : 'weekday'];
  const hour = now.getHours() + now.getMinutes() / 60;
  const open = hour >= h.opens && hour < h.closes;
  return open
    ? { open: true, text: 'Відкрито · до ' + h.closes + ':00' }
    : { open: false, text: 'Зачинено · з ' + h.opens + ':00' };
}

const tg = window.Telegram && window.Telegram.WebApp;
function applyViewportHeight() {
  if (tg && tg.viewportStableHeight) {
    document.documentElement.style.setProperty('--tg-vh', tg.viewportStableHeight + 'px');
  }
}
if (tg) {
  tg.ready();
  tg.expand();
  applyViewportHeight();
  tg.onEvent('viewportChanged', applyViewportHeight);
  try { tg.setBackgroundColor('#0c0c11'); } catch (e) {}
  try { tg.setHeaderColor('#0c0c11'); } catch (e) {}
}
const IS_ADMIN = !!(tg && tg.initDataUnsafe && tg.initDataUnsafe.user
  && String(tg.initDataUnsafe.user.id) === ADMIN_TELEGRAM_ID);

// CloudStorage прив'язане до акаунту Telegram, переживає переоткриття застосунку
// (на відміну від localStorage, яке в частині клієнтів Telegram чиститься між сесіями).
function cloudGet(key) {
  return new Promise(resolve => {
    if (tg && tg.CloudStorage) {
      try {
        tg.CloudStorage.getItem(key, (err, value) => resolve(err ? '' : (value || '')));
        return;
      } catch (e) {}
    }
    resolve(localStorage.getItem(key) || '');
  });
}
function cloudSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
  if (tg && tg.CloudStorage) {
    try { tg.CloudStorage.setItem(key, value, () => {}); } catch (e) {}
  }
}

let savedClientName = '';
const namePromise = cloudGet('client_name').then(v => { savedClientName = v; });

const app = document.getElementById('app');
let currentClub = null;

let SESSIONS = null;
const schedulePromise = fetch(API_SCHEDULE, { method: 'POST' })
  .then(r => r.json())
  .then(d => { SESSIONS = d.sessions || []; })
  .catch(() => { SESSIONS = []; });

function refreshSchedule() {
  fetch(API_SCHEDULE, { method: 'POST' }).then(r => r.json()).then(d => { SESSIONS = d.sessions || []; }).catch(() => {});
}

function showBack(fn) {
  if (!tg || !tg.BackButton) return;
  try {
    if (showBack._last) tg.BackButton.offClick(showBack._last);
    if (fn) { tg.BackButton.show(); tg.BackButton.onClick(fn); showBack._last = fn; }
    else { tg.BackButton.hide(); showBack._last = null; }
  } catch (e) {}
}

function skeleton(n) {
  let html = '';
  for (let i = 0; i < n; i++) {
    html += '<div class="skeleton-row"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>';
  }
  return html;
}

function renderClubs() {
  currentClub = null;
  showBack(null);
  app.innerHTML = `
    <div class="screen">
      <div class="hero">
        <div class="hero-top">
          <img class="hero-photo" src="trainer.jpg" alt="Катерина Резвін">
          <div>
            <div class="hero-name">Катерина Резвін</div>
            <div class="hero-role">Фітнес-тренер · CrossGYM</div>
          </div>
        </div>
        <div class="hero-bio">Аеробіка, степ-аеробіка, функціональні, силові та інтервальні тренування для жінок у двох залах мережі.</div>
        <div class="hero-badges">
          <span class="hero-badge">REPS Ukraine</span>
          <span class="hero-badge">Міжнародна сертифікація</span>
        </div>
        <a class="hero-ig" href="https://instagram.com/rezvin0707_fitness" target="_blank" rel="noopener">Instagram →</a>
      </div>
      <div class="group" style="margin-top:16px">
        <button class="row" onclick="openMyBookings()">
          <span class="grow"><div class="title">Мої записи</div></span>
          ${CHEV}
        </button>
        ${IS_ADMIN ? `<button class="row" onclick="openAdmin()">
          <span class="grow"><div class="title">Хто записався</div></span>
          ${CHEV}
        </button>` : ''}
      </div>
      <div class="shead">Оберіть зал</div>
      <div class="group" id="clubs"></div>
    </div>
  `;
  document.getElementById('clubs').innerHTML = CLUBS.map(c => `
    <button class="row" onclick="openClub('${c.id}')">
      <span class="dot" style="--dot-color:${c.accent}; background:${c.accent}"></span>
      <span class="grow"><div class="title">${c.name}</div><div class="sub">${c.addr}</div></span>
      ${CHEV}
    </button>`).join('');
}

async function openClub(id) {
  currentClub = id;
  selectedDate = null;
  showBack(renderClubs);
  const club = CLUBS.find(c => c.id === id);
  const st = clubStatus();
  app.innerHTML = `
    <div class="screen club-screen" style="--club-accent:${club.accent}">
      <div class="ctopbar">
        <button class="backsq" onclick="renderClubs()">${BACKARROW}</button>
        <div class="grow">
          <div class="cname">${club.name}</div>
          <div class="caddr">${club.addr}</div>
        </div>
      </div>
      <div class="cardbox">
        <div class="status"><i class="${st.open ? '' : 'off'}"></i>${st.text}</div>
        <div class="acts">
          <a class="act" href="tel:${club.phone}" target="_blank" rel="noopener">Подзвонити</a>
          <a class="act" href="https://instagram.com/${CLUB_INSTAGRAM}" target="_blank" rel="noopener">Instagram</a>
        </div>
      </div>
      <div class="shead">Дата</div>
      <div class="dates diary" id="dates"></div>
      <div class="shead" id="sesshead">Заняття</div>
      <div class="group" id="sess">${skeleton(2)}</div>
    </div>`;
  if (SESSIONS === null) await schedulePromise;
  if (currentClub !== id) return;
  renderDateStrip(id);
}

let selectedDate = null;
const DAYS_AHEAD = 14;

function pad2(n) { return String(n).padStart(2, '0'); }
function dstr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

// суцільна стрічка на DAYS_AHEAD днів вперед, від сьогодні
function rangeDates() {
  const now = new Date();
  const days = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
  }
  return days;
}

function renderDateStrip(id) {
  const datesBox = document.getElementById('dates');
  if (!datesBox) return;
  const list = (SESSIONS || []).filter(s => s.club === id);
  const byDate = {};
  list.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });

  const days = rangeDates();
  const todayStr = dstr(new Date());

  if (!selectedDate || !days.some(d => dstr(d) === selectedDate)) {
    const withSession = days.find(d => byDate[dstr(d)]);
    selectedDate = dstr(withSession || days[0]);
  }

  datesBox.innerHTML = days.map(d => {
    const date = dstr(d);
    const has = !!byDate[date];
    const isToday = date === todayStr;
    const cls = ['day', 'diary-day'];
    if (date === selectedDate) cls.push('on');
    if (!has) cls.push('empty');
    if (isToday) cls.push('today');
    return `<button class="${cls.join(' ')}" data-date="${date}" onclick="selectDate('${id}','${date}')">
      <div class="dw">${WD[d.getDay()]}</div><div class="dd">${d.getDate()}</div>
      <div class="daydot">${has ? '<i></i>' : ''}</div>
    </button>`;
  }).join('');
  renderSessions(id);

  const activeEl = datesBox.querySelector('.day.on');
  if (activeEl) activeEl.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function selectDate(id, date) {
  selectedDate = date;
  renderDateStrip(id);
}

function renderSessions(id) {
  const box = document.getElementById('sess');
  const headBox = document.getElementById('sesshead');
  if (!box) return;
  const list = (SESSIONS || []).filter(s => s.club === id && s.date === selectedDate);
  if (headBox && selectedDate) {
    const [y, m, d] = selectedDate.split('-').map(Number);
    headBox.textContent = 'Заняття · ' + d + ' ' + MON[m - 1];
  }
  if (!list.length) {
    box.innerHTML = '<div class="row static"><span class="grow"><div class="sub">Цього дня тренувань немає</div></span></div>';
    return;
  }
  box.innerHTML = list.map((s, i) => `
    <button class="row" ${s.free <= 0 ? 'disabled' : ''} onclick="openSession(${i})">
      <div class="lead">${s.time}</div>
      <span class="grow">
        <div class="title">Групове тренування</div>
        <div class="sub">Катерина Резвін</div>
      </span>
      <div class="trail">${s.free > 0 ? '<b>' + s.free + '</b>вільно' : 'немає місць'}</div>
    </button>`).join('');
  window.__list = list;
}

async function openSession(i) {
  const s = window.__list[i];
  const club = CLUBS.find(c => c.id === s.club);
  showBack(() => openClub(s.club));
  app.innerHTML = `
    <div class="screen" id="sessScreen">
      <button class="backbtn" onclick="openClub('${s.club}')">${CHEV} Назад</button>
      <div class="shead">Підтвердження</div>
      <div class="group">
        <div class="row static"><span class="grow"><div class="title">${club.name}</div><div class="sub">${club.addr}</div></span></div>
        <div class="row static"><span class="grow"><div class="title">${WD[s.weekday]}, ${s.date.slice(8,10)}.${s.date.slice(5,7)} о ${s.time}</div><div class="sub">Вільно ${s.free} з ${s.capacity}</div></span><div class="trail"><b>${SESSION_PRICE} грн</b></div></div>
      </div>
      <div class="shead">Формати занять</div>
      <div class="group">
        <div class="row static"><span class="grow"><div class="title">Аеробіка</div></span></div>
        <div class="row static"><span class="grow"><div class="title">Степ аеробіка</div></span></div>
        <div class="row static"><span class="grow"><div class="title">Функціональні, силові, інтервальні тренування</div></span></div>
      </div>
      <div class="shead">Ваше ім'я</div>
      <div class="group" id="nameBox">${skeleton(1)}</div>
      <div class="statusmsg" style="padding-top:6px">Скасувати запис можна в будь-який час у «Мої записи»</div>
      <button class="primary" id="confirmBtn">Записатися</button>
      <div class="statusmsg" id="status"></div>
    </div>`;
  document.getElementById('confirmBtn').onclick = () => book(s);
  await namePromise;
  renderNameBox();
}

function renderNameBox(editMode) {
  const box = document.getElementById('nameBox');
  if (!box) return;
  if (savedClientName && !editMode) {
    box.innerHTML = `
      <div class="row static">
        <span class="grow"><div class="title">${savedClientName}</div></span>
        <button class="cancelbtn" style="border-color:var(--muted);color:var(--muted)" onclick="renderNameBox(true)">Змінити</button>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="row static" style="padding:8px 14px">
      <input class="nameinput" id="nameInput" type="text" placeholder="Ім'я та прізвище" enterkeyhint="done"
        value="${savedClientName.replace(/"/g, '&quot;')}">
    </div>`;
  const nameEl = document.getElementById('nameInput');
  nameEl.focus();
  nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') nameEl.blur(); });
  document.getElementById('sessScreen').addEventListener('click', e => {
    if (e.target !== nameEl) nameEl.blur();
  });
}

async function book(s) {
  const btn = document.getElementById('confirmBtn');
  const status = document.getElementById('status');
  const nameInput = document.getElementById('nameInput');
  const clientName = (nameInput ? nameInput.value : savedClientName).trim();
  if (!clientName) {
    status.className = 'statusmsg error';
    status.textContent = "Вкажіть ім'я та прізвище";
    if (nameInput) nameInput.focus();
    return;
  }
  if (clientName !== savedClientName) {
    savedClientName = clientName;
    cloudSet('client_name', clientName);
  }
  btn.disabled = true;
  btn.textContent = 'Записую…';
  status.className = 'statusmsg';
  status.textContent = '';
  const initData = tg ? tg.initData : '';
  try {
    const res = await fetch(API_BOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, club: s.club, weekday: s.weekday, time: s.time, date: s.date, clientName })
    });
    const data = await res.json();
    if (data.ok) {
      status.className = 'statusmsg ok';
      status.textContent = '✓ Записано!';
      try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success'); } catch (e) {}
      refreshSchedule();
      setTimeout(() => openClub(s.club), 900);
    } else {
      status.className = 'statusmsg error';
      status.textContent = data.error || 'Не вдалося записатися';
      btn.disabled = false;
      btn.textContent = 'Записатися';
    }
  } catch (e) {
    status.className = 'statusmsg error';
    status.textContent = 'Помилка мережі, спробуйте ще раз';
    btn.disabled = false;
    btn.textContent = 'Записатися';
  }
}

async function openMyBookings() {
  showBack(renderClubs);
  app.innerHTML = `<div class="screen">
    <button class="backbtn" onclick="renderClubs()">${CHEV} Зали</button>
    <div class="shead">Мої записи</div>
    <div class="group" id="mine">${skeleton(2)}</div>
  </div>`;
  const box = document.getElementById('mine');
  const initData = tg ? tg.initData : '';
  try {
    const res = await fetch(API_MINE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    });
    const data = await res.json();
    const list = (data.bookings || []).filter(b => !b.past);
    if (!list.length) {
      box.innerHTML = '<div class="row static"><span class="grow"><div class="sub">У вас поки немає записів</div></span></div>';
      return;
    }
    box.innerHTML = list.map(b => `
      <div class="row static">
        <span class="grow">
          <div class="title">${b.clubName}</div>
          <div class="sub">${WD[b.weekday]}, ${b.date.slice(8,10)}.${b.date.slice(5,7)} · ${b.time}</div>
        </span>
        <button class="cancelbtn" onclick="cancelBooking('${b.booking_id}', this)">Скасувати</button>
      </div>`).join('');
  } catch (e) {
    box.innerHTML = '<div class="row static"><span class="grow"><div class="sub">Помилка мережі, спробуйте ще раз</div></span></div>';
  }
}

async function cancelBooking(bookingId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  const initData = tg ? tg.initData : '';
  try {
    const res = await fetch(API_CANCEL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, bookingId })
    });
    const data = await res.json();
    if (data.ok) {
      refreshSchedule();
      openMyBookings();
    } else {
      btn.disabled = false;
      btn.textContent = 'Скасувати';
      if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.notificationOccurred('error'); } catch (e) {} }
      alert(data.error || 'Не вдалося скасувати');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Скасувати';
    alert('Помилка мережі, спробуйте ще раз');
  }
}

async function openAdmin() {
  showBack(renderClubs);
  app.innerHTML = `<div class="screen">
    <button class="backbtn" onclick="renderClubs()">${CHEV} Зали</button>
    <div class="shead">Хто записався</div>
    <div class="group" id="admin">${skeleton(3)}</div>
  </div>`;
  const box = document.getElementById('admin');
  const initData = tg ? tg.initData : '';
  try {
    const res = await fetch(API_ADMIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    });
    const data = await res.json();
    const list = data.sessions || [];
    if (!list.length) {
      box.innerHTML = '<div class="row static"><span class="grow"><div class="sub">Немає найближчих занять</div></span></div>';
      return;
    }
    box.innerHTML = list.map(s => `
      <div class="row static">
        <span class="grow">
          <div class="title">${s.clubName} · ${WD[s.weekday]}, ${s.date.slice(8,10)}.${s.date.slice(5,7)} ${s.time}</div>
          <div class="sub">${s.roster.length} з ${s.capacity}${s.roster.length ? ': ' + s.roster.join(', ') : ' — поки нікого'}</div>
        </span>
      </div>`).join('');
  } catch (e) {
    box.innerHTML = '<div class="row static"><span class="grow"><div class="sub">Помилка мережі, спробуйте ще раз</div></span></div>';
  }
}

renderClubs();
