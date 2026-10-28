/* ============================================
   ⚙️ СЛОЖНОСТЬ — выбор уровня
   ============================================ */

const DIFF_KEY = "safecracker_difficulty";

function getCurrentDifficulty() {
  let diff = parseInt(localStorage.getItem(DIFF_KEY) || "6", 10);
  if (![3, 4, 5, 6].includes(diff)) diff = 6;
  return diff;
}

function highlightActive(currentDiff) {
  document.querySelectorAll(".difficulty-btn").forEach(btn => {
    const count = parseInt(btn.dataset.count, 10);
    btn.classList.toggle("active", count === currentDiff);
  });
}

function updateCurrentLabel(currentDiff) {
  const el = document.getElementById("currentDifficulty");
  if (el) el.textContent = `${currentDiff} цифр`;
}

document.addEventListener("DOMContentLoaded", () => {
  let currentDiff = getCurrentDifficulty();
  highlightActive(currentDiff);
  updateCurrentLabel(currentDiff);

  document.querySelectorAll(".difficulty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const count = parseInt(btn.dataset.count, 10);
      if (![3, 4, 5, 6].includes(count)) return;

      localStorage.setItem(DIFF_KEY, String(count));
      currentDiff = count;

      highlightActive(currentDiff);
      updateCurrentLabel(currentDiff);
    });
  });
});