(function () {
  const merchantUids = [
    "q03M83yAzAfFMnHRZBcvDusykMy2",
    "bMUXPPo7KPX7bIL14fzCwvFExYG2"
  ];
  const MERCHANT_UID_SET = new Set(merchantUids.map((uid) => String(uid || "").trim()).filter(Boolean));
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const container = document.querySelector("[data-merchant-page]");
  const store = window.ONLINE_SHOP_PRODUCT_ADMIN_STORE;
  let currentMerchant = null;
  let editingProductId = null;
  let deletingProductId = null;
  let deletingProductImages = [];
  let editorCategoryAssignments = [];
  let editorImages = [];
  let removedImageUrls = [];
  let sortable = null;
  let categoryDraft = [];
  let originalCategoryIds = [];
  let categorySortables = [];
  let currentMerchantRole = null;
  let currentMerchantRoleLoaded = false;
  let currentMerchantRoleLoading = false;
  let currentMerchantRoleError = null;
  let merchantRoleRequest = null;
  let homeHeroDraft = null;
  let homeHeroLoading = false;
  let homeHeroSaving = false;
  let homeHeroUploading = false;
  let footerDraft = null;
  let footerLoading = false;
  let footerSaving = false;
  let contactDraft = null;
  let contactLoading = false;
  let contactSaving = false;
  let aboutDraft = null;
  let aboutLoading = false;
  let aboutSaving = false;
  let activeHomeHeroFieldId = null;
  let activeFooterFieldId = null;
  let activeContactFieldId = null;
  let activeAboutFieldId = null;
  let suppressHomeHeroFocusActivation = false;
  let suppressFooterFocusActivation = false;
  let suppressContactFocusActivation = false;
  let suppressAboutFocusActivation = false;

  const HOME_HERO_FIELD_TO_PREVIEW_FIELD = {
    "homeHero.imageAlt": "homeHero.imageUrl",
    "homeHero.buttonHref": "homeHero.buttonText",
    "homeHero.isActive": "homeHero"
  };

  const FOOTER_FIELD_TO_PREVIEW_FIELD = {
    "footer.isActive": "footer"
  };

  const CONTACT_FIELD_TO_PREVIEW_FIELD = {
    "contact.isActive": "contact"
  };

  const ABOUT_FIELD_TO_PREVIEW_FIELD = {
    "about.imageAlt": "about.imageUrl",
    "about.isActive": "about"
  };

  window.merchantUids = merchantUids;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function textToHtml(value) {
    return escapeHtml(value).replace(/\r?\n/g, "<br>");
  }

  function uniqueStrings(values) {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function lines(value) {
    return uniqueStrings(String(value || "").split(/\r?\n/));
  }

  function resetMerchantRoleState() {
    currentMerchantRole = null;
    currentMerchantRoleLoaded = false;
    currentMerchantRoleLoading = false;
    currentMerchantRoleError = null;
    merchantRoleRequest = null;
  }

  function isAllowedMerchant(user) {
    return MERCHANT_UID_SET.has(String(user?.uid || "").trim());
  }

  function rootPrefix() {
    return document.body?.dataset.rootPrefix || "";
  }

  function isAbsoluteOrRootUrl(value) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(String(value || "").trim());
  }

  function resolvePreviewUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    return isAbsoluteOrRootUrl(url) ? url : `${rootPrefix()}${url}`;
  }

  function findDataAttribute(root, attribute, value) {
    return Array.from(root.querySelectorAll(`[${attribute}]`))
      .find((node) => node.getAttribute(attribute) === value) || null;
  }

  function previewFieldForHomeHeroField(fieldId) {
    return HOME_HERO_FIELD_TO_PREVIEW_FIELD[fieldId] || fieldId;
  }

  function findHomeHeroPreviewTarget(fieldId) {
    const previewRoot = findDataAttribute(document, "data-preview-id", "homeHero");
    if (!previewRoot) return null;
    const previewFieldId = previewFieldForHomeHeroField(fieldId);
    if (previewFieldId === "homeHero") return previewRoot;
    return findDataAttribute(previewRoot, "data-preview-field", previewFieldId);
  }

  function findHomeHeroEditorTarget(fieldId) {
    const form = document.querySelector("[data-home-hero-form]");
    if (!form) return null;
    return findDataAttribute(form, "data-editor-field", fieldId);
  }

  function clearHomeHeroVisualSelection() {
    document
      .querySelectorAll('[data-preview-id="homeHero"].is-visual-edit-active, [data-preview-id="homeHero"] .is-visual-edit-active, [data-home-hero-form] .is-visual-edit-active')
      .forEach((node) => node.classList.remove("is-visual-edit-active"));
  }

  function applyHomeHeroVisualSelection() {
    clearHomeHeroVisualSelection();
    if (!activeHomeHeroFieldId) return;
    const previewTarget = findHomeHeroPreviewTarget(activeHomeHeroFieldId);
    const editorTarget = findHomeHeroEditorTarget(activeHomeHeroFieldId);
    if (previewTarget) previewTarget.classList.add("is-visual-edit-active");
    if (editorTarget) editorTarget.classList.add("is-visual-edit-active");
  }

  function activateHomeHeroField(fieldId, source) {
    if (!fieldId) return;
    activeHomeHeroFieldId = fieldId;
    applyHomeHeroVisualSelection();

    const previewTarget = findHomeHeroPreviewTarget(fieldId);
    const editorTarget = findHomeHeroEditorTarget(fieldId);

    if (source === "editor" && previewTarget) {
      previewTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    if (source === "preview" && editorTarget) {
      editorTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const focusTarget = editorTarget.matches("input, textarea, button")
        ? editorTarget
        : editorTarget.querySelector("input, textarea, button");
      if (focusTarget) {
        suppressHomeHeroFocusActivation = true;
        focusTarget.focus({ preventScroll: true });
        window.setTimeout(() => {
          suppressHomeHeroFocusActivation = false;
        }, 0);
      }
    }
  }

  function previewFieldForFooterField(fieldId) {
    return FOOTER_FIELD_TO_PREVIEW_FIELD[fieldId] || fieldId;
  }

  function findFooterPreviewTarget(fieldId) {
    const previewRoot = findDataAttribute(document, "data-preview-id", "footer");
    if (!previewRoot) return null;
    const previewFieldId = previewFieldForFooterField(fieldId);
    if (previewFieldId === "footer") return previewRoot;
    return findDataAttribute(previewRoot, "data-preview-field", previewFieldId);
  }

  function findFooterEditorTarget(fieldId) {
    const form = document.querySelector("[data-footer-form]");
    if (!form) return null;
    return findDataAttribute(form, "data-editor-field", fieldId);
  }

  function clearFooterVisualSelection() {
    document
      .querySelectorAll('[data-preview-id="footer"].is-visual-edit-active, [data-preview-id="footer"] .is-visual-edit-active, [data-footer-form] .is-visual-edit-active')
      .forEach((node) => node.classList.remove("is-visual-edit-active"));
  }

  function applyFooterVisualSelection() {
    clearFooterVisualSelection();
    if (!activeFooterFieldId) return;
    const previewTarget = findFooterPreviewTarget(activeFooterFieldId);
    const editorTarget = findFooterEditorTarget(activeFooterFieldId);
    if (previewTarget) previewTarget.classList.add("is-visual-edit-active");
    if (editorTarget) editorTarget.classList.add("is-visual-edit-active");
  }

  function activateFooterField(fieldId, source) {
    if (!fieldId) return;
    activeFooterFieldId = fieldId;
    applyFooterVisualSelection();

    const previewTarget = findFooterPreviewTarget(fieldId);
    const editorTarget = findFooterEditorTarget(fieldId);

    if (source === "editor" && previewTarget) {
      previewTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    if (source === "preview" && editorTarget) {
      editorTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const focusTarget = editorTarget.matches("input, textarea, button")
        ? editorTarget
        : editorTarget.querySelector("input, textarea, button");
      if (focusTarget) {
        suppressFooterFocusActivation = true;
        focusTarget.focus({ preventScroll: true });
        window.setTimeout(() => {
          suppressFooterFocusActivation = false;
        }, 0);
      }
    }
  }

  function previewFieldForContactField(fieldId) {
    return CONTACT_FIELD_TO_PREVIEW_FIELD[fieldId] || fieldId;
  }

  function findContactPreviewTarget(fieldId) {
    const previewRoot = findDataAttribute(document, "data-preview-id", "contact");
    if (!previewRoot) return null;
    const previewFieldId = previewFieldForContactField(fieldId);
    if (previewFieldId === "contact") return previewRoot;
    return findDataAttribute(previewRoot, "data-preview-field", previewFieldId);
  }

  function findContactEditorTarget(fieldId) {
    const form = document.querySelector("[data-contact-form]");
    if (!form) return null;
    return findDataAttribute(form, "data-editor-field", fieldId);
  }

  function clearContactVisualSelection() {
    document
      .querySelectorAll('[data-preview-id="contact"].is-visual-edit-active, [data-preview-id="contact"] .is-visual-edit-active, [data-contact-form] .is-visual-edit-active')
      .forEach((node) => node.classList.remove("is-visual-edit-active"));
  }

  function applyContactVisualSelection() {
    clearContactVisualSelection();
    if (!activeContactFieldId) return;
    const previewTarget = findContactPreviewTarget(activeContactFieldId);
    const editorTarget = findContactEditorTarget(activeContactFieldId);
    if (previewTarget) previewTarget.classList.add("is-visual-edit-active");
    if (editorTarget) editorTarget.classList.add("is-visual-edit-active");
  }

  function activateContactField(fieldId, source) {
    if (!fieldId) return;
    activeContactFieldId = fieldId;
    applyContactVisualSelection();

    const previewTarget = findContactPreviewTarget(fieldId);
    const editorTarget = findContactEditorTarget(fieldId);

    if (source === "editor" && previewTarget) {
      previewTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    if (source === "preview" && editorTarget) {
      editorTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const focusTarget = editorTarget.matches("input, textarea, button")
        ? editorTarget
        : editorTarget.querySelector("input, textarea, button");
      if (focusTarget) {
        suppressContactFocusActivation = true;
        focusTarget.focus({ preventScroll: true });
        window.setTimeout(() => {
          suppressContactFocusActivation = false;
        }, 0);
      }
    }
  }

  function previewFieldForAboutField(fieldId) {
    return ABOUT_FIELD_TO_PREVIEW_FIELD[fieldId] || fieldId;
  }

  function findAboutPreviewTarget(fieldId) {
    const previewRoot = findDataAttribute(document, "data-preview-id", "about");
    if (!previewRoot) return null;
    const previewFieldId = previewFieldForAboutField(fieldId);
    if (previewFieldId === "about") return previewRoot;
    return findDataAttribute(previewRoot, "data-preview-field", previewFieldId);
  }

  function findAboutEditorTarget(fieldId) {
    const form = document.querySelector("[data-about-form]");
    if (!form) return null;
    return findDataAttribute(form, "data-editor-field", fieldId);
  }

  function clearAboutVisualSelection() {
    document
      .querySelectorAll('[data-preview-id="about"].is-visual-edit-active, [data-preview-id="about"] .is-visual-edit-active, [data-about-form] .is-visual-edit-active')
      .forEach((node) => node.classList.remove("is-visual-edit-active"));
  }

  function applyAboutVisualSelection() {
    clearAboutVisualSelection();
    if (!activeAboutFieldId) return;
    const previewTarget = findAboutPreviewTarget(activeAboutFieldId);
    const editorTarget = findAboutEditorTarget(activeAboutFieldId);
    if (previewTarget) previewTarget.classList.add("is-visual-edit-active");
    if (editorTarget) editorTarget.classList.add("is-visual-edit-active");
  }

  function activateAboutField(fieldId, source) {
    if (!fieldId) return;
    activeAboutFieldId = fieldId;
    applyAboutVisualSelection();

    const previewTarget = findAboutPreviewTarget(fieldId);
    const editorTarget = findAboutEditorTarget(fieldId);

    if (source === "editor" && previewTarget) {
      previewTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    if (source === "preview" && editorTarget) {
      editorTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const focusTarget = editorTarget.matches("input, textarea, button")
        ? editorTarget
        : editorTarget.querySelector("input, textarea, button");
      if (focusTarget) {
        suppressAboutFocusActivation = true;
        focusTarget.focus({ preventScroll: true });
        window.setTimeout(() => {
          suppressAboutFocusActivation = false;
        }, 0);
      }
    }
  }

  function fallbackHomeHero() {
    const home = window.ONLINE_SHOP_SITE_CONFIG?.home || {};
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

  function normalizeHomeHero(data) {
    const fallback = fallbackHomeHero();
    if (!data || data.type !== "homeHero") return fallback;
    return {
      type: "homeHero",
      title: String(data.title ?? fallback.title),
      subtitle: String(data.subtitle ?? fallback.subtitle),
      imageUrl: String(data.imageUrl ?? fallback.imageUrl),
      imagePath: String(data.imagePath ?? ""),
      imageAlt: String(data.imageAlt ?? fallback.imageAlt),
      buttonText: String(data.buttonText ?? fallback.buttonText),
      buttonHref: String(data.buttonHref ?? fallback.buttonHref),
      isActive: typeof data.isActive === "boolean" ? data.isActive : fallback.isActive
    };
  }

  function fallbackFooterContent() {
    const config = window.ONLINE_SHOP_SITE_CONFIG || {};
    const footer = config.footer || {};
    const contact = config.contact || {};
    const logoText = String(footer.logoText || document.querySelector(".brand")?.textContent.trim() || "APOTHEKE");
    return {
      type: "footer",
      logoText,
      description: String(footer.description || ""),
      phone: String(footer.phone || contact.phone || "+852 0000 0000"),
      email: String(footer.email || contact.email || ""),
      address: String(footer.address || contact.address || ""),
      copyright: String(footer.copyright || `© ${new Date().getFullYear()} ${logoText}. All rights reserved.`),
      instagramUrl: String(footer.instagramUrl || ""),
      facebookUrl: String(footer.facebookUrl || ""),
      isActive: footer.isActive !== false
    };
  }

  function normalizeFooterContent(data) {
    const fallback = fallbackFooterContent();
    if (!data || data.type !== "footer") return fallback;
    return {
      type: "footer",
      logoText: String(data.logoText ?? fallback.logoText),
      description: String(data.description ?? fallback.description),
      phone: String(data.phone ?? fallback.phone),
      email: String(data.email ?? fallback.email),
      address: String(data.address ?? fallback.address),
      copyright: String(data.copyright ?? fallback.copyright),
      instagramUrl: String(data.instagramUrl ?? fallback.instagramUrl),
      facebookUrl: String(data.facebookUrl ?? fallback.facebookUrl),
      isActive: typeof data.isActive === "boolean" ? data.isActive : fallback.isActive
    };
  }

  function fallbackContactContent() {
    const contact = window.ONLINE_SHOP_SITE_CONFIG?.contact || {};
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

  function normalizeContactContent(data) {
    const fallback = fallbackContactContent();
    if (!data || data.type !== "contact") return fallback;
    return {
      type: "contact",
      title: String(data.title ?? fallback.title),
      subtitle: String(data.subtitle ?? fallback.subtitle),
      address: String(data.address ?? fallback.address),
      phone: String(data.phone ?? fallback.phone),
      email: String(data.email ?? fallback.email),
      openingHours: String(data.openingHours ?? fallback.openingHours),
      googleMapEmbedUrl: String(data.googleMapEmbedUrl ?? fallback.googleMapEmbedUrl),
      other: String(data.other ?? fallback.other),
      isActive: typeof data.isActive === "boolean" ? data.isActive : fallback.isActive
    };
  }

  function fallbackAboutContent() {
    const about = window.ONLINE_SHOP_SITE_CONFIG?.about || {};
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

  function normalizeAboutContent(data) {
    const fallback = fallbackAboutContent();
    if (!data || data.type !== "about") return fallback;
    return {
      type: "about",
      title: String(data.title ?? fallback.title),
      subtitle: String(data.subtitle ?? fallback.subtitle),
      intro: String(data.intro ?? fallback.intro),
      sectionTitle: String(data.sectionTitle ?? fallback.sectionTitle),
      sectionContent: String(data.sectionContent ?? fallback.sectionContent),
      imageUrl: String(data.imageUrl ?? fallback.imageUrl),
      imageAlt: String(data.imageAlt ?? fallback.imageAlt),
      isActive: typeof data.isActive === "boolean" ? data.isActive : fallback.isActive
    };
  }

  function hasRolePagesWrite(roleData = currentMerchantRole) {
    const permissions = roleData?.permissions || {};
    const role = String(roleData?.role || roleData?.roleName || "").trim();
    const pagesWrite = permissions.pagesWrite === true || roleData?.pagesWrite === true;
    return roleData?.active === true
      && ["merchant", "admin", "super_admin"].includes(role)
      && pagesWrite;
  }

  function pageContentPermissionMessage() {
    if (currentMerchantRoleLoading || !currentMerchantRoleLoaded) return "Checking page content permissions...";
    if (currentMerchantRoleError) return "你目前沒有權限執行這個操作。";
    if (!hasRolePagesWrite()) return "pagesWrite permission is not enabled for this account.";
    return "";
  }

  function canEditPageContent() {
    if (!currentMerchant || !isAllowedMerchant(currentMerchant)) return false;
    if (currentMerchantRoleLoading || !currentMerchantRoleLoaded) return false;
    return hasRolePagesWrite();
  }

  function merchantDashboardUrl() {
    return `${rootPrefix()}merchant-dashboard.html`;
  }

  function storefrontLoginUrl() {
    return `${rootPrefix()}index.html?auth=login&redirect=merchant-dashboard`;
  }

  function isMerchantAreaPage() {
    return ["merchant", "merchant-dashboard"].includes(document.body?.dataset.page || "");
  }

  function isStorefrontPage() {
    return !isMerchantAreaPage();
  }

  function updateMerchantNav(user) {
    document.querySelectorAll("[data-merchant-nav]").forEach((link) => link.remove());
    if (!isAllowedMerchant(user)) return;

    document.querySelectorAll(".desktop-nav").forEach((nav) => {
      const link = document.createElement("a");
      link.className = `nav-link merchant-nav-link${document.body?.dataset.page === "merchant-dashboard" ? " is-active" : ""}`;
      link.href = merchantDashboardUrl();
      link.dataset.merchantNav = "";
      link.textContent = "\u5546\u54c1\u7ba1\u7406";
      nav.querySelector("a")?.insertAdjacentElement("afterend", link);
    });

    const menu = document.querySelector("#menu-drawer");
    if (menu) {
      const link = document.createElement("a");
      link.href = merchantDashboardUrl();
      link.dataset.merchantNav = "";
      link.textContent = "\u5546\u54c1\u7ba1\u7406";
      menu.querySelector("a")?.insertAdjacentElement("afterend", link);
    }
  }

  function renderGate(title, message, actions = "") {
    if (!container) return;
    container.innerHTML = `<section class="merchant-gate"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="merchant-gate__actions">${actions}</div></section>`;
  }

  function showPageError(message) {
    const node = document.querySelector("[data-merchant-page-message]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = "error";
  }

  function merchantErrorMessage(error, fallback) {
    const code = String(error?.code || "");
    const messages = {
      "permission-denied": "你目前沒有權限執行這個操作。",
      "storage/unauthorized": "你目前沒有權限上載或刪除圖片。",
      "unavailable": "目前無法連接 Firebase，請稍後再試。",
      "storage/retry-limit-exceeded": "圖片上載逾時，請稍後再試。"
    };
    return messages[code] || error?.message || fallback;
  }

  function showMerchantToast(message) {
    if (window.showToast) {
      window.showToast(message);
      return;
    }
    const toast = document.querySelector(".toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showMerchantToast.timer);
    showMerchantToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2000);
  }

  function renderMerchantDashboardShell(user) {
    if (!container) return;
    document.title = "\u5546\u6236\u5f8c\u53f0 - APOTHEKE";
    container.innerHTML = `
      <section class="merchant-dashboard">
        <aside class="merchant-dashboard__sidebar" aria-label="\u5546\u6236\u5f8c\u53f0\u5c0e\u89bd">
          <a class="merchant-dashboard__brand" href="${rootPrefix()}index.html" target="_blank" rel="noopener noreferrer">APOTHEKE</a>
          <nav>
            <button type="button" data-merchant-section="users">\u7528\u6236\u7ba1\u7406</button>
            <button type="button" data-merchant-section="sales">\u92b7\u552e\u7ba1\u7406</button>
            <button type="button" data-merchant-section="pages">\u9801\u9762\u5167\u5bb9</button>
            <button class="is-active" type="button" data-merchant-section="products">\u7522\u54c1\u7ba1\u7406</button>
          </nav>
          <div class="merchant-dashboard__account">${escapeHtml(user.displayName || user.email || "\u5546\u6236\u5e33\u865f")}</div>
          <button class="merchant-dashboard__logout" type="button" data-merchant-dashboard-logout>\u767b\u51fa</button>
        </aside>
        <main class="merchant-dashboard__content">
          <section class="merchant-dashboard-section" data-merchant-panel="users">
            <h1>\u7528\u6236\u7ba1\u7406</h1>
            <p>\u9019\u88e1\u6703\u653e\u6703\u54e1\u5217\u8868\u3001\u6703\u54e1\u8cc7\u6599\u548c\u6b0a\u9650\u7ba1\u7406\u3002\u6b64\u5340\u76ee\u524d\u5148\u4fdd\u7559\u57fa\u672c\u7248\u9762\u3002</p>
          </section>
          <section class="merchant-dashboard-section" data-merchant-panel="sales">
            <h1>\u92b7\u552e\u7ba1\u7406</h1>
            <p>\u9019\u88e1\u6703\u653e\u8a02\u55ae\u3001\u4ed8\u6b3e\u3001\u51fa\u8ca8\u548c\u92b7\u552e\u5831\u8868\u3002\u6b64\u5340\u76ee\u524d\u5148\u4fdd\u7559\u57fa\u672c\u7248\u9762\u3002</p>
          </section>
          <section class="merchant-dashboard-section" data-merchant-panel="pages">
            <div data-site-content-panel></div>
          </section>
          <section class="merchant-dashboard-section is-active" data-merchant-panel="products">
            <div class="merchant-page">
              <div class="merchant-page__heading">
                <div><h1>\u7522\u54c1\u7ba1\u7406</h1></div>
              </div>
              <p class="merchant-page__message" data-merchant-page-message aria-live="polite"></p>
              <section class="merchant-products-panel">
                <div class="merchant-products-panel__heading">
                  <h2>\u5168\u90e8\u5546\u54c1</h2>
                  <div class="merchant-products-panel__actions">
                    <button class="merchant-secondary-button" type="button" data-manage-categories>\u5206\u985e\u7ba1\u7406</button>
                    <button class="merchant-primary-button" type="button" data-add-product>\u65b0\u589e</button>
                  </div>
                </div>
                <div class="merchant-products" data-merchant-products></div>
              </section>
            </div>
          </section>
        </main>
      </section>`;
  }

  function setSiteContentMessage(message, type = "info", contentId = "homeHero") {
    const node = document.querySelector(`[data-site-content-message="${contentId}"]`)
      || document.querySelector("[data-site-content-message]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
  }

  function syncHomeHeroDraftFromForm(form = document.querySelector("[data-home-hero-form]")) {
    if (!form) return homeHeroDraft || fallbackHomeHero();
    const data = new FormData(form);
    homeHeroDraft = {
      ...(homeHeroDraft || fallbackHomeHero()),
      type: "homeHero",
      title: String(data.get("title") || "").trim(),
      subtitle: String(data.get("subtitle") || "").trim(),
      imageAlt: String(data.get("imageAlt") || "").trim(),
      buttonText: String(data.get("buttonText") || "").trim(),
      buttonHref: String(data.get("buttonHref") || "").trim(),
      isActive: data.get("isActive") === "on"
    };
    return homeHeroDraft;
  }

  function syncFooterDraftFromForm(form = document.querySelector("[data-footer-form]")) {
    if (!form) return footerDraft || fallbackFooterContent();
    const data = new FormData(form);
    footerDraft = {
      ...(footerDraft || fallbackFooterContent()),
      type: "footer",
      logoText: String(data.get("logoText") || "").trim(),
      description: String(data.get("description") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      address: String(data.get("address") || "").trim(),
      copyright: String(data.get("copyright") || "").trim(),
      instagramUrl: String(data.get("instagramUrl") || "").trim(),
      facebookUrl: String(data.get("facebookUrl") || "").trim(),
      isActive: data.get("isActive") === "on"
    };
    return footerDraft;
  }

  function syncContactDraftFromForm(form = document.querySelector("[data-contact-form]")) {
    if (!form) return contactDraft || fallbackContactContent();
    const data = new FormData(form);
    contactDraft = {
      ...(contactDraft || fallbackContactContent()),
      type: "contact",
      title: String(data.get("title") || "").trim(),
      subtitle: String(data.get("subtitle") || "").trim(),
      address: String(data.get("address") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      openingHours: String(data.get("openingHours") || "").trim(),
      googleMapEmbedUrl: String(data.get("googleMapEmbedUrl") || "").trim(),
      other: String(data.get("other") || "").trim(),
      isActive: data.get("isActive") === "on"
    };
    return contactDraft;
  }

  function syncAboutDraftFromForm(form = document.querySelector("[data-about-form]")) {
    if (!form) return aboutDraft || fallbackAboutContent();
    const data = new FormData(form);
    aboutDraft = {
      ...(aboutDraft || fallbackAboutContent()),
      type: "about",
      title: String(data.get("title") || "").trim(),
      subtitle: String(data.get("subtitle") || "").trim(),
      intro: String(data.get("intro") || "").trim(),
      sectionTitle: String(data.get("sectionTitle") || "").trim(),
      sectionContent: String(data.get("sectionContent") || "").trim(),
      imageUrl: String(data.get("imageUrl") || "").trim(),
      imageAlt: String(data.get("imageAlt") || "").trim(),
      isActive: data.get("isActive") === "on"
    };
    return aboutDraft;
  }

  function renderSiteContentPanel() {
    const panel = document.querySelector("[data-site-content-panel]");
    if (!panel) return;
    const hero = homeHeroDraft || fallbackHomeHero();
    const imageUrl = resolvePreviewUrl(hero.imageUrl);
    const buttonHref = hero.buttonHref ? resolvePreviewUrl(hero.buttonHref) : "#";
    const canEdit = canEditPageContent();
    const permissionMessage = pageContentPermissionMessage();
    const controlsDisabled = !canEdit || homeHeroLoading || homeHeroSaving || homeHeroUploading;
    const saveText = homeHeroSaving ? "Saving..." : "Save Home Hero";
    const uploadText = homeHeroUploading ? "Uploading image..." : "Hero image";
    const footer = footerDraft || fallbackFooterContent();
    const footerControlsDisabled = !canEdit || footerLoading || footerSaving;
    const footerSaveText = footerSaving ? "Saving..." : "Save Footer";
    const footerPhoneHref = String(footer.phone || "").replace(/[^+\d]/g, "");
    const footerEmail = String(footer.email || "").trim();
    const footerInstagramUrl = resolvePreviewUrl(footer.instagramUrl);
    const footerFacebookUrl = resolvePreviewUrl(footer.facebookUrl);
    const contact = contactDraft || fallbackContactContent();
    const contactControlsDisabled = !canEdit || contactLoading || contactSaving;
    const contactSaveText = contactSaving ? "Saving..." : "Save Contact";
    const contactPhoneHref = String(contact.phone || "").replace(/[^+\d]/g, "");
    const contactEmail = String(contact.email || "").trim();
    const contactMapUrl = resolvePreviewUrl(contact.googleMapEmbedUrl);
    const about = aboutDraft || fallbackAboutContent();
    const aboutControlsDisabled = !canEdit || aboutLoading || aboutSaving;
    const aboutSaveText = aboutSaving ? "Saving..." : "Save About";
    const aboutImageUrl = resolvePreviewUrl(about.imageUrl);

    panel.innerHTML = `
      <div class="merchant-page merchant-site-content">
        <div class="merchant-page__heading">
          <div>
            <p class="merchant-eyebrow">\u9801\u9762\u5167\u5bb9</p>
            <h1>Website Content</h1>
          </div>
          <a class="merchant-secondary-button merchant-site-content__preview" href="${rootPrefix()}index.html" target="_blank" rel="noopener noreferrer">Preview</a>
        </div>
        <h2 class="merchant-site-content__section-title">Home Hero</h2>
        <section class="merchant-products-panel merchant-site-content__panel">
          <div class="merchant-site-content__preview-frame" data-site-content-preview data-preview-id="homeHero">
            ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(hero.imageAlt)}" data-preview-field="homeHero.imageUrl">` : `<span data-preview-field="homeHero.imageUrl">No image</span>`}
            <div class="merchant-site-content__preview-copy">
              ${hero.title ? `<strong data-preview-field="homeHero.title">${escapeHtml(hero.title)}</strong>` : ""}
              ${hero.subtitle ? `<span data-preview-field="homeHero.subtitle">${escapeHtml(hero.subtitle)}</span>` : ""}
              ${hero.buttonText ? `<a class="merchant-site-content__preview-button" href="${escapeHtml(buttonHref || "#")}" data-preview-field="homeHero.buttonText">${escapeHtml(hero.buttonText)}</a>` : ""}
            </div>
          </div>
          <form class="merchant-form merchant-site-content__form" data-home-hero-form>
            <fieldset ${controlsDisabled ? "disabled" : ""}>
              <div class="merchant-form__row">
                <label data-editor-field="homeHero.title">Title
                  <input name="title" type="text" maxlength="120" value="${escapeHtml(hero.title)}">
                </label>
                <label data-editor-field="homeHero.buttonText">Button text
                  <input name="buttonText" type="text" maxlength="60" value="${escapeHtml(hero.buttonText)}">
                </label>
              </div>
              <label data-editor-field="homeHero.subtitle">Subtitle
                <textarea name="subtitle" rows="3" maxlength="280">${escapeHtml(hero.subtitle)}</textarea>
              </label>
              <div class="merchant-form__row">
                <label data-editor-field="homeHero.buttonHref">Button link
                  <input name="buttonHref" type="text" maxlength="500" value="${escapeHtml(hero.buttonHref)}">
                </label>
                <label data-editor-field="homeHero.imageAlt">Image alt text
                  <input name="imageAlt" type="text" maxlength="160" value="${escapeHtml(hero.imageAlt)}">
                </label>
              </div>
              <label data-editor-field="homeHero.imageUrl">${uploadText}
                <input type="file" accept="image/*" data-site-content-image-upload>
              </label>
              <label class="merchant-checkbox" data-editor-field="homeHero.isActive">
                <input name="isActive" type="checkbox" ${hero.isActive ? "checked" : ""}>
                <span>Show Home Hero</span>
              </label>
            </fieldset>
            <div class="merchant-site-content__meta">
              <span>${escapeHtml(hero.imagePath || "site-content/home/")}</span>
            </div>
            <p class="merchant-message" data-site-content-message="homeHero" aria-live="polite"></p>
            <div class="merchant-modal__actions">
              <button class="merchant-primary-button" type="submit" data-save-home-hero ${controlsDisabled ? "disabled" : ""}>${saveText}</button>
            </div>
            ${!canEdit && permissionMessage ? `<p class="merchant-message" data-type="${currentMerchantRoleLoading || !currentMerchantRoleLoaded ? "info" : "error"}">${escapeHtml(permissionMessage)}</p>` : ""}
          </form>
        </section>
        <h2 class="merchant-site-content__section-title">Footer</h2>
        <section class="merchant-products-panel merchant-site-content__panel">
          <div class="merchant-site-content__preview-frame merchant-site-content__preview-frame--footer" data-site-content-preview data-preview-id="footer">
            <div class="merchant-site-content__footer-preview">
              <strong data-preview-field="footer.logoText">${escapeHtml(footer.logoText)}</strong>
              ${footer.description ? `<p data-preview-field="footer.description">${textToHtml(footer.description)}</p>` : ""}
              <div class="merchant-site-content__footer-contact">
                ${footer.phone ? `<a href="${footerPhoneHref ? `tel:${escapeHtml(footerPhoneHref)}` : "#"}" data-preview-field="footer.phone">${escapeHtml(footer.phone)}</a>` : `<span data-preview-field="footer.phone">Phone</span>`}
                ${footerEmail ? `<a href="mailto:${escapeHtml(footerEmail)}" data-preview-field="footer.email">${escapeHtml(footerEmail)}</a>` : `<span data-preview-field="footer.email">Email</span>`}
                ${footer.address ? `<address data-preview-field="footer.address">${textToHtml(footer.address)}</address>` : `<address data-preview-field="footer.address">Address</address>`}
              </div>
              <div class="merchant-site-content__footer-social">
                ${footer.instagramUrl ? `<a href="${escapeHtml(footerInstagramUrl || "#")}" data-preview-field="footer.instagramUrl">Instagram</a>` : ""}
                ${footer.facebookUrl ? `<a href="${escapeHtml(footerFacebookUrl || "#")}" data-preview-field="footer.facebookUrl">Facebook</a>` : ""}
              </div>
              <small data-preview-field="footer.copyright">${escapeHtml(footer.copyright)}</small>
              <span class="merchant-site-content__status" data-preview-field="footer.isActive">${footer.isActive ? "Visible" : "Hidden"}</span>
            </div>
          </div>
          <form class="merchant-form merchant-site-content__form" data-footer-form>
            <fieldset ${footerControlsDisabled ? "disabled" : ""}>
              <div class="merchant-form__row">
                <label data-editor-field="footer.logoText">Logo text
                  <input name="logoText" type="text" maxlength="80" value="${escapeHtml(footer.logoText)}">
                </label>
                <label data-editor-field="footer.phone">Phone
                  <input name="phone" type="text" maxlength="60" value="${escapeHtml(footer.phone)}">
                </label>
              </div>
              <label data-editor-field="footer.description">Description
                <textarea name="description" rows="3" maxlength="280">${escapeHtml(footer.description)}</textarea>
              </label>
              <div class="merchant-form__row">
                <label data-editor-field="footer.email">Email
                  <input name="email" type="email" maxlength="120" value="${escapeHtml(footer.email)}">
                </label>
                <label data-editor-field="footer.copyright">Copyright
                  <input name="copyright" type="text" maxlength="160" value="${escapeHtml(footer.copyright)}">
                </label>
              </div>
              <label data-editor-field="footer.address">Address
                <textarea name="address" rows="3" maxlength="280">${escapeHtml(footer.address)}</textarea>
              </label>
              <div class="merchant-form__row">
                <label data-editor-field="footer.instagramUrl">Instagram URL
                  <input name="instagramUrl" type="text" maxlength="500" value="${escapeHtml(footer.instagramUrl)}">
                </label>
                <label data-editor-field="footer.facebookUrl">Facebook URL
                  <input name="facebookUrl" type="text" maxlength="500" value="${escapeHtml(footer.facebookUrl)}">
                </label>
              </div>
              <label class="merchant-checkbox" data-editor-field="footer.isActive">
                <input name="isActive" type="checkbox" ${footer.isActive ? "checked" : ""}>
                <span>Show Footer</span>
              </label>
            </fieldset>
            <p class="merchant-message" data-site-content-message="footer" aria-live="polite"></p>
            <div class="merchant-modal__actions">
              <button class="merchant-primary-button" type="submit" data-save-footer ${footerControlsDisabled ? "disabled" : ""}>${footerSaveText}</button>
            </div>
            ${!canEdit && permissionMessage ? `<p class="merchant-message" data-type="${currentMerchantRoleLoading || !currentMerchantRoleLoaded ? "info" : "error"}">${escapeHtml(permissionMessage)}</p>` : ""}
          </form>
        </section>
        <h2 class="merchant-site-content__section-title">Contact</h2>
        <section class="merchant-products-panel merchant-site-content__panel">
          <div class="merchant-site-content__preview-frame merchant-site-content__preview-frame--contact" data-site-content-preview data-preview-id="contact">
            <div class="merchant-site-content__contact-preview">
              <div class="merchant-site-content__contact-heading">
                <strong data-preview-field="contact.title">${escapeHtml(contact.title)}</strong>
                ${contact.subtitle ? `<p data-preview-field="contact.subtitle">${textToHtml(contact.subtitle)}</p>` : `<p data-preview-field="contact.subtitle">Subtitle</p>`}
              </div>
              <div class="merchant-site-content__contact-grid">
                <article data-preview-field="contact.address">
                  <span>Address</span>
                  <p>${textToHtml(contact.address)}</p>
                </article>
                <article data-preview-field="contact.openingHours">
                  <span>Opening Hours</span>
                  <p>${textToHtml(contact.openingHours)}</p>
                </article>
                <article data-preview-field="contact.phone">
                  <span>Phone</span>
                  ${contactPhoneHref ? `<a href="tel:${escapeHtml(contactPhoneHref)}">${escapeHtml(contact.phone)}</a>` : `<p>${escapeHtml(contact.phone)}</p>`}
                </article>
                <article data-preview-field="contact.email">
                  <span>Email</span>
                  ${contactEmail ? `<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>` : `<p>Email</p>`}
                </article>
                <article data-preview-field="contact.other">
                  <span>Other</span>
                  <p>${textToHtml(contact.other)}</p>
                </article>
                <article data-preview-field="contact.googleMapEmbedUrl">
                  <span>Map</span>
                  ${contactMapUrl ? `<a href="${escapeHtml(contactMapUrl)}">Google Map embed configured</a>` : `<p>Google Map has not been configured.</p>`}
                </article>
              </div>
              <span class="merchant-site-content__status" data-preview-field="contact.isActive">${contact.isActive ? "Visible" : "Hidden"}</span>
            </div>
          </div>
          <form class="merchant-form merchant-site-content__form" data-contact-form>
            <fieldset ${contactControlsDisabled ? "disabled" : ""}>
              <div class="merchant-form__row">
                <label data-editor-field="contact.title">Title
                  <input name="title" type="text" maxlength="120" value="${escapeHtml(contact.title)}">
                </label>
                <label data-editor-field="contact.phone">Phone
                  <input name="phone" type="text" maxlength="60" value="${escapeHtml(contact.phone)}">
                </label>
              </div>
              <label data-editor-field="contact.subtitle">Subtitle
                <textarea name="subtitle" rows="2" maxlength="240">${escapeHtml(contact.subtitle)}</textarea>
              </label>
              <div class="merchant-form__row">
                <label data-editor-field="contact.email">Email
                  <input name="email" type="email" maxlength="120" value="${escapeHtml(contact.email)}">
                </label>
                <label data-editor-field="contact.openingHours">Opening hours
                  <input name="openingHours" type="text" maxlength="160" value="${escapeHtml(contact.openingHours)}">
                </label>
              </div>
              <label data-editor-field="contact.address">Address
                <textarea name="address" rows="3" maxlength="280">${escapeHtml(contact.address)}</textarea>
              </label>
              <label data-editor-field="contact.googleMapEmbedUrl">Google Map embed URL
                <input name="googleMapEmbedUrl" type="text" maxlength="1000" value="${escapeHtml(contact.googleMapEmbedUrl)}">
              </label>
              <label data-editor-field="contact.other">Other
                <textarea name="other" rows="3" maxlength="360">${escapeHtml(contact.other)}</textarea>
              </label>
              <label class="merchant-checkbox" data-editor-field="contact.isActive">
                <input name="isActive" type="checkbox" ${contact.isActive ? "checked" : ""}>
                <span>Show Contact</span>
              </label>
            </fieldset>
            <p class="merchant-message" data-site-content-message="contact" aria-live="polite"></p>
            <div class="merchant-modal__actions">
              <button class="merchant-primary-button" type="submit" data-save-contact ${contactControlsDisabled ? "disabled" : ""}>${contactSaveText}</button>
            </div>
            ${!canEdit && permissionMessage ? `<p class="merchant-message" data-type="${currentMerchantRoleLoading || !currentMerchantRoleLoaded ? "info" : "error"}">${escapeHtml(permissionMessage)}</p>` : ""}
          </form>
        </section>
        <h2 class="merchant-site-content__section-title">About</h2>
        <section class="merchant-products-panel merchant-site-content__panel">
          <div class="merchant-site-content__preview-frame merchant-site-content__preview-frame--about" data-site-content-preview data-preview-id="about">
            <div class="merchant-site-content__about-preview">
              <div class="merchant-site-content__about-copy">
                <strong data-preview-field="about.title">${escapeHtml(about.title)}</strong>
                ${about.subtitle ? `<span data-preview-field="about.subtitle">${escapeHtml(about.subtitle)}</span>` : `<span data-preview-field="about.subtitle">Subtitle</span>`}
                ${about.intro ? `<p data-preview-field="about.intro">${textToHtml(about.intro)}</p>` : `<p data-preview-field="about.intro">Intro</p>`}
                <article>
                  ${about.sectionTitle ? `<h3 data-preview-field="about.sectionTitle">${escapeHtml(about.sectionTitle)}</h3>` : `<h3 data-preview-field="about.sectionTitle">Section title</h3>`}
                  ${about.sectionContent ? `<p data-preview-field="about.sectionContent">${textToHtml(about.sectionContent)}</p>` : `<p data-preview-field="about.sectionContent">Section content</p>`}
                </article>
                <span class="merchant-site-content__status" data-preview-field="about.isActive">${about.isActive ? "Visible" : "Hidden"}</span>
              </div>
              <div class="merchant-site-content__about-image" data-preview-field="about.imageUrl">
                ${aboutImageUrl ? `<img src="${escapeHtml(aboutImageUrl)}" alt="${escapeHtml(about.imageAlt)}">` : `<span>No image URL</span>`}
              </div>
            </div>
          </div>
          <form class="merchant-form merchant-site-content__form" data-about-form>
            <fieldset ${aboutControlsDisabled ? "disabled" : ""}>
              <div class="merchant-form__row">
                <label data-editor-field="about.title">Title
                  <input name="title" type="text" maxlength="120" value="${escapeHtml(about.title)}">
                </label>
                <label data-editor-field="about.subtitle">Subtitle
                  <input name="subtitle" type="text" maxlength="160" value="${escapeHtml(about.subtitle)}">
                </label>
              </div>
              <label data-editor-field="about.intro">Intro
                <textarea name="intro" rows="4" maxlength="600">${escapeHtml(about.intro)}</textarea>
              </label>
              <div class="merchant-form__row">
                <label data-editor-field="about.sectionTitle">Section title
                  <input name="sectionTitle" type="text" maxlength="120" value="${escapeHtml(about.sectionTitle)}">
                </label>
                <label data-editor-field="about.imageAlt">Image alt
                  <input name="imageAlt" type="text" maxlength="160" value="${escapeHtml(about.imageAlt)}">
                </label>
              </div>
              <label data-editor-field="about.sectionContent">Section content
                <textarea name="sectionContent" rows="4" maxlength="800">${escapeHtml(about.sectionContent)}</textarea>
              </label>
              <label data-editor-field="about.imageUrl">Image URL
                <input name="imageUrl" type="text" maxlength="2000" value="${escapeHtml(about.imageUrl)}">
              </label>
              <label class="merchant-checkbox" data-editor-field="about.isActive">
                <input name="isActive" type="checkbox" ${about.isActive ? "checked" : ""}>
                <span>Show About</span>
              </label>
            </fieldset>
            <p class="merchant-message" data-site-content-message="about" aria-live="polite"></p>
            <div class="merchant-modal__actions">
              <button class="merchant-primary-button" type="submit" data-save-about ${aboutControlsDisabled ? "disabled" : ""}>${aboutSaveText}</button>
            </div>
            ${!canEdit && permissionMessage ? `<p class="merchant-message" data-type="${currentMerchantRoleLoading || !currentMerchantRoleLoaded ? "info" : "error"}">${escapeHtml(permissionMessage)}</p>` : ""}
          </form>
        </section>
      </div>
    `;
    applyHomeHeroVisualSelection();
    applyFooterVisualSelection();
    applyContactVisualSelection();
    applyAboutVisualSelection();

    if (homeHeroLoading) setSiteContentMessage("Loading Home Hero...", "info");
    if (footerLoading) setSiteContentMessage("Loading Footer...", "info", "footer");
    if (contactLoading) setSiteContentMessage("Loading Contact...", "info", "contact");
    if (aboutLoading) setSiteContentMessage("Loading About...", "info", "about");
  }

  async function loadMerchantRole(user) {
    if (merchantRoleRequest) return merchantRoleRequest;
    currentMerchantRole = null;
    currentMerchantRoleLoaded = false;
    currentMerchantRoleLoading = true;
    currentMerchantRoleError = null;

    merchantRoleRequest = (async () => {
      try {
        const firebase = await firebaseService();
        const uid = String(firebase.auth?.currentUser?.uid || user?.uid || currentMerchant?.uid || "").trim();
        if (!uid) throw new Error("Cannot find current merchant UID.");
        currentMerchantRole = await firebase.getMerchantRole(uid);
        currentMerchantRoleError = null;
        return currentMerchantRole;
      } catch (error) {
        currentMerchantRole = null;
        currentMerchantRoleError = error;
        console.warn("Merchant role lookup failed.", error);
        return null;
      } finally {
        currentMerchantRoleLoaded = true;
        currentMerchantRoleLoading = false;
        merchantRoleRequest = null;
      }
    })();

    return merchantRoleRequest;
  }

  async function ensurePageContentPermission() {
    const uid = String(window.onlineShopFirebase?.auth?.currentUser?.uid || currentMerchant?.uid || "").trim();
    if (!currentMerchant || !isAllowedMerchant(currentMerchant)) {
      console.debug({
        action: "ensurePageContentPermission",
        uid,
        roleData: currentMerchantRole,
        pagesWriteResult: false
      });
      return false;
    }
    if (!currentMerchantRoleLoaded || currentMerchantRoleLoading) {
      renderSiteContentPanel();
      await loadMerchantRole(currentMerchant);
      renderSiteContentPanel();
    }
    const pagesWriteResult = hasRolePagesWrite();
    console.debug({
      action: "ensurePageContentPermission",
      uid,
      roleData: currentMerchantRole,
      pagesWriteResult
    });
    return pagesWriteResult;
  }

  async function loadHomeHeroContent() {
    if (!currentMerchant || !document.querySelector("[data-site-content-panel]")) return;
    homeHeroLoading = true;
    homeHeroDraft = homeHeroDraft || fallbackHomeHero();
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      const remoteHero = await firebase.getSiteContent("home");
      homeHeroDraft = normalizeHomeHero(remoteHero);
      homeHeroLoading = false;
      renderSiteContentPanel();
      setSiteContentMessage(remoteHero ? "Home Hero loaded." : "Using fallback Home Hero.", "success");
    } catch (error) {
      homeHeroLoading = false;
      homeHeroDraft = homeHeroDraft || fallbackHomeHero();
      renderSiteContentPanel();
      setSiteContentMessage(merchantErrorMessage(error, "Could not load Home Hero. Using fallback content."), "error");
    }
  }

  async function loadFooterContent() {
    if (!currentMerchant || !document.querySelector("[data-site-content-panel]")) return;
    footerLoading = true;
    footerDraft = footerDraft || fallbackFooterContent();
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      const remoteFooter = await firebase.getSiteContent("footer");
      footerDraft = normalizeFooterContent(remoteFooter);
      footerLoading = false;
      renderSiteContentPanel();
      setSiteContentMessage(remoteFooter ? "Footer loaded." : "Using fallback Footer.", "success", "footer");
    } catch (error) {
      footerLoading = false;
      footerDraft = footerDraft || fallbackFooterContent();
      renderSiteContentPanel();
      setSiteContentMessage(merchantErrorMessage(error, "Could not load Footer. Using fallback content."), "error", "footer");
    }
  }

  async function loadContactContent() {
    if (!currentMerchant || !document.querySelector("[data-site-content-panel]")) return;
    contactLoading = true;
    contactDraft = contactDraft || fallbackContactContent();
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      const remoteContact = await firebase.getSiteContent("contact");
      contactDraft = normalizeContactContent(remoteContact);
      contactLoading = false;
      renderSiteContentPanel();
      setSiteContentMessage(remoteContact ? "Contact loaded." : "Using fallback Contact.", "success", "contact");
    } catch (error) {
      contactLoading = false;
      contactDraft = contactDraft || fallbackContactContent();
      renderSiteContentPanel();
      setSiteContentMessage(merchantErrorMessage(error, "Could not load Contact. Using fallback content."), "error", "contact");
    }
  }

  async function loadAboutContent() {
    if (!currentMerchant || !document.querySelector("[data-site-content-panel]")) return;
    aboutLoading = true;
    aboutDraft = aboutDraft || fallbackAboutContent();
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      const remoteAbout = await firebase.getSiteContent("about");
      aboutDraft = normalizeAboutContent(remoteAbout);
      aboutLoading = false;
      renderSiteContentPanel();
      setSiteContentMessage(remoteAbout ? "About loaded." : "Using fallback About.", "success", "about");
    } catch (error) {
      aboutLoading = false;
      aboutDraft = aboutDraft || fallbackAboutContent();
      renderSiteContentPanel();
      setSiteContentMessage(merchantErrorMessage(error, "Could not load About. Using fallback content."), "error", "about");
    }
  }

  async function uploadHomeHeroImage(input) {
    if (!currentMerchant) return;
    if (!(await ensurePageContentPermission())) {
      setSiteContentMessage("pagesWrite permission is not enabled for this account.", "error");
      return;
    }
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    syncHomeHeroDraftFromForm();
    if (!file.type.startsWith("image/")) {
      setSiteContentMessage("Please choose an image file.", "error");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setSiteContentMessage("Image exceeds the 10MB limit.", "error");
      return;
    }

    homeHeroUploading = true;
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      const uploaded = await firebase.uploadSiteContentImage("home", file);
      homeHeroDraft = {
        ...(homeHeroDraft || fallbackHomeHero()),
        imageUrl: uploaded.url,
        imagePath: uploaded.path,
        imageAlt: homeHeroDraft?.imageAlt || file.name
      };
      homeHeroUploading = false;
      renderSiteContentPanel();
      setSiteContentMessage("Image uploaded. Save Home Hero to publish it.", "success");
    } catch (error) {
      homeHeroUploading = false;
      renderSiteContentPanel();
      const code = String(error?.code || "");
      const message = code === "storage/unauthorized" || code === "permission-denied"
        ? "Storage rejected the Home Hero image upload. Please check deployed storage.rules for site-content/**."
        : "Could not upload image.";
      setSiteContentMessage(message, "error");
    }
  }

  async function saveHomeHeroForm(form) {
    if (!currentMerchant) return;
    if (!(await ensurePageContentPermission())) {
      setSiteContentMessage("pagesWrite permission is not enabled for this account.", "error");
      return;
    }
    const draft = syncHomeHeroDraftFromForm(form);
    const payload = {
      type: "homeHero",
      title: draft.title,
      subtitle: draft.subtitle,
      imageUrl: draft.imageUrl,
      imagePath: draft.imagePath,
      imageAlt: draft.imageAlt,
      buttonText: draft.buttonText,
      buttonHref: draft.buttonHref,
      isActive: draft.isActive
    };

    homeHeroSaving = true;
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      await firebase.saveSiteContent("home", payload);
      homeHeroSaving = false;
      homeHeroDraft = normalizeHomeHero(payload);
      renderSiteContentPanel();
      setSiteContentMessage("Home Hero saved.", "success");
      showMerchantToast("Home Hero saved");
    } catch (error) {
      homeHeroSaving = false;
      renderSiteContentPanel();
      console.error({
        action: "saveHomeHeroForm",
        code: error?.code,
        message: error?.message,
        payload
      });
      const message = error?.code === "permission-denied"
        ? "Firestore rejected the Home Hero save. Please check deployed firestore.rules for siteContent/home."
        : "Could not save Home Hero.";
      setSiteContentMessage(message, "error");
    }
  }

  async function saveFooterForm(form) {
    if (!currentMerchant) return;
    if (!(await ensurePageContentPermission())) {
      setSiteContentMessage("pagesWrite permission is not enabled for this account.", "error", "footer");
      return;
    }
    const draft = syncFooterDraftFromForm(form);
    const payload = {
      type: "footer",
      logoText: draft.logoText,
      description: draft.description,
      phone: draft.phone,
      email: draft.email,
      address: draft.address,
      copyright: draft.copyright,
      instagramUrl: draft.instagramUrl,
      facebookUrl: draft.facebookUrl,
      isActive: draft.isActive
    };

    footerSaving = true;
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      await firebase.saveSiteContent("footer", payload);
      footerSaving = false;
      footerDraft = normalizeFooterContent(payload);
      renderSiteContentPanel();
      setSiteContentMessage("Footer saved.", "success", "footer");
      showMerchantToast("Footer saved");
    } catch (error) {
      footerSaving = false;
      renderSiteContentPanel();
      console.error({
        action: "saveFooterForm",
        code: error?.code,
        message: error?.message,
        payload
      });
      const message = error?.code === "permission-denied"
        ? "Firestore rejected the Footer save. Please check deployed firestore.rules for siteContent/footer."
        : "Could not save Footer.";
      setSiteContentMessage(message, "error", "footer");
    }
  }

  async function saveContactForm(form) {
    if (!currentMerchant) return;
    if (!(await ensurePageContentPermission())) {
      setSiteContentMessage("pagesWrite permission is not enabled for this account.", "error", "contact");
      return;
    }
    const draft = syncContactDraftFromForm(form);
    const payload = {
      type: "contact",
      title: draft.title,
      subtitle: draft.subtitle,
      address: draft.address,
      phone: draft.phone,
      email: draft.email,
      openingHours: draft.openingHours,
      googleMapEmbedUrl: draft.googleMapEmbedUrl,
      other: draft.other,
      isActive: draft.isActive
    };

    contactSaving = true;
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      await firebase.saveSiteContent("contact", payload);
      contactSaving = false;
      contactDraft = normalizeContactContent(payload);
      renderSiteContentPanel();
      setSiteContentMessage("Contact saved.", "success", "contact");
      showMerchantToast("Contact saved");
    } catch (error) {
      contactSaving = false;
      renderSiteContentPanel();
      console.error({
        action: "saveContactForm",
        code: error?.code,
        message: error?.message,
        payload
      });
      const message = error?.code === "permission-denied"
        ? "Firestore rejected the Contact save. Please check deployed firestore.rules for siteContent/contact."
        : "Could not save Contact.";
      setSiteContentMessage(message, "error", "contact");
    }
  }

  async function saveAboutForm(form) {
    if (!currentMerchant) return;
    if (!(await ensurePageContentPermission())) {
      setSiteContentMessage("pagesWrite permission is not enabled for this account.", "error", "about");
      return;
    }
    const draft = syncAboutDraftFromForm(form);
    const payload = {
      type: "about",
      title: draft.title,
      subtitle: draft.subtitle,
      intro: draft.intro,
      sectionTitle: draft.sectionTitle,
      sectionContent: draft.sectionContent,
      imageUrl: draft.imageUrl,
      imageAlt: draft.imageAlt,
      isActive: draft.isActive
    };

    aboutSaving = true;
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      await firebase.saveSiteContent("about", payload);
      aboutSaving = false;
      aboutDraft = normalizeAboutContent(payload);
      renderSiteContentPanel();
      setSiteContentMessage("About saved.", "success", "about");
      showMerchantToast("About saved");
    } catch (error) {
      aboutSaving = false;
      renderSiteContentPanel();
      console.error({
        action: "saveAboutForm",
        code: error?.code,
        message: error?.message,
        payload
      });
      const message = error?.code === "permission-denied"
        ? "Firestore rejected the About save. Please check deployed firestore.rules for siteContent/about."
        : "Could not save About.";
      setSiteContentMessage(message, "error", "about");
    }
  }

  function cleanupProductImages(urls) {
    Promise.allSettled(uniqueStrings(urls).map((url) => store.deleteProductImage(url)))
      .then((results) => {
        if (results.some((result) => result.status === "rejected")) {
          console.warn("部分商品圖片未能從 Storage 刪除。", results);
        }
      });
  }

  function productById(productId) {
    return store?.loadProducts().find((product) => product.id === productId) || null;
  }

  function primaryImage(product) {
    return Array.isArray(product?.images) ? product.images[0] || "" : "";
  }

  function renderProductRows() {
    const list = document.querySelector("[data-merchant-products]");
    if (!list || !store) return;
    const products = store.loadProducts();
    if (!products.length) {
      list.innerHTML = '<p class="merchant-products__empty">目前沒有商品。</p>';
      return;
    }

    list.innerHTML = products.map((product) => `
      <article class="merchant-product ${product.isActive ? "" : "is-hidden"}">
        <div class="merchant-product__image">${primaryImage(product) ? `<img src="${escapeHtml(primaryImage(product))}" alt="">` : "<span>沒有圖片</span>"}</div>
        <div class="merchant-product__body">
          <p class="merchant-product__status">${product.isActive ? "上架中" : "已隱藏"}</p>
          <h3>${escapeHtml(product.name)}</h3>
          <small>${escapeHtml(product.id)} ｜ ${escapeHtml(store.productCategoryLabels(product).join("、") || "未分類")}</small>
        </div>
        <div class="merchant-product__meta"><span>價格</span><strong>HK$${Number(product.price || 0).toFixed(2)}</strong></div>
        <div class="merchant-product__meta"><span>存貨</span><strong>${Number(product.stock || 0)}</strong></div>
        <div class="merchant-product__actions">
          <button type="button" data-edit-product="${escapeHtml(product.id)}">修改</button>
          <button type="button" data-toggle-product="${escapeHtml(product.id)}" data-next-active="${product.isActive ? "false" : "true"}">${product.isActive ? "隱藏" : "上架"}</button>
          <button class="is-danger" type="button" data-delete-product="${escapeHtml(product.id)}">刪除</button>
        </div>
      </article>`).join("");
  }

  function renderDashboard(user) {
    currentMerchant = user;
    renderMerchantDashboardShell(user);
    ensureMerchantModals();
    renderSiteContentPanel();
    loadHomeHeroContent();
    loadFooterContent();
    loadContactContent();
    loadAboutContent();
    renderProductRows();
  }
  function ensureMerchantModals() {
    if (!document.querySelector("#merchantEditorModal")) {
      const modal = document.createElement("div");
      modal.id = "merchantEditorModal";
      modal.className = "merchant-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `<div class="merchant-modal__overlay" data-close-merchant-modal></div><div class="merchant-modal__panel merchant-modal__panel--editor" role="dialog" aria-modal="true" aria-labelledby="merchantEditorTitle"><button class="merchant-modal__close" type="button" data-close-merchant-modal aria-label="關閉商品編輯視窗">×</button><div data-merchant-editor-content></div></div>`;
      document.body.appendChild(modal);
    }
    if (!document.querySelector("#merchantDeleteModal")) {
      const modal = document.createElement("div");
      modal.id = "merchantDeleteModal";
      modal.className = "merchant-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `<div class="merchant-modal__overlay" data-close-merchant-modal></div><div class="merchant-modal__panel merchant-modal__panel--confirm" role="dialog" aria-modal="true" aria-labelledby="merchantDeleteTitle"><button class="merchant-modal__close" type="button" data-close-merchant-modal aria-label="關閉刪除確認視窗">×</button><h2 id="merchantDeleteTitle">確認刪除商品</h2><p data-delete-product-message></p><p class="merchant-message" data-merchant-delete-message aria-live="polite"></p><div class="merchant-modal__actions"><button class="merchant-secondary-button" type="button" data-close-merchant-modal>取消</button><button class="merchant-danger-button" type="button" data-confirm-delete>確認刪除</button></div></div>`;
      document.body.appendChild(modal);
    }
    if (!document.querySelector("#merchantCategoryModal")) {
      const modal = document.createElement("div");
      modal.id = "merchantCategoryModal";
      modal.className = "merchant-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `<div class="merchant-modal__overlay" data-close-merchant-modal></div><div class="merchant-modal__panel merchant-modal__panel--categories" role="dialog" aria-modal="true" aria-labelledby="merchantCategoryTitle"><button class="merchant-modal__close" type="button" data-close-merchant-modal aria-label="關閉分類管理視窗">×</button><div data-merchant-category-content></div></div>`;
      document.body.appendChild(modal);
    }
  }

  function openModal(modal) {
    window.closeAuthModal?.();
    window.closeSearchModal?.();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function releaseEditorPreviews() {
    editorImages.filter((image) => image.file).forEach((image) => URL.revokeObjectURL(image.preview));
    sortable?.destroy();
    sortable = null;
    categorySortables.forEach((instance) => instance.destroy());
    categorySortables = [];
  }

  function closeMerchantModals() {
    document.querySelectorAll(".merchant-modal.is-open").forEach((modal) => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    });
    releaseEditorPreviews();
    editingProductId = null;
    deletingProductId = null;
    deletingProductImages = [];
    editorCategoryAssignments = [];
    editorImages = [];
    removedImageUrls = [];
    categoryDraft = [];
    originalCategoryIds = [];
    if (!document.querySelector(".auth-modal.is-open, .search-modal.is-open")) document.body.classList.remove("modal-open");
  }

  function editorForm(product = null) {
    const descriptions = Array.isArray(product?.description) ? product.description.join("\n") : "";
    const tags = Array.isArray(product?.tags) ? product.tags.join("\n") : "";
    return `
      <h2 id="merchantEditorTitle">${product ? "修改商品" : "新增商品"}</h2>
      <form class="merchant-editor-form" data-merchant-editor-form>
        <div class="merchant-editor-grid">
          <label>商品 ID<input name="id" required ${product ? "readonly" : ""} value="${escapeHtml(product?.id || "")}" placeholder="例如：product-1"></label>
          <label>商品名稱<input name="name" required value="${escapeHtml(product?.name || "")}" placeholder="商品名稱"></label>
          <label>價格（HK$）<input name="price" required type="number" min="0" step="0.01" value="${escapeHtml(product?.price ?? "")}" placeholder="120"></label>
          <label>存貨<input name="stock" required type="number" min="0" step="1" value="${escapeHtml(product?.stock ?? 100)}"></label>
          <label>訂單狀態<select name="orderStatus"><option value="in-stock" ${product?.orderStatus === "preorder" ? "" : "selected"}>現貨</option><option value="preorder" ${product?.orderStatus === "preorder" ? "selected" : ""}>預購</option></select></label>
          <div class="merchant-editor-grid__wide merchant-category-editor">
            <span class="merchant-editor-label">分類</span>
            <div class="merchant-product-categories" data-product-category-selector></div>
          </div>
          <div class="merchant-editor-grid__wide merchant-image-editor">
            <div class="merchant-image-editor__heading"><span class="merchant-editor-label">圖片</span><label class="merchant-upload-button">上載<input type="file" accept="image/*" multiple data-image-upload></label></div>
            <p>拖曳圖片可以調整順序，第一張圖片會作為主圖片，第二張圖片會作為列表 Hover 圖。</p>
            <div class="merchant-image-list" data-editor-image-list></div>
          </div>
          <label class="merchant-editor-grid__wide">商品描述<textarea name="description" rows="7" placeholder="每行一段商品描述">${escapeHtml(descriptions)}</textarea></label>
          <label class="merchant-editor-grid__wide">標籤<textarea name="tags" rows="3" placeholder="每行一個標籤">${escapeHtml(tags)}</textarea></label>
        </div>
        <div class="merchant-editor-options"><label><input name="showOnHome" type="checkbox" ${product?.showOnHome ? "checked" : ""}><span>顯示於首頁</span></label><label><input name="isActive" type="checkbox" ${product?.isActive !== false ? "checked" : ""}><span>上架商品</span></label></div>
        <p class="merchant-message" data-merchant-editor-message aria-live="polite"></p>
        <div class="merchant-modal__actions"><button class="merchant-secondary-button" type="button" data-close-merchant-modal>取消</button><button class="merchant-primary-button" type="submit" data-save-product>${product ? "儲存修改" : "新增商品"}</button></div>
      </form>`;
  }

  function renderProductCategorySelector() {
    const node = document.querySelector("[data-product-category-selector]");
    if (!node) return;
    const categories = store.loadCategories();
    node.innerHTML = categories.map((category) => {
      const assignment = editorCategoryAssignments.find((item) => item.categoryId === category.id);
      const includesWholeCategory = Boolean(assignment && !assignment.subcategoryIds.length);
      return `<section class="merchant-product-category" data-product-category-group="${escapeHtml(category.id)}">
        <label class="merchant-category-parent"><input type="checkbox" data-product-category-parent="${escapeHtml(category.id)}" ${includesWholeCategory ? "checked" : ""}><span></span><strong>${escapeHtml(category.name)}</strong></label>
        ${category.subcategories.length ? `<div class="merchant-category-children">${category.subcategories.map((subcategory) => {
          const checked = includesWholeCategory || assignment?.subcategoryIds.includes(subcategory.id);
          return `<label><input type="checkbox" data-product-category-child="${escapeHtml(category.id)}" value="${escapeHtml(subcategory.id)}" ${checked ? "checked" : ""}><span></span>${escapeHtml(subcategory.name)}</label>`;
        }).join("")}</div>` : ""}
      </section>`;
    }).join("");
    syncProductCategoryCheckboxes();
  }

  function syncProductCategoryCheckboxes() {
    document.querySelectorAll("[data-product-category-group]").forEach((group) => {
      const categoryId = group.dataset.productCategoryGroup;
      const assignment = editorCategoryAssignments.find((item) => item.categoryId === categoryId);
      const parent = group.querySelector("[data-product-category-parent]");
      const children = Array.from(group.querySelectorAll("[data-product-category-child]"));
      const wholeCategory = Boolean(assignment && !assignment.subcategoryIds.length);
      children.forEach((child) => {
        child.checked = wholeCategory || Boolean(assignment?.subcategoryIds.includes(child.value));
      });
      const checkedCount = children.filter((child) => child.checked).length;
      parent.checked = wholeCategory || (children.length > 0 && checkedCount === children.length);
      parent.indeterminate = !wholeCategory && checkedCount > 0 && checkedCount < children.length;
    });
  }

  function updateProductCategoryAssignment(input) {
    const categoryId = input.dataset.productCategoryParent || input.dataset.productCategoryChild;
    const group = input.closest("[data-product-category-group]");
    const children = Array.from(group?.querySelectorAll("[data-product-category-child]") || []);
    editorCategoryAssignments = editorCategoryAssignments.filter((item) => item.categoryId !== categoryId);
    if (input.checked && categoryId === store.uncategorizedId) editorCategoryAssignments = [];
    if (input.checked && categoryId !== store.uncategorizedId) {
      editorCategoryAssignments = editorCategoryAssignments.filter((item) => item.categoryId !== store.uncategorizedId);
    }
    if (input.matches("[data-product-category-parent]")) {
      if (input.checked) editorCategoryAssignments.push({ categoryId, subcategoryIds: [] });
    } else {
      const checkedIds = children.filter((child) => child.checked).map((child) => child.value);
      if (checkedIds.length) {
        editorCategoryAssignments.push({
          categoryId,
          subcategoryIds: checkedIds.length === children.length ? [] : checkedIds
        });
      }
    }
    syncProductCategoryCheckboxes();
  }

  function syncCategoryDraftFromDom() {
    const nodes = Array.from(document.querySelectorAll("[data-category-editor-id]"));
    if (!nodes.length) return;
    categoryDraft = nodes.map((node, order) => {
      const category = categoryDraft.find((item) => item.id === node.dataset.categoryEditorId);
      const subcategories = Array.from(node.querySelectorAll("[data-subcategory-editor-id]")).map((subNode, subOrder) => {
        const subcategory = category.subcategories.find((item) => item.id === subNode.dataset.subcategoryEditorId);
        return { ...subcategory, name: subNode.querySelector("[data-subcategory-name]").value.trim(), order: subOrder };
      });
      return { ...category, name: node.querySelector("[data-category-name]").value.trim(), order, subcategories };
    });
  }

  function renderCategoryManager() {
    const content = document.querySelector("[data-merchant-category-content]");
    if (!content) return;
    categorySortables.forEach((instance) => instance.destroy());
    categorySortables = [];
    content.innerHTML = `<h2 id="merchantCategoryTitle">分類管理</h2>
      <p class="merchant-category-help">你可以在這裡新增、排序、修改或刪除大分類與小分類。</p>
      <div class="merchant-category-list" data-category-manager-list>${categoryDraft.map((category) => `
        <article class="merchant-category-card" data-category-editor-id="${escapeHtml(category.id)}">
          <div class="merchant-category-card__heading">
            <button class="merchant-category-drag" type="button" data-category-drag aria-label="拖曳分類">⋮</button>
            <input type="text" data-category-name value="${escapeHtml(category.name)}" aria-label="大分類名稱" ${category.system ? "readonly" : ""}>
            ${category.system ? '<span class="merchant-system-label">系統分類</span>' : `<button class="merchant-category-delete" type="button" data-delete-category="${escapeHtml(category.id)}">刪除</button>`}
          </div>
          <div class="merchant-subcategory-list" data-subcategory-list="${escapeHtml(category.id)}">${category.subcategories.map((subcategory) => `
            <div class="merchant-subcategory-row" data-subcategory-editor-id="${escapeHtml(subcategory.id)}">
              <button class="merchant-subcategory-drag" type="button" data-subcategory-drag aria-label="拖曳小分類">⋮</button>
              <input type="text" data-subcategory-name value="${escapeHtml(subcategory.name)}" aria-label="小分類名稱">
              <button type="button" data-delete-subcategory="${escapeHtml(subcategory.id)}" data-parent-category="${escapeHtml(category.id)}">刪除</button>
            </div>`).join("")}</div>
          ${category.system ? "" : `<button class="merchant-add-subcategory" type="button" data-add-subcategory="${escapeHtml(category.id)}">新增小分類</button>`}
        </article>`).join("")}</div>
      <button class="merchant-secondary-button merchant-add-category" type="button" data-add-category>新增大分類</button>
      <p class="merchant-message" data-category-manager-message aria-live="polite"></p>
      <div class="merchant-modal__actions"><button class="merchant-secondary-button" type="button" data-close-merchant-modal>取消</button><button class="merchant-primary-button" type="button" data-save-categories>儲存分類</button></div>`;

    if (window.Sortable) {
      const mainList = content.querySelector("[data-category-manager-list]");
      categorySortables.push(new window.Sortable(mainList, { animation: 160, handle: "[data-category-drag]", onEnd: syncCategoryDraftFromDom }));
      content.querySelectorAll("[data-subcategory-list]").forEach((list) => {
        categorySortables.push(new window.Sortable(list, { animation: 160, handle: "[data-subcategory-drag]", onEnd: syncCategoryDraftFromDom }));
      });
    }
  }

  function openCategoryManager() {
    ensureMerchantModals();
    categoryDraft = store.loadCategories();
    originalCategoryIds = categoryDraft.map((category) => category.id);
    renderCategoryManager();
    openModal(document.querySelector("#merchantCategoryModal"));
  }

  function categoryManagerError(message) {
    const node = document.querySelector("[data-category-manager-message]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = "error";
  }

  async function saveCategoryManager() {
    syncCategoryDraftFromDom();
    if (categoryDraft.some((category) => !category.name)) return categoryManagerError("請填寫所有大分類名稱。");
    if (categoryDraft.some((category) => category.subcategories.some((subcategory) => !subcategory.name))) return categoryManagerError("請填寫所有小分類名稱。");
    const duplicateMainNames = categoryDraft.map((category) => category.name.toLowerCase());
    if (new Set(duplicateMainNames).size !== duplicateMainNames.length) return categoryManagerError("大分類名稱不能重複。");
    const hasDuplicateSubs = categoryDraft.some((category) => {
      const names = category.subcategories.map((subcategory) => subcategory.name.toLowerCase());
      return new Set(names).size !== names.length;
    });
    if (hasDuplicateSubs) return categoryManagerError("同一個大分類下的小分類名稱不能重複。");
    const button = document.querySelector("[data-save-categories]");
    button.disabled = true;
    button.textContent = "儲存中…";
    try {
      const currentIds = new Set(categoryDraft.map((category) => category.id));
      const deletedIds = originalCategoryIds.filter((id) => !currentIds.has(id));
      await store.saveCategoryCatalog(categoryDraft, deletedIds);
      closeMerchantModals();
      renderProductRows();
      showMerchantToast("分類已更新");
    } catch (error) {
      button.disabled = false;
      button.textContent = "儲存分類";
      categoryManagerError(merchantErrorMessage(error, "無法儲存分類。"));
    }
  }

  function reorderImagesFromDom() {
    const ids = Array.from(document.querySelectorAll("[data-editor-image-id]"), (node) => node.dataset.editorImageId);
    editorImages.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }

  function renderEditorImages() {
    const list = document.querySelector("[data-editor-image-list]");
    if (!list) return;
    list.innerHTML = editorImages.length
      ? editorImages.map((image, index) => `<article class="merchant-editor-image" data-editor-image-id="${escapeHtml(image.id)}"><button class="merchant-image-drag" type="button" data-drag-handle aria-label="拖曳圖片">⋮</button><img src="${escapeHtml(image.preview)}" alt="商品圖片 ${index + 1}"><span>${index === 0 ? "主圖片" : index === 1 ? "列表 Hover 圖" : `圖片 ${index + 1}`}</span><button class="merchant-image-remove" type="button" data-remove-editor-image="${escapeHtml(image.id)}" aria-label="刪除圖片">×</button></article>`).join("")
      : '<p class="merchant-image-empty">請先上載圖片。</p>';

    sortable?.destroy();
    sortable = null;
    if (window.Sortable && editorImages.length > 1) {
      sortable = new window.Sortable(list, {
        animation: 160,
        handle: "[data-drag-handle]",
        ghostClass: "is-dragging",
        onEnd: () => {
          reorderImagesFromDom();
          renderEditorImages();
        }
      });
    }
  }

  function openEditor(productId = null) {
    ensureMerchantModals();
    const product = productId ? productById(productId) : null;
    if (productId && !product) return showPageError("找不到這個商品。");
    editingProductId = product?.id || null;
    editorCategoryAssignments = cloneAssignments(product?.category || []);
    editorImages = (product?.images || []).map((url, index) => ({ id: `existing-${index}-${Date.now()}`, url, preview: url, file: null }));
    removedImageUrls = [];
    document.querySelector("[data-merchant-editor-content]").innerHTML = editorForm(product);
    renderProductCategorySelector();
    renderEditorImages();
    openModal(document.querySelector("#merchantEditorModal"));
  }

  function cloneAssignments(assignments) {
    return (Array.isArray(assignments) ? assignments : []).map((assignment) => ({
      categoryId: String(assignment.categoryId || ""),
      subcategoryIds: [...(assignment.subcategoryIds || [])]
    })).filter((assignment) => assignment.categoryId);
  }

  function openDeleteConfirmation(productId) {
    const product = productById(productId);
    if (!product) return showPageError("找不到這個商品。");
    deletingProductId = product.id;
    deletingProductImages = [...(product.images || [])];
    document.querySelector("[data-delete-product-message]").textContent = `確定要刪除「${product.name}」嗎？此操作無法還原。`;
    const errorNode = document.querySelector("[data-merchant-delete-message]");
    if (errorNode) {
      errorNode.textContent = "";
      errorNode.removeAttribute("data-type");
    }
    openModal(document.querySelector("#merchantDeleteModal"));
  }

  function setEditorError(message) {
    const node = document.querySelector("[data-merchant-editor-message]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = "error";
  }

  function setEditorBusy(isBusy) {
    document.querySelectorAll("[data-merchant-editor-form] input, [data-merchant-editor-form] textarea, [data-merchant-editor-form] button").forEach((control) => {
      control.disabled = isBusy;
    });
    const saveButton = document.querySelector("[data-save-product]");
    if (saveButton) {
      if (!saveButton.dataset.defaultText) saveButton.dataset.defaultText = saveButton.textContent;
      saveButton.textContent = isBusy ? "儲存中…" : saveButton.dataset.defaultText;
    }
  }

  async function saveEditorForm(form) {
    const data = new FormData(form);
    const productId = String(data.get("id") || "").trim();
    const name = String(data.get("name") || "").trim();
    const price = Number(data.get("price"));
    if (!productId || !name) return setEditorError("請填寫商品 ID 和商品名稱。");
    if (!Number.isFinite(price) || price < 0) return setEditorError("請輸入有效價格。");
    if (!editorCategoryAssignments.length) return setEditorError("請至少選擇一個分類。");
    if (!editorImages.length) return setEditorError("請至少保留一張圖片。");

    const wasEditing = Boolean(editingProductId);
    setEditorBusy(true);
    const uploadedUrls = [];
    try {
      const images = await Promise.all(editorImages.map(async (image) => {
        if (image.file) {
          const url = await store.uploadProductImage(productId, image.file);
          uploadedUrls.push(url);
          return url;
        }
        return image.url;
      }));

      const product = {
        id: productId,
        name,
        price,
        stock: Math.max(0, Number.parseInt(data.get("stock"), 10) || 0),
        orderStatus: data.get("orderStatus") === "preorder" ? "preorder" : "in-stock",
        category: cloneAssignments(editorCategoryAssignments),
        images,
        description: lines(data.get("description")),
        tags: lines(data.get("tags")),
        showOnHome: data.get("showOnHome") === "on",
        isActive: data.get("isActive") === "on"
      };

      if (editingProductId) await store.updateProduct(editingProductId, product);
      else await store.addProduct(product);
      const imagesToRemove = [...removedImageUrls];
      closeMerchantModals();
      renderProductRows();
      showMerchantToast(wasEditing ? "修改成功" : "新增成功");
      cleanupProductImages(imagesToRemove);
    } catch (error) {
      setEditorBusy(false);
      setEditorError(merchantErrorMessage(error, "無法儲存商品。"));
      cleanupProductImages(uploadedUrls);
    }
  }

  async function firebaseService() {
    if (!window.onlineShopFirebaseReady) throw new Error("Firebase 尚未初始化。");
    return window.onlineShopFirebaseReady;
  }

  async function handleMerchantLogout() {
    try {
      const firebase = await firebaseService();
      await firebase.signOut(firebase.auth);
    } finally {
      window.location.replace(`${rootPrefix()}index.html`);
    }
  }

  async function handleAuthState(user) {
    updateMerchantNav(user);

    if (!user) {
      currentMerchant = null;
      resetMerchantRoleState();
      homeHeroDraft = null;
      footerDraft = null;
      contactDraft = null;
      aboutDraft = null;
      activeHomeHeroFieldId = null;
      activeFooterFieldId = null;
      activeContactFieldId = null;
      activeAboutFieldId = null;
      closeMerchantModals();
      if (container) window.location.replace(storefrontLoginUrl());
      return;
    }

    if (!isAllowedMerchant(user)) {
      currentMerchant = null;
      resetMerchantRoleState();
      homeHeroDraft = null;
      footerDraft = null;
      contactDraft = null;
      aboutDraft = null;
      activeHomeHeroFieldId = null;
      activeFooterFieldId = null;
      activeContactFieldId = null;
      activeAboutFieldId = null;
      closeMerchantModals();
      if (container) {
        renderGate("沒有權限", `帳號 ${escapeHtml(user.email || user.uid || "")} 沒有商戶後台權限。`, `<a class="merchant-secondary-button" href="${rootPrefix()}index.html">返回首頁</a>`);
      }
      return;
    }

    if (isStorefrontPage()) {
      window.location.replace(merchantDashboardUrl());
      return;
    }

    if (document.body?.dataset.page === "merchant") {
      window.location.replace(merchantDashboardUrl());
      return;
    }

    if (container) {
      if (currentMerchant?.uid !== user.uid) resetMerchantRoleState();
      currentMerchant = user;
      renderGate("正在載入後台", "請稍候…");
      try {
        await loadMerchantRole(user);
        await store.initializeMerchantProducts();
        renderDashboard(user);
      } catch (error) {
        renderGate("後台載入失敗", error.message || "目前無法讀取商品資料。", `<button class="merchant-secondary-button" type="button" data-merchant-dashboard-logout>登出</button>`);
      }
    }
  }
  document.addEventListener("submit", async (event) => {
    const homeHeroForm = event.target.closest("[data-home-hero-form]");
    if (homeHeroForm && currentMerchant) {
      event.preventDefault();
      await saveHomeHeroForm(homeHeroForm);
      return;
    }
    const footerForm = event.target.closest("[data-footer-form]");
    if (footerForm && currentMerchant) {
      event.preventDefault();
      await saveFooterForm(footerForm);
      return;
    }
    const contactForm = event.target.closest("[data-contact-form]");
    if (contactForm && currentMerchant) {
      event.preventDefault();
      await saveContactForm(contactForm);
      return;
    }
    const aboutForm = event.target.closest("[data-about-form]");
    if (aboutForm && currentMerchant) {
      event.preventDefault();
      await saveAboutForm(aboutForm);
      return;
    }

    const form = event.target.closest("[data-merchant-editor-form]");
    if (!form || !currentMerchant) return;
    event.preventDefault();
    await saveEditorForm(form);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(".merchant-modal.is-open")) closeMerchantModals();
  });

  document.addEventListener("focusin", (event) => {
    if (suppressHomeHeroFocusActivation) return;
    const editorField = event.target.closest("[data-home-hero-form] [data-editor-field]");
    if (!editorField) return;
    activateHomeHeroField(editorField.getAttribute("data-editor-field"), "editor");
  });

  document.addEventListener("focusin", (event) => {
    if (suppressFooterFocusActivation) return;
    const editorField = event.target.closest("[data-footer-form] [data-editor-field]");
    if (!editorField) return;
    activateFooterField(editorField.getAttribute("data-editor-field"), "editor");
  });

  document.addEventListener("focusin", (event) => {
    if (suppressContactFocusActivation) return;
    const editorField = event.target.closest("[data-contact-form] [data-editor-field]");
    if (!editorField) return;
    activateContactField(editorField.getAttribute("data-editor-field"), "editor");
  });

  document.addEventListener("focusin", (event) => {
    if (suppressAboutFocusActivation) return;
    const editorField = event.target.closest("[data-about-form] [data-editor-field]");
    if (!editorField) return;
    activateAboutField(editorField.getAttribute("data-editor-field"), "editor");
  });

  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-merchant-dashboard-logout]")) return handleMerchantLogout();
    const previewField = event.target.closest('[data-preview-id="homeHero"] [data-preview-field]');
    if (previewField) {
      if (event.target.closest("a, button")) event.preventDefault();
      activateHomeHeroField(previewField.getAttribute("data-preview-field"), "preview");
      return;
    }
    const editorField = event.target.closest("[data-home-hero-form] [data-editor-field]");
    if (editorField) {
      activateHomeHeroField(editorField.getAttribute("data-editor-field"), "editor");
      return;
    }
    const footerPreviewField = event.target.closest('[data-preview-id="footer"] [data-preview-field]');
    if (footerPreviewField) {
      if (event.target.closest("a, button")) event.preventDefault();
      activateFooterField(footerPreviewField.getAttribute("data-preview-field"), "preview");
      return;
    }
    const footerEditorField = event.target.closest("[data-footer-form] [data-editor-field]");
    if (footerEditorField) {
      activateFooterField(footerEditorField.getAttribute("data-editor-field"), "editor");
      return;
    }
    const contactPreviewField = event.target.closest('[data-preview-id="contact"] [data-preview-field]');
    if (contactPreviewField) {
      if (event.target.closest("a, button")) event.preventDefault();
      activateContactField(contactPreviewField.getAttribute("data-preview-field"), "preview");
      return;
    }
    const contactEditorField = event.target.closest("[data-contact-form] [data-editor-field]");
    if (contactEditorField) {
      activateContactField(contactEditorField.getAttribute("data-editor-field"), "editor");
      return;
    }
    const aboutPreviewField = event.target.closest('[data-preview-id="about"] [data-preview-field]');
    if (aboutPreviewField) {
      if (event.target.closest("a, button")) event.preventDefault();
      activateAboutField(aboutPreviewField.getAttribute("data-preview-field"), "preview");
      return;
    }
    const aboutEditorField = event.target.closest("[data-about-form] [data-editor-field]");
    if (aboutEditorField) {
      activateAboutField(aboutEditorField.getAttribute("data-editor-field"), "editor");
      return;
    }

    const sectionButton = event.target.closest("[data-merchant-section]");
    if (sectionButton) {
      const section = sectionButton.dataset.merchantSection;
      document.querySelectorAll("[data-merchant-section]").forEach((button) => {
        button.classList.toggle("is-active", button === sectionButton);
      });
      document.querySelectorAll("[data-merchant-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.merchantPanel === section);
      });
      return;
    }

    if (event.target.closest("[data-manage-categories]")) return openCategoryManager();
    if (event.target.closest("[data-add-category]")) {
      syncCategoryDraftFromDom();
      categoryDraft.push(store.normalizeCategory({ id: store.newId("category"), name: "新增大分類", order: categoryDraft.length, subcategories: [] }));
      return renderCategoryManager();
    }
    const addSubcategoryButton = event.target.closest("[data-add-subcategory]");
    if (addSubcategoryButton) {
      syncCategoryDraftFromDom();
      const category = categoryDraft.find((item) => item.id === addSubcategoryButton.dataset.addSubcategory);
      if (category) category.subcategories.push({ id: store.newId("subcategory"), name: "新增小分類", slug: "new-subcategory", order: category.subcategories.length });
      return renderCategoryManager();
    }
    const deleteCategoryButton = event.target.closest("[data-delete-category]");
    if (deleteCategoryButton) {
      syncCategoryDraftFromDom();
      categoryDraft = categoryDraft.filter((category) => category.id !== deleteCategoryButton.dataset.deleteCategory || category.system);
      return renderCategoryManager();
    }
    const deleteSubcategoryButton = event.target.closest("[data-delete-subcategory]");
    if (deleteSubcategoryButton) {
      syncCategoryDraftFromDom();
      const category = categoryDraft.find((item) => item.id === deleteSubcategoryButton.dataset.parentCategory);
      if (category) category.subcategories = category.subcategories.filter((subcategory) => subcategory.id !== deleteSubcategoryButton.dataset.deleteSubcategory);
      return renderCategoryManager();
    }
    if (event.target.closest("[data-save-categories]")) return saveCategoryManager();
    if (event.target.closest("[data-add-product]")) return openEditor();
    const editButton = event.target.closest("[data-edit-product]");
    if (editButton) return openEditor(editButton.dataset.editProduct);
    const removeImage = event.target.closest("[data-remove-editor-image]");
    if (removeImage) {
      const image = editorImages.find((item) => item.id === removeImage.dataset.removeEditorImage);
      if (image?.file) URL.revokeObjectURL(image.preview);
      else if (image?.url) removedImageUrls.push(image.url);
      editorImages = editorImages.filter((item) => item.id !== removeImage.dataset.removeEditorImage);
      return renderEditorImages();
    }

    const toggleButton = event.target.closest("[data-toggle-product]");
    if (toggleButton && currentMerchant) {
      const nextActive = toggleButton.dataset.nextActive === "true";
      const originalText = toggleButton.textContent;
      toggleButton.disabled = true;
      toggleButton.textContent = "處理中…";
      try {
        await store.setProductActive(toggleButton.dataset.toggleProduct, nextActive);
        renderProductRows();
        showMerchantToast(nextActive ? "商品已上架" : "商品已隱藏");
      } catch (error) {
        const message = merchantErrorMessage(error, "無法更新商品狀態。");
        showPageError(message);
        showMerchantToast(message);
        toggleButton.disabled = false;
        toggleButton.textContent = originalText;
      }
      return;
    }
    const deleteButton = event.target.closest("[data-delete-product]");
    if (deleteButton) return openDeleteConfirmation(deleteButton.dataset.deleteProduct);
    if (event.target.closest("[data-confirm-delete]") && deletingProductId) {
      const button = event.target.closest("[data-confirm-delete]");
      button.disabled = true;
      button.textContent = "刪除中…";
      try {
        const imagesToRemove = [...deletingProductImages];
        await store.deleteProduct(deletingProductId);
        closeMerchantModals();
        renderProductRows();
        showMerchantToast("刪除成功");
        cleanupProductImages(imagesToRemove);
      } catch (error) {
        button.disabled = false;
        button.textContent = "確認刪除";
        const message = merchantErrorMessage(error, "無法刪除商品。");
        const errorNode = document.querySelector("[data-merchant-delete-message]");
        if (errorNode) {
          errorNode.textContent = message;
          errorNode.dataset.type = "error";
        }
        showPageError(message);
      }
      return;
    }
    if (event.target.closest("[data-close-merchant-modal]")) closeMerchantModals();
  });

  document.addEventListener("change", async (event) => {
    if (event.target.matches("[data-product-category-parent], [data-product-category-child]")) {
      updateProductCategoryAssignment(event.target);
      return;
    }
    if (event.target.matches("[data-site-content-image-upload]")) {
      await uploadHomeHeroImage(event.target);
      return;
    }
    if (!event.target.matches("[data-image-upload]")) return;
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setEditorError(`${file.name} 不是有效的圖片檔案。`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setEditorError(`${file.name} 超過 10MB 上限。`);
        continue;
      }
      editorImages.push({ id: `new-${crypto.randomUUID()}`, url: "", preview: URL.createObjectURL(file), file });
    }
    event.target.value = "";
    renderEditorImages();
  });

  window.addEventListener("storage", (event) => {
    if ([store?.storageKey, store?.categoryStorageKey].includes(event.key) && currentMerchant) renderProductRows();
  });

  async function initMerchantAccess() {
    if (!store) return;
    if (container) renderGate("正在檢查商戶帳號", "請稍候…");
    try {
      const firebase = await window.onlineShopFirebaseReady;
      firebase.onAuthStateChanged(firebase.auth, handleAuthState);
    } catch (error) {
      updateMerchantNav(null);
      if (container) renderGate("無法連接驗證服務", error?.message || "請稍後再試。", `<a class="merchant-secondary-button" href="${rootPrefix()}index.html">返回首頁</a>`);
    }
  }

  initMerchantAccess();
})();
