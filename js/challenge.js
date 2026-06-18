// Tetris 非同步分數挑戰（模式 A）
(function () {
  const Challenge = {
    activeChallengeId: null,
    lastSessionId: null,
    lastSessionScore: 0,
    _hasCompletedGame: false,

    getChallengeIdFromUrl() {
      const params = new URLSearchParams(window.location.search);
      return params.get('challenge');
    },

    buildShareUrl(challengeId) {
      const url = new URL(window.location.href);
      url.searchParams.set('challenge', challengeId);
      return url.toString();
    },

    async createFromLastGame() {
      const user = window.TetrisAuth?.getUser();
      if (!user) {
        alert('請先登入後再發起挑戰');
        return;
      }
      if (!this._hasCompletedGame) {
        alert('請先完成一局遊戲');
        return;
      }

      try {
        const challenge = await window.TetrisSupabaseService.createChallenge(
          user.id,
          this.lastSessionId,
          this.lastSessionScore
        );
        const shareUrl = this.buildShareUrl(challenge.id);
        await this._showShareDialog(shareUrl, this.lastSessionScore);
      } catch (e) {
        alert('發起挑戰失敗：' + e.message);
      }
    },

    async _showShareDialog(url, score) {
      const banner = document.getElementById('challenge-banner');
      const text = document.getElementById('challenge-share-text');
      if (banner && text) {
        text.textContent = `挑戰連結已建立！你的分數：${score}`;
        banner.dataset.shareUrl = url;
        banner.classList.remove('hidden');
      }
      try {
        await navigator.clipboard.writeText(url);
      } catch (_) {
        /* clipboard may fail on non-HTTPS */
      }
    },

    async loadChallengeFromUrl() {
      const id = this.getChallengeIdFromUrl();
      if (!id) return;

      this.activeChallengeId = id;
      const banner = document.getElementById('challenge-banner');
      const text = document.getElementById('challenge-share-text');
      if (!banner || !text) return;

      try {
        const challenge = await window.TetrisSupabaseService.getChallenge(id);
        if (!challenge) {
          text.textContent = '找不到此挑戰';
          banner.classList.remove('hidden');
          return;
        }

        const challengerName = challenge.challenger?.display_name || '對手';
        const score = challenge.challenger_score ?? '?';

        if (challenge.status === 'completed') {
          const result = challenge.winner_id
            ? (challenge.winner_id === window.TetrisAuth?.getUser()?.id ? '你贏了！' : '你輸了')
            : '平手';
          text.textContent = `挑戰已結束：${challengerName} ${score} 分 — ${result}`;
        } else if (challenge.status === 'expired') {
          text.textContent = '此挑戰已過期';
        } else {
          text.textContent = `${challengerName} 發起挑戰：${score} 分 — 打敗他！`;
          const user = window.TetrisAuth?.getUser();
          if (user && challenge.status === 'open' && user.id !== challenge.challenger_id) {
            await window.TetrisSupabaseService.acceptChallenge(id, user.id);
          }
        }
        banner.classList.remove('hidden');
      } catch (e) {
        text.textContent = '載入挑戰失敗：' + e.message;
        banner.classList.remove('hidden');
      }
    },

    async onGameEnd(session, sessionId) {
      if (!this.activeChallengeId || !sessionId) return;
      const user = window.TetrisAuth?.getUser();
      if (!user) return;

      try {
        const result = await window.TetrisSupabaseService.completeChallenge(
          this.activeChallengeId,
          user.id,
          sessionId,
          session.score
        );
        const banner = document.getElementById('challenge-banner');
        const text = document.getElementById('challenge-share-text');
        if (banner && text) {
          let msg = `挑戰結果：你 ${session.score} 分 vs 對手 ${result.challenger_score} 分`;
          if (result.winner_id === user.id) msg += ' — 你贏了！';
          else if (result.winner_id) msg += ' — 你輸了';
          else msg += ' — 平手';
          text.textContent = msg;
          banner.classList.remove('hidden');
        }
        this.activeChallengeId = null;
      } catch (e) {
        console.warn('[TetrisChallenge] complete failed:', e.message);
      }
    },

    setLastSession(sessionId, score) {
      this.lastSessionId = sessionId;
      this.lastSessionScore = score;
      this._hasCompletedGame = true;
      const btn = document.getElementById('challenge-create-btn');
      if (btn) btn.disabled = false;
    },

    init() {
      const createBtn = document.getElementById('challenge-create-btn');
      const copyBtn = document.getElementById('challenge-copy-btn');
      const dismissBtn = document.getElementById('challenge-dismiss-btn');

      if (createBtn) {
        createBtn.addEventListener('click', () => this.createFromLastGame());
      }
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          const banner = document.getElementById('challenge-banner');
          const url = banner?.dataset?.shareUrl;
          if (url) {
            try {
              await navigator.clipboard.writeText(url);
              copyBtn.textContent = '已複製！';
              setTimeout(() => { copyBtn.textContent = '複製連結'; }, 2000);
            } catch (_) {
              prompt('複製此連結：', url);
            }
          }
        });
      }
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          document.getElementById('challenge-banner')?.classList.add('hidden');
        });
      }

      this.loadChallengeFromUrl();
    }
  };

  window.TetrisChallenge = Challenge;
})();
