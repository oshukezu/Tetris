// Tetris 認證模組 — 匿名登入、Google OAuth、帳號升級
(function () {
  const CFG = window.TETRIS_CONFIG;
  if (!CFG || !CFG.CLOUD_ENABLED) {
    window.TetrisAuth = {
      isReady: false,
      currentUser: null,
      getUser: () => null,
      signInAnonymously: async () => null,
      signInWithGoogle: async () => null,
      linkGoogleAccount: async () => null,
      signOut: async () => {},
      init: async () => {}
    };
    return;
  }

  const supabase = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  function generateCodename() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TETRIS-';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  const Auth = {
    isReady: false,
    currentUser: null,
    supabase,

    getUser() {
      return this.currentUser;
    },

    getDisplayName() {
      const user = this.currentUser;
      if (!user) return '未登入';
      if (user.user_metadata?.full_name) return user.user_metadata.full_name;
      if (user.user_metadata?.name) return user.user_metadata.name;
      let nick = localStorage.getItem('tetris_display_name');
      if (!nick) {
        nick = generateCodename();
        localStorage.setItem('tetris_display_name', nick);
      }
      return nick;
    },

    isAnonymous() {
      return this.currentUser?.app_metadata?.provider === 'anonymous';
    },

    async signInAnonymously() {
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        this.currentUser = data.user;
        await this._ensureProfile(data.user);
        return data.user;
      } catch (e) {
        console.warn('[TetrisAuth] 匿名登入失敗:', e.message);
        return null;
      }
    },

    async signInWithGoogle() {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { skipBrowserRedirect: false }
        });
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[TetrisAuth] Google 登入失敗:', e.message);
        return null;
      }
    },

    async linkGoogleAccount() {
      try {
        const { data, error } = await supabase.auth.linkIdentity({ provider: 'google' });
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[TetrisAuth] 帳號連結失敗:', e.message);
        return null;
      }
    },

    async signOut() {
      try {
        await supabase.auth.signOut();
        this.currentUser = null;
        this._updateAuthUI(null);
      } catch (e) {
        console.error('[TetrisAuth] 登出失敗:', e.message);
      }
    },

    async _ensureProfile(user) {
      if (!user) return;
      try {
        const displayName = this.getDisplayName();
        const { error } = await supabase
          .from('tetris_profiles')
          .upsert(
            {
              id: user.id,
              display_name: displayName,
              avatar_url: user.user_metadata?.avatar_url || null,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        if (error) console.warn('[TetrisAuth] _ensureProfile:', error.message);
      } catch (e) {
        console.warn('[TetrisAuth] _ensureProfile exception:', e.message);
      }
    },

    onAuthStateChange() {
      supabase.auth.onAuthStateChange(async (event, session) => {
        this.currentUser = session?.user || null;
        this._updateAuthUI(session?.user || null);

        if (event === 'SIGNED_IN' && session?.user) {
          await this._ensureProfile(session.user);
          if (window.TetrisSync) {
            await window.TetrisSync.syncOnLogin();
          }
          if (window.TetrisLeaderboard) {
            window.TetrisLeaderboard.render().catch(() => {});
          }
        }
        this.isReady = true;
      });
    },

    _updateAuthUI(user) {
      const loginBtn = document.getElementById('auth-google-btn');
      const userLabel = document.getElementById('auth-user-label');
      if (!loginBtn) return;

      if (user) {
        const isAnon = user.app_metadata?.provider === 'anonymous';
        if (userLabel) userLabel.textContent = this.getDisplayName();
        loginBtn.textContent = isAnon ? '連結 Google' : '已登入';
        loginBtn.disabled = !isAnon;
      } else {
        if (userLabel) userLabel.textContent = '離線';
        loginBtn.textContent = 'Google 登入';
        loginBtn.disabled = false;
      }
    },

    async init() {
      this.onAuthStateChange();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await this.signInAnonymously();
      } else {
        this.currentUser = session.user;
        this._updateAuthUI(session.user);
        this.isReady = true;
      }
    }
  };

  window.TetrisAuth = Auth;
})();
