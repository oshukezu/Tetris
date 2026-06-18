// Tetris 應用程式啟動與模組串接
(function () {
  function updateStatsUI() {
    const storage = window.TetrisStorage;
    if (!storage) return;

    const bestScoreEl = document.getElementById('best-score');
    const bestComboEl = document.getElementById('best-combo');
    const gamesPlayedEl = document.getElementById('games-played');

    if (bestScoreEl) bestScoreEl.textContent = storage.getBestScore();
    if (bestComboEl) bestComboEl.textContent = storage.getBestMaxCombo();
    if (gamesPlayedEl) gamesPlayedEl.textContent = storage.getGamesPlayed();
  }

  async function handleGameEnd(session) {
    const oldBest = window.TetrisStorage?.getBestScore() || 0;
    if (window.TetrisStorage) {
      window.TetrisStorage.recordGameEnd(session);
    }
    updateStatsUI();

    let sessionId = null;
    const user = window.TetrisAuth?.getUser();
    if (user && window.TetrisSupabaseService) {
      try {
        const row = await window.TetrisSupabaseService.insertSession(user.id, session);
        sessionId = row?.id || null;
      } catch (e) {
        console.warn('[TetrisApp] session upload failed:', e.message);
      }
    }

    if (window.TetrisChallenge) {
      window.TetrisChallenge.setLastSession(sessionId, session.score);
      await window.TetrisChallenge.onGameEnd(session, sessionId);
    }

    if (session.score > oldBest && session.score > 0) {
      const status = document.getElementById('status');
      if (status) status.textContent += '｜🎉 新紀錄！';
    }
  }

  function wireGame() {
    if (typeof game === 'undefined') return;
    game.onGameEnd = handleGameEnd;
    window.addEventListener('tetrisProfileUpdated', updateStatsUI);
  }

  async function init() {
    wireGame();
    updateStatsUI();

    if (window.TetrisLeaderboard) window.TetrisLeaderboard.init();
    if (window.TetrisChallenge) window.TetrisChallenge.init();

    const googleBtn = document.getElementById('auth-google-btn');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        const auth = window.TetrisAuth;
        if (!auth) return;
        if (auth.getUser() && auth.isAnonymous()) {
          await auth.linkGoogleAccount();
        } else if (!auth.getUser()) {
          await auth.signInWithGoogle();
        }
      });
    }

    if (window.TetrisAuth) {
      await window.TetrisAuth.init();
    }
    updateStatsUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
  } else {
    init().catch(console.error);
  }

  window.TetrisApp = { updateStatsUI, handleGameEnd };
})();
