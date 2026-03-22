import { state } from "./state.js";
import { applySearchFilter } from "./search.js";

export function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  state.columns.forEach(col => {
    if(col == undefined || col == null) return;
    const colEl = document.createElement("div");
    colEl.className = "column";
    colEl.dataset.id = col.id;

    colEl.innerHTML = `
      <div class="titleCls"><span id="coltitle-${col.id}">${col.title}</span>        
        <button style="float:right;" class="btnDelCls" data-action="delete-column" data-col="${col.id}">✕</button>
        <button class="editTitleIconCls" data-action="rename-column" data-col="${col.id}">✏️</button>
        <button style="float:right;" class="btncls" data-action="add-card" data-col="${col.id}">+ Card</button>        
      </div>
      
      <div class="cards">
        ${
          col.cards.length === 0
            ? `<div class="card"><span class="card-title">No cards</span></div>`
            : col.cards.filter(card => card !== null && card !== undefined).map(card => `
              <div class="card" draggable="true"
                   data-id="${card.id}"
                   data-col="${col.id}">
                <b>Title: </b><span class="card-title">${card.title}</span></br>
                <b>Description: </b><span class="card-desc">${card.description}</span>
                <button class="btnDelClsCard" data-action="delete-card"
                        data-id="${card.id}"
                        data-col="${col.id}">✕</button>
                <button class="editIconCls" data-action="edit-card"
                  data-id="${card.id}">✏️</button>
              </div>
            `).join("")
        }
      </div>
    `;

    board.appendChild(colEl);
  });

  // IMPORTANT: reapply filter after render
  applySearchFilter();
}