/* ============================================
   🔐 SAFECRACKER — логика меню
   ============================================ */

const DIFF_KEY = "safecracker_difficulty";
const STATS_KEY = "safecracker_stats";

function updatePlayButton() {
  const playBtn = document.querySelector('a[href="game.html"]');
  if (!playBtn) return;

  let diff = parseInt(localStorage.getItem(DIFF_KEY) || "6", 10);
  if (![3, 4, 5, 6].includes(diff)) diff = 6;

  const oldBadge = playBtn.querySelector(".diff-badge");
  if (oldBadge) oldBadge.remove();

  const badge = document.createElement("span");
  badge.className = "diff-badge";
  badge.textContent = ` (${diff} цифр)`;
  badge.style.fontSize = "0.85em";
  badge.style.opacity = "0.8";
  playBtn.appendChild(badge);
}

function renderStatsHint() {
  let stats = {};
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) stats = JSON.parse(raw);
  } catch {
    stats = {};
  }

  const totalGames = Object.values(stats).reduce(
    (sum, s) => sum + (s.games || 0), 0
  );
  const totalWins = Object.values(stats).reduce(
    (sum, s) => sum + (s.wins || 0), 0
  );

  const statsBtn = document.querySelector('a[href="stats.html"]');
  if (!statsBtn) return;

  const oldHint = statsBtn.querySelector(".stats-hint");
  if (oldHint) oldHint.remove();

  if (totalGames > 0) {
    const hint = document.createElement("span");
    hint.className = "stats-hint";
    hint.style.fontSize = "0.75em";
    hint.style.opacity = "0.85";
    hint.style.display = "block";
    hint.style.marginTop = "4px";
    hint.textContent = `Игр: ${totalGames} · Побед: ${totalWins}`;
    statsBtn.appendChild(hint);
  }
}

function animateButtons() {
  const buttons = document.querySelectorAll(".nav-btn");
  buttons.forEach((btn, i) => {
    btn.style.opacity = "0";
    btn.style.transform = "translateY(12px)";
    setTimeout(() => {
      btn.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      btn.style.opacity = "1";
      btn.style.transform = "translateY(0)";
    }, 60 * i);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updatePlayButton();
  renderStatsHint();
  animateButtons();
});