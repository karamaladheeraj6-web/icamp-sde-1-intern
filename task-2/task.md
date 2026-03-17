# Kanban Board

---

## Objective

Build a fully client-side Kanban board. Users can create columns, add cards, move cards between columns, and edit or delete cards. All state persists to localStorage and survives a page reload. No frameworks, no libraries, just vanilla JS, ES Modules, and the DOM APIs from SM-1.

---

## Project Setup

```bash
mkdir kanban && cd kanban
```

Create the file structure before writing any code:

```
kanban/
  index.html
  style.css
  main.js       ← entry point, initialises app
  state.js      ← single state object, load/save to localStorage
  board.js      ← render board, columns, cards
  events.js     ← all event listeners wired here
```

All JS files use ES Modules (`type="module"` on the `<script>` tag in `index.html`). No `<script>` tags other than the single entry point.

---

## Problem Statements

---

### Ticket 1: State and Persistence

**Objective:** Build the single source of truth for the board and wire it to localStorage so state survives a page reload.

**Problem Statement:**

`state.js` exports a single mutable state object and the functions that operate on it. No other file mutates state directly, all mutations go through these functions. On every mutation, state is serialised and written to localStorage. On page load, state is read from localStorage; if nothing is stored, a default seed is used.

The state shape is fixed:

```javascript
{
  columns: [
    {
      id:    string,   // e.g. "col-1"
      title: string,
      cards: [
        {
          id:          string,   // e.g. "card-1"
          title:       string,
          description: string    // may be empty
        }
      ]
    }
  ]
}
```

**Functions to implement:**

| Function | Behaviour |
|---|---|
| `loadState()` | Read from localStorage. Return parsed state if valid, default seed if missing or corrupt. |
| `saveState()` | Serialise current state to localStorage. |
| `addColumn(title)` | Append a new column. Reject empty title, throw `Error('Column title cannot be empty')`. |
| `removeColumn(id)` | Remove column by id. |
| `renameColumn(id, newTitle)` | Update title. Reject empty string. |
| `addCard(columnId, title, description)` | Append card to column. Reject empty title. |
| `updateCard(cardId, title, description)` | Find card by id across all columns, update fields. |
| `removeCard(cardId)` | Find and remove card by id across all columns. |
| `moveCard(cardId, direction)` | `direction` is `'left'` or `'right'`. Move card to adjacent column. No-op if already at boundary. |

ID generation: `'col-' + Date.now()` and `'card-' + Date.now()` are sufficient.

**Default seed (used when localStorage is empty):**

```javascript
{
  columns: [
    { id: 'col-1', title: 'To Do',       cards: [] },
    { id: 'col-2', title: 'In Progress', cards: [] },
    { id: 'col-3', title: 'Done',        cards: [] },
  ]
}
```

**Input Format:**

- `addColumn(title)` — `title`: non-empty string
- `addCard(columnId, title, description)` — `columnId`: existing column id; `title`: non-empty string; `description`: string (may be empty)
- `moveCard(cardId, direction)` — `direction`: `'left'` or `'right'`

**Output Format:**

All mutation functions return `void`. `loadState()` returns the state object. No function should log to the console, callers handle feedback.

**Sample I/O:**

```javascript
// Initial load - localStorage empty
loadState();
// state.columns → [{id:'col-1',title:'To Do',cards:[]}, ...]

addColumn('Backlog');
// state.columns → [..., {id:'col-<ts>',title:'Backlog',cards:[]}]
// localStorage updated

addCard('col-1', 'Write tests', '');
// state.columns[0].cards → [{id:'card-<ts>',title:'Write tests',description:''}]

moveCard('card-<ts>', 'right');
// card moves from col-1 to col-2

addColumn('');
// throws Error('Column title cannot be empty')
```

**Starter Code:**

```javascript
// state.js
const STORAGE_KEY = 'kanban-state';

const DEFAULT_STATE = {
  columns: [
    { id: 'col-1', title: 'To Do',       cards: [] },
    { id: 'col-2', title: 'In Progress', cards: [] },
    { id: 'col-3', title: 'Done',        cards: [] },
  ]
};

let state = { columns: [] };

export function loadState() {
  // TODO: read from localStorage
  // TODO: if missing or JSON.parse throws, use DEFAULT_STATE
  // TODO: assign to state, return state
}

export function saveState() {
  // TODO: JSON.stringify(state) → localStorage.setItem
}

export function getState() {
  return state;
}

export function addColumn(title) {
  // TODO: reject empty title
  // TODO: push new column, saveState
}

export function removeColumn(id) {
  // TODO
}

export function renameColumn(id, newTitle) {
  // TODO
}

export function addCard(columnId, title, description = '') {
  // TODO
}

export function updateCard(cardId, title, description) {
  // TODO: search across all columns
}

export function removeCard(cardId) {
  // TODO: search across all columns
}

export function moveCard(cardId, direction) {
  // TODO: find card's current column index
  // TODO: compute target column index, clamp at boundaries (no-op)
  // TODO: remove from source, push to target, saveState
}
```

**Acceptance:**

```javascript
// Paste into browser console after loading index.html
import { loadState, addColumn, addCard, moveCard } from './state.js';

loadState();
addColumn('Review');
addCard('col-1', 'Fix bug #42', 'Repro steps in Jira');
moveCard(/* card id */, 'right');

// Reload the page
// state.columns should be identical to before reload
```

**Solution:** `/solutions/state.js`

---

### Ticket 2: Board Rendering

**Objective:** Implement a `renderBoard()` function that rebuilds the entire board DOM from state on every call.

**Problem Statement:**

`board.js` exports a single `renderBoard()` function. It reads the current state, clears the board container, and rebuilds it. It does not hold any local DOM references between calls, every call is a clean rebuild from state.

The rendered structure must match this shape:

```
#board
  .column[data-id="col-1"]
    .column-header
      h2  "To Do"
      button.rename-btn  "✏"
      button.delete-col-btn  "✕"
    .card-list
      .card[data-id="card-1"]
        .card-title   "Fix bug #42"
        .card-desc    "Repro steps in Jira"
        .card-actions
          button.edit-btn    "Edit"
          button.delete-btn  "Delete"
          button.move-left   "←"
          button.move-right  "→"
      .empty-placeholder   ← shown only when column has no cards
    .column-footer
      button.add-card-btn  "Add card"
  .column[data-id="col-2"]
    ...
  button#add-column-btn  "Add column"
```

Rules:
- `←` button is disabled when the card is in the first column.
- `→` button is disabled when the card is in the last column.
- Empty columns show `.empty-placeholder` with text `"No cards yet"`.
- `renderBoard()` must be called after every state mutation, not patched.

**Input Format:**

`renderBoard()` takes no arguments. It reads from `getState()` (imported from `state.js`).

**Output Format:**

The `#board` element in the DOM is replaced with a freshly built structure. No return value.

**Sample I/O:**

```
State: { columns: [
  { id: 'col-1', title: 'To Do', cards: [
    { id: 'card-1', title: 'Write tests', description: '' }
  ]},
  { id: 'col-2', title: 'Done', cards: [] }
]}

Rendered output:
  #board
    .column[data-id="col-1"]
      h2 "To Do"
      .card[data-id="card-1"]
        "Write tests"
        ← (disabled)  → (enabled)
    .column[data-id="col-2"]
      h2 "Done"
      .empty-placeholder "No cards yet"
    button#add-column-btn
```

**Starter Code:**

```javascript
// board.js
import { getState } from './state.js';

function createCard(card, isFirst, isLast) {
  // TODO: build .card element
  // TODO: disable ← if isFirst, disable → if isLast
  // TODO: return element
}

function createColumn(column, isFirst, isLast) {
  // TODO: build .column element with header, card-list, footer
  // TODO: if column.cards is empty, append .empty-placeholder
  // TODO: call createCard for each card
  // TODO: return element
}

export function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  const { columns } = getState();

  // TODO: create a column for each entry
  // TODO: append #add-column-btn at the end
}
```

**Acceptance:**

Open `index.html` in a browser. Manually call from the console:

```javascript
import { addCard } from './state.js';
import { renderBoard } from './board.js';

addCard('col-1', 'Test card', 'desc');
renderBoard();
// .card[data-id] appears in col-1
// ← is disabled (first column), → is enabled
```

Add a card to the last column, `→` must be disabled, `←` must be enabled.

**Solution:** `/solutions/board.js`

---

### Ticket 3: Event Wiring

**Objective:** Wire all user interactions to state mutations and re-render, using a single delegated listener per board action.

**Problem Statement:**

`events.js` exports an `initEvents()` function called once in `main.js`. All board interactions are handled through event delegation on `#board`, one `click` listener reads `event.target` and dispatches to the correct handler based on class or `data-*` attributes. No per-card or per-column listeners are attached inside `renderBoard()`.

Interactions to handle:

| User action | Element class | Behaviour |
|---|---|---|
| Add column | `#add-column-btn` | Prompt for title → `addColumn` → `renderBoard` |
| Rename column | `.rename-btn` | Prompt pre-filled with current title → `renameColumn` → `renderBoard` |
| Delete column | `.delete-col-btn` | `confirm()` if column has cards → `removeColumn` → `renderBoard` |
| Add card | `.add-card-btn` | Inline form appears in column footer (see below) |
| Edit card | `.edit-btn` | Inline form replaces card content (see below) |
| Delete card | `.delete-btn` | `confirm()` → `removeCard` → `renderBoard` |
| Move card left | `.move-left` | `moveCard(id, 'left')` → `renderBoard` |
| Move card right | `.move-right` | `moveCard(id, 'right')` → `renderBoard` |

**Inline form behaviour (add card and edit card):**

- Replace the trigger area with a small form containing a title `<input>`, a description `<textarea>`, a Save button, and a Cancel button.
- Save validates that title is not empty, shows an inline error message if it is, does not call state.
- Cancel restores the previous DOM without modifying state.
- After a successful Save, call the appropriate state function and `renderBoard()`.
- Only one inline form can be open at a time, opening a second one closes the first.

**`main.js`:**

```javascript
import { loadState }   from './state.js';
import { renderBoard } from './board.js';
import { initEvents }  from './events.js';

loadState();
renderBoard();
initEvents();
```

**Input Format:**

User interactions via click events on `#board`. Column id and card id are read from the closest `[data-id]` ancestor of the clicked element.

**Output Format:**

DOM updates `renderBoard()` called after every successful state mutation. No return value from handlers.

**Sample I/O:**

```
User clicks ".add-card-btn" on col-1
→ inline form appears in col-1 footer
→ user types "New task", clicks Save
→ addCard('col-1', 'New task', '') called
→ renderBoard() called
→ new .card appears in col-1

User clicks ".add-card-btn" on col-1 again while form already open
→ previous form is removed, new form appears
```

**Starter Code:**

```javascript
// events.js
import { addColumn, removeColumn, renameColumn,
         addCard, updateCard, removeCard, moveCard } from './state.js';
import { renderBoard } from './board.js';

function getColumnId(el) {
  return el.closest('[data-id]')?.dataset.id;
}

function getCardId(el) {
  return el.closest('.card')?.dataset.id;
}

function closeOpenForms() {
  // TODO: if an open inline form exists, remove it and restore previous content
}

function openAddCardForm(columnEl) {
  // TODO: replace .column-footer content with form
  // TODO: Save → validate → addCard → renderBoard
  // TODO: Cancel → renderBoard (restore)
}

function openEditCardForm(cardEl) {
  // TODO: replace .card content with form pre-filled with current values
  // TODO: Save → validate → updateCard → renderBoard
  // TODO: Cancel → renderBoard (restore)
}

export function initEvents() {
  const board = document.getElementById('board');

  board.addEventListener('click', (e) => {
    // TODO: dispatch on e.target.classList
  });
}
```

**Acceptance:**

All interactions work end-to-end:

```
1. Load page → three default columns visible
2. Add column "Backlog" → fourth column appears
3. Add card to "Backlog" with empty title → inline error, no state change
4. Add card "Spike auth" → card appears
5. Move card right → card moves to next column
6. Edit card title → card updates in place
7. Delete card → confirm → card gone
8. Rename column → header updates
9. Delete column with cards → confirm → column and all cards gone
10. Reload → all changes persisted
```

**Solution:** `/solutions/events.js`

---

### Ticket 4: Filtering

**Objective:** Add a real-time search input that filters cards by title across all columns without modifying state.

**Problem Statement:**

A search `<input id="search">` sits above the board in `index.html`. As the user types, all cards whose titles do not contain the query string (case-insensitive) are hidden. Columns with no visible cards are visually dimmed (opacity reduced) but not removed from the DOM. Clearing the input restores all cards.

Filtering must not call `renderBoard()`, it operates directly on the already-rendered DOM. This means it must be re-applied after every `renderBoard()` call to stay consistent.

**Input Format:**

- Query: the current value of `#search` (string, may be empty)
- Applied on `input` event

**Output Format:**

- Cards whose `.card-title` text does not include the query: `display: none`
- Cards that do match: `display` restored to default
- Columns with all cards hidden: `opacity: 0.4`
- Columns with at least one visible card: `opacity: 1`
- Empty placeholder is always visible regardless of filter

**Sample I/O:**

```
State: col-1 has ["Write tests", "Fix bug"], col-2 has ["Deploy"]

User types "fix"
→ "Fix bug" visible, "Write tests" hidden
→ col-1 opacity: 1 (one card visible)
→ "Deploy" hidden
→ col-2 opacity: 0.4 (no visible cards)

User clears input
→ all cards visible, all columns opacity: 1
```

**Starter Code:**

```javascript
// Add to events.js

export function applyFilter() {
  const query = document.getElementById('search').value.toLowerCase();
  const columns = document.querySelectorAll('.column');

  columns.forEach(col => {
    const cards = col.querySelectorAll('.card');
    let visibleCount = 0;

    cards.forEach(card => {
      const title = card.querySelector('.card-title').textContent.toLowerCase();
      // TODO: show or hide based on query
      // TODO: increment visibleCount if visible
    });

    // TODO: dim column if visibleCount === 0, restore if > 0
  });
}
```

Wire it in `initEvents()`:

```javascript
document.getElementById('search').addEventListener('input', applyFilter);
```

And call `applyFilter()` at the end of `renderBoard()` so the filter persists across re-renders.

**Acceptance:**

```
1. Add cards: "Write tests", "Fix bug #42", "Deploy"
2. Type "fix" in search → only "Fix bug #42" visible
3. Column with only hidden cards → dimmed
4. Clear search → all cards visible
5. Add a new card while filter is active → new card obeys filter immediately
6. Reload → filter clears (not persisted), all cards visible
```

**Solution:** `/solutions/filter.js`

---
