/* ============================================
   🔊 UI-SOUND — общий звук для вспомогательных страниц
   ============================================ */

(function() {
  const SOUND_KEY = "safecracker_sound_enabled";
  
  // Проверяем, включен ли звук в localStorage (по умолчанию — да)
  let enabled = localStorage.getItem(SOUND_KEY) !== "false";
  let ctx = null;

  // Инициализация AudioContext (требуется после действия пользователя)
  function initAudio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  }

  // Короткий «клик» (синтез)
  function playClick() {
    if (!enabled) return;
    initAudio();
    
    const t = ctx.currentTime;
    
    // Осциллятор для тонального щелчка
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
    
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Делегирование событий: слушаем весь документ
  document.addEventListener("pointerdown", (e) => {
    // Проверяем, был ли клик по интерактивному элементу
    const target = e.target.closest(
      ".nav-btn, .menu-btn, .circle-btn, .difficulty-btn, button, a"
    );
    
    if (target) {
      // Обновляем состояние звука на случай, если его выключили в игре
      enabled = localStorage.getItem(SOUND_KEY) !== "false";
      playClick();
    }
  }, { passive: true });

})();