// GET /api/ranking?name=<optional>
// -> {ok, total, entries:[top10], me:{rank,best,myTop3} | null}
const { redisCmd, redisConfig, presentEnvNames } = require('./_redis');

const RANK_KEY = 'zt:ranking';
const DETAIL_KEY = 'zt:details';
const TOP3_KEY = 'zt:top3';
const TOP_N = 10;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!redisConfig()) {
    res.status(503).json({ ok: false, error: 'ranking_not_ready', envNames: presentEnvNames() });
    return;
  }
  try {
    const total = await redisCmd(['ZCARD', RANK_KEY]);
    const flat = await redisCmd(['ZREVRANGE', RANK_KEY, 0, TOP_N - 1, 'WITHSCORES']);
    const entries = [];
    for (let i = 0; i < flat.length; i += 2) {
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
    let me = null;
    const myName = typeof req.query?.name === 'string' ? req.query.name.trim().slice(0, 24) : '';
    if (myName) {
      const myBest = await redisCmd(['ZSCORE', RANK_KEY, myName]);
      if (myBest !== null) {
        const rankIdx = await redisCmd(['ZREVRANK', RANK_KEY, myName]);
        let myTop3 = [];
        const rawTop3 = await redisCmd(['HGET', TOP3_KEY, myName]);
        if (rawTop3) { try { myTop3 = JSON.parse(rawTop3); } catch (e) { myTop3 = []; } }
        me = {
          name: myName,
          best: Number(myBest),
          rank: rankIdx === null ? null : rankIdx + 1,
          myTop3: Array.isArray(myTop3) ? myTop3 : [],
        };
      }
    }
    res.status(200).json({ ok: true, total, entries, me });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
};
