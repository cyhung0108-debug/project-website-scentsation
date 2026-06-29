(function () {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const container = document.querySelector("[data-merchant-page]");
  const store = window.ONLINE_SHOP_PRODUCT_ADMIN_STORE;
  let currentMerchant = null;
  let currentMerchantRole = null;
  let currentUsers = [];
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function uniqueStrings(values) {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function lines(value) {
    return uniqueStrings(String(value || "").split(/\r?\n/));
  }

  function isAllowedMerchant(user, role = currentMerchantRole) {
    return Boolean(user?.uid && role?.active === true && role.role === "merchant");
  }

  function hasPermission(permission, role = currentMerchantRole) {
    return role?.permissions?.[permission] === true;
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

  function orderStatusLabel(status) {
    const labels = {
      pending: "待處理",
      paid: "已付款",
      processing: "處理中",
      shipped: "已出貨",
      completed: "已完成",
      cancelled: "已取消"
    };
    return labels[status] || status || "未有狀態";
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
    const sections = [
      { id: "users", label: "\u7528\u6236\u7ba1\u7406" },
      { id: "sales", label: "\u92b7\u552e\u7ba1\u7406" },
      { id: "products", label: "\u7522\u54c1\u7ba1\u7406" },
      { id: "site", label: "\u7db2\u9801\u7ba1\u7406" }
    ];
    const activeSection = "users";
    const navHtml = sections
      .map((section) => `<button class="${section.id === activeSection ? "is-active" : ""}" type="button" data-merchant-section="${section.id}">${section.label}</button>`)
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
              <div class="merchant-stat-grid">
                <article class="merchant-stat-card"><span>\u7e3d\u7528\u6236\u6578</span><strong data-total-users>0</strong></article>
              </div>
              <p class="merchant-data-message" data-users-message>\u6b63\u5728\u8f09\u5165\u7528\u6236\u8cc7\u6599\u2026</p>
              <div class="merchant-table-wrap" data-users-table></div>
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
                    <button class="merchant-secondary-button" type="button" data-manage-categories>\u5206\u985e\u7ba1\u7406</button>
                    <button class="merchant-primary-button" type="button" data-add-product>\u65b0\u589e</button>
                  </div>
                </div>
                <div class="merchant-products" data-merchant-products></div>
              </section>
            </div>
          </section>
          <section class="merchant-dashboard-section ${activeSection === "site" ? "is-active" : ""}" data-merchant-panel="site">
            <h1>\u7db2\u9801\u7ba1\u7406</h1>
            <div class="merchant-data-panel">
              <p class="merchant-data-message">\u9019\u500b\u5340\u57df\u5c07\u7528\u65bc\u7ba1\u7406\u9996\u9801\u5167\u5bb9\u3001\u516c\u53f8\u8cc7\u6599\u548c\u7db2\u9801\u8a2d\u5b9a\u3002\u76ee\u524d\u5148\u4fdd\u7559\u57fa\u672c\u7248\u9762\u3002</p>
            </div>
          </section>
        </main>
      </section>`;
  }

  function renderUsers(users) {
    currentUsers = Array.isArray(users) ? users : [];
    const total = document.querySelector("[data-total-users]");
    const message = document.querySelector("[data-users-message]");
    const table = document.querySelector("[data-users-table]");
    if (!total || !message || !table) return;
    total.textContent = String(currentUsers.length);
    if (!currentUsers.length) {
      message.textContent = "暫時沒有用戶資料。";
      table.innerHTML = "";
      return;
    }
    message.textContent = "";
    table.innerHTML = `
      <table class="merchant-data-table">
        <thead>
          <tr><th>電郵</th><th>顯示名稱</th><th>角色</th><th>狀態</th><th>最後登入時間</th>${hasPermission("usersWrite") || hasPermission("ordersRead") ? "<th>操作</th>" : ""}</tr>
        </thead>
        <tbody>
          ${currentUsers.map((user) => `
            <tr>
              <td>${escapeHtml(user.email || "未有電郵")}</td>
              <td>${escapeHtml(user.displayName || "未有名稱")}</td>
              <td>${user.role === "merchant" ? "商戶" : "顧客"}</td>
              <td>${user.status === "blocked" ? "已封鎖" : "正常"}</td>
              <td>${escapeHtml(formatDateTime(user.lastLoginAt))}</td>
              ${hasPermission("usersWrite") || hasPermission("ordersRead") ? `<td><button class="merchant-table-action" type="button" data-edit-user="${escapeHtml(user.uid || user.id)}">修改</button></td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>`;
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
          <label>狀態
            <select name="orderStatus" data-order-status="${escapeHtml(order.id)}" ${hasPermission("ordersRead") ? "" : "disabled"}>
              ${["pending", "paid", "processing", "shipped", "completed", "cancelled"].map((status) => `
                <option value="${status}" ${order.status === status ? "selected" : ""}>${escapeHtml(orderStatusLabel(status))}</option>
              `).join("")}
            </select>
          </label>
          <div class="merchant-user-order-card__amount">
            <span>金額</span>
            <strong>${formatDashboardPrice(orderAmount(order))}</strong>
          </div>
        </div>
        <label>商戶備註
          <textarea rows="3" data-order-note="${escapeHtml(order.id)}" ${hasPermission("ordersRead") ? "" : "disabled"}>${escapeHtml(order.merchantNote || "")}</textarea>
        </label>
      </article>
    `).join("");
  }

  function userEditorForm(user) {
    return `
      <h2 id="merchantUserTitle">修改用戶資料</h2>
      <form class="merchant-form merchant-user-form" data-merchant-user-form>
        <div class="merchant-user-readonly-grid">
          <p class="merchant-user-readonly">電郵：${escapeHtml(user.email || "未有電郵")}</p>
          <p class="merchant-user-readonly">UID：${escapeHtml(user.uid || user.id)}</p>
          <p class="merchant-user-readonly">顯示名稱：${escapeHtml(user.displayName || "未設定")}</p>
          <p class="merchant-user-readonly">角色：${escapeHtml(user.role === "merchant" ? "商戶" : "顧客")}</p>
          <p class="merchant-user-readonly">狀態：${escapeHtml(user.status === "blocked" ? "已封鎖" : "正常")}</p>
          <p class="merchant-user-readonly">電話：${escapeHtml(user.phone || "未設定")}</p>
          <p class="merchant-user-readonly merchant-user-readonly--wide">地址：${escapeHtml(user.address || "未設定")}</p>
        </div>
        <label>備註<textarea name="note" rows="4" ${hasPermission("usersWrite") ? "" : "disabled"}>${escapeHtml(user.note || "")}</textarea></label>
        <section class="merchant-user-orders">
          <h3>歷史訂單</h3>
          <div class="merchant-user-orders__list" data-user-order-list></div>
        </section>
        <p class="merchant-message" data-merchant-user-message aria-live="polite"></p>
        <div class="merchant-modal__actions"><button class="merchant-secondary-button" type="button" data-close-merchant-modal>取消</button><button class="merchant-primary-button" type="submit" data-save-user>${hasPermission("usersWrite") || hasPermission("ordersRead") ? "儲存" : "關閉"}</button></div>
      </form>`;
  }

  async function openUserEditor(userId) {
    if (!hasPermission("usersWrite") && !hasPermission("ordersRead")) return showMerchantToast("你沒有查看用戶資料的權限。");
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
    if (!hasPermission("usersWrite") && !hasPermission("ordersRead")) return setUserEditorError("你沒有修改用戶資料的權限。");
    const data = new FormData(form);
    const button = form.querySelector("[data-save-user]");
    button.disabled = true;
    button.textContent = "儲存中…";
    try {
      const firebase = await firebaseService();
      if (hasPermission("usersWrite")) {
        await firebase.updateUserProfile(editingUserId, {
          note: data.get("note")
        });
      }
      if (hasPermission("ordersRead")) {
        const orderUpdates = editingUserOrders.map((order) => firebase.updateOrder(order.id, {
          status: form.querySelector(`[data-order-status="${CSS.escape(order.id)}"]`)?.value || order.status,
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
    const todaySales = document.querySelector("[data-today-sales]");
    const totalOrders = document.querySelector("[data-total-orders]");
    const totalSales = document.querySelector("[data-total-sales]");
    const message = document.querySelector("[data-orders-message]");
    const table = document.querySelector("[data-orders-table]");
    if (!todaySales || !totalOrders || !totalSales || !message || !table) return;

    const todayTotal = orders.filter((order) => isToday(order.createdAt)).reduce((sum, order) => sum + orderAmount(order), 0);
    const allTotal = orders.reduce((sum, order) => sum + orderAmount(order), 0);
    todaySales.textContent = formatDashboardPrice(todayTotal);
    totalOrders.textContent = String(orders.length);
    totalSales.textContent = formatDashboardPrice(allTotal);

    if (!orders.length) {
      message.textContent = "暫時沒有訂單資料。";
      table.innerHTML = "";
      return;
    }

    message.textContent = "";
    table.innerHTML = `
      <table class="merchant-data-table">
        <thead>
          <tr><th>訂單編號</th><th>顧客 email</th><th>金額</th><th>狀態</th><th>建立時間</th></tr>
        </thead>
        <tbody>
          ${orders.slice(0, 20).map((order) => `
            <tr>
              <td>${escapeHtml(order.orderNumber || order.id)}</td>
              <td>${escapeHtml(orderCustomerEmail(order))}</td>
              <td>${formatDashboardPrice(orderAmount(order))}</td>
              <td>${escapeHtml(orderStatusLabel(order.status))}</td>
              <td>${escapeHtml(formatDateTime(order.createdAt))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  function renderOrdersError(error) {
    const message = document.querySelector("[data-orders-message]");
    const table = document.querySelector("[data-orders-table]");
    if (!message) return;
    message.dataset.type = "error";
    message.textContent = merchantErrorMessage(error, "無法讀取訂單資料。");
    if (table) table.innerHTML = "";
  }

  async function startDashboardListeners(firebase, user) {
    cleanupDashboardListeners();
    try {
      await firebase.upsertCurrentUserProfile?.(user, currentMerchantRole);
    } catch (error) {
      console.warn("無法同步目前商戶資料。", error);
    }
    if (hasPermission("usersRead") && firebase.listenUsers) {
      dashboardUnsubscribers.push(firebase.listenUsers(renderUsers, renderUsersError));
    } else {
      renderUsers([]);
    }
    if (hasPermission("ordersRead") && firebase.listenOrders) {
      dashboardUnsubscribers.push(firebase.listenOrders(renderOrders, renderOrdersError));
    } else {
      renderOrders([]);
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
    try {
      const firebase = await firebaseService();
      merchantRole = await firebase.getMerchantRole?.(user.uid);
      currentMerchantRole = merchantRole;
      await firebase.upsertCurrentUserProfile?.(user, merchantRole);
    } catch (error) {
      currentMerchantRole = null;
      console.warn("無法讀取或同步商戶權限。", error);
    }

    updateMerchantNav(user);

    if (!isAllowedMerchant(user, merchantRole)) {
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
    const userForm = event.target.closest("[data-merchant-user-form]");
    if (userForm && currentMerchant) {
      event.preventDefault();
      await saveUserForm(userForm);
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

  document.addEventListener("click", async (event) => {
    const previewTrigger = event.target.closest("[data-open-store-preview]");
    if (previewTrigger) {
      event.preventDefault();
      window.open(storefrontPreviewUrl(), "_blank", "noopener");
      return;
    }
    if (event.target.closest("[data-merchant-dashboard-logout]")) return handleMerchantLogout();
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
    const editUserButton = event.target.closest("[data-edit-user]");
    if (editUserButton) return openUserEditor(editUserButton.dataset.editUser);
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
