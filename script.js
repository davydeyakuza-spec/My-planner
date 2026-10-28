// ===== My Planner =====

// ----- Storage keys -----
const STORAGE_KEY = "my_planner_tasks";
const INFO_KEY = "my_planner_dayinfo";
const ROUTINE_KEY = "my_planner_routine";
const ROUTINE_DONE_KEY = "my_planner_routine_done";
const SHOP_KEY = "my_planner_shopping";
const REPEAT_KEY = "my_planner_repeats";
const REPEAT_DONE_KEY = "my_planner_repeat_done";
const GOALS_KEY = "my_planner_goals";
const SETTINGS_KEY = "my_planner_settings";

function loadObject(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch (e) {
    return {};
  }
}

function loadArray(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return [];
}

function loadRoutine() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROUTINE_KEY));
    if (saved) return saved;
  } catch (e) {}
  return [
    { id: 1, time: "05:30", text: "Wake up and pray" },
    { id: 2, time: "06:00", text: "Exercise" },
    { id: 3, time: "07:00", text: "Breakfast" },
    { id: 4, time: "21:30", text: "Plan tomorrow" },
    { id: 5, time: "22:00", text: "Sleep" }
  ];
}

function save(storageKey, data) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {}
}

// ----- Data -----
let tasks = loadObject(STORAGE_KEY);            // { "2026-10-26": [ {id, text, time, priority, done} ] }
let dayInfo = loadObject(INFO_KEY);             // { "2026-10-26": {p1, p2, p3, note} }
let routine = loadRoutine();                    // [ {id, time, text} ] same every day
let routineDone = loadObject(ROUTINE_DONE_KEY); // { "2026-10-26": [id, id] }
let shopping = loadObject(SHOP_KEY);            // { "2026-10-26": [ {id, name, price, bought} ] }
let repeats = loadArray(REPEAT_KEY);            // [ {id, text, time, priority, type, start} ]
let repeatDone = loadObject(REPEAT_DONE_KEY);   // { "2026-10-26": [repeatId] }
let goals = loadArray(GOALS_KEY);               // [ {id, title, deadline, steps: [ {id, text, done} ]} ]
let settings = Object.assign({ dark: false, reminders: false, name: "", theme: "green", sound: true, lead: 0, lastBackup: "", nudged: "" }, loadObject(SETTINGS_KEY));
let view = "day";
let current = new Date();

function saveInfo(key, field, value) {
  if (!dayInfo[key]) dayInfo[key] = {};
  dayInfo[key][field] = value;
  save(INFO_KEY, dayInfo);
}

function infoVal(key, field) {
  const info = dayInfo[key] || {};
  const value = info[field] || "";
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ----- Helpers -----
function newId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function keyToDate(key) {
  const parts = key.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function niceDate(key) {
  const d = keyToDate(key);
  return d.getDate() + " " + MONTH_NAMES[d.getMonth()].slice(0, 3) + " " + d.getFullYear();
}

function mondayOf(d) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - diff);
  return copy;
}

// ----- Tasks (normal tasks + repeating tasks) -----
const PRIORITY_RANK = { high: 0, medium: 1, low: 2, "": 3 };

function sortItems(list) {
  return list.slice().sort(function (a, b) {
    const byTime = (a.time || "99:99").localeCompare(b.time || "99:99");
    if (byTime !== 0) return byTime;
    return PRIORITY_RANK[a.priority || ""] - PRIORITY_RANK[b.priority || ""];
  });
}

function repeatMatches(r, key) {
  if (key < r.start) return false;
  const d = keyToDate(key);
  const s = keyToDate(r.start);
  if (r.type === "daily") return true;
  if (r.type === "weekly") return d.getDay() === s.getDay();
  if (r.type === "monthly") {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(s.getDate(), lastDay);
  }
  return false;
}

function repeatLabel(r) {
  if (r.type === "daily") return "every day";
  if (r.type === "weekly") return "every " + DAY_NAMES[keyToDate(r.start).getDay()];
  return "every month";
}

// All items of one day: normal tasks and repeating tasks together
function getDayItems(key) {
  const items = (tasks[key] || []).map(function (t) {
    return {
      id: t.id, text: t.text, time: t.time, priority: t.priority, done: t.done, repeat: false,
      movedTo: t.movedTo || "", from: t.from || ""
    };
  });
  const doneIds = repeatDone[key] || [];
  repeats.forEach(function (r) {
    if (repeatMatches(r, key)) {
      items.push({
        id: r.id, text: r.text, time: r.time, priority: r.priority,
        done: doneIds.indexOf(r.id) !== -1, repeat: true, label: repeatLabel(r),
        movedTo: "", from: ""
      });
    }
  });
  return sortItems(items);
}

function taskCounts(key) {
  const list = getDayItems(key);
  const done = list.filter(function (t) { return t.done; }).length;
  return { total: list.length, done: done };
}

function plannedShopping(key) {
  let total = 0;
  (shopping[key] || []).forEach(function (s) { total += s.price; });
  return total;
}

function routineCount(key) {
  const ids = routineDone[key] || [];
  return routine.filter(function (r) { return ids.indexOf(r.id) !== -1; }).length;
}

function isRoutineFull(key) {
  return routine.length > 0 && routineCount(key) === routine.length;
}

// ----- Habit tracking -----
// Streak = days in a row (up to today). Total = all days it was done.
function habitStats(id) {
  let total = 0;
  for (const k in routineDone) {
    if (routineDone[k].indexOf(id) !== -1) total++;
  }
  let streak = 0;
  let key = dateKey(new Date());
  if ((routineDone[key] || []).indexOf(id) === -1) key = addDays(key, -1);
  while ((routineDone[key] || []).indexOf(id) !== -1) {
    streak++;
    key = addDays(key, -1);
  }
  return { streak: streak, total: total };
}

function fullRoutineStreak() {
  let streak = 0;
  let key = dateKey(new Date());
  if (!isRoutineFull(key)) key = addDays(key, -1);
  while (isRoutineFull(key)) {
    streak++;
    key = addDays(key, -1);
  }
  return streak;
}

// ----- Pop-up boxes -----
function openModal(message, buttons) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.id = "modal";
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal-box";
  const p = document.createElement("p");
  p.textContent = message;
  box.appendChild(p);
  const row = document.createElement("div");
  row.className = "modal-buttons";
  buttons.forEach(function (b) {
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.className = b.cls || "";
    btn.onclick = function () {
      closeModal();
      if (b.action) b.action();
    };
    row.appendChild(btn);
  });
  box.appendChild(row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function closeModal() {
  const old = document.getElementById("modal");
  if (old) old.parentNode.removeChild(old);
}

function askConfirm(message, onYes, yesLabel) {
  const isDelete = !yesLabel || yesLabel.indexOf("delete") !== -1;
  openModal(message, [
    { label: "No", cls: "btn-no" },
    { label: yesLabel || "Yes", cls: isDelete ? "btn-yes" : "btn-ok", action: onYes }
  ]);
}

function showNotice(message) {
  openModal(message, [{ label: "OK", cls: "btn-ok" }]);
}

// A pop-up with input fields, used to edit things.
// fields: [{ name, label, type, value, options }]. onSave gets the values; return false to keep it open.
function openForm(title, fields, onSave) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.id = "modal";
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal-box form-box";
  const heading = document.createElement("h3");
  heading.textContent = title;
  box.appendChild(heading);

  const inputs = {};
  fields.forEach(function (f) {
    const label = document.createElement("label");
    label.className = "form-label";
    label.textContent = f.label;
    box.appendChild(label);
    let input;
    if (f.type === "select") {
      input = document.createElement("select");
      f.options.forEach(function (o) {
        const opt = document.createElement("option");
        opt.value = o[0];
        opt.textContent = o[1];
        input.appendChild(opt);
      });
    } else {
      input = document.createElement("input");
      input.type = f.type;
    }
    input.className = "form-input";
    input.value = f.value === undefined || f.value === null ? "" : f.value;
    box.appendChild(input);
    inputs[f.name] = input;
  });

  const row = document.createElement("div");
  row.className = "modal-buttons";
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.className = "btn-no";
  cancel.onclick = closeModal;
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.className = "btn-ok";
  saveBtn.onclick = function () {
    const values = {};
    for (const name in inputs) values[name] = inputs[name].value;
    if (onSave(values) === false) return;
    closeModal();
  };
  row.appendChild(cancel);
  row.appendChild(saveBtn);
  box.appendChild(row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

const PRIORITY_OPTIONS = [["", "No priority"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]];
const REPEAT_OPTIONS = [["daily", "Every day"], ["weekly", "Every week"], ["monthly", "Every month"]];

// ----- Navigation -----
function setView(name) {
  view = name;
  panelName = null;
  render();
}

function move(step) {
  panelName = null;
  if (view !== "day" && view !== "week" && view !== "month") return;
  if (view === "day") {
    current.setDate(current.getDate() + step);
  } else if (view === "week") {
    current.setDate(current.getDate() + step * 7);
  } else {
    current.setDate(1);
    current.setMonth(current.getMonth() + step);
  }
  render();
}

function goToday() {
  panelName = null;
  current = new Date();
  if (view !== "day" && view !== "week" && view !== "month") view = "day";
  render();
}

function openDay(key) {
  panelName = null;
  current = keyToDate(key);
  view = "day";
  render();
}

// ----- Task actions -----
function addTask(key) {
  const text = document.getElementById("newText").value.trim();
  const time = document.getElementById("newTime").value;
  const priority = document.getElementById("newPriority").value;
  const repeatType = document.getElementById("newRepeat").value;
  if (text === "") return;
  if (repeatType !== "") {
    repeats.push({ id: newId(), text: text, time: time, priority: priority, type: repeatType, start: key });
    save(REPEAT_KEY, repeats);
  } else {
    if (!tasks[key]) tasks[key] = [];
    tasks[key].push({ id: newId(), text: text, time: time, priority: priority, done: false });
    save(STORAGE_KEY, tasks);
  }
  render();
}

function toggleTask(key, id) {
  const before = dayScore(key).percent;
  (tasks[key] || []).forEach(function (t) {
    if (t.id === id) t.done = !t.done;
  });
  save(STORAGE_KEY, tasks);
  render();
  afterToggle(key, before);
}

function toggleRepeat(key, id) {
  const before = dayScore(key).percent;
  const list = repeatDone[key] || [];
  const index = list.indexOf(id);
  if (index === -1) list.push(id);
  else list.splice(index, 1);
  repeatDone[key] = list;
  save(REPEAT_DONE_KEY, repeatDone);
  render();
  afterToggle(key, before);
}

function deleteTask(key, id) {
  const found = (tasks[key] || []).filter(function (t) { return t.id === id; })[0];
  const name = found ? found.text : "this task";
  askConfirm('Delete "' + name + '"?', function () {
    tasks[key] = (tasks[key] || []).filter(function (t) { return t.id !== id; });
    if (tasks[key].length === 0) delete tasks[key];
    save(STORAGE_KEY, tasks);
    render();
  }, "Yes, delete");
}

function deleteRepeat(id) {
  const found = repeats.filter(function (r) { return r.id === id; })[0];
  const name = found ? found.text : "this task";
  askConfirm('Delete the repeating task "' + name + '"? It will be removed from ALL days.', function () {
    repeats = repeats.filter(function (r) { return r.id !== id; });
    save(REPEAT_KEY, repeats);
    render();
  }, "Yes, delete");
}

function editTask(key, id) {
  const t = (tasks[key] || []).filter(function (x) { return x.id === id; })[0];
  if (!t) return;
  openForm("Edit task", [
    { name: "text", label: "Task", type: "text", value: t.text },
    { name: "time", label: "Time", type: "time", value: t.time },
    { name: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS, value: t.priority || "" },
    { name: "date", label: "Day", type: "date", value: key }
  ], function (v) {
    if (v.text.trim() === "") return false;
    t.text = v.text.trim();
    t.time = v.time;
    t.priority = v.priority;
    const newKey = v.date || key;
    if (newKey !== key) {
      tasks[key] = tasks[key].filter(function (x) { return x.id !== id; });
      if (tasks[key].length === 0) delete tasks[key];
      if (!tasks[newKey]) tasks[newKey] = [];
      tasks[newKey].push(t);
    }
    save(STORAGE_KEY, tasks);
    render();
  });
}

function editRepeat(id) {
  const r = repeats.filter(function (x) { return x.id === id; })[0];
  if (!r) return;
  openForm("Edit repeating task", [
    { name: "text", label: "Task", type: "text", value: r.text },
    { name: "time", label: "Time", type: "time", value: r.time },
    { name: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS, value: r.priority || "" },
    { name: "type", label: "Repeat", type: "select", options: REPEAT_OPTIONS, value: r.type }
  ], function (v) {
    if (v.text.trim() === "") return false;
    r.text = v.text.trim();
    r.time = v.time;
    r.priority = v.priority;
    r.type = v.type;
    save(REPEAT_KEY, repeats);
    render();
  });
}

// Moves only normal tasks. Repeating tasks stay on their own days.
function movableTasks(key) {
  return (tasks[key] || []).filter(function (t) { return !t.done && !t.movedTo; });
}

// Copies unfinished tasks to tomorrow. The first ones stay in today as not done.
function moveUnfinished(key) {
  const list = movableTasks(key);
  if (list.length === 0) {
    showNotice("There are no unfinished tasks to move.");
    return;
  }
  askConfirm("Move " + plural(list.length, "unfinished task") + " to tomorrow? They will also stay in today as not done.", function () {
    const next = addDays(key, 1);
    if (!tasks[next]) tasks[next] = [];
    list.forEach(function (t) {
      tasks[next].push({ id: newId(), text: t.text, time: t.time, priority: t.priority, done: false, from: key });
      t.movedTo = next;
    });
    save(STORAGE_KEY, tasks);
    render();
  }, "Yes, move");
}

// ----- Routine actions -----
function addRoutine() {
  const text = document.getElementById("routineText").value.trim();
  const time = document.getElementById("routineTime").value;
  if (text === "") return;
  routine.push({ id: newId(), time: time, text: text });
  save(ROUTINE_KEY, routine);
  render();
}

function deleteRoutine(id) {
  const found = routine.filter(function (r) { return r.id === id; })[0];
  const name = found ? found.text : "this routine";
  askConfirm('Delete "' + name + '" from your routine? Its streak count will not show anymore.', function () {
    routine = routine.filter(function (r) { return r.id !== id; });
    save(ROUTINE_KEY, routine);
    render();
  }, "Yes, delete");
}

function toggleRoutine(key, id) {
  const before = dayScore(key).percent;
  const list = routineDone[key] || [];
  const index = list.indexOf(id);
  if (index === -1) list.push(id);
  else list.splice(index, 1);
  routineDone[key] = list;
  save(ROUTINE_DONE_KEY, routineDone);
  render();
  afterToggle(key, before);
}

function editRoutine(id) {
  const r = routine.filter(function (x) { return x.id === id; })[0];
  if (!r) return;
  openForm("Edit routine", [
    { name: "text", label: "Routine", type: "text", value: r.text },
    { name: "time", label: "Time", type: "time", value: r.time }
  ], function (v) {
    if (v.text.trim() === "") return false;
    r.text = v.text.trim();
    r.time = v.time;
    save(ROUTINE_KEY, routine);
    render();
  });
}

// ----- Shopping actions -----
function addItem(key) {
  const name = document.getElementById("itemText").value.trim();
  const price = Number(document.getElementById("itemPrice").value) || 0;
  const need = document.getElementById("itemNeed").value || "must";
  if (name === "") return;
  if (!shopping[key]) shopping[key] = [];
  shopping[key].push({ id: newId(), name: name, price: price, bought: false, need: need });
  save(SHOP_KEY, shopping);
  render();
}

function toggleItem(key, id) {
  (shopping[key] || []).forEach(function (s) {
    if (s.id === id) s.bought = !s.bought;
  });
  save(SHOP_KEY, shopping);
  render();
}

function deleteItem(key, id) {
  const found = (shopping[key] || []).filter(function (s) { return s.id === id; })[0];
  const name = found ? found.name : "this item";
  askConfirm('Delete "' + name + '" from the shopping list?', function () {
    shopping[key] = (shopping[key] || []).filter(function (s) { return s.id !== id; });
    if (shopping[key].length === 0) delete shopping[key];
    save(SHOP_KEY, shopping);
    render();
  }, "Yes, delete");
}

function editItem(key, id) {
  const s = (shopping[key] || []).filter(function (x) { return x.id === id; })[0];
  if (!s) return;
  openForm("Edit item", [
    { name: "name", label: "Item", type: "text", value: s.name },
    { name: "price", label: "Price", type: "number", value: s.price },
    { name: "need", label: "How important", type: "select", options: NEED_OPTIONS, value: s.need || "must" },
    { name: "date", label: "Day", type: "date", value: key }
  ], function (v) {
    if (v.name.trim() === "") return false;
    s.name = v.name.trim();
    s.price = Number(v.price) || 0;
    s.need = v.need;
    const newKey = v.date || key;
    if (newKey !== key) {
      shopping[key] = shopping[key].filter(function (x) { return x.id !== id; });
      if (shopping[key].length === 0) delete shopping[key];
      if (!shopping[newKey]) shopping[newKey] = [];
      shopping[newKey].push(s);
    }
    save(SHOP_KEY, shopping);
    render();
  });
}

// ----- Goal actions -----
function findGoal(goalId) {
  return goals.filter(function (g) { return g.id === goalId; })[0];
}

function addGoal() {
  const title = document.getElementById("goalTitle").value.trim();
  const deadline = document.getElementById("goalDeadline").value;
  if (title === "") return;
  goals.push({ id: newId(), title: title, deadline: deadline, steps: [] });
  save(GOALS_KEY, goals);
  render();
}

function editGoal(goalId) {
  const g = findGoal(goalId);
  if (!g) return;
  openForm("Edit goal", [
    { name: "title", label: "Goal", type: "text", value: g.title },
    { name: "deadline", label: "Deadline (optional)", type: "date", value: g.deadline }
  ], function (v) {
    if (v.title.trim() === "") return false;
    g.title = v.title.trim();
    g.deadline = v.deadline;
    save(GOALS_KEY, goals);
    render();
  });
}

function deleteGoal(goalId) {
  const g = findGoal(goalId);
  const name = g ? g.title : "this goal";
  askConfirm('Delete the goal "' + name + '" and all its steps?', function () {
    goals = goals.filter(function (x) { return x.id !== goalId; });
    save(GOALS_KEY, goals);
    render();
  }, "Yes, delete");
}

function addStep(goalId) {
  const g = findGoal(goalId);
  const input = document.getElementById("step-" + goalId);
  if (!g || !input) return;
  const text = input.value.trim();
  if (text === "") return;
  g.steps.push({ id: newId(), text: text, done: false });
  save(GOALS_KEY, goals);
  render();
}

function toggleStep(goalId, stepId) {
  const g = findGoal(goalId);
  if (!g) return;
  g.steps.forEach(function (s) {
    if (s.id === stepId) s.done = !s.done;
  });
  save(GOALS_KEY, goals);
  render();
}

function editStep(goalId, stepId) {
  const g = findGoal(goalId);
  if (!g) return;
  const s = g.steps.filter(function (x) { return x.id === stepId; })[0];
  if (!s) return;
  openForm("Edit step", [
    { name: "text", label: "Step", type: "text", value: s.text }
  ], function (v) {
    if (v.text.trim() === "") return false;
    s.text = v.text.trim();
    save(GOALS_KEY, goals);
    render();
  });
}

function deleteStep(goalId, stepId) {
  const g = findGoal(goalId);
  if (!g) return;
  const s = g.steps.filter(function (x) { return x.id === stepId; })[0];
  askConfirm('Delete the step "' + (s ? s.text : "this step") + '"?', function () {
    g.steps = g.steps.filter(function (x) { return x.id !== stepId; });
    save(GOALS_KEY, goals);
    render();
  }, "Yes, delete");
}

function daysLeft(deadline) {
  const today = keyToDate(dateKey(new Date()));
  return Math.round((keyToDate(deadline) - today) / 86400000);
}

// ----- Settings: dark mode and reminders -----
function applyTheme() {
  const parts = [];
  if (settings.dark) parts.push("dark");
  if (settings.theme && settings.theme !== "green") parts.push("theme-" + settings.theme);
  document.body.className = parts.join(" ");
}

function toggleDark() {
  settings.dark = !settings.dark;
  save(SETTINGS_KEY, settings);
  applyTheme();
  render();
}

function toggleReminders() {
  settings.reminders = !settings.reminders;
  save(SETTINGS_KEY, settings);
  if (settings.reminders) {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch (e) {}
    showNotice("Reminders are ON. They work only while this page is open on your phone.");
  }
  render();
}

function beep() {
  if (!settings.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const audio = new Ctx();
    const osc = audio.createOscillator();
    osc.frequency.value = 880;
    osc.connect(audio.destination);
    osc.start();
    setTimeout(function () {
      osc.stop();
      audio.close();
    }, 500);
  } catch (e) {}
}

function showToast(message, autoMs) {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    box.className = "toasts";
    document.body.appendChild(box);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  const text = document.createElement("span");
  text.textContent = message;
  const btn = document.createElement("button");
  btn.textContent = "OK";
  btn.onclick = function () {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  };
  toast.appendChild(text);
  toast.appendChild(btn);
  box.appendChild(toast);
  if (autoMs) {
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, autoMs);
  }
}

function fireReminder(message) {
  showToast(message);
  beep();
  try {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  } catch (e) {}
  systemNotify(message);
}

const reminded = {};

function checkReminders() {
  if (!settings.reminders) return;
  const now = new Date();
  const key = dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const lead = Number(settings.lead) || 0;
  const due = [];
  getDayItems(key).forEach(function (t) {
    if (t.time && !t.done) due.push({ id: "t" + t.id, text: t.text, time: t.time });
  });
  const doneIds = routineDone[key] || [];
  routine.forEach(function (r) {
    if (r.time && doneIds.indexOf(r.id) === -1) due.push({ id: "r" + r.id, text: r.text + " (routine)", time: r.time });
  });
  due.forEach(function (d) {
    const target = toMinutes(d.time) - lead;
    // fire in the first 5 minutes after the target, so a slow phone does not miss it
    if (nowMin < target || nowMin > target + 4) return;
    const remindKey = key + "|" + d.id + "|" + d.time + "|" + lead;
    if (reminded[remindKey]) return;
    reminded[remindKey] = true;
    fireReminder((lead > 0 ? "In " + lead + " minutes (" + d.time + "): " : d.time + "  ") + d.text);
  });
}

function testReminder() {
  fireReminder("This is a test reminder.");
}

// ----- Search -----
function runSearch() {
  const q = document.getElementById("searchBox").value.trim().toLowerCase();
  const box = document.getElementById("searchResults");
  if (q.length < 2) {
    box.innerHTML = '<div class="empty">Type at least 2 letters.</div>';
    return;
  }
  const today = dateKey(new Date());
  const results = [];
  function has(text) { return text && String(text).toLowerCase().indexOf(q) !== -1; }

  for (const k in tasks) {
    tasks[k].forEach(function (t) {
      if (has(t.text)) results.push({ key: k, type: "Task", text: t.text });
    });
  }
  for (const k in shopping) {
    shopping[k].forEach(function (s) {
      if (has(s.name)) results.push({ key: k, type: "Shopping", text: s.name });
    });
  }
  for (const k in dayInfo) {
    ["p1", "p2", "p3"].forEach(function (f) {
      if (has(dayInfo[k][f])) results.push({ key: k, type: "Priority", text: dayInfo[k][f] });
    });
    if (has(dayInfo[k].note)) results.push({ key: k, type: "Note", text: dayInfo[k].note.slice(0, 80) });
  }
  repeats.forEach(function (r) {
    if (has(r.text)) results.push({ key: today, type: "Repeating task", text: r.text });
  });
  routine.forEach(function (r) {
    if (has(r.text)) results.push({ key: today, type: "Routine", text: r.text });
  });
  const goalResults = [];
  goals.forEach(function (g) {
    if (has(g.title)) goalResults.push({ type: "Goal", text: g.title });
    g.steps.forEach(function (s) {
      if (has(s.text)) goalResults.push({ type: "Goal step", text: s.text + " (" + g.title + ")" });
    });
  });

  results.sort(function (a, b) { return b.key.localeCompare(a.key); });
  let html = "";
  results.slice(0, 50).forEach(function (r) {
    html += '<div class="result" onclick="openDay(\'' + r.key + '\')">' + escapeHtml(r.text) +
      '<small>' + r.type + ' &middot; ' + niceDate(r.key) + '</small></div>';
  });
  goalResults.forEach(function (r) {
    html += '<div class="result" onclick="setView(\'goals\')">' + escapeHtml(r.text) +
      '<small>' + r.type + '</small></div>';
  });
  if (html === "") html = '<div class="empty">Nothing found.</div>';
  box.innerHTML = html;
}

// ----- Backup actions -----
function makeBackup() {
  return {
    app: "my-planner",
    version: 3,
    savedOn: dateKey(new Date()),
    tasks: tasks,
    dayInfo: dayInfo,
    routine: routine,
    routineDone: routineDone,
    shopping: shopping,
    repeats: repeats,
    repeatDone: repeatDone,
    goals: goals,
    settings: settings
  };
}

function setBackupMessage(text) {
  const box = document.getElementById("backupMsg");
  if (box) box.textContent = text;
}

function downloadBackup() {
  try {
    const text = JSON.stringify(makeBackup(), null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "planner-backup-" + dateKey(new Date()) + ".json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    markBackup();
    setBackupMessage("If the file did not download, use the Copy button and save the text in a note.");
  } catch (e) {
    setBackupMessage("Download did not work here. Use the Copy button instead.");
  }
}

function copyBackup() {
  const box = document.getElementById("backupText");
  box.focus();
  box.select();
  try {
    box.setSelectionRange(0, box.value.length);
  } catch (e) {}
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {}
  if (ok) markBackup();
  if (!ok && navigator.clipboard) {
    navigator.clipboard.writeText(box.value).then(function () {
      markBackup();
      setBackupMessage("Backup text copied. Paste it in a note and keep it safe.");
    }, function () {
      setBackupMessage("Could not copy. Press and hold the text, then choose Copy.");
    });
    return;
  }
  setBackupMessage(ok ? "Backup text copied. Paste it in a note and keep it safe."
    : "Could not copy. Press and hold the text, then choose Copy.");
}

function restoreFromText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    showNotice("This text is not a correct backup. Please check it and try again.");
    return;
  }
  if (!data || data.app !== "my-planner" || !Array.isArray(data.routine)) {
    showNotice("This is not a backup from this planner.");
    return;
  }
  askConfirm("Replace ALL the planner data now with this backup?", function () {
    tasks = data.tasks || {};
    dayInfo = data.dayInfo || {};
    routine = data.routine;
    routineDone = data.routineDone || {};
    shopping = data.shopping || {};
    repeats = Array.isArray(data.repeats) ? data.repeats : [];
    repeatDone = data.repeatDone || {};
    goals = Array.isArray(data.goals) ? data.goals : [];
    if (data.settings && typeof data.settings === "object") {
      settings = Object.assign(settings, data.settings);
      save(SETTINGS_KEY, settings);
      applyTheme();
    }
    save(STORAGE_KEY, tasks);
    save(INFO_KEY, dayInfo);
    save(ROUTINE_KEY, routine);
    save(ROUTINE_DONE_KEY, routineDone);
    save(SHOP_KEY, shopping);
    save(REPEAT_KEY, repeats);
    save(REPEAT_DONE_KEY, repeatDone);
    save(GOALS_KEY, goals);
    view = "day";
    panelName = null;
    current = new Date();
    render();
    showNotice("Backup restored.");
  }, "Yes, restore");
}

function restoreFromBox() {
  restoreFromText(document.getElementById("restoreText").value.trim());
}

function restoreFromFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    restoreFromText(String(reader.result));
  };
  reader.readAsText(file);
}

// ----- Pieces of HTML -----
function taskRowHtml(key, t) {
  const toggle = t.repeat ? "toggleRepeat" : "toggleTask";
  const edit = t.repeat ? "editRepeat(" + t.id + ")" : "editTask('" + key + "'," + t.id + ")";
  const del = t.repeat ? "deleteRepeat(" + t.id + ")" : "deleteTask('" + key + "'," + t.id + ")";
  const moved = movedLabel(key, t);
  return '<div class="task p-' + (t.priority || "none") + (t.done ? " done" : "") + '">' +
    '<input type="checkbox" ' + (t.done ? "checked" : "") +
    ' onchange="' + toggle + '(\'' + key + '\',' + t.id + ')">' +
    (t.time ? '<span class="time">' + t.time + '</span>' : "") +
    '<span class="text tap" onclick="' + edit + '">' + escapeHtml(t.text) +
    (t.repeat ? '<span class="badge">&#8635; ' + t.label + '</span>' : "") +
    (moved ? '<span class="badge ' + (t.movedTo ? "badge-moved" : "badge-from") + '">' + moved + '</span>' : "") +
    '</span>' +
    '<button class="del" onclick="' + del + '">&#10005;</button>' +
    '</div>';
}

// ----- Icons (simple line pictures) -----
const ICONS = {
  day: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="2"/>',
  week: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h10M7 17h10"/>',
  month: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" stroke-width="2.6"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  more: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  star: '<polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  bag: '<path d="M6 7h12l1 14H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  tasks: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  note: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><path d="M14 7l3 3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'
};

function icon(name) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
}

// ----- Bottom menu -----
function buildNav() {
  const items = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["goals", "Goals"], ["more", "More"]];
  let html = "";
  items.forEach(function (it) {
    html += '<button id="tab-' + it[0] + '" class="bn-item" onclick="setView(\'' + it[0] + '\')">' +
      '<span class="bn-ic">' + icon(it[0]) + '</span><span class="bn-label">' + it[1] + '</span></button>';
  });
  document.getElementById("bottomnav").innerHTML = html;
}

// ----- Day view: tiles that open panels -----
let panelName = null;   // which panel is open on the Day page (or null)

function showPanel(name) {
  panelName = name;
  render();
}

function hidePanel() {
  panelName = null;
  render();
}

function panelPriorities(key) {
  const info = dayInfo[key] || {};
  let html = '<p class="note">Write your 3 most important things. Tick each one when it is done.</p>';
  for (let n = 1; n <= 3; n++) {
    const text = infoVal(key, "p" + n);
    const isDone = !!info["d" + n] && text !== "";
    html += '<div class="field prio' + (isDone ? " done" : "") + '">' +
      '<input type="checkbox" ' + (isDone ? "checked" : "") + ' aria-label="Done"' +
      ' onchange="togglePriority(\'' + key + '\',' + n + ')">' +
      '<span class="num">' + n + '</span>' +
      '<input type="text" placeholder="Most important thing..." value="' + text + '"' +
      ' oninput="saveInfo(\'' + key + '\',\'p' + n + '\',this.value)"></div>';
  }
  const st = priorityStats(key);
  html += '<div class="progress">' + st.done + ' of ' + st.set + ' priorities done</div>';
  return html;
}

function panelRoutine(key) {
  const doneIds = routineDone[key] || [];
  const routineList = routine.slice().sort(function (a, b) {
    return (a.time || "99:99").localeCompare(b.time || "99:99");
  });
  let html = '<div class="progress">' + routineCount(key) + ' of ' + routineList.length +
    ' done. Full routine streak: ' + plural(fullRoutineStreak(), "day") + '.</div>';

  // Chart: how much of the routine you finished each day, last 14 days
  if (routineList.length > 0) {
    const bars = [];
    for (let i = 13; i >= 0; i--) {
      const k = addDays(key, -i);
      const p = Math.round((routineCount(k) / routine.length) * 100);
      bars.push({ label: String(keyToDate(k).getDate()), value: p, display: "", today: i === 0 });
    }
    html += '<div class="trend-box"><div class="small-label">Routine done each day, last 14 days (%)</div>' +
      barChart(bars, 100, true) + '</div>';
  } else {
    html += '<div class="empty">No routine yet. Add one below.</div>';
  }

  routineList.forEach(function (r) {
    const isDone = doneIds.indexOf(r.id) !== -1;
    const stats = habitStats(r.id);
    html += '<div class="task habit p-none ' + (isDone ? "done" : "") + '">' +
      '<input type="checkbox" ' + (isDone ? "checked" : "") +
      ' onchange="toggleRoutine(\'' + key + '\',' + r.id + ')">' +
      (r.time ? '<span class="time">' + r.time + '</span>' : "") +
      '<span class="text tap" onclick="editRoutine(' + r.id + ')"><span class="name">' + escapeHtml(r.text) + '</span>' +
      '<span class="stats">Streak: ' + plural(stats.streak, "day") + ' &middot; Best: ' + plural(longestStreak(r.id), "day") +
      ' &middot; Done ' + plural(stats.total, "time") + '</span>' +
      habitStripHtml(r.id, key, 14) + habitTrendHtml(r.id, key) + '</span>' +
      '<button class="del" onclick="deleteRoutine(' + r.id + ')">&#10005;</button>' +
      '</div>';
  });
  html += '<div class="add-row" style="margin-top:10px">' +
    '<input type="text" id="routineText" placeholder="New routine...">' +
    '<input type="time" id="routineTime">' +
    '<button onclick="addRoutine()">Add</button>' +
    '</div>';
  return html;
}

function shoppingTotals(key) {
  const list = shopping[key] || [];
  let planned = 0;
  let bought = 0;
  let boughtCount = 0;
  let mustLeft = 0;
  list.forEach(function (s) {
    planned += s.price;
    if (s.bought) {
      bought += s.price;
      boughtCount++;
    } else if ((s.need || "must") === "must") {
      mustLeft += s.price;
    }
  });
  return {
    count: list.length, planned: planned, bought: bought,
    boughtCount: boughtCount, pendingCount: list.length - boughtCount, mustLeft: mustLeft
  };
}

function panelShopping(key) {
  const list = shopping[key] || [];
  const totals = shoppingTotals(key);
  const percent = totals.count === 0 ? 0 : Math.round((totals.boughtCount / totals.count) * 100);
  let html = '<div class="add-form">' +
    '<input type="text" id="itemText" placeholder="Item...">' +
    '<div class="add-form-row">' +
    '<input type="number" inputmode="decimal" id="itemPrice" placeholder="Price">' +
    '<select id="itemNeed"><option value="must">Must buy</option><option value="want">Can wait</option></select>' +
    '</div>' +
    '<button class="big-btn green" onclick="addItem(\'' + key + '\')">Add item</button></div>';

  if (list.length === 0) {
    html += '<div class="empty">Nothing planned to buy.</div>';
    return html;
  }

  html += '<div class="progress">' + totals.boughtCount + ' of ' + totals.count + ' bought (' + percent + '%)</div>' +
    '<div class="bar"><div style="width:' + percent + '%"></div></div>';

  // Pending first (must buy on top), then the ones already bought
  const pending = list.filter(function (s) { return !s.bought; }).sort(function (a, b) {
    return ((a.need || "must") === "must" ? 0 : 1) - ((b.need || "must") === "must" ? 0 : 1);
  });
  const bought = list.filter(function (s) { return s.bought; });
  html += '<div class="group-title">To buy (' + pending.length + ')</div>';
  if (pending.length === 0) html += '<div class="empty">Everything is bought. Well done!</div>';
  pending.forEach(function (s) { html += shopRowHtml(key, s); });
  if (bought.length > 0) {
    html += '<div class="group-title">Bought (' + bought.length + ')</div>';
    bought.forEach(function (s) { html += shopRowHtml(key, s); });
  }

  html += '<div class="totals">Planned total: ' + totals.planned +
    '<br>Bought so far: ' + totals.bought +
    '<br>Still to buy: ' + (totals.planned - totals.bought) +
    '<br>Must buy, still to buy: ' + totals.mustLeft + '</div>';
  if (movableItems(key).length > 0) {
    html += '<button class="move-btn" onclick="moveUnbought(\'' + key + '\')">Move items not bought to tomorrow (' + movableItems(key).length + ')</button>' +
      '<p class="note">The item stays in today as pending, and a copy goes to tomorrow.</p>';
  }
  return html;
}

function panelTasks(key) {
  const list = getDayItems(key);
  const done = list.filter(function (t) { return t.done; }).length;
  const percent = list.length === 0 ? 0 : Math.round((done / list.length) * 100);
  let html = '<div class="add-form">' +
    '<input type="text" id="newText" placeholder="New task...">' +
    '<div class="add-form-row">' +
    '<input type="time" id="newTime">' +
    '<select id="newPriority"><option value="">No priority</option><option value="high">High</option>' +
    '<option value="medium">Medium</option><option value="low">Low</option></select>' +
    '<select id="newRepeat"><option value="">No repeat</option><option value="daily">Every day</option>' +
    '<option value="weekly">Every week</option><option value="monthly">Every month</option></select>' +
    '</div>' +
    '<button class="big-btn green" onclick="addTask(\'' + key + '\')">Add task</button>' +
    '</div>';
  html += '<div class="progress">' + done + ' of ' + list.length + ' done (' + percent + '%)</div>';
  html += '<div class="bar"><div style="width:' + percent + '%"></div></div>';

  if (list.length === 0) {
    html += '<div class="empty">No tasks for this day.</div>';
  } else {
    list.forEach(function (t) { html += taskRowHtml(key, t); });
  }
  const movable = movableTasks(key).length;
  if (movable > 0) {
    html += '<button class="move-btn" onclick="moveUnfinished(\'' + key + '\')">Move unfinished to tomorrow (' + movable + ')</button>' +
      '<p class="note">The task stays in today as not done, and a copy goes to tomorrow.</p>';
  }
  return html;
}

function panelNotes(key) {
  const mood = Number((dayInfo[key] || {}).mood) || 0;
  let html = '<div class="small-label">How was your day?</div><div class="moods">';
  for (let n = 1; n <= 5; n++) {
    html += '<button class="mood' + (mood === n ? " active" : "") + '" aria-label="Mood ' + n + ' of 5"' +
      ' onclick="setMood(\'' + key + '\',' + n + ')">' + MOODS[n] + '</button>';
  }
  html += '</div><textarea class="note-box" placeholder="Write how the day went, ideas, things to remember..."' +
    ' oninput="saveInfo(\'' + key + '\',\'note\',this.value)">' + infoVal(key, "note") + '</textarea>';
  return html;
}

const PANELS = {
  priorities: { title: "Top 3 priorities", build: panelPriorities },
  routine: { title: "Daily routine", build: panelRoutine },
  tasks: { title: "Tasks", build: panelTasks },
  shopping: { title: "What to buy today", build: panelShopping },
  notes: { title: "Notes and mood", build: panelNotes },
  focus: { title: "Focus timer", build: panelFocus }
};

function tileHtml(name, cls, title, big, caption, extra) {
  return '<button class="tile ' + cls + '" onclick="showPanel(\'' + name + '\')">' +
    '<span class="tile-icon">' + icon(extra.icon) + '</span>' +
    '<span class="tile-title">' + title + '</span>' +
    '<span class="tile-big">' + big + '</span>' +
    '<span class="tile-cap">' + caption + '</span>' +
    (extra.preview || "") + '</button>';
}

function shorten(text, n) {
  const t = String(text).trim();
  return t.length > n ? t.slice(0, n - 1) + "..." : t;
}

function renderDay() {
  const key = dateKey(current);
  const list = getDayItems(key);
  const done = list.filter(function (t) { return t.done; }).length;
  const info = dayInfo[key] || {};

  // Priorities tile
  const pr = priorityStats(key);
  let prioCaption = "Tap to set";
  if (pr.set > 0) {
    let firstOpen = "";
    [1, 2, 3].forEach(function (n) {
      const text = info["p" + n];
      if (!firstOpen && text && String(text).trim() !== "" && !info["d" + n]) firstOpen = String(text).trim();
    });
    prioCaption = firstOpen === "" ? "All priorities done!" : escapeHtml(shorten(firstOpen, 28));
  }

  // Tasks tile with a small preview of what is still open
  const open = list.filter(function (t) { return !t.done; });
  let preview = "";
  if (open.length > 0) {
    preview = '<span class="tile-list">';
    open.slice(0, 3).forEach(function (t) {
      preview += '<span class="tile-item">' + (t.time ? t.time + "  " : "") + escapeHtml(shorten(t.text, 30)) + '</span>';
    });
    if (open.length > 3) preview += '<span class="tile-item more-items">+ ' + (open.length - 3) + ' more</span>';
    preview += '</span>';
  }
  const taskCaption = list.length === 0 ? "No tasks yet. Tap to add."
    : (open.length === 0 ? "All tasks done!" : plural(open.length, "task") + " to do");

  // Shopping tile
  const shop = shoppingTotals(key);
  const shopBig = shop.count === 0 ? "0" : shop.boughtCount + "/" + shop.count;
  const shopCap = shop.count === 0 ? "Nothing planned"
    : (shop.pendingCount === 0 ? "All bought!" : plural(shop.pendingCount, "item") + " pending &middot; " + (shop.planned - shop.bought) + " left");

  // Notes tile
  const note = (info.note || "").trim();
  const mood = Number(info.mood) || 0;

  // Focus tile
  const focusBig = focus.running ? clockText(focusLeftSec()) : focusMinutes(key) + " min";
  const focusCap = focus.running ? "Focus time is running" : (focusMinutes(key) > 0 ? "Focused today. Tap to start again." : "Tap to start a focus timer");

  const html = '<div class="tiles">' +
    tileHtml("priorities", "t1", "Priorities", pr.done + "/" + pr.set, prioCaption, { icon: "star" }) +
    tileHtml("routine", "t2", "Routine", routineCount(key) + "/" + routine.length,
      "Streak: " + plural(fullRoutineStreak(), "day"), { icon: "repeat" }) +
    tileHtml("tasks", "t3 wide", "Tasks", done + "/" + list.length, taskCaption, { icon: "tasks", preview: preview }) +
    tileHtml("shopping", "t4", "Shopping", shopBig, shopCap, { icon: "bag" }) +
    tileHtml("notes", "t5", "Notes", mood > 0 ? MOODS[mood] : (note === "" ? "Empty" : "Written"),
      note === "" ? "Tap to write" : escapeHtml(shorten(note, 28)), { icon: "note" }) +
    tileHtml("focus", "t6 wide", "Focus", focusBig, focusCap, { icon: "timer" }) +
    '</div>';

  document.getElementById("app").innerHTML = html;

  document.getElementById("title").textContent =
    DAY_NAMES[current.getDay()] + ", " + current.getDate() + " " +
    MONTH_NAMES[current.getMonth()] + " " + current.getFullYear();
}

// ----- The panel that slides up from the bottom -----
function renderSheet() {
  let sheet = document.getElementById("sheet");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "sheet";
    sheet.className = "sheet-wrap";
    document.body.appendChild(sheet);
  }
  if (view !== "day" || !panelName || !PANELS[panelName]) {
    panelName = null;
    sheet.style.display = "none";
    sheet.innerHTML = "";
    document.body.style.overflow = "";
    return;
  }
  const oldBody = document.getElementById("sheetBody");
  const oldTop = oldBody ? oldBody.scrollTop : 0;
  const wasOpen = sheet.style.display === "flex";
  const key = dateKey(current);
  const panel = PANELS[panelName];
  sheet.style.display = "flex";
  document.body.style.overflow = "hidden";
  sheet.onclick = hidePanel;
  sheet.innerHTML =
    '<div class="sheet' + (wasOpen ? " no-anim" : "") + '" onclick="event.stopPropagation()">' +
    '<div class="sheet-head"><span>' + panel.title + '</span>' +
    '<button onclick="hidePanel()">Close</button></div>' +
    '<div class="sheet-body" id="sheetBody">' + panel.build(key) + '</div></div>';
  const newBody = document.getElementById("sheetBody");
  if (newBody) newBody.scrollTop = oldTop;
}

// ----- Week view -----
function renderWeek() {
  const start = mondayOf(current);
  const todayKey = dateKey(new Date());
  const keys = [];
  for (let i = 0; i < 7; i++) {
    keys.push(dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }

  let total = 0, done = 0, tasksTotal = 0, tasksDone = 0, fullDays = 0, planned = 0, bought = 0;
  const habitCount = {};
  routine.forEach(function (r) { habitCount[r.id] = 0; });

  const days = keys.map(function (key) {
    const sc = dayScore(key);
    const tc = taskCounts(key);
    const sh = shoppingTotals(key);
    total += sc.total;
    done += sc.done;
    tasksTotal += tc.total;
    tasksDone += tc.done;
    planned += sh.planned;
    bought += sh.bought;
    if (isRoutineFull(key)) fullDays++;
    const ids = routineDone[key] || [];
    routine.forEach(function (r) {
      if (ids.indexOf(r.id) !== -1) habitCount[r.id]++;
    });
    return { key: key, sc: sc, tc: tc, sh: sh };
  });
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  // Summary with a progress bar
  let html = '<div class="card summary"><h2>This week</h2>' +
    '<div class="big-percent">' + percent + '%</div>' +
    '<div class="bar"><div style="width:' + percent + '%"></div></div>' +
    '<div>Done: ' + done + ' of ' + total + ' (tasks, routine and priorities)</div>' +
    '<div>Tasks done: ' + tasksDone + ' of ' + tasksTotal + '</div>' +
    '<div>Days with full routine: ' + fullDays + ' of 7</div>' +
    '<div>Focus time: ' + focusSumKeys(keys) + ' minutes</div>' +
    '<div>Shopping planned: ' + planned + ' &middot; bought: ' + bought + '</div></div>';

  // Chart: progress of each day
  html += '<div class="card"><h2>Progress each day (%)</h2>' + barChart(days.map(function (d) {
    return { label: dayAbbr(d.key), value: d.sc.percent, display: d.sc.total === 0 ? "-" : d.sc.percent, today: d.key === todayKey };
  }), 100) + '</div>';

  // Habits
  if (routine.length > 0) {
    html += '<div class="card"><h2>Habits this week</h2>' + habitBarsHtml(habitCount, 7) + '</div>';
  }

  // Shopping chart
  if (planned > 0) {
    html += '<div class="card"><h2>Shopping each day</h2>' + barChart(days.map(function (d) {
      return { label: dayAbbr(d.key), value: d.sh.planned, value2: d.sh.bought, display: d.sh.planned === 0 ? "-" : shortNum(d.sh.planned), today: d.key === todayKey };
    })) + '<div class="legend"><i class="lg-soft"></i>Planned <i class="lg-solid"></i>Bought</div></div>';
  }

  // One short row for each day. Touch a row to open the day.
  html += '<div class="rows">';
  days.forEach(function (d) {
    const dt = keyToDate(d.key);
    const info = dayInfo[d.key] || {};
    const first = [info.p1, info.p2, info.p3].filter(function (g) { return g && g.trim() !== ""; })[0];
    html += '<button class="day-row' + (d.key === todayKey ? " today" : "") + '" onclick="openDay(\'' + d.key + '\')">' +
      '<span class="dr-top"><span class="dr-name">' + DAY_NAMES[dt.getDay()] + ' ' + dt.getDate() + '</span>' +
      '<span class="dr-pct">' + (d.sc.total === 0 ? "-" : d.sc.percent + "%") + '</span></span>' +
      '<span class="mini-bar"><span style="width:' + d.sc.percent + '%"></span></span>' +
      '<span class="dr-cap">Tasks ' + d.tc.done + '/' + d.tc.total + ' &middot; Routine ' + routineCount(d.key) + '/' + routine.length +
      (d.sh.planned > 0 ? ' &middot; Shopping ' + d.sh.planned : '') + '</span>' +
      (first ? '<span class="dr-goal">&#9733; ' + escapeHtml(shorten(first, 40)) + '</span>' : '') +
      '</button>';
  });
  html += '</div>';

  document.getElementById("app").innerHTML = html;

  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  document.getElementById("title").textContent =
    start.getDate() + " " + MONTH_NAMES[start.getMonth()].slice(0, 3) + " - " +
    end.getDate() + " " + MONTH_NAMES[end.getMonth()].slice(0, 3) + " " + end.getFullYear();
}

// ----- Month view -----
function renderMonth() {
  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // empty cells before day 1
  const todayKey = dateKey(new Date());

  let total = 0, done = 0, tasksTotal = 0, tasksDone = 0, fullDays = 0, activeDays = 0, elapsed = 0, planned = 0, bought = 0;
  const habitCount = {};
  routine.forEach(function (r) { habitCount[r.id] = 0; });
  const weeks = [];   // progress and shopping for each week of the month

  let grid = '<div class="grid">';
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (n) {
    grid += '<div class="dow">' + n + '</div>';
  });
  for (let i = 0; i < offset; i++) {
    grid += '<div class="cell empty-cell"></div>';
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKey(new Date(year, month, day));
    const past = key <= todayKey;
    const sc = dayScore(key);
    const w = Math.floor((offset + day - 1) / 7);
    if (!weeks[w]) weeks[w] = { total: 0, done: 0, planned: 0, bought: 0, label: "W" + (w + 1) };

    let heat = "";
    let mark = "";
    if (past) {
      elapsed++;
      total += sc.total;
      done += sc.done;
      weeks[w].total += sc.total;
      weeks[w].done += sc.done;
      const tc = taskCounts(key);
      tasksTotal += tc.total;
      tasksDone += tc.done;
      const sh = shoppingTotals(key);
      planned += sh.planned;
      bought += sh.bought;
      weeks[w].planned += sh.planned;
      weeks[w].bought += sh.bought;
      if (sc.done > 0) activeDays++;
      const ids = routineDone[key] || [];
      routine.forEach(function (r) {
        if (ids.indexOf(r.id) !== -1) habitCount[r.id]++;
      });
      if (sc.total > 0 && sc.percent > 0) {
        heat = " heat" + (sc.percent <= 25 ? 1 : sc.percent <= 50 ? 2 : sc.percent <= 75 ? 3 : 4);
        mark = sc.percent === 100 ? '<span class="cell-pct">&#10003;</span>' : '<span class="cell-pct">' + sc.percent + '%</span>';
      }
    }
    if (isRoutineFull(key)) fullDays++;
    grid += '<div class="cell' + heat + (key === todayKey ? " today" : "") +
      '" onclick="openDay(\'' + key + '\')">' + day + mark + '</div>';
  }
  grid += '</div>';
  grid += '<div class="legend heat-legend">Less <i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i> More</div>';

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  let html = '<div class="card summary"><h2>This month</h2>' +
    '<div class="big-percent">' + percent + '%</div>' +
    '<div class="bar"><div style="width:' + percent + '%"></div></div>' +
    '<div>Done: ' + done + ' of ' + total + ' (tasks, routine and priorities, up to today)</div>' +
    '<div>Tasks done: ' + tasksDone + ' of ' + tasksTotal + '</div>' +
    '<div>Active days: ' + activeDays + ' of ' + elapsed + '</div>' +
    '<div>Days with full routine: ' + fullDays + '</div>' +
    '<div>Focus time: ' + focusSumMonth(year, month) + ' minutes</div>' +
    '<div>Shopping planned: ' + planned + ' &middot; bought: ' + bought + '</div></div>';

  html += '<div class="card"><h2>Calendar</h2>' + grid + '</div>';

  const weekItems = weeks.map(function (wk) {
    const p = wk.total === 0 ? 0 : Math.round((wk.done / wk.total) * 100);
    return { label: wk.label, value: p, display: wk.total === 0 ? "-" : p };
  });
  html += '<div class="card"><h2>Progress each week (%)</h2>' + barChart(weekItems, 100) + '</div>';

  if (routine.length > 0) {
    html += '<div class="card"><h2>Habits this month</h2>' + habitBarsHtml(habitCount, elapsed) + '</div>';
  }

  if (planned > 0) {
    html += '<div class="card"><h2>Shopping each week</h2>' + barChart(weeks.map(function (wk) {
      return { label: wk.label, value: wk.planned, value2: wk.bought, display: wk.planned === 0 ? "-" : shortNum(wk.planned) };
    })) + '<div class="legend"><i class="lg-soft"></i>Planned <i class="lg-solid"></i>Bought</div></div>';
  }

  html += moodMonthHtml(year, month);

  document.getElementById("app").innerHTML = html;
  document.getElementById("title").textContent = MONTH_NAMES[month] + " " + year;
}

// ----- Goals view -----
function renderGoals() {
  let html = '<div class="card"><h2>New goal</h2><div class="add-form">' +
    '<input type="text" id="goalTitle" placeholder="My goal (example: Learn JavaScript)">' +
    '<label class="small-label">Deadline (optional)</label>' +
    '<input type="date" id="goalDeadline">' +
    '<button class="big-btn green" onclick="addGoal()">Add goal</button></div></div>';

  if (goals.length === 0) {
    html += '<div class="card"><div class="empty">No goals yet. Add one above, then add small steps.</div></div>';
  }

  goals.forEach(function (g) {
    const doneSteps = g.steps.filter(function (s) { return s.done; }).length;
    const percent = g.steps.length === 0 ? 0 : Math.round((doneSteps / g.steps.length) * 100);
    html += '<div class="card"><h2 class="tap" onclick="editGoal(' + g.id + ')">' + escapeHtml(g.title) + '</h2>';

    if (g.deadline) {
      const left = daysLeft(g.deadline);
      let text;
      let late = false;
      if (percent === 100 && g.steps.length > 0) text = "Deadline: " + niceDate(g.deadline);
      else if (left > 0) text = "Deadline: " + niceDate(g.deadline) + " (" + plural(left, "day") + " left)";
      else if (left === 0) text = "Deadline is today!";
      else {
        text = "Overdue by " + plural(-left, "day") + " (" + niceDate(g.deadline) + ")";
        late = true;
      }
      html += '<div class="goal-info ' + (late ? "late" : "") + '">' + text + '</div>';
    }

    if (g.steps.length > 0 && percent === 100) {
      html += '<div class="goal-info">Goal complete! Well done.</div>';
    }
    html += '<div class="progress">' + doneSteps + ' of ' + g.steps.length + ' steps done (' + percent + '%)</div>';
    html += '<div class="bar"><div style="width:' + percent + '%"></div></div>';

    g.steps.forEach(function (s) {
      html += '<div class="task p-none ' + (s.done ? "done" : "") + '">' +
        '<input type="checkbox" ' + (s.done ? "checked" : "") +
        ' onchange="toggleStep(' + g.id + ',' + s.id + ')">' +
        '<span class="text tap" onclick="editStep(' + g.id + ',' + s.id + ')">' + escapeHtml(s.text) + '</span>' +
        '<button class="del" onclick="deleteStep(' + g.id + ',' + s.id + ')">&#10005;</button>' +
        '</div>';
    });

    html += '<div class="add-row" style="margin-top:10px">' +
      '<input type="text" id="step-' + g.id + '" placeholder="New step...">' +
      '<button onclick="addStep(' + g.id + ')">Add</button></div>';
    html += '<button class="link-del" onclick="deleteGoal(' + g.id + ')">Delete this goal</button>';
    html += '</div>';
  });

  document.getElementById("app").innerHTML = html;
  document.getElementById("title").textContent = "Goals";
}

// ----- Weekly review -----
function reviewHtml(start, title) {
  let total = 0;
  let done = 0;
  let fullDays = 0;
  let planned = 0;
  let bought = 0;
  const habitCount = {};
  routine.forEach(function (r) { habitCount[r.id] = 0; });

  for (let i = 0; i < 7; i++) {
    const key = dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const c = taskCounts(key);
    total += c.total;
    done += c.done;
    if (isRoutineFull(key)) fullDays++;
    (shopping[key] || []).forEach(function (s) {
      planned += s.price;
      if (s.bought) bought += s.price;
    });
    const ids = routineDone[key] || [];
    routine.forEach(function (r) {
      if (ids.indexOf(r.id) !== -1) habitCount[r.id]++;
    });
  }

  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const range = start.getDate() + " " + MONTH_NAMES[start.getMonth()].slice(0, 3) + " - " +
    end.getDate() + " " + MONTH_NAMES[end.getMonth()].slice(0, 3);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  let message;
  if (total === 0) message = "No tasks were planned this week. Try adding a few tasks each day.";
  else if (percent >= 80) message = "Great week! You finished most of your tasks. Keep going.";
  else if (percent >= 50) message = "Good effort. Try to finish a few more tasks next week.";
  else message = "A hard week. Next week, plan fewer tasks and start small.";

  let html = '<div class="card"><h2>' + title + ' (' + range + ')</h2><div class="bar"><div style="width:' + percent + '%"></div></div><div class="review-line">' +
    'Tasks done: ' + done + ' of ' + total + ' (' + percent + '%)<br>' +
    'Days with full routine: ' + fullDays + ' of 7<br>' +
    'Shopping planned: ' + planned + ' &middot; Bought: ' + bought;
  if (routine.length > 0) {
    html += '<br><strong>Habits:</strong>';
    routine.forEach(function (r) {
      html += '<br>' + escapeHtml(r.text) + ': ' + habitCount[r.id] + ' of 7 days';
    });
  }
  html += '</div><div class="review-msg">' + message + '</div></div>';
  return html;
}

// ----- More view: search, review, settings, backup -----
function renderMore() {
  const text = JSON.stringify(makeBackup(), null, 2);
  const thisMonday = mondayOf(new Date());
  const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);

  let html = '<div class="card"><h2>Search</h2>' +
    '<input type="text" id="searchBox" class="search-box" placeholder="Search tasks, notes, goals..." oninput="runSearch()">' +
    '<div id="searchResults"><div class="empty">Type at least 2 letters.</div></div></div>';

  html += reviewHtml(thisMonday, "Review: this week");
  html += reviewHtml(lastMonday, "Review: last week");

  // Settings
  const themes = [["green", "Classic"], ["blue", "Royal"], ["plum", "Plum"], ["earth", "Earth"]];
  let swatches = '<div class="swatches">';
  themes.forEach(function (t) {
    swatches += '<button class="swatch sw-' + t[0] + ((settings.theme || "green") === t[0] ? " active" : "") +
      '" onclick="setTheme(\'' + t[0] + '\')"><span></span>' + t[1] + '</button>';
  });
  swatches += '</div>';
  const leads = [[0, "At the time"], [5, "5 minutes before"], [10, "10 minutes before"], [30, "30 minutes before"]];
  let leadOptions = "";
  leads.forEach(function (l) {
    leadOptions += '<option value="' + l[0] + '"' + (Number(settings.lead) === l[0] ? " selected" : "") + '>' + l[1] + '</option>';
  });

  html += '<div class="card"><h2>Settings</h2>' +
    '<label class="small-label">Your name (shown in the greeting)</label>' +
    '<input type="text" id="nameBox" class="form-input" placeholder="Your name" maxlength="30" value="' +
    escapeHtml(settings.name || "").replace(/"/g, "&quot;") + '" oninput="saveName(this.value)">' +
    '<label class="small-label" style="margin-top:14px">Color theme</label>' + swatches +
    '<button class="big-btn" onclick="toggleDark()">Dark mode: ' + (settings.dark ? "ON" : "OFF") + '</button>' +
    '<button class="big-btn" onclick="toggleSound()">Sounds: ' + (settings.sound ? "ON" : "OFF") + '</button>' +
    '<button class="big-btn" onclick="toggleReminders()">Reminders: ' + (settings.reminders ? "ON" : "OFF") + '</button>' +
    '<label class="small-label">Remind me</label>' +
    '<select id="leadSel" class="form-input" onchange="setLead(this.value)">' + leadOptions + '</select>' +
    '<button class="big-btn" onclick="testReminder()">Test a reminder</button>' +
    '<p class="note">Reminders work for tasks and routine items that have a time. They work while the planner is open or in the background. When you open the planner, it also tells you about items that are already late.</p></div>';

  // Install
  let installCard = '<div class="card"><h2>Install on your phone</h2>';
  if (isInstalled()) {
    installCard += '<p class="note">The planner is installed on this phone. You can open it from your home screen.</p>';
  } else if (installPrompt) {
    installCard += '<p class="note">Install the planner like a real app, with its own icon.</p>' +
      '<button class="big-btn green" onclick="installApp()">Install the planner</button>';
  } else {
    installCard += '<p class="note">You can install the planner like a real app, with its own icon on your home screen.</p>' +
      '<button class="big-btn" onclick="installApp()">How to install</button>';
  }
  html += installCard + '</div>';

  // Backup
  const lastText = settings.lastBackup
    ? "Last backup: " + niceDate(settings.lastBackup) + " (" + plural(daysSince(settings.lastBackup), "day") + " ago)."
    : "You have not saved a backup yet.";
  html += '<div class="card"><h2>Save a backup</h2>' +
    '<p class="note">Your planner data is saved only in this browser. If the browser data is cleared, you can lose everything. The backup also keeps your settings, so you can move to a new phone easily.</p>' +
    '<div class="review-msg">' + lastText + '</div>' +
    '<button class="big-btn" onclick="shareBackup()">Share backup (WhatsApp, Drive...)</button>' +
    '<button class="big-btn" onclick="downloadBackup()">Download backup file</button>' +
    '<button class="big-btn" onclick="copyBackup()">Copy backup text</button>' +
    '<textarea id="backupText" class="code" readonly>' + escapeHtml(text) + '</textarea>' +
    '<div id="backupMsg" class="note"></div></div>';

  html += '<div class="card"><h2>Restore a backup</h2>' +
    '<p class="note">On a new phone: open the planner, come here, paste the backup text or choose the file. This replaces all the data now in the planner.</p>' +
    '<textarea id="restoreText" class="code" placeholder="Paste your backup text here..."></textarea>' +
    '<button class="big-btn danger" onclick="restoreFromBox()">Restore from text</button>' +
    '<p class="note">Or choose a backup file:</p>' +
    '<input type="file" accept=".json,application/json" onchange="restoreFromFile(this)"></div>';

  document.getElementById("app").innerHTML = html;
  document.getElementById("title").textContent = "More";
}

// ----- Hero: greeting, quote and progress ring -----
const QUOTES = [
  "Little by little fills the measure. (Haba na haba hujaza kibaba)",
  "Slowly, slowly is the way. (Pole pole ndio mwendo)",
  "Patience brings good things. (Subira huvuta heri)",
  "Whoever wants what is under the bed must bend down. (Mtaka cha mvunguni sharti ainame)",
  "A journey of a thousand miles begins with one step.",
  "Today is a fresh page. Write something good on it.",
  "Finish one task. Then finish the next.",
  "You do not need to do everything. Do the important things.",
  "Every habit you keep makes you stronger.",
  "Progress is progress, even when it is small.",
  "A good day starts with a good plan.",
  "Be proud of every task you finish.",
  "Plan your day, or the day will plan you.",
  "Spend wisely today. Your future self will say thank you.",
  "Rest is part of the plan too.",
  "Do small things well. Big things will follow."
];

function quoteOfDay(key) {
  const days = Math.floor(keyToDate(key).getTime() / 86400000);
  return QUOTES[((days % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

// Score of one day = finished tasks and routine items, out of all of them
// Score of one day = finished tasks, routine items and priorities, out of all of them
function dayScore(key) {
  const items = getDayItems(key);
  const doneItems = items.filter(function (t) { return t.done; }).length;
  const pr = priorityStats(key);
  const total = items.length + routine.length + pr.set;
  const done = doneItems + routineCount(key) + pr.done;
  return { total: total, done: done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function encouragement(score, isToday) {
  if (score.total === 0) return "Add your first task and begin.";
  if (score.percent === 100) return isToday ? "All done today. Well done!" : "A full day. Well done!";
  if (score.percent >= 50) return "More than half done. Finish strong!";
  if (score.percent > 0) return "Good start. Keep going.";
  return isToday ? "A new day. Start with one small thing." : "Plan this day well.";
}

function renderHero() {
  const hero = document.getElementById("hero");
  if (view !== "day") {
    hero.style.display = "none";
    return;
  }
  hero.style.display = "";
  const key = dateKey(current);
  const todayKey = dateKey(new Date());
  const isToday = key === todayKey;
  const score = dayScore(key);
  const name = (settings.name || "").trim();

  let heading;
  if (isToday) heading = greetingWord() + (name ? ", " + escapeHtml(name) : "");
  else if (key === addDays(todayKey, 1)) heading = "Tomorrow";
  else if (key === addDays(todayKey, -1)) heading = "Yesterday";
  else heading = DAY_NAMES[current.getDay()] + " " + current.getDate() + " " + MONTH_NAMES[current.getMonth()];

  const circumference = 213.6;
  const offset = (circumference * (1 - score.percent / 100)).toFixed(1);
  const streak = fullRoutineStreak();

  hero.innerHTML =
    '<div class="hero-text">' +
    '<h2>' + heading + '</h2>' +
    '<div class="say">' + encouragement(score, isToday) + '</div>' +
    '<div class="quote">' + escapeHtml(quoteOfDay(key)) + '</div>' +
    (streak > 0 ? '<div class="streak">Routine streak: ' + plural(streak, "day") + '</div>' : "") +
    '</div>' +
    '<div class="ring ' + (score.percent === 100 ? "complete" : "") + '">' +
    '<svg viewBox="0 0 80 80"><circle class="track" cx="40" cy="40" r="34"></circle>' +
    '<circle class="fill" cx="40" cy="40" r="34" stroke-dasharray="' + circumference +
    '" stroke-dashoffset="' + offset + '"></circle></svg>' +
    '<div class="num">' + score.percent + '%<small>' + score.done + '/' + score.total + '</small></div></div>';
}

function saveName(value) {
  settings.name = value;
  save(SETTINGS_KEY, settings);
}

// ----- Main render -----
function render() {
  ["day", "week", "month", "goals", "more"].forEach(function (name) {
    document.getElementById("tab-" + name).classList.toggle("active", name === view);
  });
  renderHero();
  const hide = (view === "goals" || view === "more") ? "none" : "";
  document.getElementById("nav").style.display = hide;
  document.getElementById("today-btn").style.display = hide;

  if (view === "day") renderDay();
  else if (view === "week") renderWeek();
  else if (view === "month") renderMonth();
  else if (view === "goals") renderGoals();
  else renderMore();
  renderSheet();
}

// ----- Small helpers for charts and numbers -----
function shortNum(n) {
  if (n >= 1000000) return (Math.round(n / 100000) / 10) + "M";
  if (n >= 1000) return (Math.round(n / 100) / 10) + "k";
  return String(n);
}

function toMinutes(hhmm) {
  const p = String(hhmm).split(":");
  return Number(p[0]) * 60 + Number(p[1]);
}

function dayAbbr(key) {
  return DAY_NAMES[keyToDate(key).getDay()].slice(0, 3);
}

// A bar chart made from simple boxes (no libraries).
// items: [{ label, value, display, value2, today }]  value2 is a second, darker bar inside the first.
// A bar chart made from simple boxes (no libraries).
// items: [{ label, value, display, value2, today }]  value2 is a second, darker bar inside the first.
function barChart(items, minTop, dense) {
  let top = minTop || 0;
  items.forEach(function (it) { if (it.value > top) top = it.value; });
  if (top <= 0) top = 1;
  function height(v) {
    if (v <= 0) return 0;
    return Math.max(3, Math.round((v / top) * 100));
  }
  let html = '<div class="chart' + (dense ? " dense" : "") + '">';
  items.forEach(function (it) {
    const hasSecond = it.value2 !== undefined;
    html += '<div class="chart-col' + (it.today ? " today" : "") + '">' +
      '<div class="chart-val">' + (it.display !== undefined ? it.display : it.value) + '</div>' +
      '<div class="chart-track">' +
      '<div class="chart-bar' + (hasSecond ? " soft" : "") + '" style="height:' + height(it.value) + '%"></div>' +
      (hasSecond ? '<div class="chart-bar solid" style="height:' + height(it.value2) + '%"></div>' : "") +
      '</div><div class="chart-label">' + it.label + '</div></div>';
  });
  return html + '</div>';
}

function habitBarsHtml(counts, outOf) {
  let html = "";
  routine.forEach(function (r) {
    const n = counts[r.id] || 0;
    const percent = outOf === 0 ? 0 : Math.round((n / outOf) * 100);
    html += '<div class="habit-row"><div class="habit-top"><span>' + escapeHtml(r.text) + '</span>' +
      '<span>' + n + '/' + outOf + '</span></div>' +
      '<div class="bar small"><div style="width:' + percent + '%"></div></div></div>';
  });
  return html;
}

function setTheme(name) {
  settings.theme = name;
  save(SETTINGS_KEY, settings);
  applyTheme();
  render();
}

function toggleSound() {
  settings.sound = !settings.sound;
  save(SETTINGS_KEY, settings);
  if (settings.sound) playTune();
  render();
}

function setLead(value) {
  settings.lead = Number(value) || 0;
  save(SETTINGS_KEY, settings);
}

// A short happy tune
function playTune() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const audio = new Ctx();
    [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = audio.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
    setTimeout(function () { audio.close(); }, 1800);
  } catch (e) {}
}

function confetti() {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch (e) {}
  const colors = ["#d9a94f", "#2f7d57", "#f2c96b", "#8fd3ae", "#ffffff", "#c9776a"];
  const box = document.createElement("div");
  box.className = "confetti";
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("span");
    piece.className = "piece";
    piece.style.left = Math.round(Math.random() * 100) + "%";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
    piece.style.animationDuration = (1.8 + Math.random() * 1.2).toFixed(2) + "s";
    box.appendChild(piece);
  }
  document.body.appendChild(box);
  setTimeout(function () {
    if (box.parentNode) box.parentNode.removeChild(box);
  }, 3500);
}

function celebrate() {
  showToast("All done! Well done. You finished everything for this day.", 5000);
  if (settings.sound) playTune();
  try {
    if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 200]);
  } catch (e) {}
  confetti();
}

function afterToggle(key, before) {
  const after = dayScore(key);
  if (before < 100 && after.percent === 100 && after.total > 0) celebrate();
}

// Phone notification (works best when the planner is installed as an app)
function systemNotify(message) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg && reg.showNotification) reg.showNotification("My Planner", { body: message, icon: "icon-192.png" });
        else new Notification("My Planner", { body: message });
      }, function () {});
      return;
    }
    new Notification("My Planner", { body: message });
  } catch (e) {}
}

let lastMissedAt = 0;

// When you open the planner: tell you about timed items that are already late
function missedCheck() {
  if (!settings.reminders) return;
  if (Date.now() - lastMissedAt < 30 * 60000) return;
  const now = new Date();
  const key = dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let count = 0;
  getDayItems(key).forEach(function (t) {
    if (t.time && !t.done && toMinutes(t.time) < nowMin - 5) count++;
  });
  const doneIds = routineDone[key] || [];
  routine.forEach(function (r) {
    if (r.time && doneIds.indexOf(r.id) === -1 && toMinutes(r.time) < nowMin - 5) count++;
  });
  if (count > 0) {
    lastMissedAt = Date.now();
    showToast(plural(count, "item") + " from today " + (count === 1 ? "is" : "are") + " past the time and not done.", 7000);
  }
}

function hasAnyData() {
  return Object.keys(tasks).length > 0 || Object.keys(shopping).length > 0 || goals.length > 0 ||
    repeats.length > 0 || Object.keys(routineDone).length > 0;
}

function daysSince(key) {
  return Math.round((keyToDate(dateKey(new Date())) - keyToDate(key)) / 86400000);
}

// Remind you (once a day) to save a backup
function backupNudge() {
  const today = dateKey(new Date());
  if (!hasAnyData() || settings.nudged === today) return;
  if (settings.lastBackup && daysSince(settings.lastBackup) <= 14) return;
  settings.nudged = today;
  save(SETTINGS_KEY, settings);
  showToast("Tip: save a backup of your planner. Open More, then Save a backup.", 9000);
}

function markBackup() {
  settings.lastBackup = dateKey(new Date());
  save(SETTINGS_KEY, settings);
}

function shareBackup() {
  const text = JSON.stringify(makeBackup(), null, 2);
  try {
    if (navigator.share) {
      let data = { title: "Planner backup", text: text };
      try {
        const file = new File([text], "planner-backup-" + dateKey(new Date()) + ".json", { type: "application/json" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          data = { title: "Planner backup", files: [file] };
        }
      } catch (e) {}
      navigator.share(data).then(function () {
        markBackup();
        setBackupMessage("Backup shared. Keep it in a safe place, like WhatsApp to yourself or Google Drive.");
      }, function () {});
      return;
    }
  } catch (e) {}
  setBackupMessage("Sharing is not available here. Use Copy backup text instead.");
}

// ----- Install as an app -----
let installPrompt = null;

function isInstalled() {
  try {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  } catch (e) {
    return false;
  }
}

function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice.then(function () {
      installPrompt = null;
      render();
    }, function () {});
    return;
  }
  showNotice("Open the planner from a web address in Chrome. Then tap the Chrome menu (three dots) and choose Install app or Add to Home screen. It does not work when the files are opened directly from the phone.");
}

function startExtras() {
  try {
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      installPrompt = e;
      if (view === "more") render();
    });
    window.addEventListener("appinstalled", function () {
      installPrompt = null;
      if (view === "more") render();
    });
  } catch (e) {}
  try {
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  } catch (e) {}
  try {
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") missedCheck();
    });
  } catch (e) {}
  setInterval(focusTick, 1000);
  setTimeout(missedCheck, 1500);
  setTimeout(backupNudge, 3000);
}

// ----- Priorities: write them, then tick them when done -----
function priorityStats(key) {
  const info = dayInfo[key] || {};
  let set = 0;
  let done = 0;
  [1, 2, 3].forEach(function (n) {
    const text = info["p" + n];
    if (text && String(text).trim() !== "") {
      set++;
      if (info["d" + n]) done++;
    }
  });
  return { set: set, done: done };
}

function togglePriority(key, n) {
  const info = dayInfo[key] || {};
  const text = info["p" + n];
  if (!text || String(text).trim() === "") {
    showNotice("Write the priority first. Then tick it when it is done.");
    render();
    return;
  }
  const before = dayScore(key).percent;
  saveInfo(key, "d" + n, !info["d" + n]);
  render();
  afterToggle(key, before);
}

// ----- Moved items: a copy goes to the next day, the first one stays as not done -----
function movedLabel(key, item) {
  if (item.movedTo) {
    return item.movedTo === addDays(key, 1) ? "Moved to tomorrow" : "Moved to " + niceDate(item.movedTo);
  }
  if (item.from) {
    return item.from === addDays(key, -1) ? "From yesterday" : "From " + niceDate(item.from);
  }
  return "";
}

// ----- Habit tracking: strips, trend and best streak -----
function habitDoneOn(id, key) {
  return (routineDone[key] || []).indexOf(id) !== -1;
}

function habitCountRange(id, endKey, days) {
  let n = 0;
  for (let i = 0; i < days; i++) {
    if (habitDoneOn(id, addDays(endKey, -i))) n++;
  }
  return n;
}

// A row of small squares: one for each day, today on the right
function habitStripHtml(id, endKey, days) {
  let html = '<span class="strip">';
  for (let i = days - 1; i >= 0; i--) {
    const k = addDays(endKey, -i);
    html += '<i class="' + (habitDoneOn(id, k) ? "on" : "off") + (i === 0 ? " now" : "") + '" title="' + niceDate(k) + '"></i>';
  }
  return html + '</span>';
}

function longestStreak(id) {
  const keys = Object.keys(routineDone).filter(function (k) { return habitDoneOn(id, k); }).sort();
  let best = 0;
  let run = 0;
  let prev = "";
  keys.forEach(function (k) {
    run = (prev && addDays(prev, 1) === k) ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  });
  return best;
}

function habitTrendHtml(id, endKey) {
  const now = habitCountRange(id, endKey, 7);
  const before = habitCountRange(id, addDays(endKey, -7), 7);
  const diff = now - before;
  let cls = "same";
  let text = "Same as last week";
  if (diff > 0) {
    cls = "up";
    text = "&#9650; Up " + diff + " from last week";
  } else if (diff < 0) {
    cls = "down";
    text = "&#9660; Down " + (-diff) + " from last week";
  }
  return '<span class="trend ' + cls + '">' + now + '/7 this week &middot; ' + text + '</span>';
}

const NEED_OPTIONS = [["must", "Must buy"], ["want", "Can wait"]];

function movableItems(key) {
  return (shopping[key] || []).filter(function (s) { return !s.bought && !s.movedTo; });
}

// Copies items that were not bought to tomorrow. The first ones stay in today as pending.
function moveUnbought(key) {
  const list = movableItems(key);
  if (list.length === 0) {
    showNotice("There are no pending items to move.");
    return;
  }
  askConfirm("Move " + plural(list.length, "item") + " that you did not buy to tomorrow? They will also stay in today as pending.", function () {
    const next = addDays(key, 1);
    if (!shopping[next]) shopping[next] = [];
    list.forEach(function (s) {
      shopping[next].push({ id: newId(), name: s.name, price: s.price, bought: false, need: s.need || "must", from: key });
      s.movedTo = next;
    });
    save(SHOP_KEY, shopping);
    render();
  }, "Yes, move");
}

function shopRowHtml(key, s) {
  const must = (s.need || "must") === "must";
  const moved = movedLabel(key, s);
  let chips = '<span class="chips">';
  if (s.bought) {
    chips += '<span class="chip chip-bought">&#10003; Bought</span>';
  } else {
    chips += '<span class="chip chip-pending">Pending</span>' +
      '<span class="chip ' + (must ? "chip-must" : "chip-want") + '">' + (must ? "Must buy" : "Can wait") + '</span>';
  }
  if (moved) chips += '<span class="chip chip-moved">' + moved + '</span>';
  chips += '</span>';
  return '<div class="task shop ' + (s.bought ? "done p-bought" : (must ? "p-high" : "p-want")) + '">' +
    '<input type="checkbox" ' + (s.bought ? "checked" : "") + ' aria-label="Bought"' +
    ' onchange="toggleItem(\'' + key + '\',' + s.id + ')">' +
    '<span class="text tap" onclick="editItem(\'' + key + '\',' + s.id + ')"><span class="name">' + escapeHtml(s.name) + '</span>' + chips + '</span>' +
    '<span class="time">' + s.price + '</span>' +
    '<button class="edit" aria-label="Edit" onclick="editItem(\'' + key + '\',' + s.id + ')">&#9998;</button>' +
    '<button class="del" aria-label="Delete" onclick="deleteItem(\'' + key + '\',' + s.id + ')">&#10005;</button>' +
    '</div>';
}

// ----- Mood -----
const MOODS = ["", "😞", "😕", "😐", "🙂", "😄"];

function setMood(key, n) {
  const current = Number((dayInfo[key] || {}).mood) || 0;
  saveInfo(key, "mood", current === n ? 0 : n);
  render();
}

function moodMonthHtml(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  let sum = 0;
  let count = 0;
  let strip = '<span class="strip mood-strip">';
  for (let d = 1; d <= days; d++) {
    const key = dateKey(new Date(year, month, d));
    const m = Number((dayInfo[key] || {}).mood) || 0;
    if (m > 0) {
      sum += m;
      count++;
    }
    strip += '<i class="' + (m > 0 ? "m" + m : "off") + '" title="' + niceDate(key) + '"></i>';
  }
  strip += '</span>';
  if (count === 0) return "";
  const avg = (sum / count).toFixed(1);
  return '<div class="card"><h2>Mood this month</h2>' +
    '<div class="big-percent">' + MOODS[Math.round(sum / count)] + ' ' + avg + '</div>' +
    '<div>Average mood: ' + avg + ' of 5 (' + plural(count, "day") + ' marked)</div>' + strip +
    '<div class="legend">' + MOODS[1] + ' low &nbsp; ' + MOODS[5] + ' great</div></div>';
}

// ----- Focus timer -----
const FOCUS_PRESETS = [10, 25, 45];
let focus = { mins: 25, running: false, endAt: 0 };

function focusLeftSec() {
  return Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
}

function clockText(sec) {
  return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
}

function setFocusMins(m) {
  if (focus.running) return;
  focus.mins = m;
  render();
}

function startFocus() {
  focus.running = true;
  focus.endAt = Date.now() + focus.mins * 60000;
  render();
}

function stopFocus() {
  askConfirm("Stop the timer now? This focus time will not be saved.", function () {
    focus.running = false;
    render();
  }, "Yes, stop");
}

function finishFocus() {
  focus.running = false;
  const key = dateKey(new Date());
  const info = dayInfo[key] || {};
  saveInfo(key, "focusMin", (Number(info.focusMin) || 0) + focus.mins);
  saveInfo(key, "focusCount", (Number(info.focusCount) || 0) + 1);
  fireReminder("Focus time is over. Good work! Take a short rest.");
  render();
}

function focusTick() {
  if (!focus.running) return;
  const left = focusLeftSec();
  if (left <= 0) {
    finishFocus();
    return;
  }
  const clock = document.getElementById("focusClock");
  if (clock) clock.textContent = clockText(left);
}

function focusMinutes(key) {
  return Number((dayInfo[key] || {}).focusMin) || 0;
}

function panelFocus(key) {
  const info = dayInfo[key] || {};
  let html = '<p class="note">Choose the minutes, press Start and work without stopping. When the time ends, you get a sound and a message.</p>' +
    '<div class="presets">';
  FOCUS_PRESETS.forEach(function (m) {
    html += '<button class="preset' + (focus.mins === m ? " active" : "") + '"' + (focus.running ? " disabled" : "") +
      ' onclick="setFocusMins(' + m + ')">' + m + ' min</button>';
  });
  html += '</div><div class="focus-clock" id="focusClock">' +
    clockText(focus.running ? focusLeftSec() : focus.mins * 60) + '</div>';
  html += focus.running
    ? '<button class="big-btn danger" onclick="stopFocus()">Stop</button>'
    : '<button class="big-btn green" onclick="startFocus()">Start focus time</button>';
  html += '<div class="totals">Focus today: ' + focusMinutes(key) + ' minutes (' + plural(Number(info.focusCount) || 0, "session") + ')</div>' +
    '<p class="note">Keep the planner open while the timer runs.</p>';
  return html;
}

function focusSumKeys(keys) {
  let sum = 0;
  keys.forEach(function (k) { sum += focusMinutes(k); });
  return sum;
}

function focusSumMonth(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  const keys = [];
  for (let d = 1; d <= days; d++) keys.push(dateKey(new Date(year, month, d)));
  return focusSumKeys(keys);
}

// ----- Make sure the page has the parts the planner needs -----
// (this also fixes an old index.html file that does not have them)
function ensureLayout() {
  try {
    if (document.querySelector) {
      const oldTabs = document.querySelector("header .tabs");
      if (oldTabs && oldTabs.parentNode) oldTabs.parentNode.removeChild(oldTabs);
    }
    if (!document.getElementById("hero")) {
      const hero = document.createElement("section");
      hero.id = "hero";
      hero.className = "hero";
      const main = document.getElementById("app");
      if (main && main.parentNode) main.parentNode.insertBefore(hero, main);
    }
    if (!document.getElementById("bottomnav")) {
      const nav = document.createElement("nav");
      nav.id = "bottomnav";
      nav.className = "bottom-nav";
      document.body.appendChild(nav);
    }
  } catch (e) {}
}

applyTheme();
ensureLayout();
buildNav();
render();
setInterval(checkReminders, 20000);
startExtras();
