// Tetris 本地存檔模組 — 離線優先，登入後雲端合併
(function () {
  const STORAGE_KEY = 'tetris_profile';
  const MAX_RECENT = 20;

  const DEFAULT_PROFILE = {
    best_score: 0,
    best_max_combo: 0,
    games_played: 0,
    recent_sessions: []
  };

  const Storage = {
    getProfile() {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = JSON.stringify(DEFAULT_PROFILE);
        localStorage.setItem(STORAGE_KEY, raw);
      }
      let profile;
      try {
        profile = JSON.parse(raw);
      } catch (e) {
        console.error('[TetrisStorage] parse error', e);
        profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
      }
      for (const key of Object.keys(DEFAULT_PROFILE)) {
        if (profile[key] === undefined) {
          profile[key] = JSON.parse(JSON.stringify(DEFAULT_PROFILE[key]));
        }
      }
      return profile;
    },

    saveProfile(profile) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent('tetrisProfileUpdated', { detail: profile }));
      if (window.TetrisSync && window.TetrisSync.isOnline()) {
        setTimeout(() => {
          window.TetrisSync.syncToCloud(profile).catch(() => {});
        }, 0);
      }
    },

    recordGameEnd(session) {
      const profile = this.getProfile();
      profile.games_played += 1;
      profile.best_score = Math.max(profile.best_score, session.score || 0);
      profile.best_max_combo = Math.max(profile.best_max_combo, session.maxCombo || 0);
      profile.recent_sessions.push({
        score: session.score,
        lines: session.lines,
        level: session.level,
        max_combo: session.maxCombo,
        duration_ms: session.durationMs,
        played_at: new Date().toISOString()
      });
      if (profile.recent_sessions.length > MAX_RECENT) {
        profile.recent_sessions = profile.recent_sessions.slice(-MAX_RECENT);
      }
      this.saveProfile(profile);
      return profile;
    },

    getBestScore() {
      return this.getProfile().best_score;
    },

    getBestMaxCombo() {
      return this.getProfile().best_max_combo;
    },

    getGamesPlayed() {
      return this.getProfile().games_played;
    }
  };

  window.TetrisStorage = Storage;
})();
