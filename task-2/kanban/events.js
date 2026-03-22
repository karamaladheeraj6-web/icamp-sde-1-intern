
import {
  addColumn,
  deleteColumn,
  addCard,
  deleteCard,
  moveCard
} from "./state.js";

import { renderBoard } from "./board.js";

export function initEvents() {
  const addBtn = document.getElementById("add-column");

  if (!addBtn) {
    console.error("Add Column button not found!");
    return;
  }

  addBtn.onclick = () => {
    const title = prompt("Column name?");
    if (title) {
      addColumn(title);
      renderBoard();
    }
  };
  const board = document.getElementById("board");

  document.getElementById("add-column").onclick = () => {
    const title = prompt("Column name?");
    if (title) {
      addColumn(title);
      renderBoard();
    }
  };

  board.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    const colId = e.target.dataset.col;
    const cardId = e.target.dataset.id;

    if (action === "add-card") {
      const title = prompt("Card title?");
      if (title) {
        addCard(colId, title);
        renderBoard();
      }
    }

    if (action === "delete-column") {
      deleteColumn(colId);
      renderBoard();
    }

    if (action === "delete-card") {
      deleteCard(colId, cardId);
      renderBoard();
    }
  });

  // DRAG & DROP
  let dragged = null;

  board.addEventListener("dragstart", (e) => {
    dragged = e.target;
  });

  board.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  board.addEventListener("drop", (e) => {
    const colEl = e.target.closest(".column");
    if (!colEl || !dragged) return;

    const fromCol = dragged.dataset.col;
    const toCol = colEl.dataset.id;
    const cardId = dragged.dataset.id;

    if (fromCol !== toCol) {
      moveCard(fromCol, toCol, cardId);
      renderBoard();
    }
  });
}