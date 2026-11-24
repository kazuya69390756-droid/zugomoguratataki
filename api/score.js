// POST /api/score {name, score, hits, combo, title}
// Registers the player's best score in the ranking.
const { redisCmd, redisConfig } = require('./_redis');

const RANK_KEY = 'zt:ranking';
const DETAIL_KEY = 'zt:details';

function cleanName(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}
function cleanInt(v, min, max) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  if (!redisConfig()) {
    res.status(503).json({ ok: false, error: 'ranking_not_ready' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const name = cleanName(body.name);
  const score = cleanInt(body.score, 0, 5000);
  const hits = cleanInt(body.hits, 0, 500);
  const combo = cleanInt(body.combo, 0, 500);
  const title = cleanName(body.title);
  if (!name || score === null) {
    res.status(400).json({ ok: false, error: 'bad_request' });
    return;
  }
  try {
    const prev = await redisCmd(['ZSCORE', RANK_KEY, name]);
    const prevScore = prev === null ? -1 : Number(prev);
    let best = prevScore;
    if (score > prevScore) {
      await redisCmd(['ZADD', RANK_KEY, score, name]);
      await redisCmd(['HSET', DETAIL_KEY, name, JSON.stringify({
        score, hits, combo, title, ts: Date.now(),
      })]);
      best = score;
    }
    const rankIdx = await redisCmd(['ZREVRANK', RANK_KEY, name]);
    const total = await redisCmd(['ZCARD', RANK_KEY]);
    res.status(200).json({
      ok: true,
      updated: score > prevScore,
      best,
      rank: rankIdx === null ? null : rankIdx + 1,
      total,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
};
