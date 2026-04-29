// Vercel Serverless — Quản lý đơn nạp/rút tiền via Upstash Redis
// Env vars cần set trong Vercel:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN

const KEY = 'mxh24_orders';

async function redis(url, token, cmd, ...args) {
  const parts = [cmd, ...args].map(a => encodeURIComponent(String(a))).join('/');
  const res = await fetch(`${url}/${parts}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return (await res.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const URL   = process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!URL || !TOKEN) {
    return res.status(500).json({ error: 'Chưa cấu hình Upstash Redis. Xem hướng dẫn trong admin.' });
  }

  try {
    // GET — lấy tất cả đơn chờ xử lý
    if (req.method === 'GET') {
      const raw = await redis(URL, TOKEN, 'hgetall', KEY);
      if (!raw || raw.length === 0) return res.json([]);
      const orders = [];
      for (let i = 0; i < raw.length; i += 2) {
        try { orders.push(JSON.parse(raw[i + 1])); } catch (_) {}
      }
      orders.sort((a, b) => b.ts - a.ts);
      return res.json(orders);
    }

    // POST — tạo đơn mới
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.type || !b.email || !b.amount) {
        return res.status(400).json({ error: 'Thiếu thông tin đơn hàng.' });
      }
      const order = {
        id:     b.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type:   b.type,    // 'withdrawal' | 'bank_transfer'
        email:  b.email,
        amount: Number(b.amount),
        bank:   b.bank  || null,
        stk:    b.stk   || null,
        note:   b.note  || null,
        ts:     Number(b.ts) || Date.now(),
        time:   b.time || new Date().toLocaleString('vi-VN'),
      };
      await redis(URL, TOKEN, 'hset', KEY, order.id, JSON.stringify(order));
      return res.json({ ok: true, id: order.id });
    }

    // DELETE — hoàn tất đơn (xóa khỏi danh sách)
    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      if (!id) return res.status(400).json({ error: 'Thiếu id.' });
      await redis(URL, TOKEN, 'hdel', KEY, id);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Orders API error:', err);
    return res.status(500).json({ error: err.message });
  }
};
