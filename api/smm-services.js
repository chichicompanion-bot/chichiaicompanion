// Vercel Serverless Function — Lấy danh sách dịch vụ từ SMM Panel
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const PANEL_URL = process.env.SMM_PANEL_URL;
  const PANEL_KEY = process.env.SMM_PANEL_KEY;

  if (!PANEL_URL || !PANEL_KEY) {
    return res.status(200).json({
      error: 'ENV_MISSING',
      message: 'Chưa có SMM_PANEL_URL hoặc SMM_PANEL_KEY trong Vercel Environment Variables.',
    });
  }

  try {
    const params = new URLSearchParams({ key: PANEL_KEY, action: 'services' });
    const response = await fetch(PANEL_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
      signal:  AbortSignal.timeout(15000),
    });

    const raw = await response.text();

    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      return res.status(200).json({
        error: 'PARSE_ERROR',
        message: 'Panel trả về dữ liệu không phải JSON.',
        raw: raw.slice(0, 500),
      });
    }

    if (Array.isArray(data)) {
      return res.json(data);
    }

    // Panel trả về object lỗi
    return res.status(200).json({
      error: 'PANEL_ERROR',
      message: data.error || JSON.stringify(data),
    });
  } catch (err) {
    return res.status(200).json({
      error: 'FETCH_ERROR',
      message: err.message,
    });
  }
};
