// TEMPORARY one-off cleanup: removes the seeded duplicate entry @jrm44930.
// Delete this file right after use.
const { redisCmd } = require('./_redis');

const TARGET = '@jrm44930';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  try {
    const z = await redisCmd(['ZREM', 'zt:ranking', TARGET]);
    const d1 = await redisCmd(['HDEL', 'zt:details', TARGET]);
    const d2 = await redisCmd(['HDEL', 'zt:top3', TARGET]);
    res.status(200).json({ ok: true, removed: { z, d1, d2 } });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
};
