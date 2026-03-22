export function initSearch() {
  const input = document.getElementById("search");
  input.addEventListener("input", applySearchFilter);
}

export function applySearchFilter() {
  const query = document
    .getElementById("search")
    .value.toLowerCase();

  const columns = document.querySelectorAll(".column");

  columns.forEach(col => {
    const cards = col.querySelectorAll(".card");
    let visibleCount = 0;

    cards.forEach(card => {
      const title = card
        .querySelector(".card-title")
        .textContent.toLowerCase();

      if (title.includes(query)) {
        card.style.display = "";
        visibleCount++;
      } else {
        card.style.display = "none";
      }
    });

    // Empty placeholder always visible
    const empty = col.querySelector(".empty");
    if (empty) empty.style.display = "";

  });
}