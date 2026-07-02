(function () {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const container = document.querySelector("[data-merchant-page]");
  const store = window.ONLINE_SHOP_PRODUCT_ADMIN_STORE;
  let currentMerchant = null;
  let currentMerchantRole = null;
  let currentUsers = [];
  let currentInvites = [];
  let editingProductId = null;
  let editingUserId = null;
  let deletingProductId = null;
  let deletingProductImages = [];
  let customerOrdersUnsub = null;
  let editingUserOrders = [];
  let editorCategoryAssignments = [];
  let editorImages = [];
  let removedImageUrls = [];
  let sortable = null;
  let categoryDraft = [];
  let originalCategoryIds = [];
  let categorySortables = [];
  let dashboardUnsubscribers = [];
  let userCreatedSort = "desc";
  let usersSubsection = "list";
  let currentInviteLink = "";
  let activeDashboardSection = "products";
  let currentOrders = [];
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
  let policyDrafts = {};
  let policyLoading = {};
  let policySaving = {};
  let activeSiteContentId = "home";
  let siteContentPreviewMode = "desktop";
  let activeHomeHeroFieldId = null;
  let activeFooterFieldId = null;
  let activeContactFieldId = null;
  let activeAboutFieldId = null;
  let activePolicyFieldId = null;
  let suppressHomeHeroFocusActivation = false;
  let suppressFooterFocusActivation = false;
  let suppressContactFocusActivation = false;
  let suppressAboutFocusActivation = false;
  let suppressPolicyFocusActivation = false;
  const BACKOFFICE_ROLES = ["super_admin", "admin", "staff"];
  const ROLE_PERMISSION_ROLES = ["super_admin", "admin", "staff", "customer"];
  const ROLE_PERMISSION_FEATURES = [
    { key: "usersManage", label: "用戶管理" },
    { key: "inviteUsers", label: "邀請用戶" },
    { key: "inviteRecords", label: "邀請記錄" },
    { key: "salesManage", label: "銷售管理" },
    { key: "productsManage", label: "產品管理" },
    { key: "categoriesManage", label: "分類管理" },
    { key: "pagesManage", label: "網頁管理" },
    { key: "permissionsManage", label: "權限管理" },
    { key: "storePreview", label: "商戶預覽店鋪" },
    { key: "usersBlock", label: "封鎖 / 恢復用戶" },
    { key: "viewUserDetails", label: "查看用戶資料" },
    { key: "usersRoleEdit", label: "修改用戶身份" },
    { key: "usersProfileEdit", label: "修改用戶資料" },
    { key: "ordersRead", label: "查看訂單" },
    { key: "ordersUpdate", label: "修改訂單狀態" }
  ];
  const MERCHANT_ORDER_STATUSES = ["pending", "processing", "shipping", "ready_pickup", "refunded"];
  const LEGACY_PERMISSION_ALIASES = {
    usersRead: "usersManage",
    usersWrite: "usersProfileEdit",
    ordersRead: "ordersRead",
    productsWrite: "productsManage",
    pagesWrite: "pagesManage",
    permissionsWrite: "permissionsManage"
  };
  let currentRolePermissions = defaultRolePermissions();

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

  const POLICY_CONTENT_ITEMS = [
    { key: "delivery", id: "policyDelivery", docId: "policyDelivery", label: "Delivery Policy" },
    { key: "payment", id: "policyPayment", docId: "policyPayment", label: "Payment Policy" },
    { key: "refund", id: "policyRefund", docId: "policyRefund", label: "Refund Policy" }
  ];

  const SITE_CONTENT_NAV_ITEMS = [
    { id: "home", label: "Home Page", detail: "Hero banner" },
    { id: "about", label: "About", detail: "Brand story" },
    { id: "contact", label: "Contact", detail: "Contact details" },
    { id: "policyDelivery", label: "Delivery Policy", detail: "Delivery page" },
    { id: "policyPayment", label: "Payment Policy", detail: "Payment page" },
    { id: "policyRefund", label: "Refund Policy", detail: "Refund page" },
    { id: "footer", label: "Footer", detail: "Site footer" }
  ];


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

  function isBackofficeRole(roleValue) {
    return BACKOFFICE_ROLES.includes(String(roleValue || "").trim());
  }

  function isActiveBackofficeUser(role) {
    return Boolean(role && role.active === true && isBackofficeRole(role.role));
  }

  function isAllowedMerchant(user, role = currentMerchantRole) {
    return Boolean(user?.uid && isActiveBackofficeUser(role));
  }

  function defaultRolePermissions() {
    const permissions = {};
    ROLE_PERMISSION_FEATURES.forEach((feature) => {
      permissions[feature.key] = {
        super_admin: true,
        admin: true,
        staff: ["productsManage", "categoriesManage", "pagesManage", "storePreview", "viewUserDetails"].includes(feature.key),
        customer: false
      };
    });
    return permissions;
  }

  function normalizeRolePermissions(permissions) {
    const merged = defaultRolePermissions();
    ROLE_PERMISSION_FEATURES.forEach((feature) => {
      const row = permissions?.[feature.key] && typeof permissions[feature.key] === "object" ? permissions[feature.key] : {};
      ROLE_PERMISSION_ROLES.forEach((role) => {
        if (row[role] !== undefined) merged[feature.key][role] = row[role] === true;
      });
    });
    return merged;
  }

  function permissionKey(key) {
    return LEGACY_PERMISSION_ALIASES[key] || key;
  }

  function hasPermission(permission, role = currentMerchantRole) {
    const feature = permissionKey(permission);
    if (!role?.active || !isBackofficeRole(role.role)) return false;
    return currentRolePermissions?.[feature]?.[role.role] === true;
  }

  function isSuperAdmin(role = currentMerchantRole) {
    return role?.active === true && role.role === "super_admin";
  }

  function isAdmin(role = currentMerchantRole) {
    return role?.active === true && role.role === "admin";
  }

  function isStaff(role = currentMerchantRole) {
    return role?.active === true && role.role === "staff";
  }

  function canManageUsers(role = currentMerchantRole) {
    return hasPermission("usersManage", role);
  }

  function canViewUserDetails(role = currentMerchantRole) {
    return hasPermission("viewUserDetails", role);
  }

  function canOpenUsersSection(role = currentMerchantRole) {
    return canManageUsers(role) || canViewUserDetails(role);
  }

  function canManagePermissions(role = currentMerchantRole) {
    return hasPermission("permissionsManage", role);
  }

  function canManageProducts(role = currentMerchantRole) {
    return hasPermission("productsManage", role);
  }

  function canManagePages(role = currentMerchantRole) {
    return hasPermission("pagesManage", role);
  }

  function canReadSales(role = currentMerchantRole) {
    return hasPermission("salesManage", role);
  }

  function roleLabel(role) {
    const labels = {
      super_admin: "超級管理員",
      admin: "管理員",
      staff: "員工",
      customer: "顧客",
      merchant: "商戶"
    };
    return labels[role] || role || "顧客";
  }

  function roleFromUserProfile(profile) {
    const role = String(profile?.role || "").trim();
    if (!isBackofficeRole(role) || profile?.status === "blocked") return null;
    return {
      role,
      active: true,
      permissions: {}
    };
  }

  function roleOptionsForEditor(targetRole = "customer") {
    if (isSuperAdmin()) return ["super_admin", "admin", "staff", "customer"];
    if (isAdmin() && !["super_admin", "admin"].includes(targetRole)) return ["staff", "customer"];
    return [];
  }

  function userDisplayName(user) {
    return user?.displayName || user?.email || "未有名稱";
  }

  function userInitial(user) {
    return String(userDisplayName(user)).trim().charAt(0).toUpperCase() || "?";
  }

  function userTimestampValue(value) {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function sortedUsersByCreatedAt() {
    return [...currentUsers].sort((a, b) => {
      const diff = userTimestampValue(a.createdAt) - userTimestampValue(b.createdAt);
      return userCreatedSort === "asc" ? diff : -diff;
    });
  }

  function canModifyUser(user) {
    if (!user) return false;
    if (isSuperAdmin()) return true;
    if (isAdmin()) return !["super_admin", "admin"].includes(user.role);
    return false;
  }

  function canEditUserNote(user) {
    if (!user) return false;
    if (hasPermission("usersProfileEdit") && canModifyUser(user)) return true;
    return isStaff() && canViewUserDetails();
  }

  function canSetUserRole(user, nextRole) {
    if (!hasPermission("usersRoleEdit")) return false;
    if (!canModifyUser(user)) return false;
    if (isSuperAdmin()) return ["super_admin", "admin", "staff", "customer"].includes(nextRole);
    if (isAdmin()) return ["staff", "customer"].includes(nextRole);
    return false;
  }

  function canSetUserStatus(user) {
    return hasPermission("usersBlock") && canModifyUser(user);
  }

  function isSoftDeletedUser(user) {
    return user?.status === "deleted" || user?.isDeleted === true || user?.deleted === true;
  }

  function hasSoftDeleteUserPermission() {
    if (isAdmin()) {
      return canManageUsers() || hasPermission("usersProfileEdit") || hasPermission("usersBlock");
    }
    if (isStaff()) {
      return canManageUsers() || hasPermission("usersProfileEdit") || hasPermission("usersBlock");
    }
    return false;
  }

  function canSoftDeleteUser(user) {
    const userId = String(user?.uid || user?.id || "").trim();
    const targetRole = String(user?.role || "customer").trim();
    if (!user || !userId) return false;
    if (currentMerchant?.uid && userId === currentMerchant.uid) return false;
    if (isSoftDeletedUser(user)) return false;
    if (["super_admin", "merchant"].includes(targetRole)) return false;
    if (isSuperAdmin()) return true;
    if (!hasSoftDeleteUserPermission()) return false;
    if (isAdmin()) return !["admin"].includes(targetRole);
    if (isStaff()) return targetRole === "customer";
    return false;
  }

  function isVisibleUser(user) {
    return user?.status !== "exited" && user?.hidden !== true && !isSoftDeletedUser(user);
  }

  function inviteStatusLabel(invite) {
    if (!invite) return "未知";
    if (invite.status === "blocked") return "已封鎖";
    if (invite.status === "exited") return "已退出";
    if (invite.used === true || ["used", "registered"].includes(invite.status)) return "已註冊";
    if (invite.used === false && invite.status === "pending") return "邀請中";
    return invite.status || "未知";
  }

  function visibleInvites(invites = currentInvites) {
    return (Array.isArray(invites) ? invites : []).filter((invite) => invite?.hidden !== true && invite?.status !== "deleted");
  }

  function tagsInputValue(tags) {
    return Array.isArray(tags) ? tags.join(", ") : String(tags || "");
  }

  function rootPrefix() {
    return document.body?.dataset.rootPrefix || "";
  }

  function merchantDashboardUrl() {
    return `${rootPrefix()}merchant-dashboard.html`;
  }

  function storefrontLoginUrl() {
    return `${rootPrefix()}index.html?auth=login&redirect=merchant-dashboard`;
  }

  function storefrontPreviewUrl() {
    return `${rootPrefix()}index.html?preview=store`;
  }

  function isStorePreviewGuest() {
    return new URLSearchParams(window.location.search).get("preview") === "store";
  }

  function isMerchantAreaPage() {
    return ["merchant", "merchant-dashboard"].includes(document.body?.dataset.page || "");
  }

  function isStorefrontPage() {
    return !isMerchantAreaPage();
  }

  function updateMerchantNav(user) {
    document.querySelectorAll("[data-merchant-nav]").forEach((link) => link.remove());
    if (isStorePreviewGuest()) return;
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

  function formatDateTime(value) {
    if (!value) return "未有資料";
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

  function formatDashboardPrice(value) {
    return `HK$${Number(value || 0).toFixed(2)}`;
  }

  function orderAmount(order) {
    return Number(order.total || order.totalAmount || order.amount || order.grandTotal || 0);
  }

  function orderCustomerEmail(order) {
    return order.customerEmail || order.email || order.customer?.email || "未有資料";
  }

  function orderCustomerName(order) {
    return order.customerName || order.customer?.name || order.customer?.displayName || "未有資料";
  }

  function orderRecipientName(order) {
    return order.recipientName || order.recipient?.name || "未有資料";
  }

  function orderPaymentMethodLabel(value) {
    return value === "credit_card" ? "信用卡" : value || "未有資料";
  }

  function orderPaymentStatusLabel(value) {
    const labels = {
      mock_paid: "測試付款已完成",
      paid: "已付款",
      pending: "待付款",
      failed: "付款失敗"
    };
    return labels[value] || value || "未有資料";
  }

  function orderDeliveryMethodLabel(value) {
    return value === "delivery" ? "送貨上門" : "到店自取";
  }

  function orderStatusLabel(status) {
    const labels = {
      pending: "待處理",
      processing: "處理中",
      shipping: "運輸中",
      ready_pickup: "待取件",
      refunded: "已退款",
      received: "已收貨",
      paid: "已付款",
      shipped: "已出貨",
      completed: "已完成",
      cancelled: "已取消"
    };
    return labels[status] || status || "未有狀態";
  }

  function orderNumberLabel(order) {
    const base = order?.orderNumber || order?.id || "未提供訂單編號";
    return order?.status === "refunded" ? `${base}（已退款）` : base;
  }

  function renderMerchantOrderStatusOptions(currentStatus) {
    return MERCHANT_ORDER_STATUSES.map((status) => `
      <option value="${status}" ${currentStatus === status ? "selected" : ""}>${escapeHtml(orderStatusLabel(status))}</option>
    `).join("");
  }

  function cleanupDashboardListeners() {
    dashboardUnsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe?.();
      } catch (error) {
        console.warn("無法停止後台資料監聽。", error);
      }
    });
    dashboardUnsubscribers = [];
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
    const showUsersSubtabs = canManageUsers();
    if ((!showUsersSubtabs || !hasPermission("inviteRecords")) && usersSubsection === "invites") usersSubsection = "list";
    const sections = [
      canOpenUsersSection() ? { id: "users", label: "\u7528\u6236\u7ba1\u7406" } : null,
      canReadSales() ? { id: "sales", label: "\u92b7\u552e\u7ba1\u7406" } : null,
      hasPermission("ordersRead") ? { id: "order-records", label: "訂單記錄" } : null,
      (canManageProducts() || hasPermission("categoriesManage")) ? { id: "products", label: "\u7522\u54c1\u7ba1\u7406" } : null,
      canManagePages() ? { id: "site", label: "\u9801\u9762\u5167\u5bb9" } : null,
      canManagePermissions() ? { id: "permissions", label: "\u6b0a\u9650\u7ba1\u7406" } : null
    ].filter(Boolean);
    if (!sections.some((section) => section.id === activeDashboardSection)) {
      activeDashboardSection = sections[0]?.id || "products";
    }
    const activeSection = activeDashboardSection;
    const navHtml = sections
      .map((section) => {
        const sectionClasses = [
          section.id === activeSection ? "is-active" : "",
          section.id === "site" ? "page-content-sidebar-trigger" : ""
        ].filter(Boolean).join(" ");
        const button = `<button class="${sectionClasses}" type="button" data-merchant-section="${section.id}">${section.label}</button>`;
        if (section.id !== "site") return button;
        return `${button}<div class="page-content-sidebar-nav" data-site-content-sidebar-nav>${renderSiteContentSubnav(activeSiteContentId)}</div>`;
      })
      .join("");
    container.innerHTML = `
      <section class="merchant-dashboard">
        <aside class="merchant-dashboard__sidebar" aria-label="\u5546\u6236\u5f8c\u53f0\u5c0e\u89bd">
          <a class="merchant-dashboard__brand" href="${storefrontPreviewUrl()}" target="_blank" rel="noopener noreferrer" data-open-store-preview>APOTHEKE</a>
          <nav>${navHtml}</nav>
          <div class="merchant-dashboard__account">${escapeHtml(user.displayName || user.email || "\u5546\u6236\u5e33\u865f")}</div>
          <button class="merchant-dashboard__logout" type="button" data-merchant-dashboard-logout>\u767b\u51fa</button>
        </aside>
        <main class="merchant-dashboard__content">
          <section class="merchant-dashboard-section ${activeSection === "users" ? "is-active" : ""}" data-merchant-panel="users">
            <h1>\u7528\u6236\u7ba1\u7406</h1>
            <div class="merchant-data-panel" data-users-panel>
              ${showUsersSubtabs ? `<div class="merchant-subtabs" data-users-subtabs>
                <button class="merchant-subtabs__button ${usersSubsection === "list" ? "is-active" : ""}" type="button" data-users-subtab="list">用戶列表</button>
                ${hasPermission("inviteRecords") ? `<button class="merchant-subtabs__button ${usersSubsection === "invites" ? "is-active" : ""}" type="button" data-users-subtab="invites">邀請記錄</button>` : ""}
              </div>` : ""}
              <section class="merchant-subpanel ${usersSubsection === "list" ? "is-active" : ""}" data-users-subpanel="list">
              <div class="merchant-stat-grid">
                <article class="merchant-stat-card"><span>\u7e3d\u7528\u6236\u6578</span><strong data-total-users>0</strong></article>
                <article class="merchant-stat-card"><span>管理員</span><strong data-admin-users>0</strong></article>
                <article class="merchant-stat-card"><span>員工</span><strong data-staff-users>0</strong></article>
                <article class="merchant-stat-card"><span>已封鎖</span><strong data-blocked-users>0</strong></article>
              </div>
              ${hasPermission("inviteUsers") ? `<div class="merchant-users-toolbar"><button class="merchant-primary-button" type="button" data-open-invite-modal>邀請用戶</button></div>` : ""}
              <p class="merchant-data-message" data-users-message>\u6b63\u5728\u8f09\u5165\u7528\u6236\u8cc7\u6599\u2026</p>
              <div class="merchant-table-wrap" data-users-table></div>
              </section>
              <section class="merchant-subpanel ${usersSubsection === "invites" && hasPermission("inviteRecords") ? "is-active" : ""}" data-users-subpanel="invites">
                <p class="merchant-data-message" data-user-invites-message>正在載入邀請記錄…</p>
                <div class="merchant-table-wrap" data-user-invites-table></div>
              </section>
            </div>
          </section>
          <section class="merchant-dashboard-section ${activeSection === "sales" ? "is-active" : ""}" data-merchant-panel="sales">
            <h1>\u92b7\u552e\u7ba1\u7406</h1>
            <div class="merchant-data-panel" data-orders-panel>
              <div class="merchant-stat-grid">
                <article class="merchant-stat-card"><span>\u4eca\u65e5\u92b7\u552e\u984d</span><strong data-today-sales>HK$0.00</strong></article>
                <article class="merchant-stat-card"><span>\u7e3d\u8a02\u55ae\u6578</span><strong data-total-orders>0</strong></article>
                <article class="merchant-stat-card"><span>\u7e3d\u92b7\u552e\u984d</span><strong data-total-sales>HK$0.00</strong></article>
              </div>
              <p class="merchant-data-message" data-orders-message>\u6b63\u5728\u8f09\u5165\u8a02\u55ae\u8cc7\u6599\u2026</p>
              <div class="merchant-table-wrap" data-orders-table></div>
            </div>
          </section>
          <section class="merchant-dashboard-section ${activeSection === "order-records" ? "is-active" : ""}" data-merchant-panel="order-records">
            <h1>訂單記錄</h1>
            <div class="merchant-data-panel" data-order-records-panel>
              <p class="merchant-data-message" data-order-records-message>正在載入訂單記錄…</p>
              <div class="merchant-table-wrap" data-order-records-table></div>
            </div>
          </section>
          <section class="merchant-dashboard-section ${activeSection === "products" ? "is-active" : ""}" data-merchant-panel="products">
            <div class="merchant-page">
              <div class="merchant-page__heading">
                <div><h1>\u7522\u54c1\u7ba1\u7406</h1></div>
              </div>
              <p class="merchant-page__message" data-merchant-page-message aria-live="polite"></p>
              <section class="merchant-products-panel">
                <div class="merchant-products-panel__heading">
                  <h2>\u5168\u90e8\u5546\u54c1</h2>
                  <div class="merchant-products-panel__actions">
                    ${hasPermission("categoriesManage") ? `<button class="merchant-secondary-button" type="button" data-manage-categories>\u5206\u985e\u7ba1\u7406</button>` : ""}
                    ${canManageProducts() ? `<button class="merchant-primary-button" type="button" data-add-product>\u65b0\u589e</button>` : ""}
                  </div>
                </div>
                <div class="merchant-products" data-merchant-products></div>
              </section>
            </div>
          </section>
          <section class="merchant-dashboard-section ${activeSection === "site" ? "is-active" : ""}" data-merchant-panel="site">
            <div data-site-content-panel></div>
          </section>
          <section class="merchant-dashboard-section ${activeSection === "permissions" ? "is-active" : ""}" data-merchant-panel="permissions">
            <h1>權限管理</h1>
            <div class="merchant-data-panel" data-permissions-panel>
              <p class="merchant-data-message" data-permissions-message>正在載入權限資料…</p>
              <div class="merchant-table-wrap" data-permissions-table></div>
            </div>
          </section>
        </main>
      </section>`;
  }

  function renderUsers(users) {
    currentUsers = (Array.isArray(users) ? users : []).filter(isVisibleUser);
    const total = document.querySelector("[data-total-users]");
    const adminTotal = document.querySelector("[data-admin-users]");
    const staffTotal = document.querySelector("[data-staff-users]");
    const blockedTotal = document.querySelector("[data-blocked-users]");
    const message = document.querySelector("[data-users-message]");
    const table = document.querySelector("[data-users-table]");
    if (!total || !message || !table) return;
    total.textContent = String(currentUsers.length);
    if (adminTotal) adminTotal.textContent = String(currentUsers.filter((user) => user.role === "admin").length);
    if (staffTotal) staffTotal.textContent = String(currentUsers.filter((user) => user.role === "staff").length);
    if (blockedTotal) blockedTotal.textContent = String(currentUsers.filter((user) => user.status === "blocked").length);
    renderPermissions();
    if (!currentUsers.length) {
      message.textContent = "暫時沒有用戶資料。";
      table.innerHTML = "";
      return;
    }
    message.textContent = "";
    const canOperateUsers = canViewUserDetails() || canManageUsers() || hasSoftDeleteUserPermission() || hasPermission("usersProfileEdit") || hasPermission("usersRoleEdit") || hasPermission("usersBlock") || hasPermission("ordersRead") || hasPermission("ordersUpdate");
    const sortedUsers = sortedUsersByCreatedAt();
    const sortArrow = userCreatedSort === "desc" ? "↓" : "↑";
    table.innerHTML = `
      <table class="merchant-data-table merchant-users-table">
        <thead>
          <tr>
            <th>用戶</th>
            <th>Email</th>
            <th>身份</th>
            <th>超級管理員</th>
            <th>管理員</th>
            <th>員工</th>
            <th>封鎖</th>
            <th><button class="merchant-sort-button" type="button" data-sort-users-created>創建時間 ${sortArrow}</button></th>
            ${canOperateUsers ? "<th>操作</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${sortedUsers.map((user) => {
            const userId = escapeHtml(user.uid || user.id);
            const canModify = canModifyUser(user);
            const canDelete = canSoftDeleteUser(user);
            const canOpen = canViewUserDetails();
            const actionLabel = isStaff() ? "查看" : "修改";
            return `
            <tr>
              <td>
                <div class="merchant-user-cell">
                  <span class="merchant-user-avatar" aria-hidden="true">${escapeHtml(userInitial(user))}</span>
                  <span><span class="merchant-user-name">${escapeHtml(userDisplayName(user))}</span><small>ID：${userId}</small></span>
                </div>
              </td>
              <td>${escapeHtml(user.email || "未有電郵")}</td>
              <td>${escapeHtml(roleLabel(user.role))}</td>
              ${["super_admin", "admin", "staff"].map((role) => `
                <td>
                  <label class="merchant-switch" aria-label="設定為${escapeHtml(roleLabel(role))}">
                    <input type="checkbox" data-user-role-toggle="${userId}" data-role="${role}" ${user.role === role ? "checked" : ""} ${canModify && canSetUserRole(user, user.role === role ? "customer" : role) ? "" : "disabled"}>
                    <span></span>
                  </label>
                </td>
              `).join("")}
              <td>
                <label class="merchant-switch merchant-switch--danger" aria-label="封鎖用戶">
                  <input type="checkbox" data-user-status-toggle="${userId}" ${user.status === "blocked" ? "checked" : ""} ${canSetUserStatus(user) ? "" : "disabled"}>
                  <span></span>
                </label>
              </td>
              <td>${escapeHtml(formatDateTime(user.createdAt))}</td>
              ${canOperateUsers ? `
                <td>
                  <div class="merchant-row-actions">
                    ${canOpen ? `<button class="merchant-table-action merchant-table-action--view" type="button" data-edit-user="${userId}" aria-label="${actionLabel}用戶">${actionLabel}</button>` : ""}
                    <button class="merchant-icon-button merchant-icon-button--delete" type="button" data-delete-user="${userId}" aria-label="刪除 / 停用用戶" title="刪除 / 停用" ${canDelete ? "" : "disabled"}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21c-1.1 0-2-.9-2-2V8h14v11c0 1.1-.9 2-2 2H7ZM9 4h6l1 2h4v2H4V6h4l1-2Zm0 7v7h2v-7H9Zm4 0v7h2v-7h-2Z"/></svg>
                    </button>
                  </div>
                </td>
              ` : ""}
            </tr>
          `;
          }).join("")}
        </tbody>
      </table>`;
  }

  function renderUserInvites(invites) {
    currentInvites = Array.isArray(invites) ? invites : [];
    const message = document.querySelector("[data-user-invites-message]");
    const table = document.querySelector("[data-user-invites-table]");
    if (!message || !table) return;
    if (!hasPermission("inviteRecords")) {
      message.textContent = "你沒有查看邀請記錄的權限。";
      table.innerHTML = "";
      return;
    }
    const rows = visibleInvites(currentInvites);
    if (!rows.length) {
      message.textContent = "暫時沒有邀請記錄。";
      table.innerHTML = "";
      return;
    }
    message.textContent = "";
    table.innerHTML = `
      <table class="merchant-data-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>身份</th>
            <th>狀態</th>
            <th>邀請日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((invite) => `
            <tr>
              <td>${escapeHtml(invite.email || "未有電郵")}</td>
              <td>${escapeHtml(roleLabel(invite.role))}</td>
              <td>${escapeHtml(inviteStatusLabel(invite))}</td>
              <td>${escapeHtml(formatDateTime(invite.createdAt))}</td>
              <td>
                <button class="merchant-icon-button merchant-icon-button--delete" type="button" data-delete-invite="${escapeHtml(invite.id || invite.token)}" aria-label="刪除邀請記錄">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21c-1.1 0-2-.9-2-2V8h14v11c0 1.1-.9 2-2 2H7ZM9 4h6l1 2h4v2H4V6h4l1-2Zm0 7v7h2v-7H9Zm4 0v7h2v-7h-2Z"/></svg>
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  function renderUserInvitesError(error) {
    const message = document.querySelector("[data-user-invites-message]");
    const table = document.querySelector("[data-user-invites-table]");
    if (!message) return;
    message.dataset.type = "error";
    message.textContent = error?.code === "permission-denied"
      ? "目前 Firestore Rules 未允許商戶讀取邀請記錄。請按回報中的步驟更新 Firestore Rules。"
      : merchantErrorMessage(error, "無法讀取邀請記錄。");
    if (table) table.innerHTML = "";
  }

  function renderUsersError(error) {
    const message = document.querySelector("[data-users-message]");
    const table = document.querySelector("[data-users-table]");
    if (!message) return;
    message.dataset.type = "error";
    message.textContent = error?.code === "permission-denied"
      ? "目前 Firestore Rules 未允許商戶讀取 users collection。請按回報中的步驟更新 Firestore Rules。"
      : merchantErrorMessage(error, "無法讀取用戶資料。");
    if (table) table.innerHTML = "";
    const permissionMessage = document.querySelector("[data-permissions-message]");
    const permissionTable = document.querySelector("[data-permissions-table]");
    if (permissionMessage) permissionMessage.textContent = message.textContent;
    if (permissionTable) permissionTable.innerHTML = "";
  }

  function renderPermissions() {
    const message = document.querySelector("[data-permissions-message]");
    const table = document.querySelector("[data-permissions-table]");
    if (!message || !table) return;
    if (!canManagePermissions()) {
      message.textContent = "你沒有權限管理身份功能。";
      table.innerHTML = "";
      return;
    }
    message.textContent = "";
    message.dataset.type = "";
    const roleHeadings = ROLE_PERMISSION_ROLES.map((role) => `
      <th class="${isAdmin() && role === "super_admin" ? "is-disabled" : ""}">
        ${escapeHtml(roleLabel(role))}
        <small>${escapeHtml(role)}</small>
      </th>
    `).join("");
    table.innerHTML = `
      <table class="merchant-data-table merchant-permissions-table">
        <thead>
          <tr>
            <th>功能 / 頁面</th>
            ${roleHeadings}
          </tr>
        </thead>
        <tbody>
          ${ROLE_PERMISSION_FEATURES.map((feature) => `
            <tr>
              <th scope="row">
                ${escapeHtml(feature.label)}
                <small>${escapeHtml(feature.key)}</small>
              </th>
              ${ROLE_PERMISSION_ROLES.map((role) => {
                const disabled = isAdmin() && role === "super_admin";
                return `
                  <td class="${disabled ? "is-disabled" : ""}">
                    <label class="merchant-switch" aria-label="${escapeHtml(feature.label)} ${escapeHtml(roleLabel(role))}">
                      <input type="checkbox" data-role-permission-toggle data-feature="${escapeHtml(feature.key)}" data-role="${escapeHtml(role)}" ${currentRolePermissions?.[feature.key]?.[role] ? "checked" : ""} ${disabled ? "disabled" : ""}>
                      <span></span>
                    </label>
                  </td>
                `;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  function renderPermissionsError(error) {
    const message = document.querySelector("[data-permissions-message]");
    const table = document.querySelector("[data-permissions-table]");
    if (!message) return;
    message.dataset.type = "error";
    message.textContent = error?.code === "permission-denied"
      ? "目前 Firestore Rules 未允許讀取權限設定。請部署更新後的 Firestore Rules。"
      : merchantErrorMessage(error, "無法讀取權限設定。");
    if (table) table.innerHTML = "";
  }

  function editableUserById(userId) {
    return currentUsers.find((user) => String(user.uid || user.id) === String(userId)) || null;
  }

  function renderUserOrdersEditor() {
    const container = document.querySelector("[data-user-order-list]");
    if (!container) return;
    if (!editingUserOrders.length) {
      container.innerHTML = '<p class="merchant-user-orders__empty">暫時沒有訂單資料。</p>';
      return;
    }
    container.innerHTML = editingUserOrders.map((order) => `
      <article class="merchant-user-order-card" data-user-order-id="${escapeHtml(order.id)}">
        <div class="merchant-user-order-card__head">
          <strong>${escapeHtml(order.orderNumber || order.id)}</strong>
          <span>${escapeHtml(formatDateTime(order.createdAt))}</span>
        </div>
        <div class="merchant-user-order-card__grid">
          <div class="merchant-user-order-card__amount">
            <span>狀態</span>
            <strong>${escapeHtml(orderStatusLabel(order.status))}</strong>
          </div>
          <div class="merchant-user-order-card__amount">
            <span>金額</span>
            <strong>${formatDashboardPrice(orderAmount(order))}</strong>
          </div>
        </div>
        <label>商戶備註
          <textarea rows="3" data-order-note="${escapeHtml(order.id)}" ${hasPermission("ordersUpdate") ? "" : "disabled"}>${escapeHtml(order.merchantNote || "")}</textarea>
        </label>
      </article>
    `).join("");
  }

  function userEditorForm(user) {
    const userRole = user.role || "customer";
    const roleOptions = roleOptionsForEditor(userRole);
    const canEditProfile = hasPermission("usersProfileEdit") && canModifyUser(user);
    const canEditAccess = (hasPermission("usersRoleEdit") || hasPermission("usersBlock")) && canModifyUser(user);
    const canEditNoteOnly = isStaff() && canViewUserDetails();
    const isCustomer = userRole === "customer";
    return `
      <h2 id="merchantUserTitle">修改用戶資料</h2>
      <form class="merchant-form merchant-user-form" data-merchant-user-form>
        <div class="merchant-user-form-grid">
          <label>賬戶名稱<input name="displayName" value="${escapeHtml(user.displayName || "")}" ${canEditProfile ? "" : "disabled"}></label>
          <label>Email<input value="${escapeHtml(user.email || "未有電郵")}" disabled></label>
          <label>User ID / UID<input value="${escapeHtml(user.uid || user.id)}" disabled></label>
          <label>身份
            <select name="role" ${hasPermission("usersRoleEdit") && canEditAccess && roleOptions.length ? "" : "disabled"}>
              ${roleOptions.length ? roleOptions.map((role) => `<option value="${role}" ${userRole === role ? "selected" : ""}>${escapeHtml(roleLabel(role))}</option>`).join("") : `<option value="${escapeHtml(userRole)}">${escapeHtml(roleLabel(userRole))}</option>`}
            </select>
          </label>
          <label>狀態
            <select name="status" ${hasPermission("usersBlock") && canEditAccess ? "" : "disabled"}>
              <option value="active" ${user.status !== "blocked" ? "selected" : ""}>正常</option>
              <option value="blocked" ${user.status === "blocked" ? "selected" : ""}>已封鎖</option>
            </select>
          </label>
          <label>聯絡電話<input value="${escapeHtml(user.phone || "")}" readonly disabled></label>
          ${isCustomer ? `<label class="merchant-user-form-wide">送貨地址<textarea rows="3" readonly disabled>${escapeHtml(user.address || "")}</textarea></label>` : ""}
          <label>生日<input type="date" value="${escapeHtml(user.birthday || "")}" readonly disabled></label>
          <label>性別
            <select disabled>
              <option value="" ${!user.gender ? "selected" : ""}>未設定</option>
              <option value="female" ${user.gender === "female" ? "selected" : ""}>女</option>
              <option value="male" ${user.gender === "male" ? "selected" : ""}>男</option>
              <option value="other" ${user.gender === "other" ? "selected" : ""}>其他</option>
            </select>
          </label>
          <label class="merchant-user-form-wide">備註<textarea name="note" rows="3" ${(canEditProfile || canEditNoteOnly) ? "" : "disabled"}>${escapeHtml(user.note || "")}</textarea></label>
          <p class="merchant-user-readonly">創建時間：${escapeHtml(formatDateTime(user.createdAt))}</p>
          <p class="merchant-user-readonly">更新時間：${escapeHtml(formatDateTime(user.updatedAt))}</p>
        </div>
        <section class="merchant-user-orders">
          <h3>歷史訂單</h3>
          <div class="merchant-user-orders__list" data-user-order-list></div>
        </section>
        <p class="merchant-message" data-merchant-user-message aria-live="polite"></p>
        <div class="merchant-modal__actions"><button class="merchant-secondary-button" type="button" data-close-merchant-modal>取消</button><button class="merchant-primary-button" type="submit" data-save-user>${canEditProfile || canEditNoteOnly || hasPermission("usersRoleEdit") || hasPermission("usersBlock") || hasPermission("ordersUpdate") ? "儲存" : "關閉"}</button></div>
      </form>`;
  }

  function inviteRoleOptions() {
    if (isSuperAdmin() || isAdmin()) return ["admin", "staff"];
    return [];
  }

  function inviteModalContent() {
    const options = inviteRoleOptions();
    return `
      <h2 id="merchantInviteTitle">邀請用戶</h2>
      <form class="merchant-invite-form merchant-invite-form--modal" data-user-invite-form>
        <label class="merchant-invite-form__field">Email
          <input type="email" name="email" placeholder="name@example.com" required>
        </label>
        <label class="merchant-invite-form__field">身份
          <select name="role">
            ${options.map((role) => `<option value="${role}">${escapeHtml(roleLabel(role))}</option>`).join("")}
          </select>
        </label>
        <button class="merchant-primary-button merchant-invite-form__submit" type="submit">生成邀請連結</button>
      </form>
      <div class="merchant-invite-result-card">
        <p class="merchant-invite-status" data-user-invite-status aria-live="polite"></p>
        <div class="merchant-invite-result" data-user-invite-result aria-live="polite"></div>
      </div>
      <div class="merchant-invite-actions">
        <button class="merchant-secondary-button" type="button" data-copy-invite-link disabled>一鍵複製</button>
        <button class="merchant-secondary-button" type="button" data-close-merchant-modal>關閉</button>
      </div>`;
  }

  function setInviteResult(message, type = "") {
    const result = document.querySelector("[data-user-invite-result]");
    if (!result) return;
    result.dataset.type = type;
    result.innerHTML = message;
  }

  function setInviteStatus(message = "", type = "") {
    const result = document.querySelector("[data-user-invite-status]");
    if (!result) return;
    result.dataset.type = type;
    result.textContent = message;
  }

  function setInviteCopyState(enabled) {
    const button = document.querySelector("[data-copy-invite-link]");
    if (!button) return;
    button.disabled = !enabled;
  }

  function openInviteModal() {
    if (!hasPermission("inviteUsers")) return showMerchantToast("你沒有邀請用戶的權限。");
    ensureMerchantModals();
    currentInviteLink = "";
    const container = document.querySelector("[data-merchant-invite-content]");
    if (!container) return;
    container.innerHTML = inviteModalContent();
    setInviteStatus("");
    setInviteCopyState(false);
    openModal(document.querySelector("#merchantInviteModal"));
  }

  async function openUserEditor(userId) {
    if (!canViewUserDetails()) return showMerchantToast("你沒有查看用戶資料的權限。");
    const user = editableUserById(userId);
    if (!user) return showMerchantToast("找不到此用戶。");
    editingUserId = String(user.uid || user.id);
    editingUserOrders = [];
    ensureMerchantModals();
    document.querySelector("[data-merchant-user-content]").innerHTML = userEditorForm(user);
    renderUserOrdersEditor();
    openModal(document.querySelector("#merchantUserModal"));
    try {
      const firebase = await firebaseService();
      if (customerOrdersUnsub) {
        customerOrdersUnsub();
        customerOrdersUnsub = null;
      }
      if (hasPermission("ordersRead")) {
        customerOrdersUnsub = firebase.listenOrdersByCustomer?.(
          user.uid || user.id,
          user.email || "",
          (orders) => {
            editingUserOrders = Array.isArray(orders) ? orders : [];
            renderUserOrdersEditor();
          },
          (error) => {
            editingUserOrders = [];
            renderUserOrdersEditor();
            setUserEditorError(merchantErrorMessage(error, "無法讀取此用戶的訂單資料。"));
          }
        );
      }
    } catch (error) {
      setUserEditorError(merchantErrorMessage(error, "無法讀取此用戶的訂單資料。"));
    }
  }

  function setUserEditorError(message) {
    const node = document.querySelector("[data-merchant-user-message]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = "error";
  }

  async function saveUserForm(form) {
    if (!editingUserId) return setUserEditorError("找不到此用戶。");
    if (!canEditUserNote(editableUserById(editingUserId)) && !hasPermission("usersRoleEdit") && !hasPermission("usersBlock") && !hasPermission("ordersUpdate")) return setUserEditorError("你沒有修改用戶資料的權限。");
    const data = new FormData(form);
    const user = editableUserById(editingUserId);
    if (!user) return setUserEditorError("找不到此用戶。");
    const button = form.querySelector("[data-save-user]");
    button.disabled = true;
    button.textContent = "儲存中…";
    try {
      const firebase = await firebaseService();
      if (hasPermission("usersProfileEdit") && canModifyUser(user)) {
        const profileUpdates = {
          displayName: data.get("displayName"),
          note: data.get("note"),
        };
        await firebase.updateUserProfile(editingUserId, profileUpdates);
      } else if (canEditUserNote(user)) {
        await firebase.updateUserProfile(editingUserId, {
          note: data.get("note"),
        });
      }
      if ((hasPermission("usersRoleEdit") || hasPermission("usersBlock")) && canModifyUser(user)) {
        const nextRole = String(data.get("role") || user.role || "customer");
        const nextStatus = String(data.get("status") || user.status || "active");
        const accessUpdates = {};
        if (nextRole !== user.role && hasPermission("usersRoleEdit")) {
          if (!canSetUserRole(user, nextRole)) throw new Error("你沒有權限設定此身份。");
          accessUpdates.role = nextRole;
        }
        if (nextStatus !== user.status && hasPermission("usersBlock")) {
          if (!canSetUserStatus(user)) throw new Error("你沒有權限修改此狀態。");
          accessUpdates.status = nextStatus;
        }
        if (Object.keys(accessUpdates).length) await firebase.updateUserAccess?.(editingUserId, accessUpdates);
      }
      if (hasPermission("ordersUpdate")) {
        const orderUpdates = editingUserOrders.map((order) => firebase.updateOrder(order.id, {
          merchantNote: form.querySelector(`[data-order-note="${CSS.escape(order.id)}"]`)?.value || ""
        }));
        await Promise.all(orderUpdates);
      }
      closeMerchantModals();
      showMerchantToast("用戶資料已更新");
    } catch (error) {
      button.disabled = false;
      button.textContent = "儲存";
      setUserEditorError(merchantErrorMessage(error, "無法更新用戶資料。"));
    }
  }

  async function createInvite(form) {
    if (!hasPermission("inviteUsers")) return showMerchantToast("你沒有邀請用戶的權限。");
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const role = String(data.get("role") || "staff").trim();
    try {
      const firebase = await firebaseService();
      const invite = await firebase.createUserInvite?.(email, role, currentMerchant?.uid);
      const base = `${window.location.origin}${rootPrefix()}`;
      const link = `${base}index.html?auth=register&invite=${encodeURIComponent(invite.token)}`;
      currentInviteLink = link;
      setInviteResult(`邀請連結：<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a>`);
      setInviteStatus("邀請中...");
      setInviteCopyState(true);
      form.reset();
    } catch (error) {
      currentInviteLink = "";
      setInviteCopyState(false);
      setInviteStatus("");
      setInviteResult(merchantErrorMessage(error, "無法建立邀請。"), "error");
    }
  }

  async function copyInviteLink() {
    if (!currentInviteLink) return showMerchantToast("目前沒有可複製的邀請連結。");
    if (!navigator.clipboard?.writeText) {
      setInviteStatus("邀請中...");
      setInviteResult(`請手動複製邀請連結：<a href="${escapeHtml(currentInviteLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(currentInviteLink)}</a>`);
      return;
    }
    try {
      await navigator.clipboard.writeText(currentInviteLink);
      setInviteStatus("已複製邀請連結");
      setInviteResult(`邀請連結：<a href="${escapeHtml(currentInviteLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(currentInviteLink)}</a>`);
      showMerchantToast("已複製邀請連結");
    } catch (error) {
      setInviteStatus("邀請中...", "error");
      setInviteResult(`請手動複製邀請連結：<a href="${escapeHtml(currentInviteLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(currentInviteLink)}</a>`, "error");
    }
  }

  async function hideOrDeleteInvite(inviteId) {
    if (!hasPermission("inviteRecords")) return showMerchantToast("你沒有刪除邀請記錄的權限。");
    const normalizedId = String(inviteId || "").trim();
    if (!normalizedId) return showMerchantToast("找不到邀請記錄。");
    try {
      const firebase = await firebaseService();
      await firebase.hideOrDeleteUserInvite?.(normalizedId);
      showMerchantToast("邀請記錄已刪除");
    } catch (error) {
      showMerchantToast(merchantErrorMessage(error, "無法刪除邀請記錄。"));
    }
  }

  async function updateRolePermission(featureKey, roleKey, value, input) {
    if (!canManagePermissions()) {
      if (input) input.checked = !value;
      return showMerchantToast("你沒有權限修改角色權限。");
    }
    if (isAdmin() && roleKey === "super_admin") {
      if (input) input.checked = currentRolePermissions?.[featureKey]?.[roleKey] === true;
      return showMerchantToast("管理員不能修改超級管理員權限。");
    }
    try {
      const firebase = await firebaseService();
      await firebase.updateRolePermission?.(featureKey, roleKey, value);
      currentRolePermissions = normalizeRolePermissions({
        ...currentRolePermissions,
        [featureKey]: {
          ...(currentRolePermissions?.[featureKey] || {}),
          [roleKey]: value === true
        }
      });
      renderPermissions();
      showMerchantToast("權限已更新");
    } catch (error) {
      if (input) input.checked = !value;
      const message = document.querySelector("[data-permissions-message]");
      if (message) {
        message.dataset.type = "error";
        message.textContent = merchantErrorMessage(error, "無法更新權限。");
      }
      showMerchantToast(merchantErrorMessage(error, "無法更新權限。"));
    }
  }

  async function updateUserRole(userId, nextRole) {
    if (!hasPermission("usersRoleEdit")) return showMerchantToast("你沒有權限管理用戶身份。");
    const user = editableUserById(userId);
    const role = String(nextRole || "customer").trim();
    if (!user || !role) return showMerchantToast("找不到此用戶。");
    if (!canSetUserRole(user, role)) return showMerchantToast("你沒有權限設定此身份。");
    try {
      const firebase = await firebaseService();
      await firebase.updateUserAccess?.(userId, { role });
      showMerchantToast("用戶身份已更新");
    } catch (error) {
      showMerchantToast(merchantErrorMessage(error, "無法更新用戶身份。"));
    }
  }

  async function updateUserStatus(userId, status) {
    if (!hasPermission("usersBlock")) return showMerchantToast("你沒有權限修改用戶狀態。");
    const user = editableUserById(userId);
    if (!user) return showMerchantToast("找不到此用戶。");
    if (!canSetUserStatus(user)) return showMerchantToast("你沒有權限修改此用戶狀態。");
    try {
      const firebase = await firebaseService();
      await firebase.updateUserAccess?.(userId, { status });
      showMerchantToast(status === "blocked" ? "用戶已封鎖" : "用戶已恢復");
    } catch (error) {
      showMerchantToast(merchantErrorMessage(error, "無法更新用戶狀態。"));
    }
  }

  async function deleteUser(userId) {
    const user = editableUserById(userId);
    if (!user) return showMerchantToast("找不到此用戶。");
    if (isSoftDeletedUser(user)) return showMerchantToast("此用戶已被停用。");
    if (!canSoftDeleteUser(user)) return showMerchantToast("你沒有權限刪除此用戶。");
    const confirmed = window.confirm(`確定要刪除 / 停用 ${user.email || user.displayName || userId}？\n此操作會將用戶從後台列表移除並停用登入，但不會刪除歷史訂單。`);
    if (!confirmed) return;
    try {
      const firebase = await firebaseService();
      if (!firebase.softDeleteUser) throw new Error("用戶停用服務尚未準備完成。");
      await firebase.softDeleteUser(userId, currentMerchant?.uid || "");
      showMerchantToast("用戶已刪除 / 停用");
    } catch (error) {
      showMerchantToast(merchantErrorMessage(error, "無法刪除用戶。"));
    }
  }

  function isToday(value) {
    if (!value) return false;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
  }

  function renderOrders(orders) {
    currentOrders = Array.isArray(orders) ? orders : [];
    renderOrderRecords(currentOrders);
    const todaySales = document.querySelector("[data-today-sales]");
    const totalOrders = document.querySelector("[data-total-orders]");
    const totalSales = document.querySelector("[data-total-sales]");
    const message = document.querySelector("[data-orders-message]");
    const table = document.querySelector("[data-orders-table]");
    if (!todaySales || !totalOrders || !totalSales || !message || !table) return;
    if (!hasPermission("ordersRead")) {
      todaySales.textContent = "HK$0.00";
      totalOrders.textContent = "0";
      totalSales.textContent = "HK$0.00";
      message.textContent = "你沒有查看訂單的權限。";
      table.innerHTML = "";
      return;
    }

    const todayTotal = currentOrders.filter((order) => isToday(order.createdAt)).reduce((sum, order) => sum + orderAmount(order), 0);
    const allTotal = currentOrders.reduce((sum, order) => sum + orderAmount(order), 0);
    todaySales.textContent = formatDashboardPrice(todayTotal);
    totalOrders.textContent = String(currentOrders.length);
    totalSales.textContent = formatDashboardPrice(allTotal);

    if (!currentOrders.length) {
      message.textContent = "暫時沒有訂單資料。";
      table.innerHTML = "";
      return;
    }

    message.textContent = "";
    table.innerHTML = `
      <table class="merchant-data-table">
        <thead>
          <tr><th>訂單編號</th><th>下單時間</th><th>顧客名稱</th><th>價錢</th><th>付款方式</th></tr>
        </thead>
        <tbody>
          ${currentOrders.slice(0, 20).map((order) => `
            <tr>
              <td>${escapeHtml(orderNumberLabel(order))}</td>
              <td>${escapeHtml(formatDateTime(order.createdAt))}</td>
              <td>${escapeHtml(orderCustomerName(order))}</td>
              <td>${formatDashboardPrice(orderAmount(order))}</td>
              <td>${escapeHtml(orderPaymentMethodLabel(order.paymentMethod))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  function renderOrderRecords(orders = currentOrders) {
    const message = document.querySelector("[data-order-records-message]");
    const table = document.querySelector("[data-order-records-table]");
    if (!message || !table) return;
    if (!hasPermission("ordersRead")) {
      message.textContent = "你沒有查看訂單記錄的權限。";
      table.innerHTML = "";
      return;
    }
    const records = Array.isArray(orders) ? orders : [];
    if (!records.length) {
      message.textContent = "暫時沒有訂單記錄。";
      table.innerHTML = "";
      return;
    }
    message.textContent = "";
    table.innerHTML = `
      <table class="merchant-data-table merchant-order-records-table">
        <thead>
          <tr>
            <th>訂單編號</th>
            <th>下單時間</th>
            <th>顧客名稱</th>
            <th>顧客 Email</th>
            <th>收件人名稱</th>
            <th>金額</th>
            <th>付款方式</th>
            <th>付款狀態</th>
            <th>訂單狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((order) => `
            <tr>
              <td>${escapeHtml(orderNumberLabel(order))}</td>
              <td>${escapeHtml(formatDateTime(order.createdAt))}</td>
              <td>${escapeHtml(orderCustomerName(order))}</td>
              <td>${escapeHtml(orderCustomerEmail(order))}</td>
              <td>${escapeHtml(orderRecipientName(order))}</td>
              <td>${formatDashboardPrice(orderAmount(order))}</td>
              <td>${escapeHtml(orderPaymentMethodLabel(order.paymentMethod))}</td>
              <td>${escapeHtml(orderPaymentStatusLabel(order.paymentStatus))}</td>
              <td>${escapeHtml(orderStatusLabel(order.status))}</td>
              <td><button class="merchant-secondary-button" type="button" data-view-order="${escapeHtml(order.id)}">查看詳情</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  function renderOrderDetails(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    return `
      <h2 id="merchantOrderTitle">訂單詳情</h2>
      <div class="merchant-order-detail">
        <section>
          <h3>訂單資料</h3>
          <p><span>訂單編號</span><strong>${escapeHtml(order.orderNumber || order.id)}</strong></p>
          <p><span>下單時間</span><strong>${escapeHtml(formatDateTime(order.createdAt))}</strong></p>
          <p><span>訂單狀態</span><strong>${escapeHtml(orderStatusLabel(order.status))}</strong></p>
        </section>
        <section class="merchant-order-status-panel">
          <h3>修改訂單狀態</h3>
          <p><span>目前狀態</span><strong>${escapeHtml(orderStatusLabel(order.status))}</strong></p>
          <label class="merchant-order-status-control">狀態
            <select data-merchant-order-status="${escapeHtml(order.id)}" ${hasPermission("ordersUpdate") ? "" : "disabled"}>
              ${renderMerchantOrderStatusOptions(order.status)}
            </select>
          </label>
          <button class="merchant-primary-button merchant-order-status-save" type="button" data-save-order-status="${escapeHtml(order.id)}" ${hasPermission("ordersUpdate") ? "" : "disabled"}>儲存狀態</button>
          <p class="merchant-order-status-message" data-order-status-message aria-live="polite"></p>
        </section>
        <section>
          <h3>顧客資料</h3>
          <p><span>顧客名稱</span><strong>${escapeHtml(orderCustomerName(order))}</strong></p>
          <p><span>顧客 Email</span><strong>${escapeHtml(orderCustomerEmail(order))}</strong></p>
          <p><span>顧客電話</span><strong>${escapeHtml(order.customerPhone || "未有資料")}</strong></p>
        </section>
        <section>
          <h3>收件人資料</h3>
          <p><span>收件人</span><strong>${escapeHtml(orderRecipientName(order))}</strong></p>
          <p><span>聯絡電話</span><strong>${escapeHtml(order.recipientPhone || "未有資料")}</strong></p>
          <p><span>收貨方式</span><strong>${escapeHtml(orderDeliveryMethodLabel(order.deliveryMethod))}</strong></p>
          ${order.deliveryMethod === "delivery" ? `<p><span>收貨地址</span><strong>${escapeHtml(order.deliveryAddress || "未有資料")}</strong></p>` : ""}
        </section>
        <section>
          <h3>購買產品</h3>
          <div class="merchant-order-detail__items">
            ${items.length ? items.map((item) => `
              <article>
                <span>${escapeHtml(item.name || item.productId || "商品")}</span>
                <span>x ${Number(item.quantity || 0)}</span>
                <strong>${formatDashboardPrice(item.subtotal || (Number(item.price || 0) * Number(item.quantity || 0)))}</strong>
              </article>
            `).join("") : `<p>未有商品資料。</p>`}
          </div>
        </section>
        <section>
          <h3>價錢明細</h3>
          <p><span>商品小計</span><strong>${formatDashboardPrice(order.subtotal)}</strong></p>
          <p><span>優惠扣減</span><strong>-${formatDashboardPrice(order.discount)}</strong></p>
          <p><span>運費</span><strong>${formatDashboardPrice(order.shippingFee)}</strong></p>
          <p><span>附加費</span><strong>${formatDashboardPrice(order.extraFee)}</strong></p>
          <p><span>合計</span><strong>${formatDashboardPrice(orderAmount(order))}</strong></p>
        </section>
        <section>
          <h3>付款資料</h3>
          <p><span>付款方式</span><strong>${escapeHtml(orderPaymentMethodLabel(order.paymentMethod))}</strong></p>
          <p><span>付款狀態</span><strong>${escapeHtml(orderPaymentStatusLabel(order.paymentStatus))}</strong></p>
          ${order.cardLast4 ? `<p><span>卡號末四位</span><strong>**** ${escapeHtml(order.cardLast4)}</strong></p>` : ""}
        </section>
        ${order.note ? `<section><h3>訂單備註</h3><p>${escapeHtml(order.note)}</p></section>` : ""}
        <div class="merchant-modal__actions"><button class="merchant-secondary-button" type="button" data-close-merchant-modal>關閉</button></div>
      </div>
    `;
  }

  function openOrderDetails(orderId) {
    if (!hasPermission("ordersRead")) return showMerchantToast("你沒有查看訂單記錄的權限。");
    const order = currentOrders.find((item) => String(item.id) === String(orderId));
    if (!order) return showMerchantToast("找不到訂單資料。");
    const modal = document.querySelector("#merchantOrderModal");
    const content = document.querySelector("[data-merchant-order-content]");
    if (!modal || !content) return;
    content.innerHTML = renderOrderDetails(order);
    openModal(modal);
  }

  async function saveOrderStatus(orderId, button) {
    if (!hasPermission("ordersUpdate")) return showMerchantToast("你沒有修改訂單狀態的權限。");
    const normalizedId = String(orderId || "").trim();
    const order = currentOrders.find((item) => String(item.id) === normalizedId);
    const select = document.querySelector(`[data-merchant-order-status="${CSS.escape(normalizedId)}"]`);
    const message = document.querySelector("[data-order-status-message]");
    const nextStatus = String(select?.value || "").trim();
    if (!order || !select) return showMerchantToast("找不到訂單資料。");
    if (!MERCHANT_ORDER_STATUSES.includes(nextStatus)) {
      if (message) {
        message.textContent = "此狀態不可由商戶後台設定。";
        message.dataset.type = "error";
      }
      return;
    }
    const originalText = button?.textContent || "";
    if (button) {
      button.disabled = true;
      button.textContent = "儲存中…";
    }
    if (message) {
      message.textContent = "正在更新訂單狀態…";
      message.dataset.type = "";
    }
    try {
      const firebase = await firebaseService();
      await firebase.updateOrder(order.id, { status: nextStatus });
      const updatedOrder = { ...order, status: nextStatus, updatedAt: new Date().toISOString() };
      currentOrders = currentOrders.map((item) => String(item.id) === normalizedId ? updatedOrder : item);
      renderOrders(currentOrders);
      const content = document.querySelector("[data-merchant-order-content]");
      if (content) content.innerHTML = renderOrderDetails(updatedOrder);
      showMerchantToast("訂單狀態已更新");
    } catch (error) {
      if (message) {
        message.textContent = merchantErrorMessage(error, "無法更新訂單狀態。");
        message.dataset.type = "error";
      }
      if (button) {
        button.disabled = false;
        button.textContent = originalText || "儲存狀態";
      }
    }
  }

  function renderOrdersError(error) {
    const message = document.querySelector("[data-orders-message]");
    const table = document.querySelector("[data-orders-table]");
    const recordsMessage = document.querySelector("[data-order-records-message]");
    const recordsTable = document.querySelector("[data-order-records-table]");
    if (!message) return;
    message.dataset.type = "error";
    message.textContent = merchantErrorMessage(error, "無法讀取訂單資料。");
    if (table) table.innerHTML = "";
    if (recordsMessage) recordsMessage.textContent = message.textContent;
    if (recordsTable) recordsTable.innerHTML = "";
  }

  async function startDashboardListeners(firebase, user) {
    cleanupDashboardListeners();
    try {
      await firebase.upsertCurrentUserProfile?.(user, currentMerchantRole);
    } catch (error) {
      console.warn("無法同步目前商戶資料。", error);
    }
    if (firebase.listenRolePermissions) {
      dashboardUnsubscribers.push(firebase.listenRolePermissions((permissions) => {
        currentRolePermissions = normalizeRolePermissions(permissions);
        renderDashboard(user);
        renderUsers(currentUsers);
        renderUserInvites(currentInvites);
        renderOrders(currentOrders);
      }, renderPermissionsError));
    }
    if (canOpenUsersSection() && firebase.listenUsers) {
      dashboardUnsubscribers.push(firebase.listenUsers(renderUsers, renderUsersError));
    } else {
      renderUsers([]);
    }
    if ((isSuperAdmin() || isAdmin()) && firebase.listenUserInvites) {
      dashboardUnsubscribers.push(firebase.listenUserInvites(renderUserInvites, renderUserInvitesError));
    } else {
      renderUserInvites([]);
    }
    if (hasPermission("ordersRead") && firebase.listenOrders) {
      dashboardUnsubscribers.push(firebase.listenOrders(renderOrders, renderOrdersError));
    } else {
      renderOrders([]);
    }
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

  function policyItemById(policyId) {
    return POLICY_CONTENT_ITEMS.find((item) => item.id === policyId) || null;
  }

  function policyIdFromField(fieldId) {
    return String(fieldId || "").split(".")[0] || "";
  }

  function previewFieldForPolicyField(fieldId) {
    return String(fieldId || "").endsWith(".isActive") ? policyIdFromField(fieldId) : fieldId;
  }

  function findPolicyPreviewTarget(fieldId) {
    const policyId = policyIdFromField(fieldId);
    const previewRoot = findDataAttribute(document, "data-preview-id", policyId);
    if (!previewRoot) return null;
    const previewFieldId = previewFieldForPolicyField(fieldId);
    if (previewFieldId === policyId) return previewRoot;
    return findDataAttribute(previewRoot, "data-preview-field", previewFieldId);
  }

  function findPolicyEditorTarget(fieldId) {
    const form = document.querySelector(`[data-policy-form][data-policy-id="${policyIdFromField(fieldId)}"]`);
    if (!form) return null;
    return findDataAttribute(form, "data-editor-field", fieldId);
  }

  function clearPolicyVisualSelection() {
    document
      .querySelectorAll('[data-preview-id^="policy"].is-visual-edit-active, [data-preview-id^="policy"] .is-visual-edit-active, [data-policy-form] .is-visual-edit-active')
      .forEach((node) => node.classList.remove("is-visual-edit-active"));
  }

  function applyPolicyVisualSelection() {
    clearPolicyVisualSelection();
    if (!activePolicyFieldId) return;
    const previewTarget = findPolicyPreviewTarget(activePolicyFieldId);
    const editorTarget = findPolicyEditorTarget(activePolicyFieldId);
    if (previewTarget) previewTarget.classList.add("is-visual-edit-active");
    if (editorTarget) editorTarget.classList.add("is-visual-edit-active");
  }

  function activatePolicyField(fieldId, source) {
    if (!fieldId) return;
    activePolicyFieldId = fieldId;
    applyPolicyVisualSelection();

    const previewTarget = findPolicyPreviewTarget(fieldId);
    const editorTarget = findPolicyEditorTarget(fieldId);

    if (source === "editor" && previewTarget) {
      previewTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    if (source === "preview" && editorTarget) {
      editorTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const focusTarget = editorTarget.matches("input, textarea, button")
        ? editorTarget
        : editorTarget.querySelector("input, textarea, button");
      if (focusTarget) {
        suppressPolicyFocusActivation = true;
        focusTarget.focus({ preventScroll: true });
        window.setTimeout(() => {
          suppressPolicyFocusActivation = false;
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

  function fallbackPolicyContent(item) {
    const policy = window.ONLINE_SHOP_SITE_CONFIG?.policies?.[item.key] || {};
    return {
      type: "policy",
      policyKey: item.key,
      title: String(policy.title || item.label),
      content: String(policy.content || ""),
      isActive: policy.isActive !== false
    };
  }

  function normalizePolicyContent(item, data) {
    const fallback = fallbackPolicyContent(item);
    if (!data || data.type !== "policy" || data.policyKey !== item.key) return fallback;
    return {
      type: "policy",
      policyKey: item.key,
      title: String(data.title ?? fallback.title),
      content: String(data.content ?? fallback.content),
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

  function setMerchantSectionActive(section) {
    document.querySelectorAll("[data-merchant-section]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.merchantSection === section);
    });
    document.querySelectorAll("[data-merchant-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.merchantPanel === section);
    });
  }

  function updateSiteContentSidebarNav() {
    document.querySelectorAll("[data-site-content-nav]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-site-content-nav") === activeSiteContentId);
    });
  }

  function setSiteContentMessage(message, type = "info", contentId = "homeHero") {
    const node = document.querySelector(`[data-site-content-message="${contentId}"]`)
      || (contentId === "homeHero" ? document.querySelector("[data-site-content-message]") : null);
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

  function syncPolicyDraftFromForm(form) {
    const item = policyItemById(form?.dataset?.policyId || "");
    if (!item) return null;
    const data = new FormData(form);
    const draft = {
      ...(policyDrafts[item.id] || fallbackPolicyContent(item)),
      type: "policy",
      policyKey: item.key,
      title: String(data.get("title") || "").trim(),
      content: String(data.get("content") || "").trim(),
      isActive: data.get("isActive") === "on"
    };
    policyDrafts = {
      ...policyDrafts,
      [item.id]: draft
    };
    return draft;
  }

  function syncVisibleSiteContentDrafts() {
    if (document.querySelector("[data-home-hero-form]")) syncHomeHeroDraftFromForm();
    if (document.querySelector("[data-footer-form]")) syncFooterDraftFromForm();
    if (document.querySelector("[data-contact-form]")) syncContactDraftFromForm();
    if (document.querySelector("[data-about-form]")) syncAboutDraftFromForm();
    document.querySelectorAll("[data-policy-form]").forEach((form) => syncPolicyDraftFromForm(form));
  }

  function clearSiteContentVisualSelectionState() {
    activeHomeHeroFieldId = null;
    activeFooterFieldId = null;
    activeContactFieldId = null;
    activeAboutFieldId = null;
    activePolicyFieldId = null;
  }

  function siteContentNavItem(contentId = activeSiteContentId) {
    return SITE_CONTENT_NAV_ITEMS.find((item) => item.id === contentId) || SITE_CONTENT_NAV_ITEMS[0];
  }

  function renderSiteContentSubnav(activeId) {
    return SITE_CONTENT_NAV_ITEMS.map((item) => `
      <button class="page-content-sidebar-nav__item ${item.id === activeId ? "is-active" : ""}" type="button" data-site-content-nav="${escapeHtml(item.id)}">
        <span>${escapeHtml(item.label)}</span>
        <small>${escapeHtml(item.detail)}</small>
      </button>
    `).join("");
  }

  function renderSiteContentViewportControls() {
    return ["desktop", "tablet", "mobile"].map((mode) => `
      <button class="${siteContentPreviewMode === mode ? "is-active" : ""}" type="button" data-site-content-preview-mode="${mode}">
        ${escapeHtml(mode[0].toUpperCase() + mode.slice(1))}
      </button>
    `).join("");
  }

  function renderPreviewHeader(activeId) {
    const activeClass = (id) => id === activeId ? " is-active" : "";
    return `
      <div class="announcement merchant-site-content__preview-announcement">Free shipping on eligible orders</div>
      <header class="site-header merchant-site-content__site-header">
        <button class="mobile-menu-button" type="button" aria-label="Menu"><span></span><span></span></button>
        <a class="brand" href="#">APOTHEKE</a>
        <nav class="desktop-nav" aria-label="Preview navigation">
          <a class="nav-link${activeClass("home")}" href="#">Home</a>
          <a class="nav-link" href="#">Products</a>
          <a class="nav-link${activeClass("about")}" href="#">About</a>
          <a class="nav-link${activeClass("contact")}" href="#">Contact</a>
          <a class="nav-link${activeClass("policy")}" href="#">Policy</a>
        </nav>
        <div class="header-actions">
          <a class="account-link" href="#">Account</a>
          <button class="icon-button search-button" type="button" aria-label="Search"></button>
          <button class="cart-button" type="button" aria-label="Cart"><span class="cart-shape"><span class="cart-count">0</span></span></button>
        </div>
      </header>
    `;
  }

  function renderPreviewFooter(footer, withFields = false) {
    if (!footer.isActive) return "";
    const logoText = String(footer.logoText || "APOTHEKE").trim();
    const description = String(footer.description || "").trim();
    const phone = String(footer.phone || "").trim();
    const phoneHref = phone.replace(/[^+\d]/g, "");
    const email = String(footer.email || "").trim();
    const address = String(footer.address || "").trim();
    const copyright = String(footer.copyright || "").trim();
    const instagramUrl = resolvePreviewUrl(footer.instagramUrl);
    const facebookUrl = resolvePreviewUrl(footer.facebookUrl);
    const fieldAttr = (field) => withFields ? ` data-preview-field="footer.${field}"` : "";
    const socialLinks = [
      instagramUrl ? `<a class="site-footer__social-link" href="${escapeHtml(instagramUrl)}"${fieldAttr("instagramUrl")}>Instagram</a>` : "",
      facebookUrl ? `<a class="site-footer__social-link" href="${escapeHtml(facebookUrl)}"${fieldAttr("facebookUrl")}>Facebook</a>` : ""
    ].filter(Boolean).join("");

    return `
      <footer class="site-footer" data-site-footer>
        <div class="site-footer__inner">
          <div class="site-footer__brand-group">
            <a class="site-footer__brand" href="#"${fieldAttr("logoText")}>${escapeHtml(logoText)}</a>
            ${description ? `<p class="site-footer__description"${fieldAttr("description")}>${textToHtml(description)}</p>` : ""}
            ${socialLinks ? `<div class="site-footer__social">${socialLinks}</div>` : ""}
          </div>
          <div>
            <span class="site-footer__label">Phone</span>
            ${phoneHref
              ? `<a class="site-footer__value" href="tel:${escapeHtml(phoneHref)}"${fieldAttr("phone")}>${escapeHtml(phone)}</a>`
              : `<span class="site-footer__value"${fieldAttr("phone")}>${escapeHtml(phone)}</span>`}
            ${email ? `<a class="site-footer__value site-footer__email" href="mailto:${escapeHtml(email)}"${fieldAttr("email")}>${escapeHtml(email)}</a>` : ""}
          </div>
          <div>
            <span class="site-footer__label">Address</span>
            <address${fieldAttr("address")}>${textToHtml(address)}</address>
            ${copyright ? `<small class="site-footer__copyright"${fieldAttr("copyright")}>${escapeHtml(copyright)}</small>` : ""}
          </div>
        </div>
      </footer>
    `;
  }

  function renderPreviewPage(previewId, activePageId, bodyHtml, footer, footerFields = false) {
    const isPolicyPreview = String(previewId || "").startsWith("policy");
    return `
      <div class="merchant-site-content__preview-frame merchant-site-content__preview-page${isPolicyPreview ? " merchant-site-content__preview-page--policy" : ""}" data-site-content-preview data-preview-id="${escapeHtml(previewId)}">
        ${renderPreviewHeader(activePageId)}
        <main>${bodyHtml}</main>
        ${renderPreviewFooter(footer, footerFields)}
      </div>
    `;
  }

  function renderPolicyContentSection(item, canEdit, permissionMessage) {
    const policy = policyDrafts[item.id] || fallbackPolicyContent(item);
    const controlsDisabled = !canEdit || policyLoading[item.id] || policySaving[item.id];
    const saveText = policySaving[item.id] ? "Saving..." : `Save ${item.label}`;
    return `
      <h2 class="merchant-site-content__section-title">${escapeHtml(item.label)}</h2>
      <section class="merchant-products-panel merchant-site-content__panel">
        <div class="merchant-site-content__preview-frame merchant-site-content__preview-frame--policy" data-site-content-preview data-preview-id="${escapeHtml(item.id)}">
          <div class="merchant-site-content__policy-preview">
            <strong data-preview-field="${escapeHtml(item.id)}.title">${escapeHtml(policy.title)}</strong>
            <div data-preview-field="${escapeHtml(item.id)}.content">${textToHtml(policy.content)}</div>
            <span class="merchant-site-content__status" data-preview-field="${escapeHtml(item.id)}.isActive">${policy.isActive ? "Visible" : "Hidden"}</span>
          </div>
        </div>
        <form class="merchant-form merchant-site-content__form" data-policy-form data-policy-id="${escapeHtml(item.id)}">
          <fieldset ${controlsDisabled ? "disabled" : ""}>
            <label data-editor-field="${escapeHtml(item.id)}.title">Title
              <input name="title" type="text" maxlength="120" value="${escapeHtml(policy.title)}">
            </label>
            <label data-editor-field="${escapeHtml(item.id)}.content">Content
              <textarea name="content" rows="7" maxlength="4000">${escapeHtml(policy.content)}</textarea>
            </label>
            <label class="merchant-checkbox" data-editor-field="${escapeHtml(item.id)}.isActive">
              <input name="isActive" type="checkbox" ${policy.isActive ? "checked" : ""}>
              <span>Show ${escapeHtml(item.label)}</span>
            </label>
          </fieldset>
          <p class="merchant-message" data-site-content-message="${escapeHtml(item.id)}" aria-live="polite"></p>
          <div class="merchant-modal__actions">
            <button class="merchant-primary-button" type="submit" ${controlsDisabled ? "disabled" : ""}>${escapeHtml(saveText)}</button>
          </div>
          ${!canEdit && permissionMessage ? `<p class="merchant-message" data-type="${currentMerchantRoleLoading || !currentMerchantRoleLoaded ? "info" : "error"}">${escapeHtml(permissionMessage)}</p>` : ""}
        </form>
      </section>
    `;
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
    const homePreviewBody = `
      ${hero.isActive ? `
        <section class="home-banner home-hero" aria-label="${escapeHtml(hero.imageAlt || "Home Hero")}">
          ${imageUrl ? `<img class="home-hero__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(hero.imageAlt)}" data-preview-field="homeHero.imageUrl">` : `<span data-preview-field="homeHero.imageUrl">No image</span>`}
          <div class="home-hero__content">
            ${hero.title ? `<h1 data-preview-field="homeHero.title">${escapeHtml(hero.title)}</h1>` : ""}
            ${hero.subtitle ? `<p data-preview-field="homeHero.subtitle">${textToHtml(hero.subtitle)}</p>` : ""}
            ${hero.buttonText ? `<a class="home-hero__button" href="${escapeHtml(buttonHref || "#")}" data-preview-field="homeHero.buttonText">${escapeHtml(hero.buttonText)}</a>` : ""}
          </div>
        </section>
      ` : ""}
      <section class="home-products merchant-site-content__preview-products" aria-label="Featured products">
        <h1>Featured Products</h1>
        <div class="product-grid home-products__grid">
          <article class="merchant-site-content__product-placeholder"></article>
          <article class="merchant-site-content__product-placeholder"></article>
          <article class="merchant-site-content__product-placeholder"></article>
          <article class="merchant-site-content__product-placeholder"></article>
        </div>
      </section>
    `;
    const aboutPreviewBody = `
      <section class="info-page about-page">
        <div class="about-page__layout">
          <div class="about-page__content">
            <h1 data-preview-field="about.title">${escapeHtml(about.title || "About")}</h1>
            ${about.subtitle ? `<h2 data-preview-field="about.subtitle">${escapeHtml(about.subtitle)}</h2>` : `<h2 data-preview-field="about.subtitle">Subtitle</h2>`}
            ${about.intro ? `<p class="info-intro" data-preview-field="about.intro">${textToHtml(about.intro)}</p>` : `<p class="info-intro" data-preview-field="about.intro">Intro</p>`}
            <div class="info-sections">
              <article>
                ${about.sectionTitle ? `<h3 data-preview-field="about.sectionTitle">${escapeHtml(about.sectionTitle)}</h3>` : `<h3 data-preview-field="about.sectionTitle">Section title</h3>`}
                ${about.sectionContent ? `<p data-preview-field="about.sectionContent">${textToHtml(about.sectionContent)}</p>` : `<p data-preview-field="about.sectionContent">Section content</p>`}
              </article>
            </div>
            <span class="merchant-site-content__status" data-preview-field="about.isActive">${about.isActive ? "Visible" : "Hidden"}</span>
          </div>
          <figure class="about-page__image" data-preview-field="about.imageUrl">
            ${aboutImageUrl ? `<img src="${escapeHtml(aboutImageUrl)}" alt="${escapeHtml(about.imageAlt || about.title || "About")}">` : `<span>No image URL</span>`}
          </figure>
        </div>
      </section>
    `;
    const contactPreviewBody = `
      <section class="info-page contact-page">
        <h1 data-preview-field="contact.title">${escapeHtml(contact.title || "Contact")}</h1>
        ${contact.subtitle ? `<p class="info-intro" data-preview-field="contact.subtitle">${textToHtml(contact.subtitle)}</p>` : `<p class="info-intro" data-preview-field="contact.subtitle">Subtitle</p>`}
        <div class="contact-layout">
          <div class="contact-details">
            <article data-preview-field="contact.address">
              <h2>Address</h2>
              <p>${textToHtml(contact.address)}</p>
            </article>
            <article data-preview-field="contact.openingHours">
              <h2>Opening Hours</h2>
              <p>${textToHtml(contact.openingHours)}</p>
            </article>
            <article data-preview-field="contact.phone">
              <h2>Phone</h2>
              <p>${contactPhoneHref ? `<a href="tel:${escapeHtml(contactPhoneHref)}">${escapeHtml(contact.phone)}</a>` : escapeHtml(contact.phone)}</p>
            </article>
            <article data-preview-field="contact.email">
              <h2>Email</h2>
              <p>${contactEmail ? `<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>` : "Email"}</p>
            </article>
            <article data-preview-field="contact.other">
              <h2>Other</h2>
              <p>${textToHtml(contact.other)}</p>
            </article>
          </div>
          <div class="map-panel" data-preview-field="contact.googleMapEmbedUrl">
            ${contactMapUrl
              ? `<iframe src="${escapeHtml(contactMapUrl)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Google Map"></iframe>`
              : `<div class="map-placeholder">Google Map has not been configured.</div>`}
          </div>
        </div>
        <span class="merchant-site-content__status" data-preview-field="contact.isActive">${contact.isActive ? "Visible" : "Hidden"}</span>
      </section>
    `;
    const footerPreviewBody = `
      <section class="info-page merchant-site-content__footer-page">
        <h1>Footer</h1>
        <p class="info-intro">Footer appears at the bottom of the storefront pages.</p>
      </section>
    `;
    const modules = {
      home: {
        id: "home",
        label: "Home Page",
        detail: "Hero banner",
        messageId: "homeHero",
        openHref: `${rootPrefix()}index.html`,
        previewHtml: renderPreviewPage("homeHero", "home", homePreviewBody, footer),
        editorHtml: `
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
        `
      },
      about: {
        id: "about",
        label: "About",
        detail: "Brand story",
        messageId: "about",
        openHref: `${rootPrefix()}about.html`,
        previewHtml: renderPreviewPage("about", "about", aboutPreviewBody, footer),
        editorHtml: `
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
        `
      },
      contact: {
        id: "contact",
        label: "Contact",
        detail: "Contact details",
        messageId: "contact",
        openHref: `${rootPrefix()}contact.html`,
        previewHtml: renderPreviewPage("contact", "contact", contactPreviewBody, footer),
        editorHtml: `
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
        `
      },
      footer: {
        id: "footer",
        label: "Footer",
        detail: "Site footer",
        messageId: "footer",
        openHref: `${rootPrefix()}index.html`,
        previewHtml: renderPreviewPage("footer", "home", footerPreviewBody, footer, true),
        editorHtml: `
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
        `
      }
    };

    POLICY_CONTENT_ITEMS.forEach((item) => {
      const policy = policyDrafts[item.id] || fallbackPolicyContent(item);
      const controlsAreDisabled = !canEdit || policyLoading[item.id] || policySaving[item.id];
      const policySaveText = policySaving[item.id] ? "Saving..." : `Save ${item.label}`;
      const policyPreviewBody = `
        <section class="info-page policy-page">
          <h1 data-preview-field="${escapeHtml(item.id)}.title">${escapeHtml(policy.title || item.label)}</h1>
          ${policy.isActive ? `<div class="policy-page__content" data-preview-field="${escapeHtml(item.id)}.content"><p>${textToHtml(policy.content)}</p></div>` : ""}
          <span class="merchant-site-content__status" data-preview-field="${escapeHtml(item.id)}.isActive">${policy.isActive ? "Visible" : "Hidden"}</span>
        </section>
      `;
      modules[item.id] = {
        id: item.id,
        label: item.label,
        detail: "Policy page",
        messageId: item.id,
        openHref: `${rootPrefix()}${item.key === "delivery" ? "delivery" : item.key === "payment" ? "payment" : "refund"}.html`,
        previewHtml: renderPreviewPage(item.id, "policy", policyPreviewBody, footer),
        editorHtml: `
          <form class="merchant-form merchant-site-content__form" data-policy-form data-policy-id="${escapeHtml(item.id)}">
            <fieldset ${controlsAreDisabled ? "disabled" : ""}>
              <label data-editor-field="${escapeHtml(item.id)}.title">Title
                <input name="title" type="text" maxlength="120" value="${escapeHtml(policy.title)}">
              </label>
              <label data-editor-field="${escapeHtml(item.id)}.content">Content
                <textarea name="content" rows="9" maxlength="4000">${escapeHtml(policy.content)}</textarea>
              </label>
              <label class="merchant-checkbox" data-editor-field="${escapeHtml(item.id)}.isActive">
                <input name="isActive" type="checkbox" ${policy.isActive ? "checked" : ""}>
                <span>Show ${escapeHtml(item.label)}</span>
              </label>
            </fieldset>
            <p class="merchant-message" data-site-content-message="${escapeHtml(item.id)}" aria-live="polite"></p>
            <div class="merchant-modal__actions">
              <button class="merchant-primary-button" type="submit" ${controlsAreDisabled ? "disabled" : ""}>${escapeHtml(policySaveText)}</button>
            </div>
            ${!canEdit && permissionMessage ? `<p class="merchant-message" data-type="${currentMerchantRoleLoading || !currentMerchantRoleLoaded ? "info" : "error"}">${escapeHtml(permissionMessage)}</p>` : ""}
          </form>
        `
      };
    });

    if (!modules[activeSiteContentId]) activeSiteContentId = "home";
    const activeModule = modules[activeSiteContentId];
    const activeNavItem = siteContentNavItem(activeSiteContentId);

    panel.innerHTML = `
      <div class="merchant-page merchant-site-content">
        <div class="merchant-page__heading">
          <div>
            <p class="merchant-eyebrow">\u9801\u9762\u5167\u5bb9</p>
            <h1>Website Content</h1>
          </div>
          <a class="merchant-secondary-button merchant-site-content__preview" href="${escapeHtml(activeModule.openHref)}" target="_blank" rel="noopener noreferrer">Open live page</a>
        </div>
        <div class="merchant-site-content__studio">
          <section class="merchant-site-content__preview-pane">
            <div class="merchant-site-content__pane-header">
              <div>
                <span>Live Preview</span>
                <strong>${escapeHtml(activeModule.label)}</strong>
              </div>
              <div class="merchant-site-content__viewport" aria-label="Preview size">
                ${renderSiteContentViewportControls()}
              </div>
            </div>
            <div class="merchant-site-content__preview-scroll">
              <div class="merchant-site-content__device merchant-site-content__device--${escapeHtml(siteContentPreviewMode)} merchant-site-content__device--${escapeHtml(activeModule.id)}">
                ${activeModule.previewHtml}
              </div>
            </div>
          </section>
          <aside class="merchant-site-content__editor-pane">
            <div class="merchant-site-content__pane-header">
              <div>
                <span>Editor</span>
                <strong>${escapeHtml(activeModule.label)}</strong>
              </div>
              <small>${escapeHtml(activeNavItem.detail)}</small>
            </div>
            <div class="merchant-site-content__editor-scroll">
              ${activeModule.editorHtml}
            </div>
          </aside>
        </div>
      </div>
    `;
    updateSiteContentSidebarNav();
    applyHomeHeroVisualSelection();
    applyFooterVisualSelection();
    applyContactVisualSelection();
    applyAboutVisualSelection();
    applyPolicyVisualSelection();

    if (homeHeroLoading) setSiteContentMessage("Loading Home Hero...", "info");
    if (footerLoading) setSiteContentMessage("Loading Footer...", "info", "footer");
    if (contactLoading) setSiteContentMessage("Loading Contact...", "info", "contact");
    if (aboutLoading) setSiteContentMessage("Loading About...", "info", "about");
    POLICY_CONTENT_ITEMS.forEach((item) => {
      if (policyLoading[item.id]) setSiteContentMessage(`Loading ${item.label}...`, "info", item.id);
    });
  }

  async function loadMerchantRole(user) {
    if (merchantRoleRequest) return merchantRoleRequest;
    const previousRole = currentMerchantRole;
    currentMerchantRoleLoaded = false;
    currentMerchantRoleLoading = true;
    currentMerchantRoleError = null;

    merchantRoleRequest = (async () => {
      try {
        const firebase = await firebaseService();
        const uid = String(firebase.auth?.currentUser?.uid || user?.uid || currentMerchant?.uid || "").trim();
        if (!uid) throw new Error("Cannot find current merchant UID.");
        const role = await firebase.getMerchantRole(uid);
        currentMerchantRole = role || previousRole;
        currentMerchantRoleError = null;
        return currentMerchantRole;
      } catch (error) {
        currentMerchantRole = previousRole;
        currentMerchantRoleError = error;
        console.warn("Merchant role lookup failed.", error);
        return currentMerchantRole;
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

  async function loadPolicyContentItem(item) {
    if (!currentMerchant || !document.querySelector("[data-site-content-panel]")) return;
    policyLoading = { ...policyLoading, [item.id]: true };
    policyDrafts = {
      ...policyDrafts,
      [item.id]: policyDrafts[item.id] || fallbackPolicyContent(item)
    };
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      const remotePolicy = await firebase.getSiteContent(item.docId);
      policyDrafts = {
        ...policyDrafts,
        [item.id]: normalizePolicyContent(item, remotePolicy)
      };
      policyLoading = { ...policyLoading, [item.id]: false };
      renderSiteContentPanel();
      setSiteContentMessage(remotePolicy ? `${item.label} loaded.` : `Using fallback ${item.label}.`, "success", item.id);
    } catch (error) {
      policyLoading = { ...policyLoading, [item.id]: false };
      policyDrafts = {
        ...policyDrafts,
        [item.id]: policyDrafts[item.id] || fallbackPolicyContent(item)
      };
      renderSiteContentPanel();
      setSiteContentMessage(merchantErrorMessage(error, `Could not load ${item.label}. Using fallback content.`), "error", item.id);
    }
  }

  function loadPolicyContents() {
    POLICY_CONTENT_ITEMS.forEach((item) => {
      loadPolicyContentItem(item);
    });
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

  async function savePolicyForm(form) {
    if (!currentMerchant) return;
    const item = policyItemById(form?.dataset?.policyId || "");
    if (!item) return;
    if (!(await ensurePageContentPermission())) {
      setSiteContentMessage("pagesWrite permission is not enabled for this account.", "error", item.id);
      return;
    }
    const draft = syncPolicyDraftFromForm(form);
    if (!draft) return;
    const payload = {
      type: "policy",
      policyKey: item.key,
      title: draft.title,
      content: draft.content,
      isActive: draft.isActive
    };

    policySaving = { ...policySaving, [item.id]: true };
    renderSiteContentPanel();
    try {
      const firebase = await firebaseService();
      await firebase.saveSiteContent(item.docId, payload);
      policySaving = { ...policySaving, [item.id]: false };
      policyDrafts = {
        ...policyDrafts,
        [item.id]: normalizePolicyContent(item, payload)
      };
      renderSiteContentPanel();
      setSiteContentMessage(`${item.label} saved.`, "success", item.id);
      showMerchantToast(`${item.label} saved`);
    } catch (error) {
      policySaving = { ...policySaving, [item.id]: false };
      renderSiteContentPanel();
      console.error({
        action: "savePolicyForm",
        code: error?.code,
        message: error?.message,
        docId: item.docId,
        payload
      });
      const message = error?.code === "permission-denied"
        ? `Firestore rejected the ${item.label} save. Please check deployed firestore.rules for siteContent/${item.docId}.`
        : `Could not save ${item.label}.`;
      setSiteContentMessage(message, "error", item.id);
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
    const canEditProducts = canManageProducts();
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
          ${canEditProducts ? `
            <button type="button" data-edit-product="${escapeHtml(product.id)}">修改</button>
            <button type="button" data-toggle-product="${escapeHtml(product.id)}" data-next-active="${product.isActive ? "false" : "true"}">${product.isActive ? "隱藏" : "上架"}</button>
            <button class="is-danger" type="button" data-delete-product="${escapeHtml(product.id)}">刪除</button>
          ` : "<span>只可查看</span>"}
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
    loadPolicyContents();
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
    if (!document.querySelector("#merchantUserModal")) {
      const modal = document.createElement("div");
      modal.id = "merchantUserModal";
      modal.className = "merchant-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `<div class="merchant-modal__overlay" data-close-merchant-modal></div><div class="merchant-modal__panel merchant-modal__panel--confirm" role="dialog" aria-modal="true" aria-labelledby="merchantUserTitle"><button class="merchant-modal__close" type="button" data-close-merchant-modal aria-label="關閉用戶編輯視窗">×</button><div data-merchant-user-content></div></div>`;
      document.body.appendChild(modal);
    }
    if (!document.querySelector("#merchantInviteModal")) {
      const modal = document.createElement("div");
      modal.id = "merchantInviteModal";
      modal.className = "merchant-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `<div class="merchant-modal__overlay" data-close-merchant-modal></div><div class="merchant-modal__panel merchant-modal__panel--invite" role="dialog" aria-modal="true" aria-labelledby="merchantInviteTitle"><button class="merchant-modal__close" type="button" data-close-merchant-modal aria-label="關閉邀請用戶視窗">×</button><div data-merchant-invite-content></div></div>`;
      document.body.appendChild(modal);
    }
    if (!document.querySelector("#merchantOrderModal")) {
      const modal = document.createElement("div");
      modal.id = "merchantOrderModal";
      modal.className = "merchant-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `<div class="merchant-modal__overlay" data-close-merchant-modal></div><div class="merchant-modal__panel merchant-modal__panel--order" role="dialog" aria-modal="true" aria-labelledby="merchantOrderTitle"><button class="merchant-modal__close" type="button" data-close-merchant-modal aria-label="關閉訂單詳情視窗">×</button><div data-merchant-order-content></div></div>`;
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
    if (customerOrdersUnsub) {
      customerOrdersUnsub();
      customerOrdersUnsub = null;
    }
    editingUserOrders = [];
    currentInviteLink = "";
    document.querySelectorAll(".merchant-modal.is-open").forEach((modal) => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    });
    releaseEditorPreviews();
    editingProductId = null;
    editingUserId = null;
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
    if (!user) {
      currentMerchant = null;
      currentMerchantRole = null;
      cleanupDashboardListeners();
      closeMerchantModals();
      updateMerchantNav(null);
      if (container) window.location.replace(storefrontLoginUrl());
      return;
    }

    let merchantRole = null;
    let profile = null;
    try {
      const firebase = await firebaseService();
      try {
        merchantRole = await firebase.getMerchantRole?.(user.uid);
      } catch (error) {
        merchantRole = null;
        console.warn("無法讀取 merchantRoles 文件。", error);
      }

      currentMerchantRole = isActiveBackofficeUser(merchantRole) ? merchantRole : null;

      try {
        await firebase.upsertCurrentUserProfile?.(user, merchantRole);
      } catch (error) {
        console.warn("無法同步目前商戶資料。", error);
      }

      try {
        profile = await firebase.getUserProfile?.(user.uid);
      } catch (error) {
        profile = null;
        console.warn("無法讀取 users 文件。", error);
      }

      if (!currentMerchantRole) {
        currentMerchantRole = roleFromUserProfile(profile);
      }
    } catch (error) {
      currentMerchantRole = null;
      console.warn("無法讀取或同步商戶權限。", error);
    }
    currentMerchantRoleLoaded = true;
    currentMerchantRoleLoading = false;
    currentMerchantRoleError = null;

    updateMerchantNav(user);

    if (!isAllowedMerchant(user, currentMerchantRole)) {
      currentMerchant = null;
      currentMerchantRole = null;
      cleanupDashboardListeners();
      closeMerchantModals();
      if (container) {
        renderGate("沒有權限", `帳號 ${escapeHtml(user.email || user.uid || "")} 沒有商戶後台權限。`, `<a class="merchant-secondary-button" href="${rootPrefix()}index.html">返回首頁</a>`);
      }
      return;
    }

    if (isStorefrontPage() && !isStorePreviewGuest()) {
      window.location.replace(merchantDashboardUrl());
      return;
    }

    if (document.body?.dataset.page === "merchant") {
      window.location.replace(merchantDashboardUrl());
      return;
    }

    if (container) {
      currentMerchant = user;
      renderGate("正在載入後台", "請稍候…");
      try {
        const firebase = await firebaseService();
        await store.initializeMerchantProducts();
        renderDashboard(user);
        await startDashboardListeners(firebase, user);
      } catch (error) {
        renderGate("後台載入失敗", error.message || "目前無法讀取商品資料。", `<button class="merchant-secondary-button" type="button" data-merchant-dashboard-logout>登出</button>`);
      }
    }
  }
  document.addEventListener("submit", async (event) => {
    const inviteForm = event.target.closest("[data-user-invite-form]");
    if (inviteForm && currentMerchant) {
      event.preventDefault();
      await createInvite(inviteForm);
      return;
    }
    const userForm = event.target.closest("[data-merchant-user-form]");
    if (userForm && currentMerchant) {
      event.preventDefault();
      await saveUserForm(userForm);
      return;
    }
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
    const policyForm = event.target.closest("[data-policy-form]");
    if (policyForm && currentMerchant) {
      event.preventDefault();
      await savePolicyForm(policyForm);
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

  document.addEventListener("focusin", (event) => {
    if (suppressPolicyFocusActivation) return;
    const editorField = event.target.closest("[data-policy-form] [data-editor-field]");
    if (!editorField) return;
    activatePolicyField(editorField.getAttribute("data-editor-field"), "editor");
  });

  document.addEventListener("click", async (event) => {
    const previewTrigger = event.target.closest("[data-open-store-preview]");
    if (previewTrigger) {
      event.preventDefault();
      if (!hasPermission("storePreview")) return showMerchantToast("你沒有預覽店鋪的權限。");
      window.open(storefrontPreviewUrl(), "_blank", "noopener");
      return;
    }
    if (event.target.closest("[data-open-invite-modal]")) return openInviteModal();
    if (event.target.closest("[data-copy-invite-link]")) return copyInviteLink();
    if (event.target.closest("[data-merchant-dashboard-logout]")) return handleMerchantLogout();
    const siteContentNavButton = event.target.closest("[data-site-content-nav]");
    if (siteContentNavButton) {
      syncVisibleSiteContentDrafts();
      activeSiteContentId = siteContentNavButton.getAttribute("data-site-content-nav") || "home";
      activeDashboardSection = "site";
      clearSiteContentVisualSelectionState();
      setMerchantSectionActive("site");
      renderSiteContentPanel();
      return;
    }
    const previewModeButton = event.target.closest("[data-site-content-preview-mode]");
    if (previewModeButton) {
      syncVisibleSiteContentDrafts();
      siteContentPreviewMode = previewModeButton.getAttribute("data-site-content-preview-mode") || "desktop";
      renderSiteContentPanel();
      return;
    }
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
    const policyPreviewField = event.target.closest('[data-preview-id^="policy"] [data-preview-field]');
    if (policyPreviewField) {
      if (event.target.closest("a, button")) event.preventDefault();
      activatePolicyField(policyPreviewField.getAttribute("data-preview-field"), "preview");
      return;
    }
    const policyEditorField = event.target.closest("[data-policy-form] [data-editor-field]");
    if (policyEditorField) {
      activatePolicyField(policyEditorField.getAttribute("data-editor-field"), "editor");
      return;
    }
    if (event.target.closest(".merchant-site-content__preview-scroll a, .merchant-site-content__preview-scroll button")) {
      event.preventDefault();
      return;
    }
    const usersSubtabButton = event.target.closest("[data-users-subtab]");
    if (usersSubtabButton) {
      usersSubsection = usersSubtabButton.dataset.usersSubtab || "list";
      document.querySelectorAll("[data-users-subtab]").forEach((button) => {
        button.classList.toggle("is-active", button === usersSubtabButton);
      });
      document.querySelectorAll("[data-users-subpanel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.usersSubpanel === usersSubsection);
      });
      return;
    }
    const sectionButton = event.target.closest("[data-merchant-section]");
    if (sectionButton) {
      const section = sectionButton.dataset.merchantSection;
      activeDashboardSection = section;
      document.querySelectorAll("[data-merchant-section]").forEach((button) => {
        button.classList.toggle("is-active", button === sectionButton);
      });
      document.querySelectorAll("[data-merchant-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.merchantPanel === section);
      });
      if (section === "site") {
        updateSiteContentSidebarNav();
        renderSiteContentPanel();
      }
      return;
    }

    if (event.target.closest("[data-manage-categories]")) {
      if (!hasPermission("categoriesManage")) return showMerchantToast("你沒有分類管理權限。");
      return openCategoryManager();
    }
    if (event.target.closest("[data-add-category]")) {
      if (!hasPermission("categoriesManage")) return showMerchantToast("你沒有分類管理權限。");
      syncCategoryDraftFromDom();
      categoryDraft.push(store.normalizeCategory({ id: store.newId("category"), name: "新增大分類", order: categoryDraft.length, subcategories: [] }));
      return renderCategoryManager();
    }
    const addSubcategoryButton = event.target.closest("[data-add-subcategory]");
    if (addSubcategoryButton) {
      if (!hasPermission("categoriesManage")) return showMerchantToast("你沒有分類管理權限。");
      syncCategoryDraftFromDom();
      const category = categoryDraft.find((item) => item.id === addSubcategoryButton.dataset.addSubcategory);
      if (category) category.subcategories.push({ id: store.newId("subcategory"), name: "新增小分類", slug: "new-subcategory", order: category.subcategories.length });
      return renderCategoryManager();
    }
    const deleteCategoryButton = event.target.closest("[data-delete-category]");
    if (deleteCategoryButton) {
      if (!hasPermission("categoriesManage")) return showMerchantToast("你沒有分類管理權限。");
      syncCategoryDraftFromDom();
      categoryDraft = categoryDraft.filter((category) => category.id !== deleteCategoryButton.dataset.deleteCategory || category.system);
      return renderCategoryManager();
    }
    const deleteSubcategoryButton = event.target.closest("[data-delete-subcategory]");
    if (deleteSubcategoryButton) {
      if (!hasPermission("categoriesManage")) return showMerchantToast("你沒有分類管理權限。");
      syncCategoryDraftFromDom();
      const category = categoryDraft.find((item) => item.id === deleteSubcategoryButton.dataset.parentCategory);
      if (category) category.subcategories = category.subcategories.filter((subcategory) => subcategory.id !== deleteSubcategoryButton.dataset.deleteSubcategory);
      return renderCategoryManager();
    }
    if (event.target.closest("[data-save-categories]")) {
      if (!hasPermission("categoriesManage")) return showMerchantToast("你沒有分類管理權限。");
      return saveCategoryManager();
    }
    if (event.target.closest("[data-add-product]")) {
      if (!canManageProducts()) return showMerchantToast("你沒有產品管理權限。");
      return openEditor();
    }
    const editUserButton = event.target.closest("[data-edit-user]");
    if (editUserButton) return openUserEditor(editUserButton.dataset.editUser);
    const saveOrderStatusButton = event.target.closest("[data-save-order-status]");
    if (saveOrderStatusButton) return saveOrderStatus(saveOrderStatusButton.dataset.saveOrderStatus, saveOrderStatusButton);
    const viewOrderButton = event.target.closest("[data-view-order]");
    if (viewOrderButton) return openOrderDetails(viewOrderButton.dataset.viewOrder);
    const rolePermissionToggle = event.target.closest("[data-role-permission-toggle]");
    if (rolePermissionToggle) {
      return updateRolePermission(
        rolePermissionToggle.dataset.feature,
        rolePermissionToggle.dataset.role,
        rolePermissionToggle.checked,
        rolePermissionToggle
      );
    }
    const roleToggle = event.target.closest("[data-user-role-toggle]");
    if (roleToggle) {
      const user = editableUserById(roleToggle.dataset.userRoleToggle);
      const nextRole = roleToggle.checked ? roleToggle.dataset.role : "customer";
      if (!user || !canSetUserRole(user, nextRole)) {
        roleToggle.checked = !roleToggle.checked;
        return showMerchantToast("你沒有權限設定此身份。");
      }
      return updateUserRole(roleToggle.dataset.userRoleToggle, nextRole);
    }
    const statusToggle = event.target.closest("[data-user-status-toggle]");
    if (statusToggle) {
      const user = editableUserById(statusToggle.dataset.userStatusToggle);
      if (!user || !canSetUserStatus(user)) {
        statusToggle.checked = !statusToggle.checked;
        return showMerchantToast("你沒有權限修改此用戶狀態。");
      }
      return updateUserStatus(statusToggle.dataset.userStatusToggle, statusToggle.checked ? "blocked" : "active");
    }
    const deleteUserButton = event.target.closest("[data-delete-user]");
    if (deleteUserButton) return deleteUser(deleteUserButton.dataset.deleteUser);
    const deleteInviteButton = event.target.closest("[data-delete-invite]");
    if (deleteInviteButton) return hideOrDeleteInvite(deleteInviteButton.dataset.deleteInvite);
    if (event.target.closest("[data-sort-users-created]")) {
      userCreatedSort = userCreatedSort === "desc" ? "asc" : "desc";
      return renderUsers(currentUsers);
    }
    const editButton = event.target.closest("[data-edit-product]");
    if (editButton) {
      if (!canManageProducts()) return showMerchantToast("你沒有產品管理權限。");
      return openEditor(editButton.dataset.editProduct);
    }
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
      if (!canManageProducts()) return showMerchantToast("你沒有產品管理權限。");
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
    if (deleteButton) {
      if (!canManageProducts()) return showMerchantToast("你沒有產品管理權限。");
      return openDeleteConfirmation(deleteButton.dataset.deleteProduct);
    }
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

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-product-category-parent], [data-product-category-child]")) {
      updateProductCategoryAssignment(event.target);
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
