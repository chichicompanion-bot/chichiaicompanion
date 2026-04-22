// Vercel Serverless Function — Kiểm tra trạng thái đơn SMM
// Cần env vars: SMM_PANEL_URL, SMM_PANEL_KEY (xem api/order.js)

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { panelOrderId } = req.body || {};
  if (!panelOrderId) return res.status(400).json({ error: 'Thiếu panelOrderId.' });

  const PANEL_URL = process.env.SMM_PANEL_URL;
  const PANEL_KEY = process.env.SMM_PANEL_KEY;
  if (!PANEL_URL || !PANEL_KEY) return res.status(500).json({ error: 'Chưa cấu hình panel.' });

  try {
    const params = new URLSearchParams({
      key:    PANEL_KEY,
      action: 'status',
      order:  String(panelOrderId),
    });

    const response = await fetch(PANEL_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const data = await response.json();

    // Panel trả về: { charge, start_count, status, remains, currency }
    // status values: Pending | In progress | Partial | Completed | Canceled | Processing
    let normalized = 'processing';
    const s = (data.status || '').toLowerCase();
    if (s === 'completed')                       normalized = 'done';
    else if (s === 'canceled' || s === 'failed') normalized = 'failed';
    else if (s === 'partial')                    normalized = 'partial';

    return res.json({
      status:      normalized,
      rawStatus:   data.status || '',
      remains:     data.remains     || 0,
      start_count: data.start_count || 0,
      charge:      data.charge      || 0,
    });
  } catch (err) {
    console.error('order-status error:', err);
    return res.status(500).json({ error: 'Không thể kiểm tra trạng thái.' });
  }
};
