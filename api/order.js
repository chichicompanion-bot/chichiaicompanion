// Vercel Serverless Function — Đặt đơn SMM qua panel API
// Cần set trong Vercel dashboard → Settings → Environment Variables:
//   SMM_PANEL_URL = https://your-panel.com/api/v2
//   SMM_PANEL_KEY = your_api_key_here
//
// Đăng ký panel tại: smmviet.com / bufflike.app / justanotherpanel.com
// Sau khi đăng ký, vào API → lấy Key và URL

// Map service ID của ChiChi AI → service ID của SMM panel
// Vào panel → Services → copy ID số tương ứng rồi thay vào đây
const SERVICE_MAP = {
  // ── Facebook ──────────────────────────────────────────────
  fb_like:       process.env.SVC_FB_LIKE       || null,
  fb_follow:     process.env.SVC_FB_FOLLOW     || null,
  fb_share:      process.env.SVC_FB_SHARE      || null,
  fb_comment:    process.env.SVC_FB_COMMENT    || null,
  fb_livestream: process.env.SVC_FB_LIVESTREAM || null,
  fb_group:      process.env.SVC_FB_GROUP      || null,
  fb_checkin:    process.env.SVC_FB_CHECKIN    || null,
  fb_react:      process.env.SVC_FB_REACT      || null,
  fb_review5s:   process.env.SVC_FB_REVIEW5S   || null,
  fb_video_view: process.env.SVC_FB_VIDEO_VIEW || null,

  // ── Instagram ─────────────────────────────────────────────
  ig_like:       process.env.SVC_IG_LIKE       || null,
  ig_follow:     process.env.SVC_IG_FOLLOW     || null,
  ig_view_story: process.env.SVC_IG_VIEW_STORY || null,
  ig_view_reel:  process.env.SVC_IG_VIEW_REEL  || null,
  ig_comment:    process.env.SVC_IG_COMMENT    || null,
  ig_save:       process.env.SVC_IG_SAVE       || null,
  ig_share:      process.env.SVC_IG_SHARE      || null,
  ig_live_view:  process.env.SVC_IG_LIVE_VIEW  || null,

  // ── TikTok ────────────────────────────────────────────────
  tt_like:       process.env.SVC_TT_LIKE       || null,
  tt_follow:     process.env.SVC_TT_FOLLOW     || null,
  tt_view:       process.env.SVC_TT_VIEW       || null,
  tt_comment:    process.env.SVC_TT_COMMENT    || null,
  tt_share:      process.env.SVC_TT_SHARE      || null,
  tt_live:       process.env.SVC_TT_LIVE       || null,
  tt_save:       process.env.SVC_TT_SAVE       || null,
  tt_duet:       process.env.SVC_TT_DUET       || null,

  // ── YouTube ───────────────────────────────────────────────
  yt_view:       process.env.SVC_YT_VIEW       || null,
  yt_like:       process.env.SVC_YT_LIKE       || null,
  yt_sub:        process.env.SVC_YT_SUB        || null,
  yt_watchtime:  process.env.SVC_YT_WATCHTIME  || null,
  yt_comment:    process.env.SVC_YT_COMMENT    || null,
  yt_share:      process.env.SVC_YT_SHARE      || null,
  yt_short_view: process.env.SVC_YT_SHORT_VIEW || null,

  // ── Twitter ───────────────────────────────────────────────
  tw_like:       process.env.SVC_TW_LIKE       || null,
  tw_follow:     process.env.SVC_TW_FOLLOW     || null,
  tw_retweet:    process.env.SVC_TW_RETWEET    || null,
  tw_view:       process.env.SVC_TW_VIEW       || null,
  tw_reply:      process.env.SVC_TW_REPLY      || null,
  tw_bookmark:   process.env.SVC_TW_BOOKMARK   || null,

  // ── Tick xanh (nếu panel hỗ trợ) ─────────────────────────
  tx_fb:         process.env.SVC_TX_FB         || null,
  tx_ig:         process.env.SVC_TX_IG         || null,
  tx_tt:         process.env.SVC_TX_TT         || null,
  tx_yt_silver:  process.env.SVC_TX_YT_SILVER  || null,
  tx_yt_gold:    process.env.SVC_TX_YT_GOLD    || null,
  tx_tw:         process.env.SVC_TX_TW         || null,
  tx_zalo:       process.env.SVC_TX_ZALO       || null,

  // ── SEO ───────────────────────────────────────────────────
  seo_traffic:   process.env.SVC_SEO_TRAFFIC   || null,
  seo_google:    process.env.SVC_SEO_GOOGLE    || null,
  seo_backlink:  process.env.SVC_SEO_BACKLINK  || null,
  seo_gmaps:     process.env.SVC_SEO_GMAPS     || null,
  seo_youtube:   process.env.SVC_SEO_YOUTUBE   || null,

  // ── Review ────────────────────────────────────────────────
  rv_shopee:     process.env.SVC_RV_SHOPEE     || null,
  rv_lazada:     process.env.SVC_RV_LAZADA     || null,
  rv_tiki:       process.env.SVC_RV_TIKI       || null,
  rv_grab:       process.env.SVC_RV_GRAB       || null,
  rv_google:     process.env.SVC_RV_GOOGLE     || null,
  rv_foody:      process.env.SVC_RV_FOODY      || null,
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { svcId, link, qty } = req.body || {};

  if (!svcId || !link || !qty) {
    return res.status(400).json({ status: 'error', message: 'Thiếu thông tin đơn hàng.' });
  }

  const PANEL_URL = process.env.SMM_PANEL_URL;
  const PANEL_KEY = process.env.SMM_PANEL_KEY;

  if (!PANEL_URL || !PANEL_KEY) {
    return res.status(500).json({ status: 'error', message: 'Hệ thống chưa được cấu hình. Liên hệ admin.' });
  }

  const panelServiceId = SERVICE_MAP[svcId];
  if (!panelServiceId) {
    return res.status(400).json({ status: 'error', message: `Dịch vụ "${svcId}" chưa được kích hoạt. Liên hệ admin.` });
  }

  try {
    const params = new URLSearchParams({
      key:      PANEL_KEY,
      action:   'add',
      service:  panelServiceId,
      link:     link,
      quantity: String(qty),
    });

    const response = await fetch(PANEL_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const data = await response.json();

    if (data.error) {
      console.error('SMM Panel error:', data.error);
      return res.status(400).json({ status: 'error', message: data.error });
    }

    if (!data.order) {
      console.error('SMM Panel unexpected response:', data);
      return res.status(500).json({ status: 'error', message: 'Lỗi từ nhà cung cấp dịch vụ.' });
    }

    return res.json({ status: 'ok', panelOrderId: data.order });
  } catch (err) {
    console.error('SMM Panel fetch error:', err);
    return res.status(500).json({ status: 'error', message: 'Không thể kết nối đến nhà cung cấp dịch vụ.' });
  }
};
