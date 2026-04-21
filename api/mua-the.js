// Vercel Serverless Function — Mua thẻ qua TheSieure API
// Docs: https://thesieure.com/doi-tac
// Env vars cần có: THESIEURE_PARTNER_ID, THESIEURE_PARTNER_KEY

const TELCO_MAP = {
  viettel:      'VIETTEL',
  mobifone:     'MOBIFONE',
  vinaphone:    'VINAPHONE',
  vietnamobile: 'VIETNAMOBILE',
  gmobile:      'GMOBILE',
  garena:       'GARENA',
  vcoin:        'VCOIN',
  zing:         'ZING',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { telco, amount, quantity = 1, request_id } = req.body || {};

  if (!telco || !amount || !request_id) {
    return res.status(400).json({ status: 'error', message: 'Thiếu thông tin mua thẻ.' });
  }

  const telcoCode = TELCO_MAP[telco];
  if (!telcoCode) {
    return res.status(400).json({ status: 'error', message: 'Loại thẻ không hợp lệ.' });
  }

  const PARTNER_ID  = process.env.THESIEURE_PARTNER_ID;
  const PARTNER_KEY = process.env.THESIEURE_PARTNER_KEY;

  if (!PARTNER_ID || !PARTNER_KEY) {
    return res.status(500).json({ status: 'error', message: 'API chưa được cấu hình.' });
  }

  try {
    const response = await fetch('https://thesieure.com/buycard/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id:  PARTNER_ID,
        partner_key: PARTNER_KEY,
        telco:       telcoCode,
        amount:      parseInt(amount),
        quantity:    parseInt(quantity),
        request_id,
      }),
    });

    const data = await response.json();

    // TheSieure buy card response:
    // status 1  = thành công, cards[] chứa thẻ
    // status 2  = đang xử lý
    // status 3  = lỗi (hết hàng, sai thông tin...)
    // cards[]: [{ serial, code, amount, telco }]

    return res.json({
      status:  data.status,
      cards:   data.cards  || [],
      message: data.message || '',
      request_id,
    });
  } catch (err) {
    console.error('TheSieure buy card error:', err);
    return res.status(500).json({ status: 'error', message: 'Lỗi kết nối cổng mua thẻ.' });
  }
};
