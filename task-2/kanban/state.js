const STORAGE_KEY = "kanban_state";

export let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  return {
    columns: [
      {
        id: crypto.randomUUID(),
        title: "Default",
        cards: []
      }
    ]
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// COLUMN
export function addColumn(title) {
  state.columns.push({
    id: crypto.randomUUID(),
    title,
    cards: []
  });
  save();
}

export function deleteColumn(columnId) {
  state.columns = state.columns.filter(c => c.id !== columnId);
  save();
}

// CARD
export function addCard(columnId, title) {
  const col = state.columns.find(c => c.id === columnId);
  col.cards.push({
    id: crypto.randomUUID(),
    title
  });
  save();
}

export function deleteCard(columnId, cardId) {
  const col = state.columns.find(c => c.id === columnId);
  col.cards = col.cards.filter(c => c.id !== cardId);
  save();
}

export function moveCard(fromColId, toColId, cardId) {
  const from = state.columns.find(c => c.id === fromColId);
  const to = state.columns.find(c => c.id === toColId);

  const card = from.cards.find(c => c.id === cardId);
  from.cards = from.cards.filter(c => c.id !== cardId);
  to.cards.push(card);

  save();
}