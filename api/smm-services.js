// Vercel Serverless Function — Lấy danh sách dịch vụ từ SMM Panel
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const PANEL_URL = process.env.SMM_PANEL_URL;
  const PANEL_KEY = process.env.SMM_PANEL_KEY;

  if (!PANEL_URL || !PANEL_KEY) {
    return res.status(500).json({ error: 'Chưa cấu hình SMM_PANEL_URL / SMM_PANEL_KEY trong Vercel.' });
  }

  try {
    const params = new URLSearchParams({ key: PANEL_KEY, action: 'services' });
    const response = await fetch(PANEL_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error('smm-services error:', err);
    return res.status(500).json({ error: 'Không thể kết nối panel.' });
  }
};
