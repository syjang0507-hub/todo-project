// 할일은 메모리에만 보관 (새로고침하면 초기화)
let todos = [];
let currentId = null; // 상세 모달에서 보고 있는 할일
let editingId = null; // 편집 중인 할일 (null이면 새로 추가)
let view = 'list'; // 'list' | 'calendar'
let filter = 'all'; // 'all' | 'todo' | 'done'
let sortBy = 'date'; // 'date' | 'recent' | 'done'
let calMonth = new Date(); // 달력에 표시 중인 달
calMonth.setDate(1);

const $ = (id) => document.getElementById(id);
const formModal = $('formModal');
const detailModal = $('detailModal');
const dayModal = $('dayModal');
let dayDate = null; // 날짜별 모달에서 보고 있는 날짜
let returnToDay = null; // 날짜별 모달에서 추가를 눌렀다면, 저장 후 돌아갈 날짜

// ---------- 날짜 ----------
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayStr() {
  return toDateStr(new Date());
}
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
// '2026-10-02' → '10월 2일 (금)' (연도가 다르면 연도 포함)
function formatDate(str, withYear = false) {
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const showYear = withYear || y !== new Date().getFullYear();
  return `${showYear ? `${y}년 ` : ''}${m}월 ${d}일 (${WEEKDAYS[date.getDay()]})`;
}

// ---------- 아이콘 / 토스트 ----------
function icon(name, cls = '') {
  return `<svg class="icon ${cls}"><use href="#i-${name}"/></svg>`;
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- 렌더링 ----------
function createItem(todo) {
  const today = todayStr();
  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.done ? ' done' : '');
  li.tabIndex = 0;

  // 체크 버튼: 목록에서 바로 완료/미완료 전환
  const check = document.createElement('button');
  check.className = 'check';
  check.innerHTML = icon('check');
  check.setAttribute('aria-label', todo.done ? '미완료로 전환' : '완료하기');
  check.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDone(todo.id);
  });

  const body = document.createElement('div');
  body.className = 'todo-body';

  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = todo.title;

  const meta = document.createElement('div');
  meta.className = 'todo-meta';
  meta.innerHTML = `<span class="meta-item">${icon('calendar')}${formatDate(todo.date)}</span>`;
  if (!todo.done && todo.date < today) {
    meta.insertAdjacentHTML('beforeend', '<span class="tag overdue">기한 지남</span>');
  } else if (todo.date === today) {
    meta.insertAdjacentHTML('beforeend', '<span class="tag today">오늘</span>');
  }
  if (todo.detail) {
    meta.insertAdjacentHTML('beforeend', `<span class="meta-item" title="상세 내용 있음">${icon('text')}</span>`);
  }

  body.append(title, meta);
  li.append(check, body);
  li.insertAdjacentHTML('beforeend', icon('right', 'chevron'));

  li.addEventListener('click', () => openDetail(todo.id));
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === li) openDetail(todo.id);
  });
  return li;
}

function renderList(el, items, empty) {
  el.innerHTML = '';
  if (items.length === 0) {
    el.innerHTML = `<li class="empty">${icon(empty.icon)}<span>${empty.text}</span></li>`;
    return;
  }
  items.forEach((t) => el.appendChild(createItem(t)));
}

function render() {
  const today = todayStr();
  // 날짜순(가까운 날짜가 위), 같은 날짜 안에서는 미완료 먼저
  const sorted = [...todos].sort((a, b) =>
    a.date.localeCompare(b.date) || a.done - b.done || a.createdAt - b.createdAt
  );
  const todayItems = sorted.filter((t) => t.date === today);
  const doneCount = todayItems.filter((t) => t.done).length;

  // 오늘 할일 + 진행률
  $('todayDate').textContent = formatDate(today);
  $('progressBar').style.width = todayItems.length ? `${(doneCount / todayItems.length) * 100}%` : '0';
  $('progressText').textContent = todayItems.length
    ? `${todayItems.length}개 중 ${doneCount}개 완료`
    : '';
  $('progressBar').parentElement.parentElement.hidden = todayItems.length === 0;

  const allDone = todayItems.length > 0 && doneCount === todayItems.length;
  $('greeting').textContent = allDone
    ? '오늘 할일을 모두 끝냈어요! 🎉'
    : todayItems.length
      ? `오늘 남은 할일 ${todayItems.length - doneCount}개, 힘내세요!`
      : '오늘도 좋은 하루 보내세요';

  renderList($('todayList'), todayItems, {
    icon: 'sun',
    text: '오늘 예정된 할일이 없어요.<br>새로운 할일을 추가해 보세요!',
  });

  // 전체 목록 (필터 + 정렬)
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  $('allCount').textContent = `전체 ${total}개`;
  $('countAll').textContent = total;
  $('countTodo').textContent = total - done;
  $('countDone').textContent = done;

  const filtered = sortList(
    todos.filter((t) => filter === 'all' || (filter === 'done' ? t.done : !t.done))
  );
  const emptyText = {
    all: '아직 등록된 할일이 없어요.',
    todo: '남은 할일이 없어요. 모두 끝냈어요!',
    done: '아직 완료한 할일이 없어요.',
  }[filter];
  renderList($('allList'), filtered, {
    icon: filter === 'done' ? 'check' : 'inbox',
    text: emptyText,
  });

  renderCalendar(sorted);
  if (!dayModal.classList.contains('hidden')) renderDay();
}

// 목록 정렬
// - date:   날짜순 (가까운 날짜가 위, 같은 날은 미완료 먼저)
// - done:   완료순 (완료한 할일이 위, 그 안에서는 날짜순)
// - recent: 최신등록순 (최근에 등록한 할일이 위)
function sortList(items) {
  const byDate = (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
  const compare = {
    date: (a, b) => a.date.localeCompare(b.date) || a.done - b.done || a.createdAt - b.createdAt,
    recent: (a, b) => b.createdAt - a.createdAt,
    done: (a, b) => b.done - a.done || byDate(a, b),
  }[sortBy];
  return [...items].sort(compare);
}

function setFilter(next) {
  filter = next;
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
    btn.setAttribute('aria-pressed', btn.dataset.filter === filter);
  });
  render();
}

function renderCalendar(sorted) {
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  $('calTitle').textContent = `${year}년 ${month + 1}월`;

  // 날짜별로 할일 묶기
  const byDate = {};
  sorted.forEach((t) => (byDate[t.date] ||= []).push(t));

  // 첫 주 일요일부터 6주(42칸) 표시
  const start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
  const today = todayStr();
  const grid = $('calGrid');
  grid.innerHTML = '';

  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateStr = toDateStr(d);

    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (d.getMonth() !== month) cell.classList.add('other');
    if (dateStr === today) cell.classList.add('today');
    if (d.getDay() === 0) cell.classList.add('sun');
    if (d.getDay() === 6) cell.classList.add('sat');

    const num = document.createElement('div');
    num.className = 'cal-num';
    num.textContent = d.getDate();
    cell.appendChild(num);

    const items = byDate[dateStr] || [];
    items.forEach((t) => {
      const item = document.createElement('button');
      item.className = 'cal-todo' + (t.done ? ' done' : '');
      item.innerHTML = icon('check');
      const label = document.createElement('span');
      label.textContent = t.title;
      item.appendChild(label);
      item.title = t.title;
      item.addEventListener('click', (e) => {
        e.stopPropagation(); // 날짜 칸 클릭으로 처리되지 않도록
        openDetail(t.id);
      });
      cell.appendChild(item);
    });

    // 날짜 칸(빈 영역) 클릭: 할일이 있으면 그날 목록, 없으면 바로 추가
    if (items.length === 0) cell.insertAdjacentHTML('beforeend', icon('plus', 'cal-add'));
    cell.title = items.length ? `${formatDate(dateStr)} 할일 보기` : `${formatDate(dateStr)}에 할일 추가`;
    cell.addEventListener('click', () => {
      if (items.length) openDay(dateStr);
      else openForm(null, dateStr);
    });

    grid.appendChild(cell);
  }
}

function setView(next) {
  view = next;
  const isList = view === 'list';
  $('listView').classList.toggle('hidden', !isList);
  $('calendarView').classList.toggle('hidden', isList);
  $('listViewBtn').classList.toggle('active', isList);
  $('calViewBtn').classList.toggle('active', !isList);
  $('listViewBtn').setAttribute('aria-selected', isList);
  $('calViewBtn').setAttribute('aria-selected', !isList);
}

// ---------- 모달 ----------
function openModal(modal) { modal.classList.remove('hidden'); }
function closeModal(modal) { modal.classList.add('hidden'); }

// date: 새 할일의 기본 일자 (달력에서 날짜를 눌렀을 때)
function openForm(todo, date = '') {
  editingId = todo ? todo.id : null;
  returnToDay = null;
  $('formTitle').textContent = todo ? '할일 편집' : '새로운 할일';
  $('titleInput').value = todo ? todo.title : '';
  $('detailInput').value = todo ? todo.detail : '';
  $('dateInput').value = todo ? todo.date : date;
  openModal(formModal);
  $('titleInput').focus();
}

function openDay(date) {
  dayDate = date;
  renderDay();
  openModal(dayModal);
}

function renderDay() {
  const items = todos
    .filter((t) => t.date === dayDate)
    .sort((a, b) => a.done - b.done || a.createdAt - b.createdAt);
  const doneCount = items.filter((t) => t.done).length;

  $('dayTitle').textContent = formatDate(dayDate, true);
  $('daySummary').textContent = items.length
    ? `할일 ${items.length}개 · 완료 ${doneCount}개`
    : '이 날짜에 등록된 할일이 없어요.';

  const list = $('dayList');
  list.innerHTML = '';
  items.forEach((t) => {
    const li = createItem(t);
    // 항목을 누르면 날짜 모달을 닫고 상세 정보 모달 열기
    li.addEventListener('click', () => closeModal(dayModal));
    list.appendChild(li);
  });
}

function openDetail(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  currentId = id;

  $('detailTitle').textContent = todo.title;
  $('detailDate').textContent = formatDate(todo.date, true);
  $('detailText').textContent = todo.detail || '작성된 상세 내용이 없어요.';
  $('detailText').classList.toggle('placeholder', !todo.detail);

  const status = $('detailStatus');
  status.innerHTML = todo.done ? `${icon('check')}완료` : '진행 중';
  status.classList.toggle('done', todo.done);

  const toggleBtn = $('toggleBtn');
  toggleBtn.innerHTML = todo.done ? `${icon('undo')}미완료로 전환` : `${icon('check')}완료하기`;
  toggleBtn.classList.toggle('btn-success', !todo.done);
  openModal(detailModal);
}

function toggleDone(id) {
  const todo = todos.find((t) => t.id === id);
  todo.done = !todo.done;
  render();
  toast(todo.done ? '✓ 완료했어요!' : '미완료로 되돌렸어요');
}

// ---------- 이벤트 ----------
$('addBtn').addEventListener('click', () => openForm(null));

$('todoForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('titleInput').value.trim();
  const detail = $('detailInput').value.trim();
  const date = $('dateInput').value;
  if (!title || !date) return;

  if (editingId) {
    const todo = todos.find((t) => t.id === editingId);
    Object.assign(todo, { title, detail, date });
  } else {
    todos.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title, detail, date,
      done: false,
      createdAt: Date.now(),
    });
  }
  render();
  closeModal(formModal);
  toast(editingId ? '수정했어요' : '새로운 할일을 추가했어요');

  // 편집 후에는 수정된 상세 정보를, 날짜 모달에서 추가했다면 그 날짜 목록을 다시 보여줌
  if (editingId) openDetail(editingId);
  else if (returnToDay) openDay(date);
  editingId = null;
  returnToDay = null;
});

// 날짜 모달: 이 날짜에 할일 추가
$('dayAddBtn').addEventListener('click', () => {
  closeModal(dayModal);
  openForm(null, dayDate);
  returnToDay = dayDate;
});

// 보기 방식 전환
$('listViewBtn').addEventListener('click', () => setView('list'));
$('calViewBtn').addEventListener('click', () => setView('calendar'));

// 목록 필터 / 정렬
document.querySelectorAll('.filter-btn').forEach((btn) =>
  btn.addEventListener('click', () => setFilter(btn.dataset.filter))
);
$('sortSelect').addEventListener('change', (e) => {
  sortBy = e.target.value;
  render();
});

// 달력 이전/다음 달
$('prevMonth').addEventListener('click', () => {
  calMonth.setMonth(calMonth.getMonth() - 1);
  render();
});
$('nextMonth').addEventListener('click', () => {
  calMonth.setMonth(calMonth.getMonth() + 1);
  render();
});
$('calTodayBtn').addEventListener('click', () => {
  calMonth = new Date();
  calMonth.setDate(1);
  render();
});

// 상세 모달: 편집
$('editBtn').addEventListener('click', () => {
  const todo = todos.find((t) => t.id === currentId);
  closeModal(detailModal);
  openForm(todo);
});

// 상세 모달: 완료 ↔ 미완료 전환
$('toggleBtn').addEventListener('click', () => {
  toggleDone(currentId);
  openDetail(currentId);
});

// 취소(닫기) 버튼, 배경 클릭, ESC
document.querySelectorAll('[data-close]').forEach((btn) =>
  btn.addEventListener('click', () => closeModal(btn.closest('.modal')))
);
[formModal, detailModal, dayModal].forEach((modal) =>
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); })
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') [formModal, detailModal, dayModal].forEach(closeModal);
});

render();
