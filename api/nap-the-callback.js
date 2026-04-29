// Vercel Serverless — TheSieure callback khi thẻ xử lý xong (status 99 → 1 hoặc 2)
// TheSieure POST tới endpoint này với: { request_id, status, amount, sign }
// sign = md5(PARTNER_ID + PARTNER_KEY + request_id)

const crypto = require('crypto');

const SB_URL = 'https://kcotqibvffpiikqawfyw.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjb3RxaWJ2ZmZwaWlrcWF3Znl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxOTI0MTEsImV4cCI6MjA5Mjc2ODQxMX0.zdpJvg2JpXrozYwrSX5C0EhE9OB5fUVU18TXlWfvuOU';

async function redisCmd(url, token, ...args) {
  const parts = args.map(a => encodeURIComponent(String(a))).join('/');
  const res = await fetch(`${url}/${parts}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return (await res.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { request_id, status, amount, sign } = req.body || {};
  if (!request_id || !sign) return res.status(400).json({ message: 'Missing params' });

  const PARTNER_ID  = process.env.THESIEURE_PARTNER_ID;
  const PARTNER_KEY = process.env.THESIEURE_PARTNER_KEY;
  const RU = process.env.UPSTASH_REDIS_REST_URL;
  const RT = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!PARTNER_ID || !PARTNER_KEY || !RU || !RT) {
    return res.status(500).json({ message: 'Server misconfigured' });
  }

  // Verify TheSieure signature
  const expected = crypto.createHash('md5').update(PARTNER_ID + PARTNER_KEY + request_id).digest('hex');
  if (sign !== expected) {
    return res.status(403).json({ message: 'Invalid signature' });
  }

  // Look up pending charge in Redis
  const redisKey = 'nap_' + request_id;
  let stored;
  try {
    const raw = await redisCmd(RU, RT, 'get', redisKey);
    if (!raw) return res.json({ status: 1 }); // already handled or expired
    stored = JSON.parse(raw);
  } catch (err) {
    console.error('Redis get error:', err);
    return res.status(500).json({ message: 'Redis error' });
  }

  const { email } = stored;
  const actualAmount = Number(amount) || 0;

  // Calculate credited amount
  let credited = 0;
  if (status === 1) credited = Math.round(actualAmount * 0.9);
  else if (status === 2) credited = Math.round(actualAmount * 0.5);

  if (credited > 0 && email) {
    const sbH = {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };

    try {
      // Fetch current balance
      const getRes = await fetch(
        `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=balance`,
        { headers: sbH }
      );
      const users = await getRes.json();
      const current = (users && users[0]) ? Number(users[0].balance) || 0 : 0;

      // Patch with new balance
      await fetch(
        `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: sbH,
          body: JSON.stringify({ balance: current + credited }),
        }
      );
    } catch (err) {
      console.error('Supabase update error:', err);
      // Still delete from Redis to avoid double-processing on retry
    }
  }

  // Remove from Redis
  try { await redisCmd(RU, RT, 'del', redisKey); } catch (_) {}

  // TheSieure expects { status: 1 } to confirm receipt
  return res.json({ status: 1 });
};
