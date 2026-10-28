const STATS_KEY = "safecracker_stats";
const statsContent = document.getElementById("statsContent");
const resetBtn = document.getElementById("resetStatsBtn");

/* ============================================
   ЗАГРУЗКА И ОТРИСОВКА СТАТИСТИКИ
   ============================================ */
function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function renderStats() {
  const stats = loadStats();
  const levels = [3, 4, 5, 6];

  const hasAny = levels.some(l => stats[String(l)] && stats[String(l)].games > 0);

  if (!hasAny) {
    statsContent.innerHTML = '<div class="stats-empty">Пока нет сыгранных игр. Сыграйте партию!</div>';
    return;
  }

  statsContent.innerHTML = "";
  levels.forEach(l => {
    const s = stats[String(l)] || { games: 0, wins: 0, bestMoves: null, bestTime: null };
    const row = document.createElement("div");
    row.className = "stats-row";

    // Форматирование лучшего времени (секунды -> мм:сс)
    let bestTimeStr = "—";
    if (s.bestTime !== null && s.bestTime !== undefined) {
      const m = Math.floor(s.bestTime / 60).toString().padStart(2, '0');
      const sec = (s.bestTime % 60).toString().padStart(2, '0');
      bestTimeStr = `${m}:${sec}`;
    }

    row.innerHTML = `
      <h3>Уровень ${l} (${l} цифр)</h3>
      <p>Игр: <b>${s.games || 0}</b></p>
      <p>Побед: <b>${s.wins || 0}</b></p>
      <p>Лучший результат: <span class="best">${s.bestMoves !== null ? s.bestMoves + " ходов" : "—"}</span></p>
      <p>Лучшее время: <span class="best">${bestTimeStr}</span></p>
    `;
    statsContent.appendChild(row);
  });
}

/* ============================================
   МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ
   ============================================ */
function showConfirm(message, onConfirm) {
  const old = document.querySelector(".modal-overlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const box = document.createElement("div");
  box.className = "modal-box";

  const text = document.createElement("p");
  text.className = "modal-text";
  text.textContent = message;

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "modal-btn modal-cancel";
  cancelBtn.textContent = "Отмена";

  const okBtn = document.createElement("button");
  okBtn.className = "modal-btn modal-ok";
  okBtn.textContent = "Сбросить";

  actions.appendChild(cancelBtn);
  actions.appendChild(okBtn);
  box.appendChild(text);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
  }

  cancelBtn.addEventListener("click", close);
  okBtn.addEventListener("click", () => {
    close();
    onConfirm();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onEsc);
    }
  });
}

/* ============================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================ */
document.addEventListener("DOMContentLoaded", () => {
  renderStats();
});

resetBtn.addEventListener("click", () => {
  showConfirm("Сбросить всю статистику?", () => {
    localStorage.removeItem(STATS_KEY);
    renderStats();
  });
});