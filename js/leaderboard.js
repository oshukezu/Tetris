// Tetris 排行榜模組 — 分數 / Combo / 遊玩次數三 Tab
(function () {
  const RANK_ICONS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  const TAB_CONFIG = {
    score: { label: '最高分', field: 'best_score', suffix: ' 分' },
    combo: { label: '最高 Combo', field: 'best_max_combo', suffix: '' },
    plays: { label: '遊玩次數', field: 'games_played', suffix: ' 局' }
  };

  const Leaderboard = {
    currentTab: 'score',

    async render() {
      const list = document.getElementById('leaderboard-list');
      const myRank = document.getElementById('leaderboard-my-rank');
      if (!list) return;

      list.innerHTML = '<div class="lb-loading">載入中…</div>';

      let rows = [];
      try {
        if (!window.TetrisSupabaseService) throw new Error('服務未載入');
        rows = await window.TetrisSupabaseService.getLeaderboard(this.currentTab, 50);
      } catch (e) {
        list.innerHTML = `<div class="lb-error">排行榜載入失敗：${escapeHtml(e.message)}</div>`;
        if (myRank) myRank.textContent = '';
        return;
      }

      const cfg = TAB_CONFIG[this.currentTab];
      const userId = window.TetrisAuth?.getUser()?.id;

      if (myRank && userId) {
        const idx = rows.findIndex((r) => r.id === userId);
        if (idx === -1) {
          myRank.textContent = '你尚未進入前 50 名';
        } else {
          const me = rows[idx];
          myRank.textContent = `我的排名：第 ${idx + 1} 名（${me[cfg.field]}${cfg.suffix}）`;
        }
      } else if (myRank) {
        myRank.textContent = '';
      }

      if (!rows.length) {
        list.innerHTML = '<div class="lb-empty">暫無資料，快來搶第一！</div>';
        return;
      }

      const header = `
        <div class="lb-row lb-header">
          <span class="lb-rank">#</span>
          <span class="lb-name">玩家</span>
          <span class="lb-value">${cfg.label}</span>
        </div>`;

      const body = rows
        .map((row, i) => {
          const rank = i + 1;
          const icon = RANK_ICONS[rank] || rank;
          const name = escapeHtml(row.display_name || 'Player');
          const val = row[cfg.field] ?? 0;
          const highlight = row.id === userId ? ' lb-me' : '';
          return `
            <div class="lb-row${highlight}">
              <span class="lb-rank">${icon}</span>
              <span class="lb-name">${name}</span>
              <span class="lb-value">${val}${cfg.suffix}</span>
            </div>`;
        })
        .join('');

      list.innerHTML = header + body;
    },

    switchTab(tab) {
      this.currentTab = tab;
      document.querySelectorAll('.lb-tab').forEach((el) => {
        el.classList.toggle('active', el.dataset.tab === tab);
      });
      this.render().catch(() => {});
    },

    init() {
      document.querySelectorAll('.lb-tab').forEach((el) => {
        el.addEventListener('click', () => this.switchTab(el.dataset.tab));
      });
      const panel = document.getElementById('leaderboard-panel');
      const openBtn = document.getElementById('leaderboard-btn');
      const closeBtn = document.getElementById('leaderboard-close');
      if (openBtn && panel) {
        openBtn.addEventListener('click', () => {
          panel.classList.add('open');
          this.render().catch(() => {});
        });
      }
      if (closeBtn && panel) {
        closeBtn.addEventListener('click', () => panel.classList.remove('open'));
      }
    }
  };

  window.TetrisLeaderboard = Leaderboard;
})();
