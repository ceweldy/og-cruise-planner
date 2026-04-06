const YEAR = 2026;
const BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019d63d7-2d95-7ba7-9525-4845339115ce';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
let etag = null;
const LOCAL_KEY = 'ogCruiseBlocksByDate';

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

const toDateKey = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

async function loadData() {
  try {
    const res = await fetch(BLOB_URL, { cache: 'no-store' });
    etag = res.headers.get('etag');
    const data = await res.json();
    if (data?.blocksByDate && typeof data.blocksByDate === 'object') {
      blocksByDate = data.blocksByDate;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(blocksByDate));
      return;
    }
  } catch {}

  const local = localStorage.getItem(LOCAL_KEY);
  blocksByDate = local ? JSON.parse(local) : {};
}

async function saveData() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(blocksByDate));

  const payload = { blocksByDate, updatedAt: new Date().toISOString() };
  const res = await fetch(BLOB_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error('Cloud sync unavailable right now. Local save still worked.');
  }

  etag = res.headers.get('etag');
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
          alert('Enter your name first.');
          nameInput.focus();
          return;
        }

        const existing = blocksByDate[key] || [];
        const alreadyMine = existing.some((n) => n.toLowerCase() === myName.toLowerCase());

        if (alreadyMine) {
          blocksByDate[key] = existing.filter((n) => n.toLowerCase() !== myName.toLowerCase());
          if (!blocksByDate[key].length) delete blocksByDate[key];
        } else {
          blocksByDate[key] = [...existing, myName]
            .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
            .sort((a, b) => a.localeCompare(b));
        }

        render();
        try {
          await saveData();
        } catch (err) {
          console.warn(err.message);
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
  if (unlocked) passcodeGate.classList.add('hidden');

  try {
    await loadData();
  } catch {
    blocksByDate = {};
  }
  render();
  setInterval(async () => {
    await loadData();
    render();
  }, 20000);
})();
