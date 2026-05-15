// Vercel Serverless — Webhook SePay (https://sepay.vn) tự cộng tiền khi
// khách chuyển khoản ngân hàng.
//
// Setup (làm 1 lần):
// 1. Đăng ký tài khoản tại https://sepay.vn → Liên kết ngân hàng (AB Bank STK 0903722295)
// 2. Vào "Cấu hình API" → tạo Webhook URL mới:
//      URL:           https://<your-vercel-domain>/api/sepay-webhook
//      Loại trigger:  Thông báo giao dịch ngân hàng
//      Chỉ gửi khi:   Có tiền vào
//      Authorization: Apikey <copy giá trị này>
// 3. Trên Vercel → Settings → Environment Variables thêm:
//      SEPAY_API_KEY = <giá trị API key vừa tạo ở SePay>
//
// Khách CK đến STK 0903722295 với nội dung là EMAIL → tự cộng vào balance.
// Nếu nội dung không có email hoặc email lạ → gửi cảnh báo về Telegram admin.

const SB_URL = 'https://kcotqibvffpiikqawfyw.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjb3RxaWJ2ZmZwaWlrcWF3Znl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxOTI0MTEsImV4cCI6MjA5Mjc2ODQxMX0.zdpJvg2JpXrozYwrSX5C0EhE9OB5fUVU18TXlWfvuOU';

async function tg(text) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  const CHAT  = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID;
  if (!TOKEN || !CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML' }),
    });
  } catch (err) { console.error('Telegram notify failed:', err); }
}

async function redis(cmd, ...args) {
  const RU = process.env.UPSTASH_REDIS_REST_URL;
  const RT = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!RU || !RT) return null;
  const parts = [cmd, ...args].map(a => encodeURIComponent(String(a))).join('/');
  const r = await fetch(`${RU}/${parts}`, { headers: { Authorization: `Bearer ${RT}` } });
  if (!r.ok) return null;
  return (await r.json()).result;
}

function extractEmail(...sources) {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  for (const s of sources) {
    if (!s) continue;
    const m = String(s).match(re);
    if (m) return m[0].toLowerCase();
  }
  return null;
}

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN'); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Verify SePay API key (header: Authorization: Apikey xxx)
  const expectedKey = process.env.SEPAY_API_KEY;
  if (expectedKey) {
    const auth = String(req.headers.authorization || '');
    const provided = auth.replace(/^Apikey\s+/i, '').trim();
    if (provided !== expectedKey) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
  }

  const b = req.body || {};
  const {
    transferType, transferAmount, content, description,
    referenceCode, transactionDate, gateway, accountNumber,
  } = b;

  // Chỉ xử lý tiền vào
  if (transferType && transferType !== 'in') {
    return res.json({ ok: true, skipped: 'not incoming' });
  }
  const amount = Number(transferAmount) || 0;
  if (amount <= 0) return res.json({ ok: true, skipped: 'zero amount' });

  // Idempotency: tránh cộng đôi nếu SePay retry
  const refKey = `sepay_${referenceCode || `${accountNumber}_${transactionDate}_${amount}`}`;
  const already = await redis('get', refKey);
  if (already) {
    return res.json({ ok: true, skipped: 'already processed', ref: refKey });
  }

  const ctText  = String(content || description || '');
  const email   = extractEmail(content, description);

  // Helper alert
  const alertAdmin = (title, extra = '') =>
    tg(
      `${title}\n` +
      `🏦 Ngân hàng: <b>${gateway || '?'}</b> — STK <code>${accountNumber || '?'}</code>\n` +
      `💰 Số tiền: <b>+${fmt(amount)} đ</b>\n` +
      `📝 Nội dung: <code>${ctText.slice(0, 200)}</code>\n` +
      `🆔 Ref: <code>${referenceCode || '?'}</code>\n` +
      `⏰ ${transactionDate || new Date().toLocaleString('vi-VN')}` +
      (extra ? `\n${extra}` : '')
    );

  if (!email) {
    await alertAdmin('⚠️ <b>CK đến nhưng KHÔNG TÌM được email trong nội dung</b>', 'Vào admin panel để cộng tiền tay.');
    await redis('set', refKey, '1', 'ex', '604800'); // 7 ngày
    return res.json({ ok: true, skipped: 'no email in content' });
  }

  // Look up user
  const sbH = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  try {
    const getRes = await fetch(
      `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=balance`,
      { headers: sbH }
    );
    const users = await getRes.json();

    if (!Array.isArray(users) || users.length === 0) {
      await alertAdmin(`⚠️ <b>CK đến nhưng email <code>${email}</code> KHÔNG tồn tại trong hệ thống</b>`,
                       'Có thể khách gõ sai email. Vào admin panel xử lý tay.');
      await redis('set', refKey, '1', 'ex', '604800');
      return res.json({ ok: true, skipped: 'user not found', email });
    }

    const current    = Number(users[0].balance) || 0;
    const newBalance = current + amount;

    const patchRes = await fetch(
      `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      { method: 'PATCH', headers: sbH, body: JSON.stringify({ balance: newBalance }) }
    );
    if (!patchRes.ok) {
      const err = await patchRes.text();
      await alertAdmin(`❌ <b>Lỗi cộng tiền cho ${email}</b>`, `Supabase: ${err.slice(0, 200)}`);
      return res.status(500).json({ error: 'Supabase update failed' });
    }

    // Mark processed
    await redis('set', refKey, '1', 'ex', '604800');

    // Notify admin success
    await tg(
      `✅ <b>Tự động cộng tiền từ CK ngân hàng</b>\n` +
      `👤 Email: <code>${email}</code>\n` +
      `💰 +${fmt(amount)} đ\n` +
      `💵 Số dư mới: <b>${fmt(newBalance)} đ</b>\n` +
      `🏦 ${gateway || '?'} — Ref <code>${referenceCode || '?'}</code>\n` +
      `⏰ ${transactionDate || new Date().toLocaleString('vi-VN')}`
    );

    return res.json({ ok: true, email, credited: amount, newBalance });
  } catch (err) {
    console.error('SePay webhook error:', err);
    await tg(`❌ <b>Lỗi xử lý webhook SePay</b>\n<code>${String(err.message).slice(0, 200)}</code>`);
    return res.status(500).json({ error: err.message });
  }
};
