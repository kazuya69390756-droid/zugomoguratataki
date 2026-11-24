// Upstash Redis REST helper (same pattern as zugofes lib/store.js)
const CANDIDATES = [
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
  ['STORAGE_URL', 'STORAGE_REST_TOKEN'],
  ['STORAGE_REST_URL', 'STORAGE_REST_TOKEN'],
  ['REDIS_REST_URL', 'REDIS_REST_TOKEN'],
];

function redisConfig() {
  for (const [u, t] of CANDIDATES) {
    if (process.env[u] && process.env[t]) {
      return { url: process.env[u], token: process.env[t] };
    }
  }
  // any custom prefix ending in _URL with a matching token var
  for (const key of Object.keys(process.env)) {
    if (/_URL$/.test(key) && /^https:\/\//.test(process.env[key] || '')) {
      const prefix = key.slice(0, -4);
      const token = process.env[`${prefix}_TOKEN`] || process.env[`${prefix}_REST_TOKEN`];
      if (token) return { url: process.env[key], token };
    }
  }
  return null;
}

function presentEnvNames() {
  return Object.keys(process.env).filter((k) => /URL|TOKEN|REDIS|KV|STORAGE|UPSTASH/.test(k));
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

module.exports = { redisCmd, redisConfig, presentEnvNames };
