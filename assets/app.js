(function () {
  const CART_KEY = "onlineShopCart";
  const CHECKOUT_DRAFT_KEY = "onlineShopCheckoutDraft";
  const LEGACY_USERS_KEY = "onlineShopUsers";
  const products = Array.isArray(window.ONLINE_SHOP_PRODUCTS) ? window.ONLINE_SHOP_PRODUCTS : [];
  const siteConfig = window.ONLINE_SHOP_SITE_CONFIG || {};
  const currencyConfig = siteConfig.currency || { symbol: "HK$", freeShippingThreshold: 3000 };
  const FREE_SHIPPING_THRESHOLD = Number(currencyConfig.freeShippingThreshold || 3000);
  const state = {
    cart: [],
    drawer: null,
    toastTimer: null,
    authMode: "login",
    authEntryRequested: false,
    authEntryMode: "login",
    authRedirect: "",
    authInviteToken: "",
    authPendingInvite: null,
    authTab: "email",
    authBusy: false,
    authPendingAction: "",
    currentUser: null,
    currentUserProfile: null,
    currentUserOrders: [],
    orderConfirmation: null,
    priceMin: 0,
    priceMax: 0,
    priceLimit: 0,
    sort: "relevant"
  };
  let currentUserProfileUnsub = null;
  let currentUserOrdersUnsub = null;
  const AUTH_NOTICE_KEY = "onlineShopAuthNotice";
  const BACKOFFICE_ROLES = ["super_admin", "admin", "staff"];

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function formatPrice(price) {
    return `${currencyConfig.symbol || "HK$"}${Number(price || 0).toFixed(2)}`;
  }

  function formatDateTime(value) {
    if (!value) return "未提供";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("zh-HK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderCurrencyText() {
    $$("[data-free-shipping-announcement]").forEach((node) => {
      node.textContent = `滿 ${formatPrice(FREE_SHIPPING_THRESHOLD)} 免運費`;
    });
  }

  function rootPrefix() {
    return document.body?.dataset.rootPrefix || "";
  }

  function productUrl(productId) {
    return `${rootPrefix()}product.html?id=${encodeURIComponent(productId)}`;
  }

  function listUrl() {
    return document.body?.dataset.listUrl || `${rootPrefix()}collections/home-fragrance/`;
  }

  function homeUrl() {
    return `${rootPrefix()}index.html`;
  }

  function queueAuthNotice(message) {
    try {
      window.sessionStorage.setItem(AUTH_NOTICE_KEY, String(message || ""));
    } catch (error) {
      console.warn("無法暫存登入提示", error);
    }
  }

  function consumeAuthNotice() {
    try {
      const message = window.sessionStorage.getItem(AUTH_NOTICE_KEY);
      if (!message) return;
      window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
      showToast(message);
    } catch (error) {
      console.warn("無法顯示登入提示", error);
    }
  }

  function merchantDashboardUrl() {
    return `${rootPrefix()}merchant-dashboard.html`;
  }

  function profileUrl(tab = "profile") {
    const normalizedTab = ["profile", "orders", "security"].includes(tab) ? tab : "profile";
    return `${rootPrefix()}profile.html?tab=${encodeURIComponent(normalizedTab)}`;
  }

  function cartUrl() {
    return `${rootPrefix()}cart.html`;
  }

  function checkoutUrl() {
    return `${rootPrefix()}checkout.html`;
  }

  function orderConfirmationUrl(orderId) {
    return `${rootPrefix()}order-confirmation.html?order=${encodeURIComponent(String(orderId || ""))}`;
  }

  function getOrderIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("order") || "").trim();
  }

  function getProfileTabFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tab = String(params.get("tab") || "profile").trim();
    return ["profile", "orders", "security"].includes(tab) ? tab : "profile";
  }

  function isStorePreviewGuest() {
    return new URLSearchParams(window.location.search).get("preview") === "store";
  }

  function isBackofficeRole(roleValue) {
    return BACKOFFICE_ROLES.includes(String(roleValue || "").trim());
  }

  function isActiveBackofficeUser(role) {
    return Boolean(role && role.active === true && isBackofficeRole(role.role));
  }

  function initAuthEntryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const auth = String(params.get("auth") || "").trim();
    const redirect = String(params.get("redirect") || "").trim();
    const invite = String(params.get("invite") || "").trim();
    if (redirect) state.authRedirect = redirect;
    if (invite) state.authInviteToken = invite;
    if (auth === "login" || auth === "register") {
      state.authEntryRequested = true;
      state.authEntryMode = auth === "register" ? "register" : "login";
    }
    if (invite && !auth) {
      state.authEntryRequested = true;
      state.authEntryMode = "register";
    }
    if (!auth && !redirect && !invite) return;
    params.delete("auth");
    params.delete("redirect");
    params.delete("invite");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function findProduct(productId) {
    return products.find((product) => product.id === productId);
  }

  function getProductImages(product) {
    return (Array.isArray(product?.images) ? product.images : [])
      .map((image) => String(image || "").trim())
      .filter(Boolean)
      .filter((image, index, list) => list.indexOf(image) === index);
  }

  function getProductPrimaryImage(product) {
    const images = getProductImages(product);
    return images[0] || "";
  }

  function getProductSecondaryImage(product) {
    const images = getProductImages(product);
    return images[1] || images[0] || "";
  }

  function getProductDescriptions(product) {
    return (Array.isArray(product?.description) ? product.description : [product?.description])
      .map((paragraph) => String(paragraph || "").trim())
      .filter(Boolean);
  }

  function getProductCategories(product) {
    const store = window.ONLINE_SHOP_PRODUCT_ADMIN_STORE;
    if (!store?.productCategoryLabels) return [];
    const publicCategories = (store.loadCategories?.() || []).filter((category) => category.id !== store.uncategorizedId);
    return store.productCategoryLabels(product, publicCategories);
  }

  function getProductCategoryAssignments(product) {
    return (Array.isArray(product?.category) ? product.category : [])
      .filter((assignment) => assignment && typeof assignment === "object" && assignment.categoryId)
      .map((assignment) => ({
        categoryId: String(assignment.categoryId),
        subcategoryIds: (assignment.subcategoryIds || []).map(String)
      }));
  }

  function getProductStock(product) {
    return Math.max(0, Number.parseInt(product?.stock, 10) || 0);
  }

  function getProductOrderStatus(product) {
    return product?.orderStatus === "preorder" ? "preorder" : "in-stock";
  }

  function renderProductImageStack(product) {
    const images = getProductImages(product);

    return `
        <div class="product-gallery" data-product-gallery>
          <div class="product-gallery__thumbs" aria-label="商品圖片導覽">
            ${images.map((image, index) => `
              <button class="thumb ${index === 0 ? "is-active" : ""}" type="button" data-scroll-to-image="${index}" aria-label="顯示商品圖片 ${index + 1}" aria-controls="product-image-${index}" aria-pressed="${index === 0 ? "true" : "false"}">
                <img src="${escapeHtml(image)}" alt="">
              </button>
            `).join("")}
          </div>
          <div class="product-gallery__stack">
            ${images.map((image, index) => `
              <figure class="product-gallery__item" id="product-image-${index}" data-product-image-index="${index}">
                <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)} 圖片 ${index + 1}">
              </figure>
            `).join("")}
          </div>
        </div>
    `;
  }

  function updateActiveProductImage(index) {
    const gallery = $("[data-product-gallery]");
    if (!gallery) return;
    $$(".thumb", gallery).forEach((button) => {
      const isActive = Number(button.dataset.scrollToImage) === Number(index);
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function scrollToProductImage(index) {
    const target = $(`[data-product-image-index="${index}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    updateActiveProductImage(index);
  }

  function setupProductImageObserver() {
    const gallery = $("[data-product-gallery]");
    if (!gallery || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visibleEntry) return;
      updateActiveProductImage(visibleEntry.target.dataset.productImageIndex);
    }, {
      threshold: [0.35, 0.55, 0.75],
      rootMargin: "-18% 0px -45% 0px"
    });

    $$("[data-product-image-index]", gallery).forEach((item) => observer.observe(item));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function textToHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function showToast(message) {
    const toast = $(".toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2000);
  }

  function openDrawer(name) {
    closeDrawer();
    const drawer = $(`#${name}-drawer`);
    const backdrop = $(".drawer-backdrop");
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop?.classList.add("is-visible");
    state.drawer = drawer;

    if (name === "filters") {
      hydrateFilterDrawer(drawer);
    }
  }

  function closeDrawer() {
    if (state.drawer) {
      state.drawer.classList.remove("is-open");
      state.drawer.setAttribute("aria-hidden", "true");
    }
    $(".drawer-backdrop")?.classList.remove("is-visible");
    state.drawer = null;
  }

  function ensureAuthModal() {
    if ($("#authModal")) return;
    const modal = document.createElement("div");
    modal.id = "authModal";
    modal.className = "auth-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="auth-modal__overlay" data-close-auth-modal></div>
      <div class="auth-modal__panel" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
        <button class="auth-modal__close" type="button" data-close-auth-modal aria-label="關閉登入 / 註冊視窗">×</button>
        <div class="auth-modal__content"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function ensureAccountMenu() {
    if ($("#authAccountMenu")) return;
    const menu = document.createElement("div");
    menu.id = "authAccountMenu";
    menu.className = "auth-account-menu";
    menu.setAttribute("aria-hidden", "true");
    document.body.appendChild(menu);
  }

  function setCurrentUserFromFirebase(user) {
    state.currentUser = isStorePreviewGuest() ? null : user || null;
    if (!state.currentUser) {
      state.currentUserProfile = null;
      state.currentUserOrders = [];
      closeAccountMenu();
    }
    updateAuthNav();
  }

  function currentUserLabel(user = state.currentUser) {
    return user?.displayName || user?.email || "?";
  }

  function currentUserLabel(user = state.currentUser) {
    return state.currentUserProfile?.displayName || user?.displayName || user?.email || "我的帳戶";
  }

  function updateAuthNav() {
    const label = state.currentUser ? "我的帳戶" : "登入 / 註冊";
    $$(".account-link").forEach((link) => {
      link.textContent = label;
      link.href = "#login";
      link.dataset.authTrigger = "true";
      link.setAttribute("role", "button");
      link.setAttribute("aria-haspopup", state.currentUser ? "menu" : "dialog");
      link.setAttribute("aria-expanded", "false");
    });
  }

  function closeAccountMenu() {
    const menu = $("#authAccountMenu");
    if (!menu) return;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    $$(".account-link").forEach((link) => link.setAttribute("aria-expanded", "false"));
  }

  function toggleAccountMenu(anchor) {
    ensureAccountMenu();
    const menu = $("#authAccountMenu");
    if (!state.currentUser || !anchor) return;

    if (menu.classList.contains("is-open")) {
      closeAccountMenu();
      return;
    }

    const rect = anchor.getBoundingClientRect();
    menu.innerHTML = `
      <p>帳戶</p>
      <strong>${escapeHtml(currentUserLabel())}</strong>
      <a href="${profileUrl("profile")}">我的帳戶</a>
      <a href="${profileUrl("orders")}">訂單記錄</a>
      <button type="button" data-auth-logout>登出</button>
    `;
    menu.style.top = `${Math.round(rect.bottom + 12)}px`;
    menu.style.left = `${Math.round(Math.min(rect.left, window.innerWidth - 220))}px`;
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    anchor.setAttribute("aria-expanded", "true");
  }

  function getFirebaseService() {
    if (!window.onlineShopFirebaseReady) {
      return Promise.reject(new Error("Firebase 服務尚未準備完成"));
    }
    return window.onlineShopFirebaseReady;
  }

  function normalizeFirebaseUser(user) {
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      providerId: user.providerData?.[0]?.providerId || "firebase"
    };
  }

  function firebaseAuthMessage(error) {
    const code = String(error?.code || "");
    const messages = {
      "auth/email-already-in-use": "此電郵已被註冊",
      "auth/invalid-email": "電郵格式不正確",
      "auth/weak-password": "密碼至少需要 6 個字元",
      "auth/missing-password": "請輸入密碼",
      "auth/invalid-credential": "帳號或密碼不正確",
      "auth/user-not-found": "帳號或密碼不正確",
      "auth/wrong-password": "帳號或密碼不正確",
      "auth/popup-closed-by-user": "Google 登入視窗已被關閉",
      "auth/popup-blocked": "瀏覽器封鎖了 Google 登入視窗，請允許彈出視窗後再試",
      "auth/unauthorized-domain": "此網域尚未加入 Firebase 授權網域",
      "auth/operation-not-allowed": "請先在 Firebase Console 啟用此登入方式",
      "auth/too-many-requests": "嘗試次數過多，請稍後再試",
      "auth/network-request-failed": "網絡連線失敗，請檢查網絡後再試",
      "auth/operation-not-supported-in-this-environment": "目前環境不支援這個登入方式"
    };
    return messages[code] || "登入失敗，請稍後再試";
  }

  function setAuthBusy(isBusy) {
    state.authBusy = Boolean(isBusy);
    $$("[data-auth-submit], [data-auth-social], [data-auth-reset]", $("#authModal") || document).forEach((button) => {
      button.disabled = state.authBusy;
    });
    if (!state.authBusy) updateAuthSubmitState();
  }


  async function initFirebaseAuth() {
    try {
      const firebase = await getFirebaseService();
      firebase.onAuthStateChanged(firebase.auth, async (user) => {
        const normalizedUser = normalizeFirebaseUser(user);
        if (currentUserProfileUnsub) {
          currentUserProfileUnsub();
          currentUserProfileUnsub = null;
        }
        if (currentUserOrdersUnsub) {
          currentUserOrdersUnsub();
          currentUserOrdersUnsub = null;
        }
        if (!user) {
          state.currentUserProfile = null;
          state.currentUserOrders = [];
          setCurrentUserFromFirebase(null);
          renderProfilePage();
          renderCheckoutPage();
          renderOrderConfirmationPage();
          if (document.body?.dataset.page === "checkout") {
            window.location.replace(`${rootPrefix()}index.html?auth=login&redirect=checkout`);
            return;
          }
          if (state.authEntryRequested) {
            state.authEntryRequested = false;
            openAuthModal(state.authEntryMode || "login");
          }
          return;
        }

        let merchantRole = null;
        let profile = null;
        try {
          merchantRole = await firebase.getMerchantRole?.(user.uid);
          await firebase.upsertCurrentUserProfile?.(user, merchantRole);
          profile = await firebase.getUserProfile?.(user.uid);
        } catch (error) {
          console.warn("\u540c\u6b65\u6703\u54e1\u8cc7\u6599\u5931\u6557\u3002", error);
        }

        const userRole = String(profile?.role || "").trim();
        const effectiveBackofficeRole = isActiveBackofficeUser(merchantRole)
          ? merchantRole
          : { role: userRole, active: profile?.status !== "blocked" };
        const canUseDashboard = isActiveBackofficeUser(effectiveBackofficeRole);

        if (profile?.status === "blocked") {
          state.authPendingAction = "";
          queueAuthNotice("\u767b\u5165\u5931\u6557 \u60a8\u7684\u8cec\u865f\u5df2\u88ab\u5c01\u9396");
          try {
            await firebase.signOut(firebase.auth);
          } catch (error) {
            console.warn("\u5c01\u9396\u5e33\u6236\u81ea\u52d5\u767b\u51fa\u5931\u6557\u3002", error);
          }
          state.currentUserProfile = null;
          state.currentUserOrders = [];
          setCurrentUserFromFirebase(null);
          renderProfilePage();
          window.location.replace(homeUrl());
          return;
        }

        state.currentUserProfile = profile || null;
        setCurrentUserFromFirebase(normalizedUser);

        currentUserProfileUnsub = firebase.listenUserProfile?.(user.uid, async (nextProfile) => {
          state.currentUserProfile = nextProfile || null;
          renderProfilePage();
          if (!nextProfile || nextProfile.status !== "blocked") return;
          state.authPendingAction = "";
          queueAuthNotice("\u767b\u5165\u5931\u6557 \u60a8\u7684\u8cec\u865f\u5df2\u88ab\u5c01\u9396");
          try {
            await firebase.signOut(firebase.auth);
          } catch (error) {
            console.warn("\u5c01\u9396\u5e33\u6236\u5373\u6642\u767b\u51fa\u5931\u6557\u3002", error);
          }
          state.currentUserProfile = null;
          state.currentUserOrders = [];
          setCurrentUserFromFirebase(null);
          renderProfilePage();
          window.location.replace(homeUrl());
        });

        if (normalizedUser && state.authRedirect === "merchant-dashboard" && canUseDashboard) {
          state.authRedirect = "";
          if (state.authPendingAction) {
            state.authPendingAction = "";
            closeAuthModal();
          }
          window.location.replace(merchantDashboardUrl());
          return;
        }

        if (document.body?.dataset.page === "profile" && canUseDashboard) {
          window.location.replace(merchantDashboardUrl());
          return;
        }

        if (normalizedUser && canUseDashboard && !isStorePreviewGuest() && !["merchant", "merchant-dashboard", "profile"].includes(document.body?.dataset.page || "")) {
          if (state.authPendingAction) {
            state.authPendingAction = "";
            closeAuthModal();
          }
          window.location.replace(merchantDashboardUrl());
          return;
        }

        if (normalizedUser && state.authRedirect === "profile") {
          state.authRedirect = "";
          closeAuthModal();
          window.location.replace(profileUrl("profile"));
          return;
        }

        if (normalizedUser && state.authRedirect === "checkout") {
          state.authRedirect = "";
          closeAuthModal();
          window.location.replace(checkoutUrl());
          return;
        }

        if (document.body?.dataset.page === "profile") {
          currentUserOrdersUnsub = firebase.listenCurrentUserOrders?.(
            user.uid,
            user.email || "",
            (orders) => {
              state.currentUserOrders = Array.isArray(orders) ? orders : [];
              renderProfilePage();
            },
            () => {
              state.currentUserOrders = [];
              renderProfilePage();
            }
          );
        }

        if (state.authPendingAction) {
          const pendingAction = state.authPendingAction;
          state.authPendingAction = "";
          closeAuthModal();
          showToast(pendingAction === "register" ? "\u8a3b\u518a\u6210\u529f\uff0c\u5df2\u70ba\u4f60\u767b\u5165\u3002" : "\u767b\u5165\u6210\u529f\u3002");
        }

        renderProfilePage();
        renderCheckoutPage();
        renderOrderConfirmationPage();
      });
    } catch (error) {
      console.error("Firebase Authentication \u521d\u59cb\u5316\u5931\u6557\u3002", error);
      setCurrentUserFromFirebase(null);
    }
  }

  function setAuthMessage(message, type = "info") {
    const messageNode = $(".auth-message");
    if (!messageNode) return;
    messageNode.textContent = message;
    messageNode.dataset.type = type;
  }

  function authRequiredValues() {
    if (state.authMode === "register") {
      return [$(".auth-field-email")?.value, $(".auth-field-password")?.value, $(".auth-field-confirm")?.value];
    }
    return [$(".auth-field-email")?.value, $(".auth-field-password")?.value];
  }

  function updateAuthSubmitState() {
    const button = $(".auth-submit");
    if (!button) return;
    button.disabled = state.authBusy || authRequiredValues().some((value) => !String(value || "").trim());
  }

  function renderAuthFields() {
    const submitText = state.authMode === "login" ? "登入" : "註冊";
    const socialText = state.authMode === "login" ? "登入" : "註冊 / 登入";

    return `
      <p class="auth-field-label">請輸入你的帳戶資料</p>
      <label class="auth-input">
        <input class="auth-field-email" type="email" autocomplete="email" placeholder="電郵地址">
      </label>
      <label class="auth-input">
        <input class="auth-field-password" type="password" autocomplete="${state.authMode === "login" ? "current-password" : "new-password"}" placeholder="撖Ⅳ">
      </label>
      ${state.authMode === "register" ? `
        <label class="auth-input">
          <input class="auth-field-confirm" type="password" autocomplete="new-password" placeholder="確認密碼">
        </label>
      ` : `
        <button class="auth-text-button auth-forgot" type="button" data-auth-reset>忘記密碼？</button>
      `}
      <button class="auth-submit" type="button" data-auth-submit disabled>${submitText}</button>
      <div class="auth-divider"><span>或使用以下方式</span></div>
      <button class="auth-social" type="button" data-auth-social="google">使用 Google ${socialText}</button>
    `;
  }

  function renderAuthModal() {
    ensureAuthModal();
    const title = state.authMode === "login" ? "登入 / 註冊" : "建立帳戶";
    const switchText = state.authMode === "login" ? "還沒有帳戶？" : "已經有帳戶？";
    const switchTarget = state.authMode === "login" ? "register" : "login";
    const switchLabel = state.authMode === "login" ? "建立帳戶" : "登入";

    $(".auth-modal__content").innerHTML = `
      <h2 id="authModalTitle">${title}</h2>
      <p class="auth-switch">${switchText}<button type="button" data-auth-mode="${switchTarget}">${switchLabel}</button></p>
      ${state.authMode === "register" ? '<p class="auth-intro">建立帳戶後即可管理個人資料與查看訂單記錄。</p>' : ""}
      <div class="auth-form" data-auth-form>
        ${renderAuthFields()}
      </div>
      <p class="auth-message" aria-live="polite"></p>
      <p class="auth-terms">繼續即表示你同意我們的<a href="#terms">服務條款</a>及<a href="#privacy">私隱政策</a>。</p>
    `;
    updateAuthSubmitState();
  }

  function openAuthModal(mode = "login") {
    closeDrawer();
    closeSearchModal();
    closeAccountMenu();
    ensureAuthModal();
    state.authMode = mode === "register" ? "register" : "login";
    state.authTab = "email";
    renderAuthModal();
    const modal = $("#authModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeAuthModal() {
    const modal = $("#authModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (!$("#searchModal")?.classList.contains("is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  function switchAuthMode(mode) {
    state.authMode = mode === "register" ? "register" : "login";
    state.authTab = "email";
    renderAuthModal();
  }

  function switchAuthTab(tab) {
    state.authTab = "email";
    renderAuthModal();
  }

  async function validateInviteForEmail(firebase, email) {
    if (!state.authInviteToken) return null;
    const invite = await firebase.getUserInvite?.(state.authInviteToken);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!invite || invite.used || invite.status !== "pending") {
      throw new Error("邀請連結無效或已失效");
    }
    if (String(invite.email || "").trim().toLowerCase() !== normalizedEmail) {
      throw new Error("註冊電郵必須與邀請電郵一致");
    }
    state.authPendingInvite = invite;
    return invite;
  }

  async function handleRegister() {
    const email = $(".auth-field-email")?.value.trim();
    const password = $(".auth-field-password")?.value;
    const confirmPassword = $(".auth-field-confirm")?.value;
    if (!email || !password || !confirmPassword) return setAuthMessage("請填寫電郵、密碼及確認密碼", "error");
    if (password !== confirmPassword) return setAuthMessage("兩次輸入的密碼不一致", "error");
    if (password.length < 6) return setAuthMessage("密碼至少需要 6 個字元", "error");

    setAuthBusy(true);
    state.authPendingAction = "register";
    setAuthMessage("正在建立帳戶...");
    try {
      const firebase = await getFirebaseService();
      await validateInviteForEmail(firebase, email);
      const credential = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
      if (state.authInviteToken) {
        const acceptedInvite = await firebase.acceptUserInvite?.(state.authInviteToken, credential.user);
        state.authInviteToken = "";
        state.authPendingInvite = null;
        if (isBackofficeRole(acceptedInvite?.role)) window.location.replace(merchantDashboardUrl());
      }
    } catch (error) {
      state.authPendingAction = "";
      setAuthMessage(error?.code ? firebaseAuthMessage(error) : error.message, "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin() {
    const email = $(".auth-field-email")?.value.trim();
    const password = $(".auth-field-password")?.value;
    if (!email || !password) return setAuthMessage("請輸入電郵和密碼", "error");

    setAuthBusy(true);
    state.authPendingAction = "login";
    setAuthMessage("正在登入...");
    try {
      const firebase = await getFirebaseService();
      await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
    } catch (error) {
      state.authPendingAction = "";
      setAuthMessage(firebaseAuthMessage(error), "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setAuthBusy(true);
    state.authPendingAction = "google";
    setAuthMessage("正在使用 Google 登入...");
    try {
      const firebase = await getFirebaseService();
      const credential = await firebase.signInWithPopup(firebase.auth, firebase.googleProvider);
      if (state.authInviteToken && state.authMode === "register") {
        try {
          await validateInviteForEmail(firebase, credential.user?.email || "");
          const acceptedInvite = await firebase.acceptUserInvite?.(state.authInviteToken, credential.user);
          state.authInviteToken = "";
          state.authPendingInvite = null;
          if (isBackofficeRole(acceptedInvite?.role)) window.location.replace(merchantDashboardUrl());
        } catch (inviteError) {
          await firebase.signOut(firebase.auth);
          throw inviteError;
        }
      }
    } catch (error) {
      state.authPendingAction = "";
      setAuthMessage(error?.code ? firebaseAuthMessage(error) : error.message, "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordReset() {
    const email = $(".auth-field-email")?.value.trim();
    if (!email) return setAuthMessage("請輸入電郵以接收重設密碼連結", "error");

    setAuthBusy(true);
    try {
      const firebase = await getFirebaseService();
      await firebase.sendPasswordResetEmail(firebase.auth, email);
      setAuthMessage("重設密碼電郵已送出，請檢查你的信箱", "success");
    } catch (error) {
      setAuthMessage(firebaseAuthMessage(error), "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    try {
      const firebase = await getFirebaseService();
      await firebase.signOut(firebase.auth);
      closeAccountMenu();
      showToast("已登出");
    } catch (error) {
      closeAccountMenu();
      showToast(firebaseAuthMessage(error));
    }
  }

  function setProfileSettingsMessage(message, type = "info") {
    const node = $("[data-profile-settings-message]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
  }

  async function handleProfileSettingsSubmit(form) {
    if (!state.currentUser) return;
    const data = new FormData(form);
    const nextEmail = String(data.get("email") || "").trim();
    const currentEmail = String(state.currentUserProfile?.email || state.currentUser?.email || "").trim();
    const saveButton = form.querySelector("[data-profile-save]");
    if (saveButton) saveButton.disabled = true;
    setProfileSettingsMessage("正在儲存個人資料...");
    try {
      const firebase = await getFirebaseService();
      if (nextEmail && nextEmail !== currentEmail) {
        await firebase.updateCurrentUserEmail?.(nextEmail);
      }
      await firebase.updateCurrentUserProfile?.({
        displayName: data.get("displayName"),
        phone: data.get("phone"),
        address: data.get("address"),
        birthday: data.get("birthday"),
        gender: data.get("gender")
      });
      setProfileSettingsMessage("個人資料已更新", "success");
      showToast("個人資料已更新");
    } catch (error) {
      setProfileSettingsMessage(firebaseAuthMessage(error), "error");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  function loadCart() {
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      state.cart = Array.isArray(parsed)
        ? parsed
            .map((item) => ({
              productId: String(item.productId || item.id || ""),
              quantity: Math.max(0, Number.parseInt(item.quantity || item.qty || 0, 10))
            }))
            .filter((item) => item.productId && item.quantity > 0 && findProduct(item.productId))
        : [];
      state.cart = state.cart
        .map((item) => {
          const product = findProduct(item.productId);
          return { ...item, quantity: Math.min(item.quantity, getProductStock(product)) };
        })
        .filter((item) => item.quantity > 0);
      window.localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch (error) {
      state.cart = [];
    }
    return state.cart;
  }

  function saveCart() {
    window.localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }

  function addToCart(productId, quantity = 1) {
    const product = findProduct(productId);
    const qty = Math.max(1, Number.parseInt(quantity, 10) || 1);
    if (!product) {
      showToast("找不到商品，請重新整理頁面");
      return;
    }
    const stock = getProductStock(product);
    if (stock <= 0) {
      showToast("此商品目前缺貨");
      return;
    }

    const existing = state.cart.find((item) => item.productId === productId);
    if (existing) {
      existing.quantity = Math.min(stock, existing.quantity + qty);
    } else {
      state.cart.push({ productId, quantity: Math.min(stock, qty) });
    }

    saveCart();
    renderCart();
    updateCartBadge();
    openDrawer("cart");
    showToast(`${product.name} 已加入購物車`);
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter((item) => item.productId !== productId);
    saveCart();
    renderCart();
    updateCartBadge();
    showToast("商品已從購物車移除");
  }

  function updateCartQuantity(productId, quantity) {
    const qty = Number.parseInt(quantity, 10) || 0;
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    const item = state.cart.find((entry) => entry.productId === productId);
    if (!item) return;
    const product = findProduct(productId);
    item.quantity = Math.min(qty, getProductStock(product));
    if (item.quantity <= 0) return removeFromCart(productId);
    saveCart();
    renderCart();
    updateCartBadge();
  }

  function clearCart() {
    state.cart = [];
    saveCart();
    renderCart();
    updateCartBadge();
    showToast("購物車已更新");
  }

  function cartTotals() {
    return state.cart.reduce(
      (totals, item) => {
        const product = findProduct(item.productId);
        if (!product) return totals;
        totals.quantity += item.quantity;
        totals.amount += getNumericPrice(product.price) * item.quantity;
        return totals;
      },
      { quantity: 0, amount: 0 }
    );
  }

  function loadCheckoutDraft() {
    const defaults = {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      recipientName: "",
      recipientPhone: "",
      deliveryMethod: "pickup",
      deliveryAddress: "",
      sameAsCustomer: false,
      note: ""
    };
    try {
      const raw = window.localStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return defaults;
      }
      return {
        customerName: typeof parsed.customerName === "string" ? parsed.customerName : "",
        customerEmail: typeof parsed.customerEmail === "string" ? parsed.customerEmail : "",
        customerPhone: typeof parsed.customerPhone === "string" ? parsed.customerPhone : "",
        recipientName: typeof parsed.recipientName === "string" ? parsed.recipientName : "",
        recipientPhone: typeof parsed.recipientPhone === "string" ? parsed.recipientPhone : "",
        deliveryMethod: parsed.deliveryMethod === "delivery" ? "delivery" : "pickup",
        deliveryAddress: typeof parsed.deliveryAddress === "string" ? parsed.deliveryAddress : "",
        sameAsCustomer: parsed.sameAsCustomer === true,
        note: typeof parsed.note === "string" ? parsed.note : ""
      };
    } catch (error) {
      return defaults;
    }
  }


  function saveCheckoutDraft(updates = {}) {
    const draft = { ...loadCheckoutDraft(), ...updates };
    window.localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
    return draft;
  }

  function clearCheckoutDraft() {
    window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
  }

  function removeCartDrawerNotes() {
    $$("#cart-drawer textarea").forEach((textarea) => textarea.remove());
  }

  function getCartLineItems() {
    return state.cart
      .map((item) => {
        const product = findProduct(item.productId);
        if (!product) return null;
        const price = getNumericPrice(product.price);
        const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
        return {
          productId: product.id,
          name: product.name,
          image: getProductPrimaryImage(product),
          option: item.option || item.color || product.option || product.color || "",
          price,
          quantity,
          subtotal: price * quantity
        };
      })
      .filter(Boolean);
  }

  function checkoutTotals(draft = loadCheckoutDraft()) {
    const items = getCartLineItems();
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = 0;
    const deliveryMethod = draft.deliveryMethod === "delivery" ? "delivery" : "pickup";
    const shippingFee = deliveryMethod === "delivery" ? 30 : 0;
    const extraFee = 0;
    return {
      items,
      subtotal,
      discount,
      deliveryMethod,
      shippingFee,
      extraFee,
      total: Math.max(0, subtotal - discount + shippingFee + extraFee)
    };
  }

  function renderCheckoutSteps(activeStep = "cart") {
    const steps = [
      { key: "cart", label: "購物車" },
      { key: "details", label: "填寫資料" },
      { key: "confirm", label: "訂單確認" }
    ];
    return `
      <ol class="checkout-steps" aria-label="結帳流程">
        ${steps.map((step, index) => `
          <li class="${step.key === activeStep ? "is-active" : ""}">
            <span>${index + 1}</span>
            <strong>${step.label}</strong>
          </li>
        `).join("")}
      </ol>
    `;
  }

  function renderCartPage() {
    const container = $("[data-cart-page]");
    if (!container) return;
    loadCart();
    const draft = loadCheckoutDraft();
    const totals = checkoutTotals(draft);
    if (!totals.items.length) {
      container.innerHTML = `
        ${renderCheckoutSteps("cart")}
        <section class="cart-page cart-page--empty">
          <h1>購物車</h1>
          <p>購物車暫時沒有商品</p>
          <a class="checkout-secondary-button" href="${listUrl()}">繼續購物</a>
        </section>
      `;
      return;
    }

    container.innerHTML = `
      ${renderCheckoutSteps("cart")}
      <section class="cart-page">
        <div class="cart-page__main">
          <h1>購物車</h1>
          <div class="cart-page__items">
            ${totals.items.map((item) => `
              <article class="cart-page-item">
                <a class="cart-page-item__image" href="${productUrl(item.productId)}">
                  <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
                </a>
                <div class="cart-page-item__content">
                  <a class="cart-page-item__title" href="${productUrl(item.productId)}">${escapeHtml(item.name)}</a>
                  ${item.option ? `<p class="cart-page-item__option">${escapeHtml(item.option)}</p>` : ""}
                  <p class="cart-page-item__price">${formatPrice(item.price)}</p>
                </div>
                <div class="cart-page-item__quantity" aria-label="${escapeHtml(item.name)} 數量">
                  <button type="button" data-cart-action="decrease" data-product-id="${escapeHtml(item.productId)}">-</button>
                  <input type="number" min="1" value="${item.quantity}" data-cart-quantity data-product-id="${escapeHtml(item.productId)}">
                  <button type="button" data-cart-action="increase" data-product-id="${escapeHtml(item.productId)}">+</button>
                </div>
                <p class="cart-page-item__subtotal">${formatPrice(item.subtotal)}</p>
                <button class="cart-page-item__remove" type="button" data-cart-action="remove" data-product-id="${escapeHtml(item.productId)}">移除</button>
              </article>
            `).join("")}
          </div>
          <label class="checkout-note">
            <span>訂單備註</span>
            <textarea rows="5" data-checkout-note placeholder="可填寫送貨或包裝備註，稍後會一併帶到結帳頁">${escapeHtml(draft.note || "")}</textarea>
          </label>
        </div>
        <aside class="cart-page__summary">
          <h2>訂單摘要</h2>
          <p><span>商品小計</span><strong>${formatPrice(totals.subtotal)}</strong></p>
          <p><span>優惠扣減</span><strong>-${formatPrice(totals.discount)}</strong></p>
          <p class="cart-page__promo">${totals.items.reduce((sum, item) => sum + item.quantity, 0) < 2 ? "再買 1 件 即享有優惠" : "暫未套用優惠"}</p>
          <p class="cart-page__total"><span>合計</span><strong>${formatPrice(totals.subtotal - totals.discount)}</strong></p>
          <button class="checkout-button cart-page__checkout" type="button" data-go-checkout>確認訂單</button>
        </aside>
      </section>
    `;
  }

  function checkoutDefaults() {
    const draft = loadCheckoutDraft();
    const profile = state.currentUserProfile || {};
    const currentUser = state.currentUser || {};
    return {
      customerName: draft.customerName || profile.displayName || currentUser.displayName || "",
      customerEmail: draft.customerEmail || profile.email || currentUser.email || "",
      customerPhone: draft.customerPhone || profile.phone || "",
      recipientName: draft.recipientName || "",
      recipientPhone: draft.recipientPhone || "",
      deliveryMethod: draft.deliveryMethod === "delivery" ? "delivery" : "pickup",
      deliveryAddress: draft.deliveryAddress || profile.address || "",
      sameAsCustomer: draft.sameAsCustomer === true,
      note: draft.note || ""
    };
  }

  function generateOrderNumber() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `ORD-${datePart}-${timePart}-${randomPart}`;
  }

  function checkoutDeliveryLabel(value) {
    return value === "delivery" ? "送貨上門" : "到店自取";
  }

  function checkoutPaymentStatusLabel(value) {
    return value === "mock_paid" ? "模擬付款成功" : String(value || "未付款");
  }

  function renderOrderConfirmation(order) {
    const container = $("[data-checkout-page]") || $("[data-order-confirmation-page]");
    if (!container || !order) return;
    container.innerHTML = `
      ${renderCheckoutSteps("confirm")}
      <section class="checkout-confirmation">
        <h1>訂單確認</h1>
        <p>感謝你的訂購，以下是本次訂單資料。</p>
        <div class="checkout-confirmation__details">
          <p><span>訂單編號</span><strong>${escapeHtml(order.orderNumber)}</strong></p>
          <p><span>合計金額</span><strong>${formatPrice(order.total)}</strong></p>
          <p><span>收件人</span><strong>${escapeHtml(order.recipientName)}</strong></p>
          <p><span>收件人電話</span><strong>${escapeHtml(order.recipientPhone)}</strong></p>
          <p><span>收貨方式</span><strong>${order.deliveryMethod === "delivery" ? "送貨上門" : "到店自取"}</strong></p>
          ${order.deliveryMethod === "delivery" ? `<p><span>收貨地址</span><strong>${escapeHtml(order.deliveryAddress)}</strong></p>` : ""}
          <p><span>付款方式</span><strong>信用卡</strong></p>
        </div>
        <div class="checkout-confirmation__actions">
          <a class="checkout-secondary-button" href="${homeUrl()}">返回首頁</a>
          <a class="checkout-button" href="${profileUrl("orders")}">查看我的訂單</a>
        </div>
      </section>
    `;
  }

  function renderOrderConfirmation(order) {
    const container = $("[data-checkout-page]") || $("[data-order-confirmation-page]");
    if (!container || !order) return;
    const items = Array.isArray(order.items) ? order.items : [];
    container.innerHTML = `
      ${renderCheckoutSteps("confirm")}
      <section class="checkout-confirmation">
        <h1>訂單確認</h1>
        <p>感謝你的訂購，以下是本次訂單資料。</p>
        <div class="checkout-confirmation__grid">
          <section>
            <h2>訂單資料</h2>
            <p class="checkout-confirmation__row"><span>訂單編號</span><strong>${escapeHtml(order.orderNumber)}</strong></p>
            <p class="checkout-confirmation__row"><span>下單時間</span><strong>${escapeHtml(formatDateTime(order.createdAt || new Date()))}</strong></p>
            <p class="checkout-confirmation__row"><span>訂單狀態</span><strong>待處理</strong></p>
          </section>
          <section>
            <h2>顧客資料</h2>
            <p class="checkout-confirmation__row"><span>顧客名稱</span><strong>${escapeHtml(order.customerName)}</strong></p>
            <p class="checkout-confirmation__row"><span>電郵</span><strong>${escapeHtml(order.customerEmail)}</strong></p>
            <p class="checkout-confirmation__row"><span>電話</span><strong>${escapeHtml(order.customerPhone)}</strong></p>
          </section>
          <section>
            <h2>收件人資料</h2>
            <p class="checkout-confirmation__row"><span>收件人</span><strong>${escapeHtml(order.recipientName)}</strong></p>
            <p class="checkout-confirmation__row"><span>收件人電話</span><strong>${escapeHtml(order.recipientPhone)}</strong></p>
            <p class="checkout-confirmation__row"><span>收貨方式</span><strong>${escapeHtml(checkoutDeliveryLabel(order.deliveryMethod))}</strong></p>
            ${order.deliveryMethod === "delivery" ? `<p class="checkout-confirmation__row"><span>收貨地址</span><strong>${escapeHtml(order.deliveryAddress)}</strong></p>` : ""}
          </section>
          <section>
            <h2>付款資料</h2>
            <p class="checkout-confirmation__row"><span>付款方式</span><strong>信用卡</strong></p>
            <p class="checkout-confirmation__row"><span>付款狀態</span><strong>${escapeHtml(checkoutPaymentStatusLabel(order.paymentStatus))}</strong></p>
            ${order.cardLast4 ? `<p class="checkout-confirmation__row"><span>卡號末四位</span><strong>**** ${escapeHtml(order.cardLast4)}</strong></p>` : ""}
          </section>
        </div>
        <section class="checkout-confirmation__items">
          <h2>購買商品</h2>
          ${items.map((item) => `
            <article>
              <span>${escapeHtml(item.name)}</span>
              <span>x ${Number(item.quantity || 0)}</span>
              <strong>${formatPrice(item.subtotal)}</strong>
            </article>
          `).join("")}
        </section>
        <section class="checkout-confirmation__totals">
          <h2>價錢明細</h2>
          <p class="checkout-confirmation__row"><span>商品小計</span><strong>${formatPrice(order.subtotal)}</strong></p>
          <p class="checkout-confirmation__row"><span>優惠扣減</span><strong>-${formatPrice(order.discount)}</strong></p>
          <p class="checkout-confirmation__row"><span>運費</span><strong>${formatPrice(order.shippingFee)}</strong></p>
          <p class="checkout-confirmation__row"><span>附加費</span><strong>${formatPrice(order.extraFee)}</strong></p>
          <p class="checkout-confirmation__row checkout-page__total"><span>合計</span><strong>${formatPrice(order.total)}</strong></p>
        </section>
        ${order.note ? `<section class="checkout-confirmation__note"><h2>訂單備註</h2><p>${textToHtml(order.note)}</p></section>` : ""}
        <div class="checkout-confirmation__actions">
          <a class="checkout-secondary-button" href="${homeUrl()}">返回首頁</a>
          <a class="checkout-button" href="${profileUrl("orders")}">查看我的訂單</a>
        </div>
      </section>
    `;
  }

  function checkoutPaymentStatusLabel(value) {
    return value === "mock_paid" ? "模擬付款成功" : String(value || "未付款");
  }

  function renderOrderConfirmationError(message) {
    const container = $("[data-order-confirmation-page]");
    if (!container) return;
    container.innerHTML = `
      ${renderCheckoutSteps("confirm")}
      <section class="checkout-confirmation">
        <h1>訂單確認</h1>
        <p class="checkout-message" data-type="error">${escapeHtml(message)}</p>
        <div class="checkout-confirmation__actions">
          <a class="checkout-secondary-button" href="${homeUrl()}">返回首頁</a>
          <a class="checkout-button" href="${cartUrl()}">返回購物車</a>
        </div>
      </section>
    `;
  }

  async function renderOrderConfirmationPage() {
    const container = $("[data-order-confirmation-page]");
    if (!container) return;
    const orderId = getOrderIdFromUrl();
    if (!orderId) {
      renderOrderConfirmationError("找不到訂單資料。");
      return;
    }
    if (!state.currentUser) {
      container.innerHTML = `
        ${renderCheckoutSteps("confirm")}
        <section class="checkout-confirmation">
          <h1>訂單確認</h1>
          <p>請先登入，然後再查看訂單確認資料。</p>
          <div class="checkout-confirmation__actions">
            <a class="checkout-button" href="${rootPrefix()}index.html?auth=login">登入 / 註冊</a>
            <a class="checkout-secondary-button" href="${homeUrl()}">返回首頁</a>
          </div>
        </section>
      `;
      return;
    }
    container.innerHTML = `
      ${renderCheckoutSteps("confirm")}
      <section class="checkout-confirmation">
        <h1>訂單確認</h1>
        <p>正在讀取訂單資料...</p>
      </section>
    `;
    try {
      const firebase = await getFirebaseService();
      const order = await firebase.getOrder(orderId);
      if (!order) {
        renderOrderConfirmationError("找不到訂單，或你沒有權限查看此訂單。");
        return;
      }
      renderOrderConfirmation(order);
    } catch (error) {
      renderOrderConfirmationError(checkoutErrorMessage(error));
    }
  }

  function renderCheckoutPage() {
    const container = $("[data-checkout-page]");
    if (!container) return;
    if (state.orderConfirmation) {
      renderOrderConfirmation(state.orderConfirmation);
      return;
    }
    loadCart();
    const defaults = checkoutDefaults();
    const totals = checkoutTotals(defaults);
    if (!state.currentUser) {
      container.innerHTML = `
        ${renderCheckoutSteps("details")}
        <section class="checkout-page checkout-page--empty">
          <h1>請先登入</h1>
          <p>提交訂單前請先登入你的帳戶。</p>
          <a class="checkout-button" href="${rootPrefix()}index.html?auth=login&redirect=checkout">登入 / 註冊</a>
        </section>
      `;
      return;
    }
    if (!totals.items.length) {
      container.innerHTML = `
        ${renderCheckoutSteps("details")}
        <section class="checkout-page checkout-page--empty">
          <h1>購物車暫時沒有商品</h1>
          <a class="checkout-secondary-button" href="${cartUrl()}">返回購物車</a>
        </section>
      `;
      return;
    }
    container.innerHTML = `
      ${renderCheckoutSteps("details")}
      <form class="checkout-page" data-checkout-form>
        <div class="checkout-page__forms">
          <section class="checkout-section">
            <h1>顧客資料</h1>
            <label>顧客名稱<input type="text" name="customerName" data-checkout-field value="${escapeHtml(defaults.customerName)}" required></label>
            <label>電郵<input type="email" name="customerEmail" data-checkout-field value="${escapeHtml(defaults.customerEmail)}" required></label>
            <label>電話<input type="tel" name="customerPhone" data-checkout-field value="${escapeHtml(defaults.customerPhone)}" required></label>
          </section>
          <section class="checkout-section">
            <h2>收件人資料</h2>
            <label class="checkout-checkbox"><input type="checkbox" name="sameAsCustomer" data-checkout-same ${defaults.sameAsCustomer ? "checked" : ""}>收件人資料與顧客資料相同</label>
            <label>收件人名稱<input type="text" name="recipientName" data-checkout-field value="${escapeHtml(defaults.sameAsCustomer ? defaults.customerName : defaults.recipientName)}" required></label>
            <label>收件人聯絡電話<input type="tel" name="recipientPhone" data-checkout-field value="${escapeHtml(defaults.sameAsCustomer ? defaults.customerPhone : defaults.recipientPhone)}" required></label>
            <label>收貨方式
              <select name="deliveryMethod" data-checkout-delivery data-checkout-field>
                <option value="pickup" ${defaults.deliveryMethod === "pickup" ? "selected" : ""}>到店自取</option>
                <option value="delivery" ${defaults.deliveryMethod === "delivery" ? "selected" : ""}>送貨上門</option>
              </select>
            </label>
            <label class="checkout-address ${defaults.deliveryMethod === "delivery" ? "" : "is-hidden"}">收貨地址<textarea name="deliveryAddress" rows="4" data-checkout-field ${defaults.deliveryMethod === "delivery" ? "required" : ""}>${escapeHtml(defaults.sameAsCustomer ? (state.currentUserProfile?.address || defaults.deliveryAddress) : defaults.deliveryAddress)}</textarea></label>
          </section>
          <section class="checkout-section">
            <h2>訂單備註</h2>
            <textarea name="note" rows="4" data-checkout-note placeholder="可填寫送貨、包裝或其他備註">${escapeHtml(defaults.note)}</textarea>
          </section>
          <section class="checkout-section">
            <h2>付款方式</h2>
            <label class="checkout-radio"><input type="radio" checked disabled>信用卡</label>
            <div class="checkout-card-grid">
              <label>卡號<input type="text" name="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" required></label>
              <label>到期日<input type="text" name="cardExpiry" autocomplete="cc-exp" placeholder="MM/YY" required></label>
              <label>安全碼<input type="password" name="cardCvc" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC" required></label>
            </div>
            <p class="checkout-helper-text">這是模擬付款流程，不會真的扣款，也不會保存完整卡號或安全碼。</p>
          </section>
        </div>
        <aside class="checkout-page__summary">
          <h2>訂單摘要</h2>
          <div class="checkout-summary-items">
            ${totals.items.map((item) => `
              <article>
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
                <div><strong>${escapeHtml(item.name)}</strong><span>x ${item.quantity}</span></div>
                <span>${formatPrice(item.subtotal)}</span>
              </article>
            `).join("")}
          </div>
          <p><span>商品小計</span><strong>${formatPrice(totals.subtotal)}</strong></p>
          <p><span>優惠扣減</span><strong>-${formatPrice(totals.discount)}</strong></p>
          <p><span>運費</span><strong>${formatPrice(totals.shippingFee)}</strong></p>
          <p><span>附加費</span><strong>${formatPrice(totals.extraFee)}</strong></p>
          <p class="checkout-page__total"><span>合計</span><strong>${formatPrice(totals.total)}</strong></p>
          <p class="checkout-message" data-checkout-message aria-live="polite"></p>
          <button class="checkout-button" type="submit" data-submit-order>提交訂單</button>
        </aside>
      </form>
    `;
  }

  function checkoutFormPayload(form) {
    const formData = new FormData(form);
    const sameAsCustomer = formData.get("sameAsCustomer") === "on";
    const customerName = String(formData.get("customerName") || "").trim();
    const customerEmail = String(formData.get("customerEmail") || "").trim();
    const customerPhone = String(formData.get("customerPhone") || "").trim();
    const cardNumber = String(formData.get("cardNumber") || "").replace(/\D/g, "");
    return {
      customerName,
      customerEmail,
      customerPhone,
      sameAsCustomer,
      recipientName: sameAsCustomer ? customerName : String(formData.get("recipientName") || "").trim(),
      recipientPhone: sameAsCustomer ? customerPhone : String(formData.get("recipientPhone") || "").trim(),
      deliveryMethod: formData.get("deliveryMethod") === "delivery" ? "delivery" : "pickup",
      deliveryAddress: sameAsCustomer
        ? String(state.currentUserProfile?.address || formData.get("deliveryAddress") || "").trim()
        : String(formData.get("deliveryAddress") || "").trim(),
      note: String(formData.get("note") || "").trim(),
      cardLast4: cardNumber.slice(-4)
    };
  }

  function setCheckoutMessage(message, type = "info") {
    const node = $("[data-checkout-message]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
  }

  function checkoutErrorMessage(error) {
    const code = String(error?.code || "");
    if (code.includes("permission-denied")) return "訂單提交失敗：目前 Firestore 權限不允許建立訂單。";
    if (code.includes("unavailable")) return "訂單提交失敗：暫時無法連線到資料庫，請稍後再試。";
    return String(error?.message || "訂單提交失敗，請稍後再試。");
  }

  async function handleCheckoutSubmit(form) {
    if (!state.currentUser) {
      window.location.href = `${rootPrefix()}index.html?auth=login&redirect=checkout`;
      return;
    }
    const submitButton = form.querySelector("[data-submit-order]");
    const payload = checkoutFormPayload(form);
    saveCheckoutDraft(payload);
    const totals = checkoutTotals(payload);
    if (!totals.items.length) {
      setCheckoutMessage("購物車暫時沒有商品", "error");
      return;
    }
    if (!payload.customerName || !payload.customerEmail || !payload.customerPhone) {
      setCheckoutMessage("請填寫完整顧客資料", "error");
      return;
    }
    if (!payload.recipientName || !payload.recipientPhone) {
      setCheckoutMessage("請填寫完整收件人資料", "error");
      return;
    }
    if (payload.deliveryMethod === "delivery" && !payload.deliveryAddress) {
      setCheckoutMessage("送貨上門必須填寫收貨地址", "error");
      return;
    }
    try {
      if (submitButton) submitButton.disabled = true;
      setCheckoutMessage("正在提交訂單...");
      const firebase = await getFirebaseService();
      const orderData = {
        orderNumber: generateOrderNumber(),
        customerUid: state.currentUser.uid,
        customerEmail: payload.customerEmail,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        recipientName: payload.recipientName,
        recipientPhone: payload.recipientPhone,
        deliveryMethod: payload.deliveryMethod,
        deliveryAddress: payload.deliveryAddress,
        items: totals.items,
        subtotal: totals.subtotal,
        discount: totals.discount,
        shippingFee: totals.shippingFee,
        extraFee: totals.extraFee,
        total: totals.total,
        paymentMethod: "credit_card",
        paymentStatus: "mock_paid",
        cardLast4: payload.cardLast4,
        status: "pending",
        note: payload.note
      };
      const createdOrder = await firebase.createOrder(orderData);
      state.orderConfirmation = { ...orderData, id: createdOrder.id, createdAt: new Date().toISOString() };
      state.cart = [];
      saveCart();
      clearCheckoutDraft();
      renderCart();
      updateCartBadge();
      window.location.href = orderConfirmationUrl(createdOrder.id);
    } catch (error) {
      setCheckoutMessage(checkoutErrorMessage(error), "error");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function renderCart() {
    removeCartDrawerNotes();
    const totals = cartTotals();

    $$(".cart-items").forEach((container) => {
      if (!state.cart.length) {
        container.innerHTML = '<p class="empty-cart">購物車暫時沒有商品</p>';
        return;
      }

      container.innerHTML = state.cart
        .map((item) => {
          const product = findProduct(item.productId);
          if (!product) return "";
          const subtotal = product.price * item.quantity;
          const stock = getProductStock(product);
          return `
            <article class="cart-item">
              <a class="cart-item-image" href="${productUrl(product.id)}">
                <img src="${escapeHtml(getProductPrimaryImage(product))}" alt="${escapeHtml(product.name)}">
              </a>
              <div class="cart-item-body">
                <a class="cart-item-title" href="${productUrl(product.id)}">${escapeHtml(product.name)}</a>
                <p>單價：${formatPrice(product.price)}</p>
                <div class="cart-line-actions" aria-label="${escapeHtml(product.name)} 數量">
                  <button type="button" data-cart-action="decrease" data-product-id="${product.id}" aria-label="減少數量">-</button>
                  <input type="number" min="0" max="${stock}" value="${item.quantity}" data-cart-quantity data-product-id="${product.id}" aria-label="商品數量">
                  <button type="button" data-cart-action="increase" data-product-id="${product.id}" aria-label="增加數量" ${item.quantity >= stock ? "disabled" : ""}>+</button>
                </div>
                <p class="cart-item-subtotal">小計：${formatPrice(subtotal)}</p>
                <button class="cart-remove" type="button" data-cart-action="remove" data-product-id="${product.id}">移除</button>
              </div>
            </article>
          `;
        })
        .join("");
    });

    $$(".cart-total-quantity").forEach((node) => {
      node.textContent = String(totals.quantity);
    });
    $$(".cart-total-amount").forEach((node) => {
      node.textContent = formatPrice(totals.amount);
    });
    $$("#cart-drawer .checkout-button").forEach((button) => {
      button.textContent = totals.amount ? `前往結帳 ${formatPrice(totals.amount)}` : "前往結帳";
    });
    $$(".shipping-progress").forEach((node) => {
      const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - totals.amount);
      node.textContent = remaining > 0
        ? `再買 ${formatPrice(remaining)} 即享免運費`
        : "已達免運門檻";
    });
    refreshCheckoutSurfaces();
  }

  function refreshCheckoutSurfaces() {
    renderCartPage();
    if (!state.orderConfirmation) renderCheckoutPage();
  }

  function updateCartBadge() {
    const totals = cartTotals();
    $$(".cart-count").forEach((node) => {
      node.textContent = String(totals.quantity);
    });
  }

  function renderProductGrid(items = products, targetGrid = null, emptyMessage = "沒有符合條件的商品") {
    const grid = targetGrid || $("[data-products-grid]");
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = `<p class="filter-empty" role="status">${escapeHtml(emptyMessage)}</p>`;
      return;
    }

    // ??泵???隞嗥???銝甈⊿＊蝷綽?銝脰??????
    grid.innerHTML = items
      .map((product) => {
        const index = products.findIndex((item) => item.id === product.id);
        const primaryImage = getProductPrimaryImage(product);
        const secondaryImage = getProductSecondaryImage(product);
        const stock = getProductStock(product);
        return `
        <article class="product-card" data-index="${index}" data-category="${escapeHtml(getProductCategories(product).join("|"))}" data-price="${product.price}" data-name="${escapeHtml(product.name)}">
          <a class="product-image-link product-card__image-wrap" href="${productUrl(product.id)}" aria-label="查看 ${escapeHtml(product.name)}">
            <img class="product-card__image product-card__image--primary" src="${escapeHtml(primaryImage)}" alt="${escapeHtml(product.name)}">
            <img class="product-card__image product-card__image--secondary" src="${escapeHtml(secondaryImage)}" alt="${escapeHtml(product.name)} 第二張圖片">
          </a>
          <button class="quick-add" type="button" data-add-cart data-product-id="${product.id}" aria-label="加入 ${escapeHtml(product.name)} 到購物車" ${stock <= 0 ? "disabled" : ""}>${stock <= 0 ? "缺貨" : "加入購物車"}</button>
          <a class="product-title" href="${productUrl(product.id)}">${escapeHtml(product.name)}</a>
          <p class="price">${formatPrice(product.price)}</p>
        </article>
      `;
      })
      .join("");
  }

  function ensureSearchModal() {
    if ($("#searchModal")) return;
    const modal = document.createElement("div");
    modal.id = "searchModal";
    modal.className = "search-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="search-modal__overlay" data-close-search-modal></div>
      <div class="search-modal__panel" role="dialog" aria-modal="true" aria-labelledby="searchModalTitle">
        <button class="search-modal__close" type="button" data-close-search-modal aria-label="關閉搜尋視窗">×</button>
        <h2 id="searchModalTitle">搜尋商品</h2>
        <div class="search-modal__input-wrap">
          <input id="searchInput" type="search" placeholder="輸入關鍵字搜尋商品" autocomplete="off">
        </div>
        <div id="searchResults" class="search-modal__results" aria-live="polite"></div>
      </div>
    `;
    document.body.appendChild(modal);
    bindSearchEvents();
    renderSearchResults([], "");
  }

  function searchProducts(keyword) {
    const query = String(keyword || "").trim().toLowerCase();
    if (!query) return [];

    return products.filter((product) => {
      const searchableText = [
        product.name,
        product.subtitle,
        ...getProductDescriptions(product),
        ...getProductCategories(product),
        ...(Array.isArray(product.tags) ? product.tags : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(query);
    });
  }

  function renderSearchResults(results, keyword) {
    const container = $("#searchResults");
    if (!container) return;
    const query = String(keyword || "").trim();

    if (!query) {
      container.innerHTML = '<p class="search-modal__empty">請輸入關鍵字開始搜尋</p>';
      return;
    }

    if (!results.length) {
      container.innerHTML = '<p class="search-modal__empty">找不到相關商品</p>';
      return;
    }

    container.innerHTML = results.map((product) => `
      <a class="search-result" href="${productUrl(product.id)}">
        <span class="search-result__image"><img src="${escapeHtml(getProductPrimaryImage(product))}" alt="${escapeHtml(product.name)}"></span>
        <span class="search-result__content">
          <strong class="search-result__title">${escapeHtml(product.name)}</strong>
          <span class="search-result__price">${formatPrice(product.price)}</span>
          <span class="search-result__description">${escapeHtml(getProductDescriptions(product)[0] || "")}</span>
        </span>
      </a>
    `).join("");
  }

  function bindSearchEvents() {
    const input = $("#searchInput");
    if (!input || input.dataset.searchBound === "true") return;
    input.dataset.searchBound = "true";
    input.addEventListener("input", () => {
      const keyword = input.value;
      renderSearchResults(searchProducts(keyword), keyword);
    });
  }

  function openSearchModal() {
    closeDrawer();
    closeAuthModal();
    closeAccountMenu();
    ensureSearchModal();
    const modal = $("#searchModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    window.requestAnimationFrame(() => $("#searchInput")?.focus());
  }

  function closeSearchModal() {
    const modal = $("#searchModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    const input = $("#searchInput");
    if (input) input.value = "";
    renderSearchResults([], "");
    if (!$("#authModal")?.classList.contains("is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  function renderProductDetail() {
    const container = $("[data-product-detail]");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id") || document.body.dataset.productId || "";
    const product = findProduct(productId);

    if (!product) {
      document.title = "找不到商品 - APOTHEKE";
      container.innerHTML = `
        <section class="product-not-found">
          <h1>找不到商品</h1>
          <p>找不到你想查看的商品，請返回商品列表重新選擇。</p>
          <a class="return-link" href="${listUrl()}">返回商品列表</a>
        </section>
      `;
      return;
    }

    document.title = `${product.name} - APOTHEKE`;
    const promotionNotice = String(product.promotionNotice || "").trim();
    const pointsNotice = String(product.pointsNotice || "").trim();
    const descriptions = getProductDescriptions(product);
    const detailParagraphs = descriptions.slice(1);
    const stock = getProductStock(product);

    container.innerHTML = `
      <section class="product-main">
        ${renderProductImageStack(product)}

        <aside class="product-info" aria-label="商品資料區">
          <a class="return-link product-return" href="${listUrl()}">返回商品列表</a>
          <h1>${escapeHtml(product.name)}</h1>
          <p class="product-price">${formatPrice(product.price)}</p>
          <p class="product-intro">${escapeHtml(descriptions[0] || "")}</p>

          ${detailParagraphs.length ? `<section class="accordion product-accordion is-open">
            <button type="button" aria-expanded="true" class="accordion-toggle">商品詳情 / 規格說明</button>
            <div class="accordion-content">
              <ul>
                ${detailParagraphs.map((paragraph) => `<li>${escapeHtml(paragraph)}</li>`).join("")}
              </ul>
            </div>
          </section>` : ""}

          <div class="product-quantity">
            <span>數量</span>
            <div class="quantity-control">
              <button type="button" data-quantity-adjust="product-quantity" data-delta="-1" aria-label="減少數量" ${stock <= 0 ? "disabled" : ""}>-</button>
              <input id="product-quantity" type="number" min="1" max="${stock}" value="${stock > 0 ? 1 : 0}" ${stock <= 0 ? "disabled" : ""}>
              <button type="button" data-quantity-adjust="product-quantity" data-delta="1" aria-label="增加數量" ${stock <= 0 ? "disabled" : ""}>+</button>
            </div>
          </div>

          <div class="product-actions">
            <button class="add-cart-button" type="button" data-add-cart data-product-id="${product.id}" data-quantity-input="product-quantity" ${stock <= 0 ? "disabled" : ""}>${stock <= 0 ? "缺貨" : "加入購物車"}</button>
          </div>

          <p class="installment">滿 <strong>${formatPrice(FREE_SHIPPING_THRESHOLD)}</strong> 即享免運費<br><a href="#learn-more">了解更多</a></p>

          ${promotionNotice || pointsNotice ? `
            <div class="product-perks" aria-label="商品優惠與提醒">
              ${promotionNotice ? `<p><span class="perk-icon box"></span>${escapeHtml(promotionNotice)}</p>` : ""}
              ${pointsNotice ? `<p><span class="perk-icon medal"></span>${escapeHtml(pointsNotice)}</p>` : ""}
            </div>
          ` : ""}
        </aside>
      </section>

      <section class="details-strip">
        <article>
          <span class="detail-icon clock"></span>
          <h2>商品簡介</h2>
          <p>${escapeHtml(detailParagraphs[0] || descriptions[0] || "暫時未有商品描述")}</p>
        </article>
        <article>
          <span class="detail-icon leaf"></span>
          <h2>使用建議</h2>
          <p>可根據空間大小與個人喜好調整使用方式，讓香氣自然融入日常生活。</p>
        </article>
        <article>
          <span class="detail-icon map"></span>
          <h2>商品資訊</h2>
          <p>圖片、尺寸與商品資料會按商戶設定更新，購買前可先查看商品詳情與備註說明。</p>
        </article>
      </section>
    `;
    setupProductImageObserver();
  }

  function renderAboutPage() {
    const container = $("[data-about-page]");
    if (!container) return;
    const about = siteConfig.about || {};
    document.title = `${about.title || "關於我們"} - APOTHEKE`;
    container.innerHTML = `
      <section class="info-page">
        <h1>${escapeHtml(about.title || "關於我們")}</h1>
        <h2>${escapeHtml(about.companyName || "品牌資訊")}</h2>
        <p class="info-intro">${textToHtml(about.intro || "請在 assets/site-config.js 補上品牌介紹內容。")}</p>
        <div class="info-sections">
          ${(about.sections || []).map((section) => `
            <article>
              <h3>${escapeHtml(section.heading)}</h3>
              <p>${textToHtml(section.content)}</p>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderContactPage() {
    const container = $("[data-contact-page]");
    if (!container) return;
    const contact = siteConfig.contact || {};
    document.title = `${contact.title || "聯絡我們"} - APOTHEKE`;
    const mapUrl = String(contact.googleMapEmbedUrl || "").trim();
    container.innerHTML = `
      <section class="info-page contact-page">
        <h1>${escapeHtml(contact.title || "聯絡我們")}</h1>
        <div class="contact-layout">
          <div class="contact-details">
            <article>
              <h2>店舖地址</h2>
              <p>${textToHtml(contact.address || "請在這裡填寫店舖地址")}</p>
            </article>
            <article>
              <h2>營業時間</h2>
              <p>${textToHtml(contact.openingHours || "星期一至日 11:00 - 20:00")}</p>
            </article>
            <article>
              <h2>聯絡電話</h2>
              <p>${textToHtml(contact.phone || "+852 0000 0000")}</p>
            </article>
            <article>
              <h2>其他資訊</h2>
              <p>${textToHtml(contact.other || "請在設定中補上其他聯絡資訊。")}</p>
            </article>
          </div>
          <div class="map-panel">
            ${mapUrl
              ? `<iframe src="${escapeHtml(mapUrl)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Google Map"></iframe>`
              : `<div class="map-placeholder">請在設定中填入 Google Map 嵌入連結</div>`}
          </div>
        </div>
      </section>
    `;
  }

  function profileOrderAmount(order) {
    return Number(order?.totalAmount || order?.total || order?.amount || 0);
  }

  function profileOrderStatus(order) {
    const labels = {
      pending: "待處理",
      paid: "已付款",
      processing: "處理中",
      shipped: "已出貨",
      completed: "已完成",
      cancelled: "已取消"
    };
    return labels[order?.status] || order?.status || "未知";
  }

  function renderProfilePage() {
    const container = $("[data-profile-page]");
    if (!container) return;

    const currentUser = state.currentUser;
    const profile = state.currentUserProfile || {};
    const currentTab = getProfileTabFromUrl();
    const providerId = String(profile.providerId || currentUser?.providerId || "password");
    const providerLabel = providerId === "google.com" ? "Google" : providerId === "password" ? "電郵 / 密碼" : providerId;
    document.title = "我的帳戶 - APOTHEKE";

    if (!currentUser) {
      container.innerHTML = `
        <section class="profile-page profile-page--empty">
          <div class="profile-empty">
            <h1>我的帳戶</h1>
            <p>請先登入以查看你的帳戶資料。</p>
          </div>
        </section>
      `;
      return;
    }

    const orders = Array.isArray(state.currentUserOrders) ? state.currentUserOrders : [];
    const emailValue = profile.email || currentUser.email || "";

    container.innerHTML = `
      <section class="profile-page">
        <aside class="profile-sidebar" aria-label="帳戶導覽">
          <h1>我的帳戶</h1>
          <nav class="profile-nav">
            <a class="${currentTab === "profile" ? "is-active" : ""}" href="${profileUrl("profile")}">個人資料</a>
            <a class="${currentTab === "orders" ? "is-active" : ""}" href="${profileUrl("orders")}">訂單記錄</a>
            <a class="${currentTab === "security" ? "is-active" : ""}" href="${profileUrl("security")}">帳戶安全</a>
          </nav>
        </aside>
        <div class="profile-content">
          <section class="profile-panel ${currentTab === "profile" ? "is-active" : ""}" ${currentTab === "profile" ? "" : "hidden"}>
            <h2>個人資料</h2>
            <form class="profile-settings-form" data-profile-settings-form>
              <label>電郵<input type="email" name="email" value="${escapeHtml(emailValue)}"></label>
              <label>顯示名稱<input type="text" name="displayName" value="${escapeHtml(profile.displayName || "")}"></label>
              <label>電話<input type="text" name="phone" value="${escapeHtml(profile.phone || "")}"></label>
              <label class="profile-settings-form__wide">地址<textarea name="address" rows="4">${escapeHtml(profile.address || "")}</textarea></label>
              <label>生日<input type="date" name="birthday" value="${escapeHtml(profile.birthday || "")}"></label>
              <label>性別
                <select name="gender">
                  <option value="" ${!profile.gender ? "selected" : ""}>不透露</option>
                  <option value="male" ${profile.gender === "male" ? "selected" : ""}>男</option>
                  <option value="female" ${profile.gender === "female" ? "selected" : ""}>女</option>
                  <option value="other" ${profile.gender === "other" ? "selected" : ""}>其他</option>
                </select>
              </label>
              <p class="profile-settings-form__message" data-profile-settings-message aria-live="polite"></p>
              <div class="profile-settings-form__actions">
                <button class="checkout-button" type="submit" data-profile-save>儲存個人資料</button>
              </div>
            </form>
          </section>

          <section class="profile-panel ${currentTab === "orders" ? "is-active" : ""}" ${currentTab === "orders" ? "" : "hidden"}>
            <h2>訂單記錄</h2>
            ${orders.length ? `
              <div class="profile-orders">
                ${orders.map((order) => `
                  <article class="profile-order-card">
                    <div>
                      <span>訂單編號</span>
                      <strong>${escapeHtml(order.orderNumber || order.id || "未提供訂單編號")}</strong>
                    </div>
                    <div>
                      <span>狀態</span>
                      <strong>${escapeHtml(profileOrderStatus(order))}</strong>
                    </div>
                    <div>
                      <span>金額</span>
                      <strong>${escapeHtml(formatPrice(profileOrderAmount(order)))}</strong>
                    </div>
                    <div>
                      <span>下單時間</span>
                      <strong>${escapeHtml(formatDateTime(order.createdAt))}</strong>
                    </div>
                    <div class="profile-order-card__note">
                      <span>商戶備註</span>
                      <p>${escapeHtml(order.merchantNote || "暫無備註")}</p>
                    </div>
                  </article>
                `).join("")}
              </div>
            ` : `<p class="profile-empty-message">暫時沒有訂單</p>`}
          </section>

          <section class="profile-panel ${currentTab === "security" ? "is-active" : ""}" ${currentTab === "security" ? "" : "hidden"}>
            <h2>帳戶安全</h2>
            <div class="profile-security">
              <article class="profile-security__card">
                <span>目前登入方式</span>
                <strong>${escapeHtml(providerLabel)}</strong>
              </article>
              <div class="profile-settings-form__actions">
                <button class="checkout-button" type="button" data-auth-logout>登出</button>
              </div>
            </div>
          </section>
        </div>
      </section>
    `;
  }

  function renderPolicyPage() {
    const container = $("[data-policy-page]");
    if (!container) return;

    const type = document.body.dataset.policyType || container.dataset.policyType || "";
    const policy = siteConfig.policies?.[type];
    const title = policy?.title || "政策內容";
    const content = policy?.content || "請在 assets/site-config.js 補上政策內容。";
    document.title = `${title} - APOTHEKE`;
    container.innerHTML = `
      <section class="info-page policy-page">
        <h1>${escapeHtml(title)}</h1>
        <div class="policy-page__content"><p>${textToHtml(content)}</p></div>
      </section>
    `;
  }

  function renderHomePage() {
    const container = $("[data-home-page]");
    if (!container) return;

    const home = siteConfig.home || {};
    const maxProducts = Math.max(1, Number.parseInt(home.maxProducts, 10) || 8);
    const featuredProducts = products.filter((product) => product.showOnHome === true).slice(0, maxProducts);
    const bannerImage = `${rootPrefix()}${home.bannerImage || "assets/images/banner.jpg"}`;
    container.innerHTML = `
      <section class="home-banner" aria-label="${escapeHtml(home.bannerAlt || "首頁 Banner")}">
        <img src="${escapeHtml(bannerImage)}" alt="${escapeHtml(home.bannerAlt || "APOTHEKE 首頁 Banner")}">
      </section>
      <section class="home-products" aria-labelledby="homeProductsTitle">
        <h1 id="homeProductsTitle">${escapeHtml(home.productsTitle || "精選商品")}</h1>
        <div class="product-grid home-products__grid" data-home-products-grid aria-label="首頁商品列表"></div>
      </section>
    `;
    renderProductGrid(featuredProducts, $("[data-home-products-grid]", container), "暫時沒有精選商品");
  }

  function renderSiteFooter() {
    if ($("[data-site-footer]") || !$(".site-header")) return;

    const contact = siteConfig.contact || {};
    const logoText = $(".brand")?.textContent.trim() || "APOTHEKE";
    const phone = String(contact.phone || "+852 0000 0000").trim();
    const phoneHref = phone.replace(/[^+\d]/g, "");
    const address = contact.address || "請在這裡填寫店舖地址";
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.dataset.siteFooter = "";
    footer.innerHTML = `
      <div class="site-footer__inner">
        <a class="site-footer__brand" href="${homeUrl()}" aria-label="${escapeHtml(logoText)} 返回首頁">${escapeHtml(logoText)}</a>
        <div>
          <span class="site-footer__label">聯絡電話</span>
          ${phoneHref
            ? `<a class="site-footer__value" href="tel:${escapeHtml(phoneHref)}">${escapeHtml(phone)}</a>`
            : `<span class="site-footer__value">${escapeHtml(phone)}</span>`}
        </div>
        <div>
          <span class="site-footer__label">店舖地址</span>
          <address>${textToHtml(address)}</address>
        </div>
      </div>
    `;

    const main = $("main");
    if (main) main.insertAdjacentElement("afterend", footer);
    else document.body.appendChild(footer);
  }

  function getNumericPrice(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
    const normalized = String(value ?? "")
      .replace(/HK\$/gi, "")
      .replace(/\$/g, "")
      .replace(/,/g, "")
      .trim();
    return normalized === "" ? Number.NaN : Number(normalized);
  }

  function getMaxProductPrice() {
    const validPrices = products
      .map((product) => getNumericPrice(product.price))
      .filter((price) => Number.isFinite(price));
    return validPrices.length ? Math.max(0, ...validPrices) : 0;
  }

  function getFilterCategories() {
    const store = window.ONLINE_SHOP_PRODUCT_ADMIN_STORE;
    const categories = store?.loadCategories?.() || [];
    return categories.filter((category) => category.id !== store?.uncategorizedId);
  }

  function renderFilterPanel() {
    const form = $("[data-filters]");
    if (!form) return;
    const categories = getFilterCategories();

    form.innerHTML = `
      <section class="filter-section is-open">
        <button class="filter-section-toggle" type="button" aria-expanded="true">排序</button>
        <div class="filter-content">
          <label class="filter-sort">
            <select data-sort-products aria-label="商品排序">
              <option value="relevant">相關排序</option>
              <option value="best">精選商品</option>
              <option value="az">名稱 A-Z</option>
              <option value="za">名稱 Z-A</option>
              <option value="low">價格由低至高</option>
              <option value="high">價格由高至低</option>
            </select>
          </label>
        </div>
      </section>
      <section class="filter-section is-open">
        <button class="filter-section-toggle" type="button" aria-expanded="true">價格</button>
        <div class="filter-content">
          <div class="price-inputs">
            <label><span>HK$</span><input type="number" min="0" step="1" data-filter-min-price aria-label="最低價格"></label>
            <label><span>HK$</span><input type="number" min="0" step="1" data-filter-max-price aria-label="最高價格"></label>
          </div>
          <div class="price-range" data-price-range>
            <span class="price-range__track"></span>
            <span class="price-range__selected"></span>
            <input type="range" step="1" data-price-range-min aria-label="價格最低滑桿">
            <input type="range" step="1" data-price-range-max aria-label="價格最高滑桿">
          </div>
        </div>
      </section>
      <section class="filter-section is-open">
        <button class="filter-section-toggle" type="button" aria-expanded="true">庫存狀態</button>
        <div class="filter-content filter-options">
          <label><input type="checkbox" value="in-stock" data-filter-stock-status><span></span>有存貨</label>
          <label><input type="checkbox" value="out-of-stock" data-filter-stock-status><span></span>蝻箄疏</label>
        </div>
      </section>
      <section class="filter-section is-open">
        <button class="filter-section-toggle" type="button" aria-expanded="true">訂單狀態</button>
        <div class="filter-content filter-options">
          <label><input type="checkbox" value="in-stock" data-filter-order-status><span></span>現貨</label>
          <label><input type="checkbox" value="preorder" data-filter-order-status><span></span>預購</label>
        </div>
      </section>
      <section class="filter-section filter-section--category-group is-open">
        <button class="filter-section-toggle" type="button" aria-expanded="true">憿</button>
        <div class="filter-content filter-category-groups">
          ${categories.map((category) => {
            const hasSubcategories = category.subcategories.length > 0;
            return `
            <section class="filter-section filter-section--category is-open" data-filter-category-group="${escapeHtml(category.id)}">
              <div class="filter-category-heading">
                <label class="filter-category-parent">
                  <input type="checkbox" data-filter-category-id="${escapeHtml(category.id)}">
                  <span></span>
                  <strong>${escapeHtml(category.name)}</strong>
                </label>
                ${hasSubcategories ? `<button class="filter-category-toggle" type="button" aria-expanded="true" aria-label="展開或收起 ${escapeHtml(category.name)}">
                  <span class="filter-category-arrow" aria-hidden="true"></span>
                </button>` : ""}
              </div>
              ${hasSubcategories ? `<div class="filter-content filter-options filter-category-tree">
                ${category.subcategories.map((subcategory) => `
                  <label class="filter-category-child"><input type="checkbox" value="${escapeHtml(subcategory.id)}" data-filter-subcategory-id="${escapeHtml(subcategory.id)}" data-filter-parent-id="${escapeHtml(category.id)}"><span></span>${escapeHtml(subcategory.name)}</label>
                `).join("")}
              </div>` : ""}
            </section>
          `;
          }).join("")}
        </div>
      </section>
    `;
    const sortSelect = $("[data-sort-products]", form);
    if (sortSelect) sortSelect.value = state.sort;
    initPriceFilter();
    syncFilterHierarchy(form);
  }

  function syncFilterHierarchy(scope = document) {
    $$('[data-filter-category-group]', scope).forEach((group) => {
      const parent = $('[data-filter-category-id]', group);
      const children = $$('[data-filter-subcategory-id]', group);
      if (!parent) return;
      const checkedCount = children.filter((child) => child.checked).length;
      parent.checked = children.length ? checkedCount === children.length : parent.checked;
      parent.indeterminate = checkedCount > 0 && checkedCount < children.length;
    });
  }

  function updateFilterHierarchy(input) {
    const categoryId = input.dataset.filterCategoryId || input.dataset.filterParentId;
    if (!categoryId) return;
    const sourceGroup = input.closest('[data-filter-category-group]');
    if (input.matches('[data-filter-category-id]')) {
      $$(`[data-filter-category-id="${CSS.escape(categoryId)}"]`).forEach((parent) => {
        parent.checked = input.checked;
        parent.indeterminate = false;
      });
      $$(`[data-filter-parent-id="${CSS.escape(categoryId)}"]`).forEach((child) => {
        child.checked = input.checked;
      });
    } else {
      const selectedIds = new Set($$('[data-filter-subcategory-id]:checked', sourceGroup).map((child) => child.value));
      $$(`[data-filter-parent-id="${CSS.escape(categoryId)}"]`).forEach((child) => {
        child.checked = selectedIds.has(child.value);
      });
      $$(`[data-filter-category-group="${CSS.escape(categoryId)}"]`).forEach((group) => syncFilterHierarchy(group));
    }
    applyFilters();
  }

  function pricePercent(value) {
    return state.priceLimit > 0 ? Math.min(100, Math.max(0, (value / state.priceLimit) * 100)) : 0;
  }

  function syncPriceFilterControls(scope = document) {
    const minValue = String(state.priceMin);
    const maxValue = String(state.priceMax);
    const limit = String(state.priceLimit);

    $$("[data-filter-min-price]", scope).forEach((input) => {
      input.min = "0";
      input.max = limit;
      input.value = minValue;
    });
    $$("[data-filter-max-price]", scope).forEach((input) => {
      input.min = "0";
      input.max = limit;
      input.value = maxValue;
    });
    $$("[data-price-range-min]", scope).forEach((input) => {
      input.min = "0";
      input.max = limit;
      input.value = minValue;
      input.style.zIndex = state.priceMin > state.priceLimit * 0.8 ? "5" : "3";
    });
    $$("[data-price-range-max]", scope).forEach((input) => {
      input.min = "0";
      input.max = limit;
      input.value = maxValue;
      input.style.zIndex = "4";
    });
    $$("[data-price-range]", scope).forEach((range) => {
      range.style.setProperty("--price-min-percent", `${pricePercent(state.priceMin)}%`);
      range.style.setProperty("--price-max-percent", `${pricePercent(state.priceMax)}%`);
    });
  }

  function initPriceFilter() {
    state.priceLimit = getMaxProductPrice();
    state.priceMin = 0;
    state.priceMax = state.priceLimit;
    syncPriceFilterControls();
  }

  function updatePriceFilter(changedHandle, rawValue) {
    const fallback = changedHandle === "min" ? 0 : state.priceLimit;
    const parsed = rawValue === "" ? fallback : getNumericPrice(rawValue);
    const value = Number.isFinite(parsed)
      ? Math.min(state.priceLimit, Math.max(0, parsed))
      : fallback;

    if (changedHandle === "min") {
      state.priceMin = Math.min(value, state.priceMax);
    } else {
      state.priceMax = Math.max(value, state.priceMin);
    }
    syncPriceFilterControls();
    applyFilters();
  }

  function productMatchesPrice(product, minPrice, maxPrice) {
    const price = getNumericPrice(product?.price);
    if (Number.isNaN(price)) return false;
    if (minPrice !== "" && price < Number(minPrice)) return false;
    if (maxPrice !== "" && price > Number(maxPrice)) return false;
    return true;
  }

  function sortProducts(value, announce = true) {
    const grid = $(".product-grid");
    if (!grid) return;
    const cards = $$(".product-card", grid);
    const sorted = cards.slice().sort((a, b) => {
      const priceA = getNumericPrice(a.dataset.price);
      const priceB = getNumericPrice(b.dataset.price);
      const nameA = a.dataset.name || "";
      const nameB = b.dataset.name || "";
      const indexA = Number(a.dataset.index || 0);
      const indexB = Number(b.dataset.index || 0);

      if (value === "low") return priceA - priceB;
      if (value === "high") return priceB - priceA;
      if (value === "az") return nameA.localeCompare(nameB, "zh-Hant");
      if (value === "za") return nameB.localeCompare(nameA, "zh-Hant");
      if (value === "best") return indexA - indexB;
      return indexA - indexB;
    });

    sorted.forEach((card) => grid.appendChild(card));
    if (announce) showToast("商品排序已更新");
  }

  function applyFilters() {
    const selectedCategoryIds = new Set($$("[data-filter-category-id]:checked").map((input) => input.dataset.filterCategoryId));
    const selectedSubcategories = $$("[data-filter-subcategory-id]:checked").map((input) => ({
      categoryId: input.dataset.filterParentId,
      subcategoryId: input.dataset.filterSubcategoryId
    }));
    const selectedStockStatuses = new Set($$("[data-filter-stock-status]:checked").map((input) => input.value));
    const selectedOrderStatuses = new Set($$("[data-filter-order-status]:checked").map((input) => input.value));
    const hasCategoryFilters = selectedCategoryIds.size > 0 || selectedSubcategories.length > 0;
    const hasStockFilter = selectedStockStatuses.size === 1;
    const hasOrderStatusFilter = selectedOrderStatuses.size === 1;

    const filteredProducts = products.filter((product) => {
      const assignments = getProductCategoryAssignments(product);
      const matchesCategories = !hasCategoryFilters || assignments.some((assignment) => (
        selectedCategoryIds.has(assignment.categoryId)
        || selectedSubcategories.some((selected) => (
          selected.categoryId === assignment.categoryId
          && assignment.subcategoryIds.includes(selected.subcategoryId)
        ))
      ));
      const matchesPrice = productMatchesPrice(product, state.priceMin, state.priceMax);
      const stock = getProductStock(product);
      const matchesStock = !hasStockFilter
        || (selectedStockStatuses.has("in-stock") && stock > 0)
        || (selectedStockStatuses.has("out-of-stock") && stock === 0);
      const matchesOrderStatus = !hasOrderStatusFilter || selectedOrderStatuses.has(getProductOrderStatus(product));
      return matchesCategories && matchesPrice && matchesStock && matchesOrderStatus;
    });

    renderProductGrid(filteredProducts);
    sortProducts(state.sort, false);
  }

  function resetFilters() {
    $$("[data-filter-category-id], [data-filter-subcategory-id], [data-filter-stock-status], [data-filter-order-status]").forEach((input) => {
      input.checked = false;
      input.indeterminate = false;
    });
    state.priceMin = 0;
    state.priceMax = state.priceLimit;
    syncPriceFilterControls();
    applyFilters();
    showToast("篩選條件已清除");
  }

  function refreshProductViews() {
    const filterDrawer = $("#filters-drawer");
    if (filterDrawer) {
      filterDrawer.innerHTML = "";
      delete filterDrawer.dataset.ready;
    }
    renderFilterPanel();
    renderProductGrid();
    renderHomePage();
    renderProductDetail();
    loadCart();
    renderCart();
    updateCartBadge();
    const searchInput = $("#searchInput");
    if (searchInput?.value.trim()) {
      renderSearchResults(searchProducts(searchInput.value), searchInput.value);
    }
  }

  function hydrateFilterDrawer(drawer) {
    if (drawer.dataset.ready) return;
    const source = $(".filters-sidebar");
    if (!source) return;
    drawer.innerHTML = `
      <button class="drawer-close" type="button" data-close-drawer aria-label="??蝭拚">x</button>
      ${source.innerHTML}
    `;
    drawer.dataset.ready = "true";
    syncPriceFilterControls(drawer);
    syncFilterHierarchy(drawer);
  }

  function adjustQuantity(inputId, delta) {
    const input = document.getElementById(inputId);
    if (!input || input.disabled) return;
    const minimum = Number.parseInt(input.min, 10) || 1;
    const parsedMaximum = Number.parseInt(input.max, 10);
    const maximum = Number.isFinite(parsedMaximum) ? parsedMaximum : Number.POSITIVE_INFINITY;
    const current = Number.parseInt(input.value, 10) || minimum;
    input.value = String(Math.min(maximum, Math.max(minimum, current + Number(delta || 0))));
  }

  document.addEventListener("click", (event) => {
    if ($("#authAccountMenu")?.classList.contains("is-open") && !event.target.closest("#authAccountMenu") && !event.target.closest("[data-auth-trigger], .account-link")) {
      closeAccountMenu();
    }

    if (event.target.closest("[data-open-search-modal]")) {
      event.preventDefault();
      openSearchModal();
      return;
    }

    if (event.target.closest("[data-close-search-modal]")) {
      closeSearchModal();
      return;
    }

    const authTrigger = event.target.closest("[data-auth-trigger], .account-link");
    if (authTrigger) {
      event.preventDefault();
      if (state.currentUser) {
        toggleAccountMenu(authTrigger);
      } else {
        openAuthModal("login");
      }
      return;
    }

    if (event.target.closest("[data-close-auth-modal]")) {
      closeAuthModal();
      return;
    }

    const authModeButton = event.target.closest("[data-auth-mode]");
    if (authModeButton) {
      switchAuthMode(authModeButton.dataset.authMode);
      return;
    }

    const authSocialButton = event.target.closest("[data-auth-social]");
    if (authSocialButton) {
      if (authSocialButton.dataset.authSocial === "google") handleGoogleAuth();
      return;
    }

    if (event.target.closest("[data-auth-reset]")) {
      handlePasswordReset();
      return;
    }

    if (event.target.closest("[data-auth-submit]")) {
      if (state.authMode === "register") {
        handleRegister();
      } else {
        handleLogin();
      }
      return;
    }

    if (event.target.closest("[data-auth-logout]")) {
      handleLogout();
      return;
    }

    const openButton = event.target.closest("[data-open-drawer]");
    if (openButton) {
      openDrawer(openButton.dataset.openDrawer);
      return;
    }

    if (event.target.closest("[data-close-drawer]")) {
      closeDrawer();
      return;
    }

    const addButton = event.target.closest("[data-add-cart]");
    if (addButton) {
      event.preventDefault();
      const productId = addButton.dataset.productId;
      const quantityInput = addButton.dataset.quantityInput ? document.getElementById(addButton.dataset.quantityInput) : null;
      addToCart(productId, quantityInput ? quantityInput.value : 1);
      return;
    }

    const cartAction = event.target.closest("[data-cart-action]");
    if (cartAction) {
      const productId = cartAction.dataset.productId;
      const item = state.cart.find((entry) => entry.productId === productId);
      if (cartAction.dataset.cartAction === "increase" && item) updateCartQuantity(productId, item.quantity + 1);
      if (cartAction.dataset.cartAction === "decrease" && item) updateCartQuantity(productId, item.quantity - 1);
      if (cartAction.dataset.cartAction === "remove") removeFromCart(productId);
      if (cartAction.dataset.cartAction === "clear") clearCart();
      return;
    }

    if (event.target.closest("#cart-drawer .checkout-button")) {
      event.preventDefault();
      closeDrawer();
      window.location.href = cartUrl();
      return;
    }

    if (event.target.closest("[data-go-checkout]")) {
      event.preventDefault();
      if (!state.cart.length) {
        showToast("購物車暫時沒有商品");
        return;
      }
      closeDrawer();
      window.location.href = state.currentUser ? checkoutUrl() : `${rootPrefix()}index.html?auth=login&redirect=checkout`;
      return;
    }

    const quantityAdjust = event.target.closest("[data-quantity-adjust]");
    if (quantityAdjust) {
      adjustQuantity(quantityAdjust.dataset.quantityAdjust, quantityAdjust.dataset.delta);
      return;
    }

    const toastButton = event.target.closest("[data-toast]");
    if (toastButton) {
      showToast(toastButton.dataset.toast);
      return;
    }

    const filterToggle = event.target.closest(".filter-section-toggle");
    if (filterToggle) {
      const section = filterToggle.closest(".filter-section");
      section?.classList.toggle("is-open");
      filterToggle.setAttribute("aria-expanded", String(section?.classList.contains("is-open")));
      return;
    }

    const categoryToggle = event.target.closest(".filter-category-toggle");
    if (categoryToggle) {
      const section = categoryToggle.closest(".filter-section");
      section?.classList.toggle("is-open");
      categoryToggle.setAttribute("aria-expanded", String(section?.classList.contains("is-open")));
      return;
    }

    const accordionToggle = event.target.closest(".accordion-toggle");
    if (accordionToggle) {
      const accordion = accordionToggle.closest(".accordion");
      accordion?.classList.toggle("is-open");
      accordionToggle.setAttribute("aria-expanded", String(accordion?.classList.contains("is-open")));
      return;
    }

    const resetButton = event.target.closest("[data-reset-filters]");
    if (resetButton) {
      resetFilters();
      return;
    }

    const thumb = event.target.closest("[data-scroll-to-image]");
    if (thumb) {
      scrollToProductImage(thumb.dataset.scrollToImage);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-sort-products]")) {
      state.sort = event.target.value;
      $$('[data-sort-products]').forEach((select) => {
        if (select !== event.target) select.value = state.sort;
      });
      sortProducts(state.sort);
    }

    if (event.target.matches("[data-filter-category-id], [data-filter-subcategory-id]")) {
      updateFilterHierarchy(event.target);
    }

    if (event.target.matches("[data-filter-stock-status], [data-filter-order-status]")) {
      applyFilters();
    }

    if (event.target.matches("[data-cart-quantity]")) {
      updateCartQuantity(event.target.dataset.productId, event.target.value);
    }

    if (event.target.matches("[data-checkout-same], [data-checkout-delivery]")) {
      const form = event.target.closest("[data-checkout-form]");
      if (form) {
        saveCheckoutDraft(checkoutFormPayload(form));
        renderCheckoutPage();
      }
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-filter-min-price]")) updatePriceFilter("min", event.target.value);
    if (event.target.matches("[data-filter-max-price]")) updatePriceFilter("max", event.target.value);
    if (event.target.matches("[data-price-range-min]")) updatePriceFilter("min", event.target.value);
    if (event.target.matches("[data-price-range-max]")) updatePriceFilter("max", event.target.value);

    if (event.target.closest("#authModal")) {
      updateAuthSubmitState();
    }

    if (event.target.matches("[data-checkout-note]")) {
      saveCheckoutDraft({ note: event.target.value });
    }

    if (event.target.matches("[data-checkout-field]")) {
      const form = event.target.closest("[data-checkout-form]");
      if (form) saveCheckoutDraft(checkoutFormPayload(form));
    }
  });

  document.addEventListener("submit", async (event) => {
    const checkoutForm = event.target.closest("[data-checkout-form]");
    if (checkoutForm) {
      event.preventDefault();
      await handleCheckoutSubmit(checkoutForm);
      return;
    }

    const profileForm = event.target.closest("[data-profile-settings-form]");
    if (!profileForm) return;
    event.preventDefault();
    await handleProfileSettingsSubmit(profileForm);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthModal();
      closeSearchModal();
      closeAccountMenu();
      closeDrawer();
    }
  });

  window.addEventListener("merchant-products-updated", refreshProductViews);
  window.addEventListener("merchant-categories-updated", refreshProductViews);

  window.formatPrice = formatPrice;
  window.loadCart = loadCart;
  window.saveCart = saveCart;
  window.addToCart = addToCart;
  window.removeFromCart = removeFromCart;
  window.updateCartQuantity = updateCartQuantity;
  window.clearCart = clearCart;
  window.renderCart = renderCart;
  window.updateCartBadge = updateCartBadge;
  window.getNumericPrice = getNumericPrice;
  window.getMaxProductPrice = getMaxProductPrice;
  window.initPriceFilter = initPriceFilter;
  window.syncPriceFilterControls = syncPriceFilterControls;
  window.renderFilterPanel = renderFilterPanel;
  window.productMatchesPrice = productMatchesPrice;
  window.applyFilters = applyFilters;
  window.renderProductGrid = renderProductGrid;
  window.renderHomePage = renderHomePage;
  window.renderProfilePage = renderProfilePage;
  window.renderCartPage = renderCartPage;
  window.renderCheckoutPage = renderCheckoutPage;
  window.renderOrderConfirmationPage = renderOrderConfirmationPage;
  window.renderPolicyPage = renderPolicyPage;
  window.renderSiteFooter = renderSiteFooter;
  window.openSearchModal = openSearchModal;
  window.closeSearchModal = closeSearchModal;
  window.searchProducts = searchProducts;
  window.renderSearchResults = renderSearchResults;
  window.bindSearchEvents = bindSearchEvents;
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.switchAuthMode = switchAuthMode;
  window.switchAuthTab = switchAuthTab;
  window.renderAuthModal = renderAuthModal;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
  window.handleGoogleAuth = handleGoogleAuth;
  window.handlePasswordReset = handlePasswordReset;
  window.handleLogout = handleLogout;
  window.updateAuthNav = updateAuthNav;
  window.getProductImages = getProductImages;
  window.getProductPrimaryImage = getProductPrimaryImage;
  window.getProductSecondaryImage = getProductSecondaryImage;
  window.renderProductImageStack = renderProductImageStack;
  window.scrollToProductImage = scrollToProductImage;
  window.showToast = showToast;

  initAuthEntryFromUrl();
  ensureAuthModal();
  ensureSearchModal();
  renderCurrencyText();
  renderFilterPanel();
  renderProductGrid();
  renderHomePage();
  renderProfilePage();
  renderCartPage();
  renderCheckoutPage();
  renderOrderConfirmationPage();
  renderProductDetail();
  renderAboutPage();
  renderContactPage();
  renderPolicyPage();
  renderSiteFooter();
  window.localStorage.removeItem(LEGACY_USERS_KEY);
  window.localStorage.removeItem("onlineShopCurrentUser");
  updateAuthNav();
  consumeAuthNotice();
  initFirebaseAuth();
  loadCart();
  renderCart();
  updateCartBadge();
  if (document.body?.dataset.page !== "merchant") {
    window.ONLINE_SHOP_PRODUCT_ADMIN_STORE?.initializePublicProducts();
  }
})();
