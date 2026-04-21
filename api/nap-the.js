// Vercel Serverless Function — Nạp thẻ qua TheSieure Partner API
// Docs: https://thesieure.com/doi-tac
// Cần set 2 env vars trong Vercel dashboard:
//   THESIEURE_PARTNER_ID  = partner id của bạn
//   THESIEURE_PARTNER_KEY = partner key của bạn

const TELCO_MAP = {
  viettel:      'VIETTEL',
  mobifone:     'MOBIFONE',
  vinaphone:    'VINAPHONE',
  vietnamobile: 'VIETNAMOBILE',
  gmobile:      'GMOBILE',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { carrier, amount, serial, pin, request_id } = req.body || {};

  if (!carrier || !amount || !serial || !pin || !request_id) {
    return res.status(400).json({ status: 'error', message: 'Thiếu thông tin nạp thẻ.' });
  }

  const telco = TELCO_MAP[carrier];
  if (!telco) {
    return res.status(400).json({ status: 'error', message: 'Nhà mạng không hợp lệ.' });
  }

  const PARTNER_ID  = process.env.THESIEURE_PARTNER_ID;
  const PARTNER_KEY = process.env.THESIEURE_PARTNER_KEY;

  if (!PARTNER_ID || !PARTNER_KEY) {
    return res.status(500).json({ status: 'error', message: 'API chưa được cấu hình. Liên hệ admin.' });
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
