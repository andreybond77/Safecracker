/* ============================================
   🎉 ПОБЕДА — салюты и денежный дождь (монохром)
   ============================================ */

const canvas = document.getElementById("fireworks");
const ctx = canvas.getContext("2d");

let W = 0, H = 0;
function resize() {
  const rect = canvas.getBoundingClientRect();
  W = canvas.width  = Math.max(1, Math.round(rect.width));
  H = canvas.height = Math.max(1, Math.round(rect.height));
}
resize();
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 100));

/* ============================================
   САЛЮТЫ (серые оттенки)
   ============================================ */
const particles = [];
const COLORS = ["#cccccc", "#aaaaaa", "#888888", "#e0e0e0", "#999999", "#ffffff"];

function spawnFirework(x, y) {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const count = 40 + Math.floor(Math.random() * 30);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.012 + Math.random() * 0.015,
      color,
      size: 2 + Math.random() * 2,
    });
  }
}

function randomFirework() {
  spawnFirework(
    W * (0.15 + Math.random() * 0.7),
    H * (0.1 + Math.random() * 0.5)
  );
}

setInterval(randomFirework, 700);
setTimeout(randomFirework, 200);
setTimeout(randomFirework, 500);

function animate() {
  ctx.clearRect(0, 0, W, H);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.life -= p.decay;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  requestAnimationFrame(animate);
}
animate();

/* ============================================
   ДЕНЕЖНЫЙ ДОЖДЬ (монохромные иконки)
   ============================================ */
const moneyRain = document.getElementById("moneyRain");
const MONEY_ICONS = ["💵", "💰", "🪙", "💎", "💸"];

function createMoneyDrop() {
  const el = document.createElement("span");
  el.textContent = MONEY_ICONS[Math.floor(Math.random() * MONEY_ICONS.length)];
  el.style.left = Math.random() * 100 + "%";
  el.style.fontSize = (18 + Math.random() * 20) + "px";
  const duration = 3 + Math.random() * 4;
  el.style.animationDuration = duration + "s";
  el.style.animationDelay = Math.random() * 2 + "s";
  moneyRain.appendChild(el);

  setTimeout(() => el.remove(), (duration + 2) * 1000);
}

for (let i = 0; i < 40; i++) createMoneyDrop();
setInterval(createMoneyDrop, 350);