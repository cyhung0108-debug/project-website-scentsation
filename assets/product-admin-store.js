(function () {
  const PRODUCT_STORAGE_KEY = "onlineShopMerchantProducts";
  const CATEGORY_STORAGE_KEY = "onlineShopCategories";
  const UNCATEGORIZED_ID = "uncategorized";
  const PENDING_ID = "pending-review";
  const storefrontProducts = Array.isArray(window.ONLINE_SHOP_PRODUCTS)
    ? window.ONLINE_SHOP_PRODUCTS
    : [];
  const initialRawProducts = JSON.parse(JSON.stringify(storefrontProducts));

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uniqueStrings(values) {
    return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function stableId(prefix, value) {
    const text = String(value || "").trim();
    const latin = text.normalize("NFKD").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    let hash = 2166136261;
    for (const character of text) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${latin || (hash >>> 0).toString(36)}`;
  }

  function newId(prefix) {
    return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  }

  function legacyCategoryNames(product) {
    const values = Array.isArray(product?.category) ? product.category : [product?.category];
    return uniqueStrings([
      ...values.filter((value) => typeof value !== "object"),
      product?.type,
      product?.family
    ]);
  }

  function normalizeAssignments(product) {
    const source = Array.isArray(product?.category) ? product.category : [product?.category];
    const assignmentMap = new Map();
    source.filter((item) => item && typeof item === "object").forEach((item) => {
      const categoryId = String(item.categoryId || "").trim();
      if (!categoryId) return;
      const existing = assignmentMap.get(categoryId) || [];
      assignmentMap.set(categoryId, uniqueStrings([...existing, ...(item.subcategoryIds || [])]));
    });
    const legacyNames = legacyCategoryNames(product);
    if (legacyNames.length) {
      assignmentMap.set(PENDING_ID, uniqueStrings([
        ...(assignmentMap.get(PENDING_ID) || []),
        ...legacyNames.map((name) => stableId("legacy", name))
      ]));
    }
    if (assignmentMap.size > 1) assignmentMap.delete(UNCATEGORIZED_ID);
    return [...assignmentMap.entries()].map(([categoryId, subcategoryIds]) => ({
      categoryId,
      subcategoryIds
    }));
  }

  function normalizeProduct(product, index = 0) {
    const legacyImages = Array.isArray(product?.images) ? product.images : [];
    const images = uniqueStrings([product?.image, ...legacyImages]);
    const description = uniqueStrings([
      ...(Array.isArray(product?.description) ? product.description : [product?.description]),
      ...(Array.isArray(product?.details) ? product.details : [])
    ]);
    const { type, family, image, details, ...currentFields } = product || {};

    return {
      ...currentFields,
      id: String(product?.id || `product-${index + 1}`).trim(),
      name: String(product?.name || "未命名商品").trim(),
      price: Math.max(0, Number(product?.price) || 0),
      stock: Math.max(0, Number.parseInt(product?.stock ?? 100, 10) || 0),
      orderStatus: product?.orderStatus === "preorder" ? "preorder" : "in-stock",
      category: normalizeAssignments(product),
      images,
      description,
      tags: uniqueStrings(Array.isArray(product?.tags) ? product.tags : []),
      showOnHome: product?.showOnHome === true,
      isActive: product?.isActive !== false
    };
  }

  function normalizeCategory(category, index = 0) {
    const id = String(category?.id || newId("category")).trim();
    const subcategories = (Array.isArray(category?.subcategories) ? category.subcategories : [])
      .map((subcategory, subIndex) => ({
        id: String(subcategory?.id || newId("subcategory")).trim(),
        name: String(subcategory?.name || "未命名小分類").trim(),
        slug: String(subcategory?.slug || stableId("sub", subcategory?.name)).replace(/^sub-/, ""),
        order: Number.isFinite(Number(subcategory?.order)) ? Number(subcategory.order) : subIndex
      }))
      .sort((a, b) => a.order - b.order)
      .map((subcategory, subIndex) => ({ ...subcategory, order: subIndex }));
    return {
      id,
      name: String(category?.name || "未命名分類").trim(),
      slug: String(category?.slug || stableId("category", category?.name)).replace(/^category-/, ""),
      order: Number.isFinite(Number(category?.order)) ? Number(category.order) : index,
      system: category?.system === true,
      subcategories
    };
  }

  function systemUncategorized() {
    return normalizeCategory({
      id: UNCATEGORIZED_ID,
      name: "未分類",
      slug: "uncategorized",
      order: 9999,
      system: true,
      subcategories: []
    });
  }

  function ensureCategoryCatalog(categories, rawProducts = []) {
    const normalized = (Array.isArray(categories) ? categories : []).map(normalizeCategory);
    if (!normalized.some((category) => category.id === UNCATEGORIZED_ID)) {
      normalized.push(systemUncategorized());
    }
    const legacyNames = uniqueStrings(rawProducts.flatMap(legacyCategoryNames));
    if (legacyNames.length) {
      let pending = normalized.find((category) => category.id === PENDING_ID);
      if (!pending) {
        pending = normalizeCategory({
          id: PENDING_ID,
          name: "待整理",
          slug: "pending-review",
          order: Math.max(0, ...normalized.map((category) => category.order)) + 1,
          system: false,
          subcategories: []
        });
        normalized.push(pending);
      }
      const existingIds = new Set(pending.subcategories.map((subcategory) => subcategory.id));
      legacyNames.forEach((name) => {
        const id = stableId("legacy", name);
        if (!existingIds.has(id)) {
          pending.subcategories.push({
            id,
            name,
            slug: stableId("sub", name).replace(/^sub-/, ""),
            order: pending.subcategories.length
          });
        }
      });
    }
    return normalized
      .sort((a, b) => a.order - b.order)
      .map((category, index) => normalizeCategory({ ...category, order: index }, index));
  }

  const initialDefaultProducts = initialRawProducts.map(normalizeProduct);
  const initialCategories = ensureCategoryCatalog([], initialRawProducts);

  function loadRawProducts() {
    try {
      const raw = window.localStorage.getItem(PRODUCT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      console.warn("無法讀取商品快取，將使用預設商品。", error);
    }
    return clone(initialRawProducts);
  }

  function loadProducts() {
    const raw = loadRawProducts();
    return (raw.length ? raw : initialDefaultProducts).map(normalizeProduct);
  }

  function loadCategories() {
    try {
      const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) return ensureCategoryCatalog(parsed, loadRawProducts());
    } catch (error) {
      console.warn("無法讀取分類快取，將使用預設分類。", error);
    }
    return ensureCategoryCatalog(initialCategories, loadRawProducts());
  }

  function publishCategories(categories, source = "cache") {
    const normalized = ensureCategoryCatalog(categories);
    window.ONLINE_SHOP_CATEGORIES = clone(normalized);
    window.dispatchEvent(new CustomEvent("merchant-categories-updated", {
      detail: { categories: clone(normalized), source }
    }));
    return normalized;
  }

  function saveCategories(categories, source = "cache") {
    const normalized = ensureCategoryCatalog(categories);
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(normalized));
    publishCategories(normalized, source);
    return clone(normalized);
  }

  function publishProducts(products, source = "cache") {
    const allProducts = products.map(normalizeProduct);
    const activeProducts = allProducts.filter((product) => product.isActive !== false);
    storefrontProducts.splice(0, storefrontProducts.length, ...activeProducts);
    window.ONLINE_SHOP_PRODUCTS = storefrontProducts;
    window.ONLINE_SHOP_ALL_PRODUCTS = clone(allProducts);
    window.dispatchEvent(new CustomEvent("merchant-products-updated", {
      detail: { products: clone(allProducts), source }
    }));
    return allProducts;
  }

  function saveProducts(products, source = "cache") {
    const normalized = products.map(normalizeProduct);
    window.localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(normalized));
    publishProducts(normalized, source);
    return clone(normalized);
  }

  function firestorePayload(product) {
    const normalized = normalizeProduct(product);
    const { id, createdAt, updatedAt, ...payload } = normalized;
    return payload;
  }

  function categoryPayload(category) {
    const { createdAt, updatedAt, ...payload } = normalizeCategory(category);
    return payload;
  }

  function isLegacyProduct(product) {
    const values = Array.isArray(product?.category) ? product.category : [product?.category];
    return values.some((value) => typeof value !== "object") || Boolean(product?.type || product?.family);
  }

  function productCategoryLabels(product, categories = window.ONLINE_SHOP_CATEGORIES || loadCategories()) {
    const catalog = new Map(categories.map((category) => [category.id, category]));
    const labels = [];
    normalizeProduct(product).category.forEach((assignment) => {
      const category = catalog.get(assignment.categoryId);
      if (!category) return;
      labels.push(category.name);
      assignment.subcategoryIds.forEach((subcategoryId) => {
        const subcategory = category.subcategories.find((item) => item.id === subcategoryId);
        if (subcategory) labels.push(subcategory.name);
      });
    });
    return uniqueStrings(labels);
  }

  async function firebaseService() {
    if (!window.onlineShopFirebaseReady) throw new Error("Firebase 尚未載入。");
    return window.onlineShopFirebaseReady;
  }

  async function initializePublicProducts() {
    try {
      const firebase = await firebaseService();
      const [rawProducts, remoteCategories] = await Promise.all([
        firebase.getActiveProducts(),
        firebase.getCategories()
      ]);
      const categories = ensureCategoryCatalog(remoteCategories, rawProducts);
      const products = rawProducts.map(normalizeProduct);
      saveCategories(categories, "firestore");
      saveProducts(products, "firestore");
      return clone(products);
    } catch (error) {
      console.warn("Firestore 商品或分類載入失敗，已使用本地快取。", error);
      const cachedCategories = loadCategories();
      const cachedProducts = loadProducts();
      publishCategories(cachedCategories, "cache");
      publishProducts(cachedProducts, "cache");
      return clone(cachedProducts);
    }
  }

  async function initializeMerchantProducts() {
    const firebase = await firebaseService();
    const remoteProducts = await firebase.getAllProducts();
    const remoteWasEmpty = !remoteProducts.length;
    let rawProducts = remoteWasEmpty ? loadRawProducts() : remoteProducts;
    let remoteCategories = await firebase.getCategories();
    const categories = ensureCategoryCatalog(remoteCategories, rawProducts);
    const products = rawProducts.map(normalizeProduct);
    const needsMigration = !remoteCategories.length || rawProducts.some(isLegacyProduct);
    if (remoteWasEmpty) {
      await firebase.saveCategoryChanges(categories.map(categoryPayload), [], []);
      await Promise.all(products.map((product) => firebase.saveProduct(product.id, firestorePayload(product), true)));
      remoteCategories = categories;
    } else if (needsMigration) {
      await firebase.saveCategoryChanges(
        categories.map(categoryPayload),
        [],
        products.map((product) => ({ id: product.id, category: product.category }))
      );
      remoteCategories = categories;
    }
    saveCategories(remoteCategories.length ? remoteCategories : categories, "firestore");
    saveProducts(products, "firestore");
    return clone(products);
  }

  function productIndex(products, productId) {
    return products.findIndex((product) => product.id === productId);
  }

  async function addProduct(product) {
    const products = loadProducts();
    const normalized = normalizeProduct(product, products.length);
    if (!normalized.id) throw new Error("請輸入商品 ID。");
    if (products.some((item) => item.id === normalized.id)) throw new Error("商品 ID 已存在，請使用另一個 ID。");
    const firebase = await firebaseService();
    const saved = normalizeProduct(await firebase.saveProduct(normalized.id, firestorePayload(normalized), true));
    products.push(saved);
    return saveProducts(products, "firestore");
  }

  async function updateProduct(productId, updates) {
    const products = loadProducts();
    const index = productIndex(products, productId);
    if (index < 0) throw new Error("找不到此商品。");
    const normalized = normalizeProduct({ ...products[index], ...updates, id: productId }, index);
    const firebase = await firebaseService();
    const saved = normalizeProduct(await firebase.saveProduct(productId, firestorePayload(normalized), false));
    products[index] = saved;
    return saveProducts(products, "firestore");
  }

  async function setProductActive(productId, isActive) {
    const products = loadProducts();
    const index = productIndex(products, productId);
    if (index < 0) throw new Error("找不到此商品。");
    const nextActive = Boolean(isActive);
    const firebase = await firebaseService();
    await firebase.updateProductFields(productId, { isActive: nextActive });
    products[index] = normalizeProduct({ ...products[index], isActive: nextActive }, index);
    return saveProducts(products, "firestore");
  }

  async function deleteProduct(productId) {
    const products = loadProducts();
    const index = productIndex(products, productId);
    if (index < 0) throw new Error("找不到此商品。");
    const firebase = await firebaseService();
    await firebase.deleteProduct(productId);
    products.splice(index, 1);
    return saveProducts(products, "firestore");
  }

  function reconcileProductsWithCategories(products, categories) {
    const catalog = new Map(categories.map((category) => [category.id, category]));
    return products.map((product, index) => {
      const assignments = normalizeProduct(product, index).category.flatMap((assignment) => {
        const category = catalog.get(assignment.categoryId);
        if (!category) return [];
        const validSubcategoryIds = new Set(category.subcategories.map((subcategory) => subcategory.id));
        return [{
          categoryId: assignment.categoryId,
          subcategoryIds: assignment.subcategoryIds.filter((id) => validSubcategoryIds.has(id))
        }];
      });
      return normalizeProduct({
        ...product,
        category: assignments.length ? assignments : [{ categoryId: UNCATEGORIZED_ID, subcategoryIds: [] }]
      }, index);
    });
  }

  async function saveCategoryCatalog(categories, deletedCategoryIds = []) {
    const normalizedCategories = ensureCategoryCatalog(categories);
    const products = reconcileProductsWithCategories(loadProducts(), normalizedCategories);
    const firebase = await firebaseService();
    await firebase.saveCategoryChanges(
      normalizedCategories.map(categoryPayload),
      uniqueStrings(deletedCategoryIds).filter((id) => id !== UNCATEGORIZED_ID),
      products.map((product) => ({ id: product.id, category: product.category }))
    );
    saveCategories(normalizedCategories, "firestore");
    saveProducts(products, "firestore");
    return { categories: clone(normalizedCategories), products: clone(products) };
  }

  async function uploadProductImage(productId, file) {
    return (await firebaseService()).uploadProductImage(productId, file);
  }

  async function deleteProductImage(url) {
    return (await firebaseService()).deleteProductImage(url);
  }

  const store = {
    storageKey: PRODUCT_STORAGE_KEY,
    categoryStorageKey: CATEGORY_STORAGE_KEY,
    uncategorizedId: UNCATEGORIZED_ID,
    pendingId: PENDING_ID,
    normalizeProduct,
    normalizeCategory,
    newId,
    loadProducts: () => clone(loadProducts()),
    loadCategories: () => clone(loadCategories()),
    saveProducts,
    saveCategories,
    publishProducts,
    publishCategories,
    productCategoryLabels,
    initializePublicProducts,
    initializeMerchantProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    setProductActive,
    saveCategoryCatalog,
    uploadProductImage,
    deleteProductImage
  };

  window.ONLINE_SHOP_PRODUCT_ADMIN_STORE = store;
  publishCategories(loadCategories(), "cache");
  publishProducts(loadProducts(), "cache");
})();
