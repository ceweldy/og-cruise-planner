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
const monthsEl = document.getElementById('months');
const monthTemplate = document.getElementById('monthTemplate');
const nameInput = document.getElementById('nameInput');
const passcodeGate = document.getElementById('passcodeGate');
const passcodeInput = document.getElementById('passcodeInput');
const passcodeBtn = document.getElementById('passcodeBtn');
const passcodeError = document.getElementById('passcodeError');
const dayModal = document.getElementById('dayModal');
const dayModalBackdrop = document.getElementById('dayModalBackdrop');
const dayModalClose = document.getElementById('dayModalClose');
const dayModalTitle = document.getElementById('dayModalTitle');
const dayModalStatus = document.getElementById('dayModalStatus');
const dayModalPeople = document.getElementById('dayModalPeople');
const dayModalToggle = document.getElementById('dayModalToggle');
const PASSCODE = 'theogs';
const PASSCODE_FLAG = 'ogCruiseUnlocked';

let blocksByDate = {};
let activeDateKey = null;

nameInput.value = localStorage.getItem('ogCruiseName') || '';
nameInput.addEventListener('change', () => {
  localStorage.setItem('ogCruiseName', nameInput.value.trim());
  if (activeDateKey) updateModalContent(activeDateKey);
  render();
});

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
const isMyBlock = (name, selectedName = getSelectedName()) => (
  !!selectedName && name.toLowerCase() === selectedName.toLowerCase()
);

function rowsToMap(rows) {
  const out = {};
  for (const row of rows) {
    if (!out[row.date_key]) out[row.date_key] = [];
    out[row.date_key].push(row.person_name);
  }
  Object.keys(out).forEach((k) => out[k].sort((a, b) => a.localeCompare(b)));
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
  if (activeDateKey) updateModalContent(activeDateKey);
}

async function toggleBlock(dateKey) {
  const myName = getSelectedName();
  if (!myName) {
    alert('Pick your name first.');
    nameInput.focus();
    return;
  }

  const existing = blocksByDate[dateKey] || [];
  const alreadyMine = existing.some((name) => isMyBlock(name, myName));

  try {
    if (alreadyMine) {
      await removeBlock(dateKey, myName);
    } else {
      await addBlock(dateKey, myName);
    }
    await syncAndRender();
  } catch {
    alert('Could not sync right now, refresh and try again.');
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

function createBlockPill(name) {
  const pill = document.createElement('div');
  const nameClass = CLASS_BY_NAME[name.toLowerCase()] || '';
  pill.className = `block ${nameClass}`.trim();
  pill.textContent = name;
  return pill;
}

function openModal(dateKey) {
  activeDateKey = dateKey;
  updateModalContent(dateKey);
  dayModal.classList.remove('hidden');
  dayModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  activeDateKey = null;
  dayModal.classList.add('hidden');
  dayModal.setAttribute('aria-hidden', 'true');
}

function updateModalContent(dateKey) {
  const blocks = blocksByDate[dateKey] || [];
  const myName = getSelectedName();
  const alreadyMine = blocks.some((name) => isMyBlock(name, myName));

  dayModalTitle.textContent = formatFullDate(dateKey);

  if (!myName) {
    dayModalStatus.textContent = 'Pick your name to mark whether this date works for you.';
    dayModalToggle.textContent = 'Pick your name first';
    dayModalToggle.disabled = true;
    dayModalToggle.classList.remove('secondary');
  } else if (alreadyMine) {
    dayModalStatus.textContent = `${myName} has blocked this date.`;
    dayModalToggle.textContent = 'Remove my block';
    dayModalToggle.disabled = false;
    dayModalToggle.classList.add('secondary');
  } else {
    dayModalStatus.textContent = `${myName} has not blocked this date.`;
    dayModalToggle.textContent = 'Block this date for me';
    dayModalToggle.disabled = false;
    dayModalToggle.classList.remove('secondary');
  }

  dayModalPeople.innerHTML = '';
  if (!blocks.length) {
    const empty = document.createElement('p');
    empty.className = 'modal-empty';
    empty.textContent = 'No one has blocked this date yet.';
    dayModalPeople.appendChild(empty);
    return;
  }

  blocks.forEach((name) => {
    dayModalPeople.appendChild(createBlockPill(name));
  });
}

function render() {
  monthsEl.innerHTML = '';
  const selectedName = getSelectedName();

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const node = monthTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.month-title').textContent = `${MONTH_NAMES[monthIndex]} ${YEAR}`;

    const weekdayRow = node.querySelector('.weekdays');
    WEEKDAYS.forEach((d) => {
      const w = document.createElement('div');
      w.className = 'weekday';
      w.textContent = d;
      weekdayRow.appendChild(w);
    });

    const daysGrid = node.querySelector('.days');
    const firstDay = new Date(YEAR, monthIndex, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(YEAR, monthIndex + 1, 0).getDate();

    for (let i = 0; i < startWeekday; i++) {
      const empty = document.createElement('button');
      empty.className = 'day empty';
      empty.disabled = true;
      daysGrid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(YEAR, monthIndex, day);
      const key = toDateKey(date);
      const blocks = blocksByDate[key] || [];
      const alreadyMine = blocks.some((name) => isMyBlock(name, selectedName));

      const dayEl = document.createElement('button');
      dayEl.className = 'day';
      if (blocks.length) dayEl.classList.add('has-blocks');
      if (alreadyMine) dayEl.classList.add('mine');
      dayEl.type = 'button';
      dayEl.setAttribute('aria-label', `${formatFullDate(key)}. ${blocks.length ? `${blocks.length} blocked` : 'No blocks'}. Open details.`);

      const summary = document.createElement('div');
      summary.className = 'day-summary';

      const dayNum = document.createElement('div');
      dayNum.className = 'day-num';
      dayNum.textContent = day;
      summary.appendChild(dayNum);

      if (blocks.length) {
        const count = document.createElement('div');
        count.className = 'day-count';
        count.textContent = blocks.length === 1 ? '1 block' : `${blocks.length} blocks`;
        summary.appendChild(count);
      }

      dayEl.appendChild(summary);

      const preview = document.createElement('div');
      preview.className = 'day-preview';
      blocks.slice(0, 2).forEach((name) => {
        preview.appendChild(createBlockPill(name));
      });

      if (blocks.length > 2) {
        const extra = document.createElement('div');
        extra.className = 'block';
        extra.textContent = `+${blocks.length - 2} more`;
        preview.appendChild(extra);
      }

      dayEl.appendChild(preview);

      const hint = document.createElement('div');
      hint.className = 'day-hint';
      hint.textContent = blocks.length ? 'Tap for details' : 'Tap to review';
      dayEl.appendChild(hint);

      dayEl.addEventListener('click', () => openModal(key));
      daysGrid.appendChild(dayEl);
    }

    monthsEl.appendChild(node);
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
passcodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlockIfValid();
});

dayModalClose.addEventListener('click', closeModal);
dayModalBackdrop.addEventListener('click', closeModal);
dayModalToggle.addEventListener('click', async () => {
  if (!activeDateKey || dayModalToggle.disabled) return;
  await toggleBlock(activeDateKey);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dayModal.classList.contains('hidden')) {
    closeModal();
  }
});

(async function init() {
  const unlocked = sessionStorage.getItem(PASSCODE_FLAG) === '1';
  if (unlocked) {
    document.body.classList.remove('locked');
    appMain.style.visibility = 'visible';
    passcodeGate.classList.add('hidden');
  }

  try {
    await loadData();
  } catch {
    blocksByDate = {};
  }
  render();
  setupRealtime();

  setInterval(async () => {
    try {
      await syncAndRender();
    } catch {}
  }, 45000);
})();
