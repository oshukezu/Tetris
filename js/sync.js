// Tetris 雲端同步 — localStorage ↔ tetris_profiles 雙向合併
(function () {
  const CFG = window.TETRIS_CONFIG;
  if (!CFG || !CFG.CLOUD_ENABLED) {
    window.TetrisSync = {
      syncToCloud: async () => {},
      syncOnLogin: async () => {},
      isOnline: () => navigator.onLine
    };
    return;
  }

  const Sync = {
    _isSyncing: false,

    isOnline() {
      return navigator.onLine;
    },

    _getUserId() {
      return window.TetrisAuth?.currentUser?.id || null;
    },

    mergeProfiles(local, remote) {
      if (!remote) return local;
      return {
        best_score: Math.max(local.best_score || 0, remote.best_score || 0),
        best_max_combo: Math.max(local.best_max_combo || 0, remote.best_max_combo || 0),
        games_played: Math.max(local.games_played || 0, remote.games_played || 0),
        recent_sessions: local.recent_sessions || []
      };
    },

    async syncToCloud(profile) {
      if (!this.isOnline() || this._isSyncing) return;
      const userId = this._getUserId();
      if (!userId || !window.TetrisSupabaseService) return;

      this._isSyncing = true;
      try {
        const remote = await window.TetrisSupabaseService.getProfile(userId);
        const merged = this.mergeProfiles(profile, remote);
        await window.TetrisSupabaseService.updateProfile(userId, {
          best_score: merged.best_score,
          best_max_combo: merged.best_max_combo,
          games_played: merged.games_played,
          display_name: window.TetrisAuth?.getDisplayName()
        });
      } catch (e) {
        console.warn('[TetrisSync] syncToCloud failed:', e.message);
      } finally {
        this._isSyncing = false;
      }
    },

    async syncOnLogin() {
      if (!this.isOnline()) return;
      const userId = this._getUserId();
      if (!userId || !window.TetrisStorage || !window.TetrisSupabaseService) return;

      try {
        const local = window.TetrisStorage.getProfile();
        const remote = await window.TetrisSupabaseService.getProfile(userId);
        const merged = this.mergeProfiles(local, remote);

        const localProfile = window.TetrisStorage.getProfile();
        localProfile.best_score = merged.best_score;
        localProfile.best_max_combo = merged.best_max_combo;
        localProfile.games_played = merged.games_played;
        localStorage.setItem('tetris_profile', JSON.stringify(localProfile));
        window.dispatchEvent(new CustomEvent('tetrisProfileUpdated', { detail: localProfile }));

        await window.TetrisSupabaseService.updateProfile(userId, {
          best_score: merged.best_score,
          best_max_combo: merged.best_max_combo,
          games_played: merged.games_played,
          display_name: window.TetrisAuth?.getDisplayName()
        });
      } catch (e) {
        console.warn('[TetrisSync] syncOnLogin failed:', e.message);
      }
    }
  };

  window.TetrisSync = Sync;
})();
