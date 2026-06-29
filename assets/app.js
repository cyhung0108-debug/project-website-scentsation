(function () {
  const CART_KEY = "onlineShopCart";
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
    authRedirect: "",
    authTab: "email",
    authBusy: false,
    aboutContent: null,
    aboutContentLoadStarted: false,
    currentUser: null,
    contactContent: null,
    contactContentLoadStarted: false,
    homeHero: null,
    homeHeroLoadStarted: false,
    siteFooter: null,
    siteFooterLoadStarted: false,
    priceMin: 0,
    priceMax: 0,
    priceLimit: 0,
    sort: "relevant"
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function formatPrice(price) {
    return `${currencyConfig.symbol || "HK$"}${Number(price || 0).toFixed(2)}`;
  }

  function renderCurrencyText() {
    $$("[data-free-shipping-announcement]").forEach((node) => {
      node.textContent = `滿 ${formatPrice(FREE_SHIPPING_THRESHOLD)} 免運`;
    });
  }

  function rootPrefix() {
    return document.body?.dataset.rootPrefix || "";
  }

  function isAbsoluteOrRootUrl(value) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(String(value || "").trim());
  }

  function resolveAssetUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    return isAbsoluteOrRootUrl(url) ? url : `${rootPrefix()}${url}`;
  }

  function resolveLinkUrl(value) {
    const href = String(value || "").trim();
    if (!href || /^javascript:/i.test(href)) return "";
    if (href.startsWith("#") || isAbsoluteOrRootUrl(href)) return href;
    return `${rootPrefix()}${href}`;
  }

  function fallbackHomeHero(home = siteConfig.home || {}) {
    return {
      type: "homeHero",
      title: String(home.heroTitle || ""),
      subtitle: String(home.heroSubtitle || ""),
      imageUrl: String(home.bannerImage || "assets/images/banner.jpg"),
      imagePath: "",
      imageAlt: String(home.heroImageAlt || home.bannerAlt || "APOTHEKE"),
      buttonText: String(home.heroButtonText || ""),
      buttonHref: String(home.heroButtonHref || ""),
      isActive: home.heroIsActive !== false
    };
  }

  function normalizeRemoteHomeHero(data) {
    if (!data || data.type !== "homeHero" || typeof data.isActive !== "boolean") return null;
    const stringFields = ["title", "subtitle", "imageUrl", "imagePath", "imageAlt", "buttonText", "buttonHref"];
    if (!stringFields.every((field) => typeof data[field] === "string")) return null;
    return {
      type: "homeHero",
      title: data.title,
      subtitle: data.subtitle,
      imageUrl: data.imageUrl,
      imagePath: data.imagePath,
      imageAlt: data.imageAlt,
      buttonText: data.buttonText,
      buttonHref: data.buttonHref,
      isActive: data.isActive
    };
  }

  function currentHomeHero(home = siteConfig.home || {}) {
    const fallback = fallbackHomeHero(home);
    if (!state.homeHero) return fallback;
    return {
      ...fallback,
      ...state.homeHero,
      imageUrl: state.homeHero.imageUrl || fallback.imageUrl,
      imageAlt: state.homeHero.imageAlt || fallback.imageAlt
    };
  }

  function fallbackSiteFooter() {
    const footer = siteConfig.footer || {};
    const contact = siteConfig.contact || {};
    const logoText = String(footer.logoText || $(".brand")?.textContent.trim() || "APOTHEKE");
    return {
      type: "footer",
      logoText,
      description: String(footer.description || ""),
      phone: String(footer.phone || contact.phone || "+852 0000 0000"),
      email: String(footer.email || contact.email || ""),
      address: String(footer.address || contact.address || "璜嬪湪閫欒！濉搴楅嫪鍦板潃"),
      copyright: String(footer.copyright || `© ${new Date().getFullYear()} ${logoText}. All rights reserved.`),
      instagramUrl: String(footer.instagramUrl || ""),
      facebookUrl: String(footer.facebookUrl || ""),
      isActive: footer.isActive !== false
    };
  }

  function normalizeRemoteSiteFooter(data) {
    if (!data || data.type !== "footer" || typeof data.isActive !== "boolean") return null;
    const stringFields = ["logoText", "description", "phone", "email", "address", "copyright", "instagramUrl", "facebookUrl"];
    if (!stringFields.every((field) => typeof data[field] === "string")) return null;
    return {
      type: "footer",
      logoText: data.logoText,
      description: data.description,
      phone: data.phone,
      email: data.email,
      address: data.address,
      copyright: data.copyright,
      instagramUrl: data.instagramUrl,
      facebookUrl: data.facebookUrl,
      isActive: data.isActive
    };
  }

  function currentSiteFooter() {
    const fallback = fallbackSiteFooter();
    if (!state.siteFooter) return fallback;
    return {
      ...fallback,
      ...state.siteFooter,
      logoText: state.siteFooter.logoText || fallback.logoText,
      copyright: state.siteFooter.copyright || fallback.copyright
    };
  }

  function fallbackContactContent() {
    const contact = siteConfig.contact || {};
    return {
      type: "contact",
      title: String(contact.title || "聯絡我們"),
      subtitle: String(contact.subtitle || ""),
      address: String(contact.address || "請在這裡填寫店鋪地址"),
      phone: String(contact.phone || "+852 0000 0000"),
      email: String(contact.email || ""),
      openingHours: String(contact.openingHours || "星期一至日 11:00 - 20:00"),
      googleMapEmbedUrl: String(contact.googleMapEmbedUrl || ""),
      other: String(contact.other || "請在這裡填寫其他聯絡資料。"),
      isActive: contact.isActive !== false
    };
  }

  function normalizeRemoteContactContent(data) {
    if (!data || data.type !== "contact" || typeof data.isActive !== "boolean") return null;
    const stringFields = ["title", "subtitle", "address", "phone", "email", "openingHours", "googleMapEmbedUrl", "other"];
    if (!stringFields.every((field) => typeof data[field] === "string")) return null;
    return {
      type: "contact",
      title: data.title,
      subtitle: data.subtitle,
      address: data.address,
      phone: data.phone,
      email: data.email,
      openingHours: data.openingHours,
      googleMapEmbedUrl: data.googleMapEmbedUrl,
      other: data.other,
      isActive: data.isActive
    };
  }

  function currentContactContent() {
    const fallback = fallbackContactContent();
    if (!state.contactContent) return fallback;
    return {
      ...fallback,
      ...state.contactContent,
      title: state.contactContent.title || fallback.title
    };
  }

  function fallbackAboutContent() {
    const about = siteConfig.about || {};
    const firstSection = Array.isArray(about.sections) ? about.sections[0] || {} : {};
    return {
      type: "about",
      title: String(about.title || "關於我們"),
      subtitle: String(about.subtitle || about.companyName || ""),
      intro: String(about.intro || "請在 assets/site-config.js 填寫公司簡介。"),
      sectionTitle: String(about.sectionTitle || firstSection.heading || ""),
      sectionContent: String(about.sectionContent || firstSection.content || ""),
      imageUrl: String(about.imageUrl || ""),
      imageAlt: String(about.imageAlt || about.title || "About"),
      isActive: about.isActive !== false
    };
  }

  function normalizeRemoteAboutContent(data) {
    if (!data || data.type !== "about" || typeof data.isActive !== "boolean") return null;
    const stringFields = ["title", "subtitle", "intro", "sectionTitle", "sectionContent", "imageUrl", "imageAlt"];
    if (!stringFields.every((field) => typeof data[field] === "string")) return null;
    return {
      type: "about",
      title: data.title,
      subtitle: data.subtitle,
      intro: data.intro,
      sectionTitle: data.sectionTitle,
      sectionContent: data.sectionContent,
      imageUrl: data.imageUrl,
      imageAlt: data.imageAlt,
      isActive: data.isActive
    };
  }

  function currentAboutContent() {
    const fallback = fallbackAboutContent();
    if (!state.aboutContent) return fallback;
    return {
      ...fallback,
      ...state.aboutContent,
      title: state.aboutContent.title || fallback.title,
      imageAlt: state.aboutContent.imageAlt || fallback.imageAlt
    };
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

  function merchantDashboardUrl() {
    return `${rootPrefix()}merchant-dashboard.html`;
  }

  function isMerchantUid(uid) {
    const merchantIds = Array.isArray(window.merchantUids) ? window.merchantUids : [];
    return merchantIds.includes(String(uid || "").trim());
  }

  function initAuthEntryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const auth = String(params.get("auth") || "").trim();
    const redirect = String(params.get("redirect") || "").trim();
    if (redirect) state.authRedirect = redirect;
    if (auth === "login") state.authEntryRequested = true;
    if (!auth && !redirect) return;
    params.delete("auth");
    params.delete("redirect");
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
          <div class="product-gallery__thumbs" aria-label="商品圖片導航">
            ${images.map((image, index) => `
              <button class="thumb ${index === 0 ? "is-active" : ""}" type="button" data-scroll-to-image="${index}" aria-label="移動到商品圖片 ${index + 1}" aria-controls="product-image-${index}" aria-pressed="${index === 0 ? "true" : "false"}">
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
        <button class="auth-modal__close" type="button" data-close-auth-modal aria-label="關閉登入註冊視窗">×</button>
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
    state.currentUser = user || null;
    if (!state.currentUser) closeAccountMenu();
    updateAuthNav();
  }

  function currentUserLabel(user = state.currentUser) {
    return user?.displayName || user?.email || "會員";
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
      <p>已登入</p>
      <strong>${escapeHtml(currentUserLabel())}</strong>
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
      return Promise.reject(new Error("Firebase 尚未載入。"));
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
      "auth/email-already-in-use": "此電郵已經註冊，請直接登入。",
      "auth/invalid-email": "請輸入有效的電郵地址。",
      "auth/weak-password": "密碼至少需要 6 個字元。",
      "auth/missing-password": "請輸入密碼。",
      "auth/invalid-credential": "電郵或密碼不正確。",
      "auth/user-not-found": "電郵或密碼不正確。",
      "auth/wrong-password": "電郵或密碼不正確。",
      "auth/popup-closed-by-user": "Google 登入視窗已關閉。",
      "auth/popup-blocked": "瀏覽器已阻擋 Google 登入視窗，請允許彈出視窗後重試。",
      "auth/unauthorized-domain": "目前網域尚未加入 Firebase 授權網域。",
      "auth/operation-not-allowed": "此登入方式尚未在 Firebase Console 啟用。",
      "auth/too-many-requests": "嘗試次數過多，請稍後再試。",
      "auth/network-request-failed": "網絡連線失敗，請檢查連線後重試。",
      "auth/operation-not-supported-in-this-environment": "請透過本地伺服器或正式網址開啟網站後再登入。"
    };
    return messages[code] || "會員服務暫時無法完成操作，請稍後再試。";
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
      firebase.onAuthStateChanged(firebase.auth, (user) => {
        const normalizedUser = normalizeFirebaseUser(user);
        setCurrentUserFromFirebase(normalizedUser);
        if (normalizedUser && state.authRedirect === "merchant-dashboard" && isMerchantUid(normalizedUser.uid)) {
          state.authRedirect = "";
          window.location.replace(merchantDashboardUrl());
          return;
        }
        if (!normalizedUser && state.authEntryRequested) {
          state.authEntryRequested = false;
          openAuthModal("login");
        }
      });
    } catch (error) {
      console.error("Firebase Authentication 初始化失敗：", error);
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
      <p class="auth-field-label">請輸入你的電郵</p>
      <label class="auth-input">
        <input class="auth-field-email" type="email" autocomplete="email" placeholder="電郵地址">
      </label>
      <label class="auth-input">
        <input class="auth-field-password" type="password" autocomplete="${state.authMode === "login" ? "current-password" : "new-password"}" placeholder="密碼">
      </label>
      ${state.authMode === "register" ? `
        <label class="auth-input">
          <input class="auth-field-confirm" type="password" autocomplete="new-password" placeholder="確認密碼">
        </label>
      ` : `
        <button class="auth-text-button auth-forgot" type="button" data-auth-reset>忘記密碼？</button>
      `}
      <button class="auth-submit" type="button" data-auth-submit disabled>${submitText}</button>
      <div class="auth-divider"><span>或一鍵登入</span></div>
      <button class="auth-social" type="button" data-auth-social="google">使用 Google ${socialText}</button>
    `;
  }

  function renderAuthModal() {
    ensureAuthModal();
    const title = state.authMode === "login" ? "你好！歡迎回來。" : "註冊";
    const switchText = state.authMode === "login" ? "新用戶？" : "已有帳號？";
    const switchTarget = state.authMode === "login" ? "register" : "login";
    const switchLabel = state.authMode === "login" ? "註冊" : "登入";

    $(".auth-modal__content").innerHTML = `
      <h2 id="authModalTitle">${title}</h2>
      <p class="auth-switch">${switchText}<button type="button" data-auth-mode="${switchTarget}">${switchLabel}</button></p>
      ${state.authMode === "register" ? '<p class="auth-intro">成為會員即可獲取最新資訊及優惠！</p>' : ""}
      <div class="auth-form" data-auth-form>
        ${renderAuthFields()}
      </div>
      <p class="auth-message" aria-live="polite"></p>
      <p class="auth-terms">繼續即代表你同意本店的 <a href="#terms">服務條款</a> 及 <a href="#privacy">私隱政策</a>。</p>
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

  async function handleRegister() {
    const email = $(".auth-field-email")?.value.trim();
    const password = $(".auth-field-password")?.value;
    const confirmPassword = $(".auth-field-confirm")?.value;
    if (!email || !password || !confirmPassword) return setAuthMessage("請填寫電郵、密碼和確認密碼。", "error");
    if (password !== confirmPassword) return setAuthMessage("兩次輸入的密碼不一致。", "error");
    if (password.length < 6) return setAuthMessage("密碼至少需要 6 個字元。", "error");

    setAuthBusy(true);
    setAuthMessage("正在建立帳戶…");
    try {
      const firebase = await getFirebaseService();
      await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
      closeAuthModal();
      showToast("註冊成功，已為你登入。");
    } catch (error) {
      setAuthMessage(firebaseAuthMessage(error), "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin() {
    const email = $(".auth-field-email")?.value.trim();
    const password = $(".auth-field-password")?.value;
    if (!email || !password) return setAuthMessage("請填寫電郵和密碼。", "error");

    setAuthBusy(true);
    setAuthMessage("正在登入…");
    try {
      const firebase = await getFirebaseService();
      await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
      closeAuthModal();
      showToast("登入成功。");
    } catch (error) {
      setAuthMessage(firebaseAuthMessage(error), "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setAuthBusy(true);
    setAuthMessage("正在開啟 Google 登入…");
    try {
      const firebase = await getFirebaseService();
      await firebase.signInWithPopup(firebase.auth, firebase.googleProvider);
      closeAuthModal();
      showToast("Google 登入成功。");
    } catch (error) {
      setAuthMessage(firebaseAuthMessage(error), "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordReset() {
    const email = $(".auth-field-email")?.value.trim();
    if (!email) return setAuthMessage("請先輸入需要重設密碼的電郵地址。", "error");

    setAuthBusy(true);
    try {
      const firebase = await getFirebaseService();
      await firebase.sendPasswordResetEmail(firebase.auth, email);
      setAuthMessage("重設密碼電郵已發送，請檢查收件箱。", "success");
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
      showToast("已登出。");
    } catch (error) {
      closeAccountMenu();
      showToast(firebaseAuthMessage(error));
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
      showToast("找不到此商品，無法加入購物車");
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
    showToast("購物車已清空");
  }

  function cartTotals() {
    return state.cart.reduce(
      (totals, item) => {
        const product = findProduct(item.productId);
        if (!product) return totals;
        totals.quantity += item.quantity;
        totals.amount += product.price * item.quantity;
        return totals;
      },
      { quantity: 0, amount: 0 }
    );
  }

  function renderCart() {
    const totals = cartTotals();

    $$(".cart-items").forEach((container) => {
      if (!state.cart.length) {
        container.innerHTML = '<p class="empty-cart">你的購物車目前是空的</p>';
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
    $$(".checkout-button").forEach((button) => {
      button.textContent = totals.amount ? `前往結帳 ${formatPrice(totals.amount)}` : "前往結帳";
    });
    $$(".shipping-progress").forEach((node) => {
      const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - totals.amount);
      node.textContent = remaining > 0
        ? `再消費 ${formatPrice(remaining)} 即享免運`
        : "此訂單已符合免運門檻";
    });
  }

  function updateCartBadge() {
    const totals = cartTotals();
    $$(".cart-count").forEach((node) => {
      node.textContent = String(totals.quantity);
    });
  }

  function renderProductGrid(items = products, targetGrid = null, emptyMessage = "沒有符合篩選條件的商品") {
    const grid = targetGrid || $("[data-products-grid]");
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = `<p class="filter-empty" role="status">${escapeHtml(emptyMessage)}</p>`;
      return;
    }

    // 所有符合目前條件的商品一次顯示，不進行分頁或截取。
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
          <button class="quick-add" type="button" data-add-cart data-product-id="${product.id}" aria-label="將 ${escapeHtml(product.name)} 加入購物車" ${stock <= 0 ? "disabled" : ""}>${stock <= 0 ? "缺貨" : "加入購物車"}</button>
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
          <input id="searchInput" type="search" placeholder="請輸入商品名稱或關鍵字" autocomplete="off">
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
      container.innerHTML = '<p class="search-modal__empty">請輸入商品名稱或關鍵字</p>';
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
          <h1>找不到此商品</h1>
          <p>此商品可能已下架，或商品連結有誤。</p>
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

        <aside class="product-info" aria-label="商品購買資訊">
          <a class="return-link product-return" href="${listUrl()}">返回商品列表</a>
          <h1>${escapeHtml(product.name)}</h1>
          <p class="product-price">${formatPrice(product.price)}</p>
          <p class="product-intro">${escapeHtml(descriptions[0] || "")}</p>

          ${detailParagraphs.length ? `<section class="accordion product-accordion is-open">
            <button type="button" aria-expanded="true" class="accordion-toggle">商品詳情 / 規格</button>
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

          <p class="installment">滿 <strong>${formatPrice(FREE_SHIPPING_THRESHOLD)}</strong> 即享免運<br><a href="#learn-more">了解更多</a></p>

          ${promotionNotice || pointsNotice ? `
            <div class="product-perks" aria-label="商品優惠與會員積分">
              ${promotionNotice ? `<p><span class="perk-icon box"></span>${escapeHtml(promotionNotice)}</p>` : ""}
              ${pointsNotice ? `<p><span class="perk-icon medal"></span>${escapeHtml(pointsNotice)}</p>` : ""}
            </div>
          ` : ""}
        </aside>
      </section>

      <section class="details-strip">
        <article>
          <span class="detail-icon clock"></span>
          <h2>香氣時長</h2>
          <p>${escapeHtml(detailParagraphs[0] || descriptions[0] || "商戶可自行修改商品規格")}</p>
        </article>
        <article>
          <span class="detail-icon leaf"></span>
          <h2>精緻配方</h2>
          <p>以居家使用情境設計，商品描述與規格皆可由商戶自行維護。</p>
        </article>
        <article>
          <span class="detail-icon map"></span>
          <h2>商店選品</h2>
          <p>圖片、價格、庫存與文字皆集中於商品資料中，方便後續接後端。</p>
        </article>
      </section>
    `;
    setupProductImageObserver();
  }

  function renderAboutPageLegacy() {
    const container = $("[data-about-page]");
    if (!container) return;
    const about = siteConfig.about || {};
    document.title = `${about.title || "關於我們"} - APOTHEKE`;
    container.innerHTML = `
      <section class="info-page">
        <h1>${escapeHtml(about.title || "關於我們")}</h1>
        <h2>${escapeHtml(about.companyName || "你的公司名稱")}</h2>
        <p class="info-intro">${textToHtml(about.intro || "請在 assets/site-config.js 填寫公司簡介。")}</p>
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

  function renderContactPageLegacy() {
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
              <h2>店鋪地址</h2>
              <p>${textToHtml(contact.address || "請在這裡填寫店鋪地址")}</p>
            </article>
            <article>
              <h2>開店時間</h2>
              <p>${textToHtml(contact.openingHours || "星期一至日 11:00 - 20:00")}</p>
            </article>
            <article>
              <h2>聯絡電話</h2>
              <p>${textToHtml(contact.phone || "+852 0000 0000")}</p>
            </article>
            <article>
              <h2>其他資料</h2>
              <p>${textToHtml(contact.other || "請在這裡填寫其他聯絡資料。")}</p>
            </article>
          </div>
          <div class="map-panel">
            ${mapUrl
              ? `<iframe src="${escapeHtml(mapUrl)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Google Map"></iframe>`
              : `<div class="map-placeholder">請在後台設定 Google Map 連結</div>`}
          </div>
        </div>
      </section>
    `;
  }

  function renderAboutPage() {
    const container = $("[data-about-page]");
    if (!container) return;
    const about = currentAboutContent();
    const aboutImage = resolveAssetUrl(about.imageUrl);
    document.title = `${about.title || "About"} - APOTHEKE`;

    if (!about.isActive) {
      container.innerHTML = `
        <section class="info-page about-page">
          <h1>${escapeHtml(about.title || "About")}</h1>
          ${about.subtitle ? `<h2>${escapeHtml(about.subtitle)}</h2>` : ""}
        </section>
      `;
      return;
    }

    container.innerHTML = `
      <section class="info-page about-page">
        <div class="about-page__layout">
          <div class="about-page__content">
            <h1>${escapeHtml(about.title || "About")}</h1>
            ${about.subtitle ? `<h2>${escapeHtml(about.subtitle)}</h2>` : ""}
            ${about.intro ? `<p class="info-intro">${textToHtml(about.intro)}</p>` : ""}
            ${(about.sectionTitle || about.sectionContent) ? `
              <div class="info-sections">
                <article>
                  ${about.sectionTitle ? `<h3>${escapeHtml(about.sectionTitle)}</h3>` : ""}
                  ${about.sectionContent ? `<p>${textToHtml(about.sectionContent)}</p>` : ""}
                </article>
              </div>
            ` : ""}
          </div>
          ${aboutImage ? `
            <figure class="about-page__image">
              <img src="${escapeHtml(aboutImage)}" alt="${escapeHtml(about.imageAlt || about.title || "About")}">
            </figure>
          ` : ""}
        </div>
      </section>
    `;
  }

  async function loadAboutContent() {
    if (state.aboutContentLoadStarted || !document.querySelector("[data-about-page]")) return;
    state.aboutContentLoadStarted = true;
    try {
      const firebase = await getFirebaseService();
      const content = normalizeRemoteAboutContent(await firebase.getSiteContent("about"));
      if (!content) return;
      state.aboutContent = content;
      renderAboutPage();
    } catch (error) {
      console.warn("About content load failed; using site-config fallback.", error);
    }
  }

  function renderContactPage() {
    const container = $("[data-contact-page]");
    if (!container) return;
    const contact = currentContactContent();
    document.title = `${contact.title || "Contact"} - APOTHEKE`;
    const mapUrl = String(contact.googleMapEmbedUrl || "").trim();
    const phone = String(contact.phone || "").trim();
    const phoneHref = phone.replace(/[^+\d]/g, "");
    const email = String(contact.email || "").trim();

    if (!contact.isActive) {
      container.innerHTML = `
        <section class="info-page contact-page">
          <h1>${escapeHtml(contact.title || "Contact")}</h1>
          ${contact.subtitle ? `<p class="info-intro">${textToHtml(contact.subtitle)}</p>` : ""}
        </section>
      `;
      return;
    }

    container.innerHTML = `
      <section class="info-page contact-page">
        <h1>${escapeHtml(contact.title || "Contact")}</h1>
        ${contact.subtitle ? `<p class="info-intro">${textToHtml(contact.subtitle)}</p>` : ""}
        <div class="contact-layout">
          <div class="contact-details">
            <article>
              <h2>Address</h2>
              <p>${textToHtml(contact.address)}</p>
            </article>
            <article>
              <h2>Opening Hours</h2>
              <p>${textToHtml(contact.openingHours)}</p>
            </article>
            <article>
              <h2>Phone</h2>
              <p>${phoneHref ? `<a href="tel:${escapeHtml(phoneHref)}">${escapeHtml(phone)}</a>` : escapeHtml(phone)}</p>
            </article>
            ${email ? `
              <article>
                <h2>Email</h2>
                <p><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
              </article>
            ` : ""}
            <article>
              <h2>Other</h2>
              <p>${textToHtml(contact.other)}</p>
            </article>
          </div>
          <div class="map-panel">
            ${mapUrl
              ? `<iframe src="${escapeHtml(mapUrl)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Google Map"></iframe>`
              : `<div class="map-placeholder">Google Map has not been configured.</div>`}
          </div>
        </div>
      </section>
    `;
  }

  async function loadContactContent() {
    if (state.contactContentLoadStarted || !document.querySelector("[data-contact-page]")) return;
    state.contactContentLoadStarted = true;
    try {
      const firebase = await getFirebaseService();
      const content = normalizeRemoteContactContent(await firebase.getSiteContent("contact"));
      if (!content) return;
      state.contactContent = content;
      renderContactPage();
    } catch (error) {
      console.warn("Contact content load failed; using site-config fallback.", error);
    }
  }

  function renderPolicyPage() {
    const container = $("[data-policy-page]");
    if (!container) return;

    const type = document.body.dataset.policyType || container.dataset.policyType || "";
    const policy = siteConfig.policies?.[type];
    const title = policy?.title || "商店政策";
    const content = policy?.content || "請在 assets/site-config.js 填寫此政策內容。";
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
    const hero = currentHomeHero(home);
    const heroImage = resolveAssetUrl(hero.imageUrl);
    const heroHref = resolveLinkUrl(hero.buttonHref);
    const heroHasCopy = Boolean(hero.title || hero.subtitle || (hero.buttonText && heroHref));
    container.innerHTML = `
      ${hero.isActive ? `
        <section class="home-banner home-hero" aria-label="${escapeHtml(hero.imageAlt || home.bannerAlt || "店舖 Banner")}">
          ${heroImage ? `<img class="home-hero__image" src="${escapeHtml(heroImage)}" alt="${escapeHtml(hero.imageAlt || "APOTHEKE 店舖")}">` : ""}
          ${heroHasCopy ? `
            <div class="home-hero__content">
              ${hero.title ? `<h1>${escapeHtml(hero.title)}</h1>` : ""}
              ${hero.subtitle ? `<p>${textToHtml(hero.subtitle)}</p>` : ""}
              ${hero.buttonText && heroHref ? `<a class="home-hero__button" href="${escapeHtml(heroHref)}">${escapeHtml(hero.buttonText)}</a>` : ""}
            </div>
          ` : ""}
        </section>
      ` : ""}
      <section class="home-products" aria-labelledby="homeProductsTitle">
        <h1 id="homeProductsTitle">${escapeHtml(home.productsTitle || "熱門商品")}</h1>
        <div class="product-grid home-products__grid" data-home-products-grid aria-label="首頁推薦商品"></div>
      </section>
    `;
    renderProductGrid(featuredProducts, $("[data-home-products-grid]", container), "暫時沒有推薦商品");
  }

  async function loadHomeHeroContent() {
    if (state.homeHeroLoadStarted || !document.querySelector("[data-home-page]")) return;
    state.homeHeroLoadStarted = true;
    try {
      const firebase = await getFirebaseService();
      const content = normalizeRemoteHomeHero(await firebase.getSiteContent("home"));
      if (!content) return;
      state.homeHero = content;
      renderHomePage();
    } catch (error) {
      console.warn("Home hero content load failed; using site-config fallback.", error);
    }
  }

  function renderSiteFooterLegacy() {
    if (!$(".site-header")) return;

    const footerData = currentSiteFooter();
    const existingFooter = $("[data-site-footer]");
    if (!footerData.isActive) {
      existingFooter?.remove();
      return;
    }

    const logoText = String(footerData.logoText || "APOTHEKE").trim();
    const description = String(footerData.description || "").trim();
    const phone = String(footerData.phone || "").trim();
    const phoneHref = phone.replace(/[^+\d]/g, "");
    const address = contact.address || "請在這裡填寫店鋪地址";
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.dataset.siteFooter = "";
    footer.innerHTML = `
      <div class="site-footer__inner">
        <a class="site-footer__brand" href="${homeUrl()}" aria-label="${escapeHtml(logoText)} 首頁">${escapeHtml(logoText)}</a>
        <div>
          <span class="site-footer__label">聯絡電話</span>
          ${phoneHref
            ? `<a class="site-footer__value" href="tel:${escapeHtml(phoneHref)}">${escapeHtml(phone)}</a>`
            : `<span class="site-footer__value">${escapeHtml(phone)}</span>`}
        </div>
        <div>
          <span class="site-footer__label">店鋪地址</span>
          <address>${textToHtml(address)}</address>
        </div>
      </div>
    `;

    const main = $("main");
    if (main) main.insertAdjacentElement("afterend", footer);
    else document.body.appendChild(footer);
  }

  function renderSiteFooter() {
    if (!$(".site-header")) return;

    const footerData = currentSiteFooter();
    const existingFooter = $("[data-site-footer]");
    if (!footerData.isActive) {
      existingFooter?.remove();
      return;
    }

    const logoText = String(footerData.logoText || "APOTHEKE").trim();
    const description = String(footerData.description || "").trim();
    const phone = String(footerData.phone || "").trim();
    const phoneHref = phone.replace(/[^+\d]/g, "");
    const email = String(footerData.email || "").trim();
    const emailHref = email ? `mailto:${email}` : "";
    const address = String(footerData.address || "").trim();
    const copyright = String(footerData.copyright || "").trim();
    const instagramUrl = resolveLinkUrl(footerData.instagramUrl);
    const facebookUrl = resolveLinkUrl(footerData.facebookUrl);
    const socialLinks = [
      instagramUrl ? `<a class="site-footer__social-link" href="${escapeHtml(instagramUrl)}" target="_blank" rel="noopener noreferrer">Instagram</a>` : "",
      facebookUrl ? `<a class="site-footer__social-link" href="${escapeHtml(facebookUrl)}" target="_blank" rel="noopener noreferrer">Facebook</a>` : ""
    ].filter(Boolean).join("");
    const footer = existingFooter || document.createElement("footer");
    footer.className = "site-footer";
    footer.dataset.siteFooter = "";
    footer.innerHTML = `
      <div class="site-footer__inner">
        <div class="site-footer__brand-group">
          <a class="site-footer__brand" href="${homeUrl()}" aria-label="${escapeHtml(logoText)} home">${escapeHtml(logoText)}</a>
          ${description ? `<p class="site-footer__description">${textToHtml(description)}</p>` : ""}
          ${socialLinks ? `<div class="site-footer__social">${socialLinks}</div>` : ""}
        </div>
        <div>
          <span class="site-footer__label">Phone</span>
          ${phoneHref
            ? `<a class="site-footer__value" href="tel:${escapeHtml(phoneHref)}">${escapeHtml(phone)}</a>`
            : `<span class="site-footer__value">${escapeHtml(phone)}</span>`}
          ${email ? `<a class="site-footer__value site-footer__email" href="${escapeHtml(emailHref)}">${escapeHtml(email)}</a>` : ""}
        </div>
        <div>
          <span class="site-footer__label">Address</span>
          <address>${textToHtml(address)}</address>
          ${copyright ? `<small class="site-footer__copyright">${escapeHtml(copyright)}</small>` : ""}
        </div>
      </div>
    `;

    if (!existingFooter) {
      const main = $("main");
      if (main) main.insertAdjacentElement("afterend", footer);
      else document.body.appendChild(footer);
    }
  }

  async function loadSiteFooterContent() {
    if (state.siteFooterLoadStarted || !$("[data-site-footer]")) return;
    state.siteFooterLoadStarted = true;
    try {
      const firebase = await getFirebaseService();
      const content = normalizeRemoteSiteFooter(await firebase.getSiteContent("footer"));
      if (!content) return;
      state.siteFooter = content;
      renderSiteFooter();
    } catch (error) {
      console.warn("Footer content load failed; using site-config fallback.", error);
    }
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
              <option value="relevant">預設排序</option>
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
            <input type="range" step="1" data-price-range-min aria-label="調整最低價格">
            <input type="range" step="1" data-price-range-max aria-label="調整最高價格">
          </div>
        </div>
      </section>
      <section class="filter-section is-open">
        <button class="filter-section-toggle" type="button" aria-expanded="true">庫存狀態</button>
        <div class="filter-content filter-options">
          <label><input type="checkbox" value="in-stock" data-filter-stock-status><span></span>有存貨</label>
          <label><input type="checkbox" value="out-of-stock" data-filter-stock-status><span></span>缺貨</label>
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
        <button class="filter-section-toggle" type="button" aria-expanded="true">類別</button>
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
    showToast("篩選條件已套用");
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
      <button class="drawer-close" type="button" data-close-drawer aria-label="關閉篩選">x</button>
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
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-filter-min-price]")) updatePriceFilter("min", event.target.value);
    if (event.target.matches("[data-filter-max-price]")) updatePriceFilter("max", event.target.value);
    if (event.target.matches("[data-price-range-min]")) updatePriceFilter("min", event.target.value);
    if (event.target.matches("[data-price-range-max]")) updatePriceFilter("max", event.target.value);

    if (event.target.closest("#authModal")) {
      updateAuthSubmitState();
    }
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
  loadHomeHeroContent();
  renderProductDetail();
  renderAboutPage();
  loadAboutContent();
  renderContactPage();
  loadContactContent();
  renderPolicyPage();
  renderSiteFooter();
  loadSiteFooterContent();
  window.localStorage.removeItem(LEGACY_USERS_KEY);
  window.localStorage.removeItem("onlineShopCurrentUser");
  updateAuthNav();
  initFirebaseAuth();
  loadCart();
  renderCart();
  updateCartBadge();
  if (document.body?.dataset.page !== "merchant") {
    window.ONLINE_SHOP_PRODUCT_ADMIN_STORE?.initializePublicProducts();
  }
})();
