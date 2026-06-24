(function () {
  const MERCHANT_UID_ALLOWLIST = ["MvVN7JqMAiUp5S051FYQ5Hw5dLO2"];
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
  let hasPromptedLogin = false;

  window.MERCHANT_UID_ALLOWLIST = MERCHANT_UID_ALLOWLIST;

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

  function isAllowedMerchant(user) {
    return MERCHANT_UID_ALLOWLIST.includes(String(user?.uid || ""));
  }

  function merchantUrl() {
    return `${document.body?.dataset.rootPrefix || ""}merchant.html`;
  }

  function updateMerchantNav(user) {
    document.querySelectorAll("[data-merchant-nav]").forEach((link) => link.remove());
    if (!isAllowedMerchant(user)) return;

    document.querySelectorAll(".desktop-nav").forEach((nav) => {
      const link = document.createElement("a");
      link.className = `nav-link merchant-nav-link${document.body?.dataset.page === "merchant" ? " is-active" : ""}`;
      link.href = merchantUrl();
      link.dataset.merchantNav = "";
      link.textContent = "商品管理";
      nav.querySelector("a")?.insertAdjacentElement("afterend", link);
    });

    const menu = document.querySelector("#menu-drawer");
    if (menu) {
      const link = document.createElement("a");
      link.href = merchantUrl();
      link.dataset.merchantNav = "";
      link.textContent = "商品管理";
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
      "permission-denied": "Firebase 拒絕此操作，請登出後重新登入商戶帳號。",
      "storage/unauthorized": "Firebase Storage 拒絕此操作，請登出後重新登入商戶帳號。",
      "unavailable": "暫時無法連接 Firebase，請檢查網絡後重試。",
      "storage/retry-limit-exceeded": "圖片上載逾時，請檢查網絡後重試。"
    };
    return messages[code] || error?.message || fallback;
  }

  function showMerchantToast(message) {
    window.showToast?.(message);
  }

  function cleanupProductImages(urls) {
    Promise.allSettled(uniqueStrings(urls).map((url) => store.deleteProductImage(url)))
      .then((results) => {
        if (results.some((result) => result.status === "rejected")) {
          console.warn("部分商品圖片未能從 Storage 清理，商品資料已成功更新。", results);
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
      list.innerHTML = '<p class="merchant-products__empty">目前沒有商品</p>';
      return;
    }

    list.innerHTML = products.map((product) => `
      <article class="merchant-product ${product.isActive ? "" : "is-hidden"}">
        <div class="merchant-product__image">${primaryImage(product) ? `<img src="${escapeHtml(primaryImage(product))}" alt="">` : "<span>沒有圖片</span>"}</div>
        <div class="merchant-product__body">
          <p class="merchant-product__status">${product.isActive ? "顯示中" : "已隱藏"}</p>
          <h3>${escapeHtml(product.name)}</h3>
          <small>${escapeHtml(product.id)} · ${escapeHtml(store.productCategoryLabels(product).join("、") || "未分類")}</small>
        </div>
        <div class="merchant-product__meta"><span>價格</span><strong>HK$${Number(product.price || 0).toFixed(2)}</strong></div>
        <div class="merchant-product__meta"><span>存貨</span><strong>${Number(product.stock || 0)}</strong></div>
        <div class="merchant-product__actions">
          <button type="button" data-edit-product="${escapeHtml(product.id)}">修改</button>
          <button type="button" data-toggle-product="${escapeHtml(product.id)}" data-next-active="${product.isActive ? "false" : "true"}">${product.isActive ? "隱藏" : "顯示"}</button>
          <button class="is-danger" type="button" data-delete-product="${escapeHtml(product.id)}">刪除</button>
        </div>
      </article>`).join("");
  }

  function renderDashboard(user) {
    currentMerchant = user;
    container.innerHTML = `
      <section class="merchant-page">
        <div class="merchant-page__heading"><div><h1>商品管理</h1><p>登入帳號：${escapeHtml(user.email || "")}</p></div><button type="button" class="merchant-secondary-button" data-auth-logout>登出</button></div>
        <p class="merchant-page__message" data-merchant-page-message aria-live="polite"></p>
        <section class="merchant-products-panel">
          <div class="merchant-products-panel__heading"><h2>全部商品</h2><div class="merchant-products-panel__actions"><button class="merchant-secondary-button" type="button" data-manage-categories>分類管理</button><button class="merchant-primary-button" type="button" data-add-product>新增</button></div></div>
          <div class="merchant-products" data-merchant-products></div>
        </section>
      </section>`;
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
            <p>拖曳圖片可調整順序；第一張是主圖片，第二張是 Hover 圖。</p>
            <div class="merchant-image-list" data-editor-image-list></div>
          </div>
          <label class="merchant-editor-grid__wide">商品描述<textarea name="description" rows="7" placeholder="每行一個段落">${escapeHtml(descriptions)}</textarea></label>
          <label class="merchant-editor-grid__wide">標籤<textarea name="tags" rows="3" placeholder="每行一個標籤">${escapeHtml(tags)}</textarea></label>
        </div>
        <div class="merchant-editor-options"><label><input name="showOnHome" type="checkbox" ${product?.showOnHome ? "checked" : ""}><span>首頁推薦</span></label><label><input name="isActive" type="checkbox" ${product?.isActive !== false ? "checked" : ""}><span>顯示商品</span></label></div>
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
      <p class="merchant-category-help">拖曳可調整顯示順序。系統「未分類」不能刪除或改名。</p>
      <div class="merchant-category-list" data-category-manager-list>${categoryDraft.map((category) => `
        <article class="merchant-category-card" data-category-editor-id="${escapeHtml(category.id)}">
          <div class="merchant-category-card__heading">
            <button class="merchant-category-drag" type="button" data-category-drag aria-label="拖曳大分類">⋮⋮</button>
            <input type="text" data-category-name value="${escapeHtml(category.name)}" aria-label="大分類名稱" ${category.system ? "readonly" : ""}>
            ${category.system ? '<span class="merchant-system-label">系統</span>' : `<button class="merchant-category-delete" type="button" data-delete-category="${escapeHtml(category.id)}">刪除</button>`}
          </div>
          <div class="merchant-subcategory-list" data-subcategory-list="${escapeHtml(category.id)}">${category.subcategories.map((subcategory) => `
            <div class="merchant-subcategory-row" data-subcategory-editor-id="${escapeHtml(subcategory.id)}">
              <button class="merchant-subcategory-drag" type="button" data-subcategory-drag aria-label="拖曳小分類">⋮⋮</button>
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
    if (categoryDraft.some((category) => !category.name)) return categoryManagerError("大分類名稱不能留空。");
    if (categoryDraft.some((category) => category.subcategories.some((subcategory) => !subcategory.name))) return categoryManagerError("小分類名稱不能留空。");
    const duplicateMainNames = categoryDraft.map((category) => category.name.toLowerCase());
    if (new Set(duplicateMainNames).size !== duplicateMainNames.length) return categoryManagerError("大分類名稱不能重複。");
    const hasDuplicateSubs = categoryDraft.some((category) => {
      const names = category.subcategories.map((subcategory) => subcategory.name.toLowerCase());
      return new Set(names).size !== names.length;
    });
    if (hasDuplicateSubs) return categoryManagerError("同一大分類內的小分類名稱不能重複。");
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
      ? editorImages.map((image, index) => `<article class="merchant-editor-image" data-editor-image-id="${escapeHtml(image.id)}"><button class="merchant-image-drag" type="button" data-drag-handle aria-label="拖曳圖片">⋮⋮</button><img src="${escapeHtml(image.preview)}" alt="商品圖片 ${index + 1}"><span>${index === 0 ? "主圖片" : index === 1 ? "Hover 圖" : `圖片 ${index + 1}`}</span><button class="merchant-image-remove" type="button" data-remove-editor-image="${escapeHtml(image.id)}" aria-label="刪除圖片">×</button></article>`).join("")
      : '<p class="merchant-image-empty">尚未加入圖片</p>';

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
    if (productId && !product) return showPageError("找不到此商品。");
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
    if (!product) return showPageError("找不到此商品。");
    deletingProductId = product.id;
    deletingProductImages = [...(product.images || [])];
    document.querySelector("[data-delete-product-message]").textContent = `確定要刪除「${product.name}」嗎？此操作無法復原。`;
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
    if (!editorCategoryAssignments.length) return setEditorError("請至少選擇一個大分類或小分類。");
    if (!editorImages.length) return setEditorError("請至少上載一張圖片。");

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

  async function handleAuthState(user) {
    updateMerchantNav(user);
    if (!container) return;
    if (!user) {
      currentMerchant = null;
      closeMerchantModals();
      renderGate("商戶登入", "請先登入已列入商戶白名單的帳號。", '<button class="merchant-primary-button" type="button" data-auth-trigger>登入商戶帳號</button>');
      if (!hasPromptedLogin) {
        hasPromptedLogin = true;
        window.setTimeout(() => window.openAuthModal?.("login"), 0);
      }
      return;
    }
    hasPromptedLogin = false;
    if (!isAllowedMerchant(user)) {
      currentMerchant = null;
      closeMerchantModals();
      renderGate("沒有管理權限", `帳號 ${user.email || ""} 不是指定的商戶管理帳號。`, '<button class="merchant-secondary-button" type="button" data-auth-logout>登出</button>');
      return;
    }

    currentMerchant = user;
    renderGate("正在載入商品", "請稍候…");
    try {
      await store.initializeMerchantProducts();
      renderDashboard(user);
    } catch (error) {
      renderGate("無法載入商品管理", error.message || "請檢查 Firestore 權限後重試。", '<button class="merchant-secondary-button" type="button" data-auth-logout>登出</button>');
    }
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-merchant-editor-form]");
    if (!form || !currentMerchant) return;
    event.preventDefault();
    await saveEditorForm(form);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(".merchant-modal.is-open")) closeMerchantModals();
  });

  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-manage-categories]")) return openCategoryManager();
    if (event.target.closest("[data-add-category]")) {
      syncCategoryDraftFromDom();
      categoryDraft.push(store.normalizeCategory({ id: store.newId("category"), name: "新大分類", order: categoryDraft.length, subcategories: [] }));
      return renderCategoryManager();
    }
    const addSubcategoryButton = event.target.closest("[data-add-subcategory]");
    if (addSubcategoryButton) {
      syncCategoryDraftFromDom();
      const category = categoryDraft.find((item) => item.id === addSubcategoryButton.dataset.addSubcategory);
      if (category) category.subcategories.push({ id: store.newId("subcategory"), name: "新小分類", slug: "new-subcategory", order: category.subcategories.length });
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
        showMerchantToast(nextActive ? "商品已顯示" : "商品已隱藏");
      } catch (error) {
        const message = merchantErrorMessage(error, "無法更新商品。");
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
        setEditorError(`${file.name} 不是有效圖片。`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setEditorError(`${file.name} 超過 10MB。`);
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
      if (container) renderGate("無法檢查登入狀態", "會員登入服務暫時無法使用，請稍後再試。");
    }
  }

  initMerchantAccess();
})();
