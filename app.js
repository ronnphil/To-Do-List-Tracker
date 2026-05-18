'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

var STORAGE_KEY = 'fastodo_v1';

var MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

var DOW_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Ephemeral UI State (not persisted to localStorage) ───────────────────────

var pendingDate       = null;  // ISO string '2026-05-17', applied to next added task
var pendingPriority   = 0;     // 0=none, 1=low, 2=medium, 3=high
var tagFilter         = null;  // '#tagname' or null
var editingDateTaskId = null;  // id of task whose due date is being set via calendar

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function padTwo(n) {
  var s = String(parseInt(n, 10));
  return s.length < 2 ? '0' + s : s;
}

function calDayToISO(y, m, d) {
  // m is 0-indexed (0=Jan); ISO month is 1-indexed
  return String(y) + '-' + padTwo(parseInt(m, 10) + 1) + '-' + padTwo(d);
}

function formatDateLabel(iso) {
  var parts = iso.split('-');
  var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseTagsFromText(text) {
  return text.match(/#[a-zA-Z0-9_]+/g) || [];
}

function stripTags(text) {
  return text.replace(/#[a-zA-Z0-9_]+/g, '').replace(/\s{2,}/g, ' ').trim();
}

function getGreeting() {
  var h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

function getActiveList() {
  return state.lists.find(function(l) { return l.id === state.activeListId; }) || null;
}

function filterByTag(tasks) {
  if (!tagFilter) return tasks;
  return tasks.filter(function(t) { return t.tags.indexOf(tagFilter) !== -1; });
}

function sortTasks(tasks) {
  var copy = tasks.slice();
  switch (state.sortMethod) {
    case 'date':
      return copy.sort(function(a, b) {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate < b.dueDate ? -1 : 1;
      });
    case 'tag':
      return copy.sort(function(a, b) {
        var ta = (a.tags[0] || '￿').toLowerCase();
        var tb = (b.tags[0] || '￿').toLowerCase();
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
    case 'name':
      return copy.sort(function(a, b) { return a.text.localeCompare(b.text); });
    case 'priority':
      return copy.sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); });
    default:
      return copy.sort(function(a, b) { return a.createdAt - b.createdAt; });
  }
}

// ─── Persistent State ─────────────────────────────────────────────────────────

var state;

function makeDefaultState() {
  var id1 = uid(), id2 = uid(), id3 = uid();
  var now = new Date();
  return {
    lists: [
      { id: id1, name: 'Life',      tasks: [] },
      { id: id2, name: 'Work',      tasks: [] },
      { id: id3, name: 'Project A', tasks: [] }
    ],
    activeListId:  id1,
    sortMethod:    'none',
    calendarMonth: now.getMonth(),
    calendarYear:  now.getFullYear()
  };
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.lists)) {
        state = parsed;
        if (state.calendarMonth == null) {
          var n = new Date();
          state.calendarMonth = n.getMonth();
          state.calendarYear  = n.getFullYear();
        }
      } else {
        state = makeDefaultState();
      }
    } else {
      state = makeDefaultState();
    }
  } catch (_) {
    state = makeDefaultState();
  }
  if (!state.activeListId || !state.lists.find(function(l) { return l.id === state.activeListId; })) {
    state.activeListId = state.lists.length ? state.lists[0].id : null;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* private mode or quota exceeded */ }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function addTask(rawText) {
  var list = getActiveList();
  if (!list) return;
  var trimmed = rawText.trim();
  if (!trimmed) return;

  var tags = parseTagsFromText(trimmed);
  var text = stripTags(trimmed) || trimmed;

  list.tasks.push({
    id:        uid(),
    text:      text,
    completed: false,
    dueDate:   pendingDate,
    tags:      tags,
    priority:  pendingPriority,
    createdAt: Date.now()
  });

  pendingDate     = null;
  pendingPriority = 0;
  saveState();
  render();
}

function toggleTask(taskId) {
  var list = getActiveList();
  if (!list) return;
  var task = list.tasks.find(function(t) { return t.id === taskId; });
  if (task) task.completed = !task.completed;
  saveState();
  render();
}

function addList(name) {
  var trimmed = name.trim();
  if (!trimmed) return;
  var id = uid();
  state.lists.push({ id: id, name: trimmed, tasks: [] });
  state.activeListId = id;
  saveState();
  render();
}

function deleteList(listId) {
  state.lists = state.lists.filter(function(l) { return l.id !== listId; });
  if (state.activeListId === listId) {
    state.activeListId = state.lists.length ? state.lists[0].id : null;
  }
  saveState();
  render();
}

function setActiveList(listId) {
  if (state.activeListId === listId) return;
  state.activeListId = listId;
  saveState();
  render();
}

function setSortMethod(method) {
  state.sortMethod = method;
  saveState();
  renderWorkspace();
  renderUtility();
}

function setPendingDate(iso) {
  pendingDate = iso;
  renderInputMeta();
  document.getElementById('calendar').innerHTML =
    buildCalendar(state.calendarMonth, state.calendarYear);
}

function clearPendingDate() {
  pendingDate = null;
  renderInputMeta();
  document.getElementById('calendar').innerHTML =
    buildCalendar(state.calendarMonth, state.calendarYear);
}

function setTaskDueDate(taskId, iso) {
  var list = getActiveList();
  if (!list) return;
  var task = list.tasks.find(function(t) { return t.id === taskId; });
  if (task) task.dueDate = iso;
  editingDateTaskId = null;
  saveState();
  render();
}

function calNavigate(dir) {
  state.calendarMonth += dir;
  if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
  if (state.calendarMonth < 0)  { state.calendarMonth = 11; state.calendarYear--; }
  document.getElementById('calendar').innerHTML =
    buildCalendar(state.calendarMonth, state.calendarYear);
}

// ─── Calendar Builder ─────────────────────────────────────────────────────────

function buildCalendar(month, year) {
  var now          = new Date();
  var todayD       = now.getDate();
  var todayM       = now.getMonth();
  var todayY       = now.getFullYear();
  var firstWeekday = new Date(year, month, 1).getDay();
  var daysInMonth  = new Date(year, month + 1, 0).getDate();
  var isTargeting  = !!editingDateTaskId;

  var hint = isTargeting
    ? '<span class="cal-target-hint"> — pick a date</span>'
    : '';

  var html = '<div class="cal-header">'
    + '<button class="cal-nav" data-action="cal-prev">&#8249;</button>'
    + '<span class="cal-month-label">' + MONTHS[month] + ' ' + year + hint + '</span>'
    + '<button class="cal-nav" data-action="cal-next">&#8250;</button>'
    + '</div>'
    + '<div class="cal-grid">';

  for (var i = 0; i < DOW_LABELS.length; i++) {
    html += '<div class="cal-dow">' + DOW_LABELS[i] + '</div>';
  }

  for (var e = 0; e < firstWeekday; e++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var isToday    = d === todayD && month === todayM && year === todayY;
    var isoDay     = calDayToISO(year, month, d);
    var isSelected = pendingDate === isoDay;
    var classes    = 'cal-day';
    if (isToday)                  classes += ' today';
    if (isSelected)               classes += ' selected';
    if (isTargeting && !isToday)  classes += ' date-target';
    html += '<div class="' + classes + '" data-action="cal-day"'
      + ' data-day="' + d + '" data-month="' + month + '" data-year="' + year + '">' + d + '</div>';
  }

  var total    = firstWeekday + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var t = 0; t < trailing; t++) {
    html += '<div class="cal-day empty"></div>';
  }

  html += '</div>';
  return html;
}

// ─── Renderers ────────────────────────────────────────────────────────────────

function renderSidebar() {
  var nav = document.getElementById('list-nav');

  if (!state.lists.length) {
    nav.innerHTML = '<div class="empty-state" style="padding:20px 12px;font-size:.78rem;text-align:center">No lists yet.<br>Create one below.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < state.lists.length; i++) {
    var list    = state.lists[i];
    var active  = list.id === state.activeListId ? ' active' : '';
    var pending = 0;
    for (var j = 0; j < list.tasks.length; j++) {
      if (!list.tasks[j].completed) pending++;
    }
    html += '<div class="list-item' + active + '" data-action="set-list" data-id="' + esc(list.id) + '">'
      + '<span class="list-dot"></span>'
      + '<span class="list-name">' + esc(list.name) + '</span>'
      + (pending > 0 ? '<span class="list-count">' + pending + '</span>' : '')
      + '<button class="delete-btn" data-action="delete-list" data-id="' + esc(list.id) + '" title="Remove list">✕</button>'
      + '</div>';
  }
  nav.innerHTML = html;
}

function renderInputMeta() {
  var el = document.getElementById('input-meta');
  if (!el) return;

  var dateChipHtml = '';
  if (pendingDate) {
    dateChipHtml = '<span class="meta-chip date-chip">'
      + '📅 ' + esc(formatDateLabel(pendingDate))
      + ' <button class="chip-remove" data-action="clear-date" title="Clear date">×</button>'
      + '</span>';
  }

  var levels = [
    { level: 1, label: 'Low'  },
    { level: 2, label: 'Med'  },
    { level: 3, label: 'High' }
  ];
  var pillsHtml = '';
  for (var i = 0; i < levels.length; i++) {
    var p      = levels[i];
    var active = pendingPriority === p.level ? ' pill-active pill-' + p.level : '';
    pillsHtml += '<button class="priority-pill' + active + '" data-action="set-priority" data-level="' + p.level + '">'
      + p.label + '</button>';
  }

  el.innerHTML = dateChipHtml
    + '<div class="priority-pills">' + pillsHtml + '</div>';
}

function renderWorkspace() {
  var greetingEl   = document.getElementById('greeting');
  var taskListEl   = document.getElementById('task-list');
  var sectionLabel = document.getElementById('task-section-label');

  // ── Greeting — stacked, no flex alignment issues ──────────────────────────
  var now        = new Date();
  var dayNum     = now.getDate();
  var weekdayStr = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  var monthStr   = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();

  greetingEl.innerHTML =
    '<div class="greeting-context">' + weekdayStr + ' · ' + monthStr + ' ' + now.getFullYear() + '</div>'
    + '<div class="greeting-day-num">' + dayNum + '</div>'
    + '<div class="greeting-headline">Good <strong>' + getGreeting() + '</strong>.</div>'
    + '<div class="greeting-sub">What\'s your plan for today?</div>';

  // ── Section label + active tag filter chip ────────────────────────────────
  var list = getActiveList();

  if (list) {
    var total   = list.tasks.length;
    var pending = 0;
    for (var p = 0; p < total; p++) {
      if (!list.tasks[p].completed) pending++;
    }
    var filterChip = tagFilter
      ? ' <span class="filter-chip">' + esc(tagFilter)
        + ' <button class="chip-remove" data-action="clear-tag-filter">×</button></span>'
      : '';
    sectionLabel.innerHTML =
      '<div class="task-section-header">'
      + '<span class="task-section-title">' + esc(list.name) + '</span>'
      + (total > 0 ? '<span class="task-section-count">' + pending + ' / ' + total + '</span>' : '')
      + filterChip
      + '</div>';
  } else {
    sectionLabel.innerHTML = '';
  }

  // ── Task list ─────────────────────────────────────────────────────────────
  if (!list) {
    taskListEl.innerHTML =
      '<li class="empty-state"><span class="empty-icon">📋</span>Select or create a list to begin.</li>';
    return;
  }

  var tasks = sortTasks(filterByTag(list.tasks));

  if (!tasks.length) {
    taskListEl.innerHTML = tagFilter
      ? '<li class="empty-state"><span class="empty-icon">🏷</span>No tasks tagged ' + esc(tagFilter) + '</li>'
      : '<li class="empty-state"><span class="empty-icon">✓</span>All clear! Add a task above.</li>';
    return;
  }

  var rows = '';
  for (var i = 0; i < tasks.length; i++) {
    var task          = tasks[i];
    var done          = task.completed ? ' done' : '';
    var checked       = task.completed ? ' checked' : '';
    var priorityClass = task.priority ? ' priority-' + task.priority : '';
    var isEditingThis = editingDateTaskId === task.id;

    // Due date / set-date area
    var dueHtml;
    if (task.dueDate) {
      dueHtml = '<span class="task-due' + (isEditingThis ? ' editing-date' : '') + '"'
        + ' data-action="edit-task-date" data-id="' + esc(task.id) + '" title="Click to change date">'
        + esc(formatDateLabel(task.dueDate)) + '</span>';
    } else {
      dueHtml = '<span class="task-set-date" data-action="edit-task-date" data-id="' + esc(task.id) + '"'
        + ' title="Set due date">+ date</span>';
    }

    // Clickable tag chips
    var tagsHtml = '';
    if (task.tags.length) {
      var tagSpans = '';
      for (var j = 0; j < task.tags.length; j++) {
        var tag    = task.tags[j];
        var isAct  = tag === tagFilter ? ' active-filter' : '';
        tagSpans += '<span class="tag-chip' + isAct + '" data-action="set-tag-filter" data-tag="'
          + esc(tag) + '">' + esc(tag) + '</span>';
      }
      tagsHtml = '<span class="task-tags">' + tagSpans + '</span>';
    }

    rows +=
      '<li class="task-row' + done + priorityClass + '">'
      + '<button class="task-check' + checked + '" data-action="toggle-task" data-id="' + esc(task.id) + '"'
      + ' aria-label="' + (task.completed ? 'Mark incomplete' : 'Mark complete') + '"></button>'
      + '<div class="task-body">'
      + dueHtml
      + '<span class="task-text">' + esc(task.text) + '</span>'
      + '</div>'
      + tagsHtml
      + '</li>';
  }
  taskListEl.innerHTML = rows;
}

function renderUtility() {
  document.getElementById('calendar').innerHTML =
    buildCalendar(state.calendarMonth, state.calendarYear);

  var sorts = [
    { key: 'none',     label: 'None'     },
    { key: 'date',     label: 'Date'     },
    { key: 'tag',      label: 'Tag'      },
    { key: 'name',     label: 'Name'     },
    { key: 'priority', label: 'Priority' }
  ];

  var btns = '';
  for (var i = 0; i < sorts.length; i++) {
    var s      = sorts[i];
    var active = state.sortMethod === s.key ? ' active' : '';
    btns += '<button class="sort-btn' + active + '" data-action="set-sort" data-method="' + s.key + '">'
      + s.label + '</button>';
  }

  document.getElementById('sort-panel').innerHTML =
    '<div class="sort-section-label">Sort tasks by</div>'
    + '<div class="sort-grid">' + btns + '</div>';
}

function render() {
  renderSidebar();
  renderWorkspace();
  renderInputMeta();
  renderUtility();
}

// ─── Event Delegation ─────────────────────────────────────────────────────────

function handleClick(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;

  var action = el.dataset.action;
  var id     = el.dataset.id;

  switch (action) {
    case 'set-list':
      setActiveList(id);
      break;

    case 'delete-list':
      e.stopPropagation();
      deleteList(id);
      break;

    case 'toggle-task':
      toggleTask(id);
      break;

    case 'edit-task-date':
      // Toggle: clicking same task again cancels date-edit mode
      editingDateTaskId = (editingDateTaskId === id) ? null : id;
      renderWorkspace();
      document.getElementById('calendar').innerHTML =
        buildCalendar(state.calendarMonth, state.calendarYear);
      break;

    case 'cal-day':
      var iso = calDayToISO(el.dataset.year, el.dataset.month, el.dataset.day);
      if (editingDateTaskId) {
        setTaskDueDate(editingDateTaskId, iso);
      } else {
        setPendingDate(iso);
      }
      break;

    case 'cal-prev':
      calNavigate(-1);
      break;

    case 'cal-next':
      calNavigate(1);
      break;

    case 'set-sort':
      setSortMethod(el.dataset.method);
      break;

    case 'set-priority':
      var level = parseInt(el.dataset.level, 10);
      pendingPriority = (pendingPriority === level) ? 0 : level;
      renderInputMeta();
      break;

    case 'clear-date':
      clearPendingDate();
      break;

    case 'set-tag-filter':
      tagFilter = (tagFilter === el.dataset.tag) ? null : el.dataset.tag;
      renderWorkspace();
      break;

    case 'clear-tag-filter':
      tagFilter = null;
      renderWorkspace();
      break;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  loadState();
  render();

  document.getElementById('app').addEventListener('click', handleClick);

  document.getElementById('btn-new-list').addEventListener('click', function() {
    var name = prompt('List name:');
    if (name && name.trim()) addList(name.trim());
  });

  document.getElementById('todo-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var val = e.currentTarget.value;
      if (val.trim()) {
        addTask(val);
        e.currentTarget.value = '';
      }
    }
  });

  // Escape cancels date-edit mode
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && editingDateTaskId) {
      editingDateTaskId = null;
      renderWorkspace();
      document.getElementById('calendar').innerHTML =
        buildCalendar(state.calendarMonth, state.calendarYear);
    }
  });
}

init();
