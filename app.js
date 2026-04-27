const YEAR = 2026;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SUPABASE_URL = 'https://ldnzmpqnbbiiwtyunxpo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbnptcHFuYmJpaXd0eXVueHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzQ0NjcsImV4cCI6MjA4NTkxMDQ2N30.TDZfXz0K7bu8pifms5kKddTy06HI6W0ZOHj_kUj-sPU';
const API_BASE = `${SUPABASE_URL}/rest/v1/cruise_blocks`;
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const appMain = document.getElementById('appMain');
const monthView = document.getElementById('monthView');
const weekdaysEl = document.getElementById('weekdays');
const monthLabel = document.getElementById('monthLabel');
const monthSelect = document.getElementById('monthSelect');
const selectionStatus = document.getElementById('selectionStatus');
const nameInput = document.getElementById('nameInput');
const dayInspector = document.getElementById('dayInspector');
const inspectorTitle = document.getElementById('inspectorTitle');
const inspectorStatus = document.getElementById('inspectorStatus');
const inspectorPeople = document.getElementById('inspectorPeople');
const passcodeGate = document.getElementById('passcodeGate');
const passcodeInput = document.getElementById('passcodeInput');
const passcodeBtn = document.getElementById('passcodeBtn');
const passcodeError = document.getElementById('passcodeError');

const PASSCODE = 'theogs';
const PASSCODE_FLAG = 'ogCruiseUnlocked';
const CLASS_BY_NAME = {
  connor: 'connor',
  alexa: 'alexa',
  taher: 'taher',
  breidy: 'breidy',
  sumer: 'sumer',
  isa: 'isa',
  renata: 'renata',
  julissa: 'julissa'
};

const defaultHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

let blocksByDate = {};
let currentMonthIndex = 0;
let activeDateKey = null;

nameInput.value = localStorage.getItem('ogCruiseName') || '';
nameInput.addEventListener('change', () => {
  localStorage.setItem('ogCruiseName', nameInput.value.trim());
  updateSelectionStatus();
  if (activeDateKey) updateInspector(activeDateKey);
  render();
});

const toDateKey = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatFullDate = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

const getSelectedName = () => nameInput.value.trim();
const isMyBlock = (name, selectedName = getSelectedName()) => !!selectedName && name.toLowerCase() === selectedName.toLowerCase();

function rowsToMap(rows) {
  const out = {};
  for (const row of rows) {
    if (!out[row.date_key]) out[row.date_key] = [];
    out[row.date_key].push(row.person_name);
  }
  Object.keys(out).forEach((key) => out[key].sort((a, b) => a.localeCompare(b)));
  return out;
}

async function loadData() {
  const url = `${API_BASE}?select=date_key,person_name&date_key=gte.2026-01-01&date_key=lte.2026-12-31&order=date_key.asc,person_name.asc`;
  const res = await fetch(url, { headers: defaultHeaders });
  if (!res.ok) throw new Error('Failed to load blocks');
  const rows = await res.json();
  blocksByDate = rowsToMap(rows);
}

async function addBlock(dateKey, personName) {
  const url = `${API_BASE}?on_conflict=date_key,person_name`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify([{ date_key: dateKey, person_name: personName }])
  });
  if (!res.ok) throw new Error('Failed to add block');
}

async function removeBlock(dateKey, personName) {
  const qs = new URLSearchParams({
    date_key: `eq.${dateKey}`,
    person_name: `eq.${personName}`
  });
  const res = await fetch(`${API_BASE}?${qs.toString()}`, {
    method: 'DELETE',
    headers: {
      ...defaultHeaders,
      Prefer: 'return=minimal'
    }
  });
  if (!res.ok) throw new Error('Failed to remove block');
}

async function syncAndRender() {
  await loadData();
  render();
  if (activeDateKey) updateInspector(activeDateKey);
}

async function toggleBlock(dateKey, toggleButton) {
  const myName = getSelectedName();
  if (!myName) {
    alert('Pick your name first.');
    nameInput.focus();
    return;
  }

  const existing = blocksByDate[dateKey] || [];
  const alreadyMine = existing.some((name) => isMyBlock(name, myName));

  if (toggleButton) toggleButton.disabled = true;

  try {
    if (alreadyMine) {
      await removeBlock(dateKey, myName);
    } else {
      await addBlock(dateKey, myName);
    }
    await syncAndRender();
    activeDateKey = dateKey;
    updateInspector(dateKey);
  } catch {
    alert('Could not sync right now, refresh and try again.');
  } finally {
    if (toggleButton) toggleButton.disabled = false;
  }
}

function setupRealtime() {
  supabaseClient
    .channel('cruise-blocks-live')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cruise_blocks'
    }, async () => {
      try {
        await syncAndRender();
      } catch {}
    })
    .subscribe();
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function createBlockPill(name, selectedName = getSelectedName()) {
  const pill = document.createElement('div');
  const nameClass = CLASS_BY_NAME[name.toLowerCase()] || '';
  pill.className = `block ${nameClass}`.trim();
  if (isMyBlock(name, selectedName)) pill.classList.add('mine-pill');
  pill.textContent = name;
  return pill;
}

function createBlockBadge(name, selectedName = getSelectedName()) {
  const badge = document.createElement('div');
  const nameClass = CLASS_BY_NAME[name.toLowerCase()] || '';
  badge.className = `block-badge ${nameClass}`.trim();
  if (isMyBlock(name, selectedName)) badge.classList.add('mine-badge');
  badge.textContent = getInitials(name);
  badge.title = name;
  badge.setAttribute('aria-label', name);
  return badge;
}

function updateSelectionStatus() {
  const selectedName = getSelectedName();
  if (selectedName) {
    selectionStatus.textContent = `${selectedName}, tap Block on any day to mark yourself unavailable.`;
  } else {
    selectionStatus.textContent = 'Choose your name, then tap Block on any day.';
  }
}

function buildMonthSelect() {
  monthSelect.innerHTML = '';
  MONTH_NAMES.forEach((monthName, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${monthName} ${YEAR}`;
    monthSelect.appendChild(option);
  });
}

function setCurrentMonth(index) {
  currentMonthIndex = Math.max(0, Math.min(11, index));
  monthLabel.textContent = `${MONTH_NAMES[currentMonthIndex]} ${YEAR}`;
  monthSelect.value = String(currentMonthIndex);
  render();
}

function updateInspector(dateKey, options = {}) {
  activeDateKey = dateKey;
  const selectedName = getSelectedName();
  const blocks = blocksByDate[dateKey] || [];
  const alreadyMine = blocks.some((name) => isMyBlock(name, selectedName));

  dayInspector.classList.remove('empty-state');
  inspectorTitle.textContent = formatFullDate(dateKey);

  if (!blocks.length) {
    inspectorStatus.textContent = selectedName
      ? `${selectedName} can tap “Block me” on the calendar if this date does not work.`
      : 'No one has blocked this date yet.';
    inspectorPeople.innerHTML = '';
    if (options.scroll) {
      dayInspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  if (!selectedName) {
    inspectorStatus.textContent = `${blocks.length === 1 ? '1 person has' : `${blocks.length} people have`} blocked this date.`;
  } else if (alreadyMine) {
    inspectorStatus.textContent = `You’re on the blocked list for this date, along with ${Math.max(blocks.length - 1, 0)} other ${blocks.length - 1 === 1 ? 'person' : 'people'}.`;
  } else {
    inspectorStatus.textContent = `${blocks.length === 1 ? '1 person is' : `${blocks.length} people are`} currently blocked.`;
  }

  inspectorPeople.innerHTML = '';
  blocks.forEach((name) => inspectorPeople.appendChild(createBlockPill(name, selectedName)));

  if (options.scroll) {
    dayInspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function buildWeekdays() {
  weekdaysEl.innerHTML = '';
  WEEKDAYS.forEach((dayName) => {
    const el = document.createElement('div');
    el.className = 'weekday';
    el.textContent = dayName;
    weekdaysEl.appendChild(el);
  });
}

function renderDayCard(dayNumber, dateKey, blocks, selectedName) {
  const dayEl = document.createElement('article');
  dayEl.className = 'day';

  const alreadyMine = blocks.some((name) => isMyBlock(name, selectedName));
  if (blocks.length) {
    dayEl.classList.add('has-blocks');
    dayEl.classList.add(alreadyMine ? 'is-mine' : 'is-blocked');
  } else {
    dayEl.classList.add('is-open');
  }

  const head = document.createElement('div');
  head.className = 'day-head';

  const dayNum = document.createElement('div');
  dayNum.className = 'day-num';
  dayNum.textContent = dayNumber;
  head.appendChild(dayNum);

  const count = document.createElement('div');
  count.className = 'day-count';
  count.classList.add(blocks.length ? (alreadyMine ? 'count-mine' : 'count-blocked') : 'count-open');
  count.textContent = blocks.length ? String(blocks.length) : '○';
  count.title = blocks.length ? `${blocks.length} blocked` : 'Open';
  count.setAttribute('aria-label', blocks.length ? `${blocks.length} blocked` : 'Open');
  head.appendChild(count);
  dayEl.appendChild(head);

  const list = document.createElement('div');
  list.className = 'day-list';
  if (blocks.length) {
    blocks.slice(0, 4).forEach((name) => list.appendChild(createBlockBadge(name, selectedName)));
    if (blocks.length > 4) {
      const extra = document.createElement('div');
      extra.className = 'block-badge block-more';
      extra.textContent = `+${blocks.length - 4}`;
      extra.title = `${blocks.length - 4} more blocked`;
      list.appendChild(extra);
    }
  } else {
    const open = document.createElement('div');
    open.className = 'day-open-indicator';
    open.textContent = 'Open';
    list.appendChild(open);
  }
  dayEl.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'day-actions';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = `day-action ${alreadyMine ? 'secondary' : 'primary'}`;
  toggleBtn.textContent = selectedName ? (alreadyMine ? 'Unblock' : 'Block') : 'Name';
  toggleBtn.disabled = !selectedName;
  toggleBtn.setAttribute('aria-label', `${alreadyMine ? 'Unblock' : 'Block'} ${formatFullDate(dateKey)} for ${selectedName || 'selected user'}`);
  toggleBtn.addEventListener('click', () => toggleBlock(dateKey, toggleBtn));
  actions.appendChild(toggleBtn);

  const detailsBtn = document.createElement('button');
  detailsBtn.type = 'button';
  detailsBtn.className = 'day-action ghost';
  detailsBtn.textContent = 'View';
  detailsBtn.addEventListener('click', () => updateInspector(dateKey, { scroll: true }));
  actions.appendChild(detailsBtn);

  dayEl.appendChild(actions);
  return dayEl;
}

function render() {
  monthView.innerHTML = '';
  const selectedName = getSelectedName();
  const firstDay = new Date(YEAR, currentMonthIndex, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(YEAR, currentMonthIndex + 1, 0).getDate();

  for (let i = 0; i < startWeekday; i++) {
    const placeholder = document.createElement('div');
    placeholder.className = 'day-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    monthView.appendChild(placeholder);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(YEAR, currentMonthIndex, day);
    const dateKey = toDateKey(date);
    const blocks = blocksByDate[dateKey] || [];
    monthView.appendChild(renderDayCard(day, dateKey, blocks, selectedName));
  }
}

function unlockIfValid() {
  if (passcodeInput.value.trim() === PASSCODE) {
    sessionStorage.setItem(PASSCODE_FLAG, '1');
    document.body.classList.remove('locked');
    appMain.style.visibility = 'visible';
    passcodeGate.classList.add('hidden');
    passcodeError.textContent = '';
    return true;
  }
  passcodeError.textContent = 'Wrong passcode';
  return false;
}

passcodeBtn.addEventListener('click', unlockIfValid);
passcodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') unlockIfValid();
});

monthSelect.addEventListener('change', (event) => {
  setCurrentMonth(Number(event.target.value));
});

document.addEventListener('keydown', (event) => {
  if (document.body.classList.contains('locked')) return;
  if (event.key === 'ArrowLeft' && currentMonthIndex > 0) setCurrentMonth(currentMonthIndex - 1);
  if (event.key === 'ArrowRight' && currentMonthIndex < 11) setCurrentMonth(currentMonthIndex + 1);
});

(async function init() {
  const unlocked = sessionStorage.getItem(PASSCODE_FLAG) === '1';
  if (unlocked) {
    document.body.classList.remove('locked');
    appMain.style.visibility = 'visible';
    passcodeGate.classList.add('hidden');
  }

  buildWeekdays();
  buildMonthSelect();
  updateSelectionStatus();

  try {
    await loadData();
  } catch {
    blocksByDate = {};
  }

  setCurrentMonth(0);
  setupRealtime();

  setInterval(async () => {
    try {
      await syncAndRender();
    } catch {}
  }, 45000);
})();
