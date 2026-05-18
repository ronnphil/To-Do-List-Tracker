# ⚡ Fastodo
<img width="1918" height="984" alt="image" src="https://github.com/user-attachments/assets/adc534ec-621d-4ea8-8b7a-8ecf7fec4667" />

A task dashboard that actually looks good at 2am.

No Electron. No React. No npm install. Just three files — open `index.html` and go.

---

![dark](https://img.shields.io/badge/theme-obsidian_dark-111?style=flat-square&labelColor=111&color=ffc107)
![stack](https://img.shields.io/badge/stack-HTML_·_CSS_·_JS-111?style=flat-square&labelColor=111&color=ffc107)
![deps](https://img.shields.io/badge/dependencies-zero-111?style=flat-square&labelColor=111&color=4caf50)

---

## What it is

Three columns. One purpose.

```
┌─────────────┬─────────────────────────────────┬──────────────┐
│  MY LISTS   │  18                             │  May 2026    │
│             │  SUNDAY · MAY 2026              │  ┌──────────┐│
│  ● Life     │  Good Evening.                  │  │ calendar ││
│  ● Work  3  │                                 │  └──────────┘│
│  ● Project  │  [ Add Todo__________________ ] │              │
│             │  Low  Med  High                 │  Sort by     │
│  + New List │                                 │  None  Date  │
│             │  ○ Buy groceries      #life     │  Tag   Name  │
│             │  ● Submit report  May 19 #work  │  Priority    │
└─────────────┴─────────────────────────────────┴──────────────┘
```

Left column is your lists. Center is where you live. Right column handles the calendar and sorting. Everything saves to `localStorage` — your tasks survive refreshes, power cuts, and bad decisions.

---

## Stuff that actually works

**Calendar sets due dates.** Click a day → a chip appears below the input → add your task → date is attached. Or click an existing task's date to change it. Hit `Escape` to bail out.

**Priority is color-coded.** Before adding a task, hit `Low`, `Med`, or `High`. The task gets a colored left border: green for low, amber for medium, red for high. Sort by priority and watch your chaos organize itself.

**Tags are filters.** Type `#work` or `#life` anywhere in your task text — they get stripped out and stored separately. Click any tag on any task to filter the whole list to just that tag. Click it again to clear.

**Sort by anything.** Date, tag, name, priority, or just the order you added them. One click.

---

## Getting started

```
git clone https://github.com/ronnphil/To-Do-List-Tracker.git
cd To-Do-List-Tracker
# open index.html in your browser
```

That's it. Seriously.

---

## How to add a task

1. Type in the big input field
2. Optionally: click a calendar day to attach a due date
3. Optionally: click Low / Med / High for priority
4. Optionally: add `#tags` anywhere in the text
5. Press `Enter`

Tags get parsed and shown on the right side of the task. The text stays clean.

---

## Tech

| Thing | Choice |
|---|---|
| Framework | None |
| Build step | None |
| Dependencies | None |
| Storage | `localStorage` |
| Lines of code | ~450 JS, ~986 CSS |

The whole app is one HTML file, one CSS file, one JS file. No bundler, no transpiler, no node_modules folder that's somehow 400MB for a todo list.

---

## Structure

```
To-Do-List-Tracker/
├── index.html   ← shell, three-column layout
├── styles.css   ← dark theme, animations, everything visual
└── app.js       ← state, rendering, event delegation
```

State lives in a single `state` object, serialized to `localStorage` on every change. Rendering is full innerHTML replacement — fast enough for a task list, simple enough to debug in five minutes.

---

*Built in a single session. No libraries were harmed.*
