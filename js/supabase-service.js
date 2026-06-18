// Tetris Supabase 連線服務
(function () {
  const CFG = window.TETRIS_CONFIG;
  let supabaseClient = null;

  function getClient() {
    if (!CFG || !CFG.CLOUD_ENABLED) return null;
    if (!supabaseClient) {
      if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase) {
        console.warn('[TetrisSupabase] credentials or SDK missing');
        return null;
      }
      supabaseClient = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    }
    return supabaseClient;
  }

  async function sha256(message) {
    const data = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function generateSessionHash(userId, score, lines, level, maxCombo) {
    const salt = CFG.INTEGRITY_SALT || 'Tetris_Salt';
    return sha256(`${userId}:${score}:${lines}:${level}:${maxCombo}:${salt}`);
  }

  async function insertSession(userId, session) {
    const db = getClient();
    if (!db || !userId) return null;

    const integrityHash = await generateSessionHash(
      userId,
      session.score,
      session.lines,
      session.level,
      session.maxCombo
    );

    const { data, error } = await db
      .from('tetris_sessions')
      .insert({
        user_id: userId,
        score: session.score,
        lines: session.lines,
        level: session.level,
        max_combo: session.maxCombo,
        duration_ms: session.durationMs,
        integrity_hash: integrityHash
      })
      .select('id')
      .single();

    if (error) {
      console.error('[TetrisSupabase] insertSession error:', error.message);
      throw error;
    }
    return data;
  }

  async function getProfile(userId) {
    const db = getClient();
    if (!db || !userId) return null;
    const { data, error } = await db
      .from('tetris_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[TetrisSupabase] getProfile error:', error.message);
      return null;
    }
    return data;
  }

  async function updateProfile(userId, fields) {
    const db = getClient();
    if (!db || !userId) return null;
    const { data, error } = await db
      .from('tetris_profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      console.warn('[TetrisSupabase] updateProfile error:', error.message);
      return null;
    }
    return data;
  }

  const LEADERBOARD_VIEWS = {
    score: 'tetris_leaderboard_scores',
    combo: 'tetris_leaderboard_combos',
    plays: 'tetris_leaderboard_plays'
  };

  async function getLeaderboard(type = 'score', limit = 50) {
    const db = getClient();
    if (!db) throw new Error('Supabase 未初始化');

    const view = LEADERBOARD_VIEWS[type] || LEADERBOARD_VIEWS.score;
    const { data, error } = await db.from(view).select('*').limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function createChallenge(challengerId, sessionId, score) {
    const db = getClient();
    if (!db) throw new Error('Supabase 未初始化');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (CFG.CHALLENGE_EXPIRY_HOURS || 72));

    const { data, error } = await db
      .from('tetris_challenges')
      .insert({
        challenger_id: challengerId,
        challenger_session_id: sessionId,
        challenger_score: score,
        status: 'open',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function getChallenge(challengeId) {
    const db = getClient();
    if (!db) throw new Error('Supabase 未初始化');

    const { data, error } = await db
      .from('tetris_challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    if (data.challenger_id) {
      const { data: profile } = await db
        .from('tetris_profiles')
        .select('id, display_name, avatar_url')
        .eq('id', data.challenger_id)
        .maybeSingle();
      data.challenger = profile;
    }

    if (new Date(data.expires_at) < new Date() && data.status === 'open') {
      await db.from('tetris_challenges').update({ status: 'expired' }).eq('id', challengeId);
      data.status = 'expired';
    }
    return data;
  }

  async function acceptChallenge(challengeId, challengedId) {
    const db = getClient();
    if (!db) throw new Error('Supabase 未初始化');

    const { data, error } = await db
      .from('tetris_challenges')
      .update({
        challenged_id: challengedId,
        status: 'accepted'
      })
      .eq('id', challengeId)
      .eq('status', 'open')
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function completeChallenge(challengeId, challengedId, sessionId, score) {
    const db = getClient();
    if (!db) throw new Error('Supabase 未初始化');

    const challenge = await getChallenge(challengeId);
    if (!challenge) throw new Error('挑戰不存在');
    if (challenge.status === 'expired') throw new Error('挑戰已過期');
    if (challenge.status === 'completed') throw new Error('挑戰已完成');

    const challengerScore = challenge.challenger_score || 0;
    let winnerId = null;
    if (score > challengerScore) winnerId = challengedId;
    else if (score < challengerScore) winnerId = challenge.challenger_id;
    // tie: winner_id stays null

    const { data, error } = await db
      .from('tetris_challenges')
      .update({
        challenged_id: challengedId,
        challenged_session_id: sessionId,
        challenged_score: score,
        winner_id: winnerId,
        status: 'completed'
      })
      .eq('id', challengeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  window.TetrisSupabaseService = {
    getClient,
    insertSession,
    getProfile,
    updateProfile,
    getLeaderboard,
    createChallenge,
    getChallenge,
    acceptChallenge,
    completeChallenge,
    generateSessionHash
  };
})();
