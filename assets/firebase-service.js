(function () {
  const config = window.ONLINE_SHOP_FIREBASE_CONFIG;
  const sdkVersion = "12.15.0";
  const sdkBaseUrl = `https://www.gstatic.com/firebasejs/${sdkVersion}`;
  const databaseId = "scentsation";
  window.onlineShopFirebaseReady = (async function initializeFirebase() {
    if (!config?.apiKey || !config?.projectId || !config?.appId || !config?.storageBucket) {
      throw new Error("Firebase Web App 設定不完整。請檢查 assets/firebase-config.js。");
    }

    const [appSdk, authSdk, firestoreSdk, storageSdk] = await Promise.all([
      import(`${sdkBaseUrl}/firebase-app.js`),
      import(`${sdkBaseUrl}/firebase-auth.js`),
      import(`${sdkBaseUrl}/firebase-firestore.js`),
      import(`${sdkBaseUrl}/firebase-storage.js`)
    ]);

    const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(config);
    const auth = authSdk.getAuth(app);
    const db = firestoreSdk.getFirestore(app, databaseId);
    const storage = storageSdk.getStorage(app, `gs://${config.storageBucket}`);
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    authSdk.useDeviceLanguage(auth);

    const googleProvider = new authSdk.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });

    function productDocument(productId) {
      return firestoreSdk.doc(db, "products", String(productId || ""));
    }

    function categoryDocument(categoryId) {
      return firestoreSdk.doc(db, "categories", String(categoryId || ""));
    }

    function snapshotData(snapshot) {
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    }

    function userProviderId(user) {
      return user?.providerData?.[0]?.providerId || "password";
    }

    function normalizeTimestamp(value) {
      if (!value) return "";
      if (typeof value.toDate === "function") return value.toDate().toISOString();
      if (value instanceof Date) return value.toISOString();
      return value;
    }

    function normalizeUserRecord(snapshot) {
      const data = { id: snapshot.id, ...snapshot.data() };
      return {
        ...data,
        tags: Array.isArray(data.tags) ? data.tags : [],
        createdAt: normalizeTimestamp(data.createdAt),
        lastLoginAt: normalizeTimestamp(data.lastLoginAt),
        updatedAt: normalizeTimestamp(data.updatedAt)
      };
    }

    function normalizeMerchantRole(snapshot) {
      if (!snapshot.exists()) return null;
      const data = snapshot.data() || {};
      return {
        id: snapshot.id,
        role: data.role || "",
        active: data.active === true,
        permissions: {
          usersRead: data.permissions?.usersRead === true,
          usersWrite: data.permissions?.usersWrite === true,
          ordersRead: data.permissions?.ordersRead === true,
          productsWrite: data.permissions?.productsWrite === true,
          pagesWrite: data.permissions?.pagesWrite === true
        }
      };
    }

    function normalizeOrderRecord(snapshot) {
      const data = { id: snapshot.id, ...snapshot.data() };
      return {
        ...data,
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt)
      };
    }

    async function getMerchantRole(uid) {
      if (!uid) return null;
      const roleRef = firestoreSdk.doc(db, "merchantRoles", String(uid));
      return normalizeMerchantRole(await firestoreSdk.getDoc(roleRef));
    }

    async function getUserProfile(uid) {
      if (!uid) return null;
      const snapshot = await firestoreSdk.getDoc(firestoreSdk.doc(db, "users", String(uid)));
      return snapshot.exists() ? normalizeUserRecord(snapshot) : null;
    }

    async function upsertCurrentUserProfile(user, merchantRole = null) {
      if (!user?.uid) return null;
      const uid = String(user.uid);
      const userRef = firestoreSdk.doc(db, "users", uid);
      const currentSnapshot = await firestoreSdk.getDoc(userRef);
      let role = merchantRole;
      if (!role) {
        try {
          role = await getMerchantRole(uid);
        } catch (error) {
          if (error?.code !== "permission-denied") throw error;
        }
      }
      const now = firestoreSdk.serverTimestamp();
      const payload = {
        uid,
        email: user.email || "",
        displayName: user.displayName || "",
        providerId: userProviderId(user),
        lastLoginAt: now,
        role: role?.active && role.role === "merchant" ? "merchant" : "customer"
      };
      if (!currentSnapshot.exists()) {
        payload.createdAt = now;
        payload.status = "active";
        payload.phone = "";
        payload.note = "";
        payload.tags = [];
      }
      await firestoreSdk.setDoc(userRef, payload, { merge: true });
      return { uid, ...payload };
    }

    async function updateUserProfile(userId, updates) {
      const uid = String(userId || "").trim();
      if (!uid) throw new Error("缺少用戶 UID。");
      const allowed = {};
      if ("displayName" in updates) allowed.displayName = String(updates.displayName || "").trim();
      if ("phone" in updates) allowed.phone = String(updates.phone || "").trim();
      if ("status" in updates) allowed.status = updates.status === "blocked" ? "blocked" : "active";
      if ("note" in updates) allowed.note = String(updates.note || "").trim();
      if ("tags" in updates) {
        allowed.tags = (Array.isArray(updates.tags) ? updates.tags : String(updates.tags || "").split(/[\n,]/))
          .map((tag) => String(tag || "").trim())
          .filter(Boolean)
          .filter((tag, index, list) => list.indexOf(tag) === index);
      }
      allowed.updatedAt = firestoreSdk.serverTimestamp();
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "users", uid), allowed, { merge: true });
      return { id: uid, ...allowed };
    }

    function listenUsers(callback, onError) {
      return firestoreSdk.onSnapshot(
        firestoreSdk.collection(db, "users"),
        (snapshot) => callback(snapshot.docs.map(normalizeUserRecord)
          .sort((a, b) => String(b.lastLoginAt || "").localeCompare(String(a.lastLoginAt || "")))),
        onError
      );
    }

    function listenUserProfile(uid, callback, onError) {
      if (!uid) return () => {};
      return firestoreSdk.onSnapshot(
        firestoreSdk.doc(db, "users", String(uid)),
        (snapshot) => callback(snapshot.exists() ? normalizeUserRecord(snapshot) : null),
        onError
      );
    }

    function listenOrders(callback, onError) {
      return firestoreSdk.onSnapshot(
        firestoreSdk.collection(db, "orders"),
        (snapshot) => callback(snapshot.docs.map(normalizeOrderRecord)
          .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))),
        onError
      );
    }

    async function getActiveProducts() {
      const productsQuery = firestoreSdk.query(
        firestoreSdk.collection(db, "products"),
        firestoreSdk.where("isActive", "==", true)
      );
      const snapshot = await firestoreSdk.getDocs(productsQuery);
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    }

    async function getAllProducts() {
      const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "products"));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    }

    async function getCategories() {
      const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "categories"));
      return snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    }

    async function getProduct(productId) {
      return snapshotData(await firestoreSdk.getDoc(productDocument(productId)));
    }

    async function saveProduct(productId, product, isNew = false) {
      const payload = {
        ...product,
        updatedAt: firestoreSdk.serverTimestamp()
      };
      if (isNew) payload.createdAt = firestoreSdk.serverTimestamp();
      await firestoreSdk.setDoc(productDocument(productId), payload, { merge: !isNew });
      return { id: productId, ...product };
    }

    async function updateProductFields(productId, fields) {
      await firestoreSdk.updateDoc(productDocument(productId), {
        ...fields,
        updatedAt: firestoreSdk.serverTimestamp()
      });
      return { id: productId, ...fields };
    }

    async function deleteProduct(productId) {
      await firestoreSdk.deleteDoc(productDocument(productId));
    }

    async function commitOperations(operations) {
      for (let index = 0; index < operations.length; index += 400) {
        const batch = firestoreSdk.writeBatch(db);
        operations.slice(index, index + 400).forEach((operation) => {
          if (operation.type === "delete") batch.delete(operation.ref);
          else batch.set(operation.ref, operation.data, { merge: operation.merge !== false });
        });
        await batch.commit();
      }
    }

    async function saveCategoryChanges(categories, deletedCategoryIds = [], products = []) {
      const operations = categories.map((category) => ({
        type: "set",
        ref: categoryDocument(category.id),
        data: { ...category, updatedAt: firestoreSdk.serverTimestamp() }
      }));
      deletedCategoryIds.forEach((categoryId) => operations.push({
        type: "delete",
        ref: categoryDocument(categoryId)
      }));
      products.forEach((product) => operations.push({
        type: "set",
        ref: productDocument(product.id),
        data: { category: product.category, updatedAt: firestoreSdk.serverTimestamp() }
      }));
      await commitOperations(operations);
      return { categories, products };
    }

    function safeFilename(filename) {
      return String(filename || "image")
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "image";
    }

    async function uploadProductImage(productId, file) {
      const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
      const imageRef = storageSdk.ref(storage, `products/${productId}/${uniqueName}`);
      await storageSdk.uploadBytes(imageRef, file, {
        contentType: file.type,
        customMetadata: { productId: String(productId) }
      });
      return storageSdk.getDownloadURL(imageRef);
    }

    function isManagedStorageUrl(url) {
      const value = String(url || "");
      return value.includes("firebasestorage.googleapis.com")
        && value.includes(encodeURIComponent(config.storageBucket));
    }

    async function deleteProductImage(url) {
      if (!isManagedStorageUrl(url)) return false;
      try {
        await storageSdk.deleteObject(storageSdk.ref(storage, url));
        return true;
      } catch (error) {
        if (error?.code === "storage/object-not-found") return false;
        throw error;
      }
    }

    const service = {
      app,
      auth,
      db,
      storage,
      databaseId,
      googleProvider,
      createUserWithEmailAndPassword: authSdk.createUserWithEmailAndPassword,
      onAuthStateChanged: authSdk.onAuthStateChanged,
      sendPasswordResetEmail: authSdk.sendPasswordResetEmail,
      signInWithEmailAndPassword: authSdk.signInWithEmailAndPassword,
      signInWithPopup: authSdk.signInWithPopup,
      signOut: authSdk.signOut,
      getActiveProducts,
      getAllProducts,
      getCategories,
      getProduct,
      saveProduct,
      updateProductFields,
      deleteProduct,
      saveCategoryChanges,
      getMerchantRole,
      getUserProfile,
      upsertCurrentUserProfile,
      updateUserProfile,
      listenUsers,
      listenUserProfile,
      listenOrders,
      uploadProductImage,
      deleteProductImage,
      isManagedStorageUrl
    };

    window.onlineShopFirebase = service;
    window.dispatchEvent(new CustomEvent("online-shop-firebase-ready", { detail: service }));
    return service;
  })();
})();
