// GET /api/ranking -> {ok, total, entries:[{rank,name,score,hits,combo,title,ts}]}
const { redisCmd, redisConfig } = require('./_redis');

const RANK_KEY = 'zt:ranking';
const DETAIL_KEY = 'zt:details';
const TOP_N = 50;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!redisConfig()) {
    res.status(503).json({ ok: false, error: 'ranking_not_ready' });
    return;
  }
  try {
    const total = await redisCmd(['ZCARD', RANK_KEY]);
    const flat = await redisCmd(['ZREVRANGE', RANK_KEY, 0, TOP_N - 1, 'WITHSCORES']);
    const entries = [];
    for (let i = 0; i + 1 < flat.length + 1 && i < flat.length; i += 2) {
      // pairs of (member, score)
      const name = flat[i];
      const score = Number(flat[i + 1]);
      let detail = {};
      const raw = await redisCmd(['HGET', DETAIL_KEY, name]);
      if (raw) { try { detail = JSON.parse(raw); } catch (e) { detail = {}; } }
      entries.push({
        rank: entries.length + 1,
        name,
        score,
        hits: detail.hits ?? null,
        combo: detail.combo ?? null,
        title: detail.title || '',
        ts: detail.ts || null,
      });
    }
    res.status(200).json({ ok: true, total, entries });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
};
