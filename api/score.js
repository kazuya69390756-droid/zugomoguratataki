// POST /api/score {name, score, hits, combo, title}
// Keeps each player's best-3 runs; the overall ranking uses the best score.
const { redisCmd, redisConfig } = require('./_redis');

const RANK_KEY = 'zt:ranking';
const DETAIL_KEY = 'zt:details';
const TOP3_KEY = 'zt:top3';

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
    const run = { score, hits, combo, title, ts: Date.now() };
    // personal top 3
    let top3 = [];
    const rawTop3 = await redisCmd(['HGET', TOP3_KEY, name]);
    if (rawTop3) { try { top3 = JSON.parse(rawTop3); } catch (e) { top3 = []; } }
    if (!Array.isArray(top3)) top3 = [];
    top3.push(run);
    top3.sort((a, b) => b.score - a.score);
    top3 = top3.slice(0, 3);
    await redisCmd(['HSET', TOP3_KEY, name, JSON.stringify(top3)]);
    // overall ranking = best score
    const best = top3[0].score;
    const prev = await redisCmd(['ZSCORE', RANK_KEY, name]);
    const prevScore = prev === null ? -1 : Number(prev);
    const updated = best > prevScore;
    if (updated) {
      const bestRun = top3[0];
      await redisCmd(['ZADD', RANK_KEY, best, name]);
      await redisCmd(['HSET', DETAIL_KEY, name, JSON.stringify(bestRun)]);
    }
    const rankIdx = await redisCmd(['ZREVRANK', RANK_KEY, name]);
    const total = await redisCmd(['ZCARD', RANK_KEY]);
    res.status(200).json({
      ok: true,
      updated,
      best,
      rank: rankIdx === null ? null : rankIdx + 1,
      total,
      myTop3: top3,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
};
