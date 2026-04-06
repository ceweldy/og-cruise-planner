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
const PASSCODE = 'theogs';
const PASSCODE_FLAG = 'ogCruiseUnlocked';

let blocksByDate = {};

nameInput.value = localStorage.getItem('ogCruiseName') || '';
nameInput.addEventListener('change', () => {
  localStorage.setItem('ogCruiseName', nameInput.value.trim());
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

function setupRealtime() {
  supabaseClient
    .channel('cruise-blocks-live')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cruise_blocks'
    }, async () => {
      try {
        await loadData();
        render();
      } catch {}
    })
    .subscribe();
}

function render() {
  monthsEl.innerHTML = '';

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

      const dayEl = document.createElement('button');
      dayEl.className = 'day';
      if (blocks.length) dayEl.classList.add('has-blocks');

      const dayNum = document.createElement('div');
      dayNum.className = 'day-num';
      dayNum.textContent = day;
      dayEl.appendChild(dayNum);

      blocks.slice(0, 2).forEach((name) => {
        const pill = document.createElement('div');
        const nameClass = CLASS_BY_NAME[name.toLowerCase()] || '';
        pill.className = `block ${nameClass}`.trim();
        pill.textContent = name;
        dayEl.appendChild(pill);
      });

      if (blocks.length > 2) {
        const extra = document.createElement('div');
        extra.className = 'block';
        extra.textContent = `+${blocks.length - 2} more`;
        dayEl.appendChild(extra);
      }

      dayEl.addEventListener('click', async () => {
        const myName = nameInput.value.trim();
        if (!myName) {
          alert('Pick your name first.');
          nameInput.focus();
          return;
        }

        const existing = blocksByDate[key] || [];
        const alreadyMine = existing.some((n) => n.toLowerCase() === myName.toLowerCase());

        try {
          if (alreadyMine) {
            await removeBlock(key, myName);
          } else {
            await addBlock(key, myName);
          }
          await loadData();
          render();
        } catch {
          alert('Could not sync right now, refresh and try again.');
        }
      });

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

  // Fallback poll in case websocket drops on some networks.
  setInterval(async () => {
    try {
      await loadData();
      render();
    } catch {}
  }, 45000);
})();
