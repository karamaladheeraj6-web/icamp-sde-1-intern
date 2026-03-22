
import {
  addColumn,
  deleteColumn,
  addCard,
  deleteCard,
  moveCard,
  updateCard,
  renameColumn
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
      const title = prompt("Card title");
      const description = prompt("Card Description");
      if(description == null || description == undefined) {
        description = "";
      }
      if (title && description) {
        addCard(colId, title, description);
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
    if (action === "edit-card") {
      const cardEl = e.target.closest(".card");

      const currentTitle = cardEl.querySelector(".card-title").textContent;
      const currentDesc = cardEl.querySelector(".card-desc").textContent;

      const newTitle = prompt("Edit title:", currentTitle);
      if (newTitle === null) return;

      const newDesc = prompt("Edit description:", currentDesc);

      updateCard(cardId, newTitle, newDesc || "");
      renderBoard();
    }

    if (action === "rename-column") {
      const currentTitle = document.getElementById("coltitle-"+colId).innerHTML;

      const newTitle = prompt("New column name:", currentTitle);
      if (!newTitle) return;

      renameColumn(colId, newTitle);
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