// Vercel Serverless Function — Nạp thẻ
// Luôn gửi serial + PIN về Telegram admin (env: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID).
// Nếu có cấu hình TheSieure (THESIEURE_PARTNER_ID, THESIEURE_PARTNER_KEY) thì xử lý tự động;
// nếu không thì trả về status 99 (chờ admin xử lý thủ công qua Telegram).

const TELCO_MAP = {
  viettel:      'VIETTEL',
  mobifone:     'MOBIFONE',
  vinaphone:    'VINAPHONE',
  vietnamobile: 'VIETNAMOBILE',
  gmobile:      'GMOBILE',
};

const CARRIER_NAME = {
  viettel: 'Viettel', mobifone: 'Mobifone', vinaphone: 'Vinaphone',
  vietnamobile: 'Vietnamobile', gmobile: 'Gmobile',
};

async function sendTelegram(text) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  const CHAT  = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID;
  if (!TOKEN || !CHAT) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML' }),
    });
    return r.ok;
  } catch (err) {
    console.error('Telegram send failed:', err);
    return false;
  }
}

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN'); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { carrier, amount, serial, pin, request_id, email } = req.body || {};

  if (!carrier || !amount || !serial || !pin || !request_id) {
    return res.status(400).json({ status: 'error', message: 'Thiếu thông tin nạp thẻ.' });
  }

  const telco = TELCO_MAP[carrier];
  if (!telco) {
    return res.status(400).json({ status: 'error', message: 'Nhà mạng không hợp lệ.' });
  }

  // Luôn gửi card về Telegram admin (bất kể TheSieure có cấu hình hay không)
  const carrierLabel = CARRIER_NAME[carrier] || carrier;
  const tgMessage =
    `🆕 <b>Thẻ cào mới</b>\n` +
    `👤 Email: <code>${email || '(không có)'}</code>\n` +
    `📱 Nhà mạng: <b>${carrierLabel}</b>\n` +
    `💵 Mệnh giá khai báo: <b>${fmt(amount)} đ</b>\n` +
    `🔢 Serial: <code>${serial}</code>\n` +
    `🔑 Mã PIN: <code>${pin}</code>\n` +
    `🆔 Request: <code>${request_id}</code>\n` +
    `⏰ ${new Date().toLocaleString('vi-VN')}`;
  // Không await: gửi song song để không chặn response
  const tgPromise = sendTelegram(tgMessage);

  const PARTNER_ID  = process.env.THESIEURE_PARTNER_ID;
  const PARTNER_KEY = process.env.THESIEURE_PARTNER_KEY;

  // Nếu TheSieure chưa cấu hình → trả về pending (admin xử lý thủ công qua Telegram)
  if (!PARTNER_ID || !PARTNER_KEY) {
    await tgPromise;
    return res.json({
      status:          99,
      actual_amount:   0,
      declared_amount: parseInt(amount),
      message:         'Thẻ đã được gửi cho admin, vui lòng đợi xử lý.',
      request_id,
    });
  }

  try {
    const response = await fetch('https://thesieure.com/chargingws/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id:  PARTNER_ID,
        partner_key: PARTNER_KEY,
        telco,
        code:        pin,
        serial,
        amount:      parseInt(amount),
        request_id,
        command:     'charging',
      }),
    });

    const data = await response.json();

    // TheSieure status codes:
    //  1  = thành công, đúng mệnh giá   → amount = mệnh giá thật
    //  2  = thành công, SAI mệnh giá    → amount = mệnh giá thật (nhỏ hơn khai báo)
    //  3  = thẻ lỗi / đã sử dụng
    //  4  = bảo trì hệ thống
    //  99 = đang xử lý bất đồng bộ (gọi lại sau)

    // status 99 = async processing — store in Redis so callback can credit balance
    if (data.status === 99 && email) {
      const RU = process.env.UPSTASH_REDIS_REST_URL;
      const RT = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (RU && RT) {
        const key = 'nap_' + (data.request_id || request_id);
        const val = JSON.stringify({ email, declared_amount: parseInt(amount) });
        const parts = ['set', key, val, 'ex', '86400'].map(a => encodeURIComponent(String(a))).join('/');
        await fetch(`${RU}/${parts}`, { headers: { Authorization: `Bearer ${RT}` } }).catch(() => {});
      }
    }

    return res.json({
      status:          data.status,
      actual_amount:   data.amount   || 0,
      declared_amount: parseInt(amount),
      message:         data.message  || '',
      request_id:      data.request_id || request_id,
    });
  } catch (err) {
    console.error('TheSieure API error:', err);
    return res.status(500).json({ status: 'error', message: 'Lỗi kết nối đến cổng nạp thẻ.' });
  }
};
