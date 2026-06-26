(function () {
  // 商戶權限已改由 assets/merchant.js 內的 merchantUids 控制。
  // 此檔只保留向下相容，請不要再用 emailAllowlist 授權商戶。
  window.ONLINE_SHOP_MERCHANT_CONFIG = {
    emailAllowlist: []
  };

  window.ONLINE_SHOP_MERCHANT_EMAIL_ALLOWLIST = window.ONLINE_SHOP_MERCHANT_CONFIG.emailAllowlist;
  window.MERCHANT_EMAIL_ALLOWLIST = window.ONLINE_SHOP_MERCHANT_EMAIL_ALLOWLIST;
})();
