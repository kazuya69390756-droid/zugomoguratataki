// Upstash Redis REST helper (same pattern as zugofes lib/store.js)
function redisConfig() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  }
  return null;
}

async function redisCmd(cmd) {
  const cfg = redisConfig();
  if (!cfg) throw new Error('redis_not_configured');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`redis_http_${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`redis: ${data.error}`);
  return data.result;
}

module.exports = { redisCmd, redisConfig };
