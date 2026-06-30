(function () {
  const config = window.ONLINE_SHOP_FIREBASE_CONFIG;
  const sdkVersion = "12.15.0";
  const sdkBaseUrl = `https://www.gstatic.com/firebasejs/${sdkVersion}`;
  const databaseId = "scentsation";
  window.onlineShopFirebaseReady = (async function initializeFirebase() {
    if (!config?.apiKey || !config?.projectId || !config?.appId || !config?.storageBucket) {
      throw new Error("Firebase Web App 設定不完整，請檢查 assets/firebase-config.js。");
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

    function normalizeRole(value) {
      const role = String(value || "").trim();
      if (role === "merchant") return "super_admin";
      return ["super_admin", "admin", "staff", "customer"].includes(role) ? role : "customer";
    }

    function isDashboardRole(role) {
      return ["super_admin", "admin", "staff"].includes(normalizeRole(role));
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
        role: normalizeRole(data.role),
        status: String(data.status || "active"),
        address: String(data.address || ""),
        gender: String(data.gender || ""),
        birthday: String(data.birthday || ""),
        note: String(data.note || ""),
        createdAt: normalizeTimestamp(data.createdAt),
        lastLoginAt: normalizeTimestamp(data.lastLoginAt),
        updatedAt: normalizeTimestamp(data.updatedAt)
      };
    }

    const rolePermissionFeatures = [
      "usersManage",
      "inviteUsers",
      "inviteRecords",
      "salesManage",
      "productsManage",
      "categoriesManage",
      "pagesManage",
      "permissionsManage",
      "storePreview",
      "usersBlock",
      "viewUserDetails",
      "usersRoleEdit",
      "usersProfileEdit",
      "ordersRead",
      "ordersUpdate"
    ];

    const rolePermissionKeys = ["super_admin", "admin", "staff", "customer"];

    function getDefaultRolePermissions() {
      const permissions = {};
      rolePermissionFeatures.forEach((feature) => {
        permissions[feature] = {
          super_admin: true,
          admin: true,
          staff: ["productsManage", "categoriesManage", "pagesManage", "storePreview", "viewUserDetails"].includes(feature),
          customer: false
        };
      });
      return permissions;
    }

    function normalizeRolePermissions(data) {
      const defaults = getDefaultRolePermissions();
      const source = data?.permissions && typeof data.permissions === "object" ? data.permissions : {};
      rolePermissionFeatures.forEach((feature) => {
        const row = source[feature] && typeof source[feature] === "object" ? source[feature] : {};
        rolePermissionKeys.forEach((role) => {
          defaults[feature][role] = row[role] === undefined ? defaults[feature][role] : row[role] === true;
        });
      });
      return defaults;
    }

    function normalizeMerchantRole(snapshot) {
      if (!snapshot.exists()) return null;
      const data = snapshot.data() || {};
      const permissions = data.permissions && typeof data.permissions === "object" ? data.permissions : null;
      const role = data.role === "merchant" ? "super_admin" : normalizeRole(data.role);
      const legacyActiveMerchant = data.active === true && isDashboardRole(role);
      const hasPermission = (key) => {
        if (!legacyActiveMerchant) return false;
        if (!permissions || !(key in permissions)) return true;
        return permissions[key] === true;
      };
      return {
        id: snapshot.id,
        role,
        active: data.active === true,
        permissions: {
          usersRead: hasPermission("usersRead"),
          usersWrite: hasPermission("usersWrite"),
          ordersRead: hasPermission("ordersRead"),
          productsWrite: hasPermission("productsWrite"),
          pagesWrite: hasPermission("pagesWrite")
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

    function listenRolePermissions(callback, onError) {
      return firestoreSdk.onSnapshot(
        firestoreSdk.doc(db, "settings", "rolePermissions"),
        (snapshot) => callback(normalizeRolePermissions(snapshot.exists() ? snapshot.data() : null)),
        onError
      );
    }

    async function updateRolePermission(featureKey, roleKey, value) {
      const feature = String(featureKey || "").trim();
      const role = String(roleKey || "").trim();
      if (!rolePermissionFeatures.includes(feature) || !rolePermissionKeys.includes(role)) {
        throw new Error("權限設定不正確。");
      }
      const rolePermissionRef = firestoreSdk.doc(db, "settings", "rolePermissions");
      const snapshot = await firestoreSdk.getDoc(rolePermissionRef);
      const permissions = normalizeRolePermissions(snapshot.exists() ? snapshot.data() : null);
      permissions[feature][role] = value === true;
      await firestoreSdk.setDoc(rolePermissionRef, {
        permissions,
        updatedAt: firestoreSdk.serverTimestamp(),
        updatedBy: auth.currentUser?.uid || ""
      }, { merge: false });
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
      const currentData = currentSnapshot.exists() ? currentSnapshot.data() || {} : {};
      const currentRole = normalizeRole(currentData.role);
      const hasLegacyDashboardRole = role?.active === true && isDashboardRole(role.role);
      const nextRole = !currentSnapshot.exists()
        ? (hasLegacyDashboardRole ? "super_admin" : "customer")
        : ((currentData.role === "merchant" || (hasLegacyDashboardRole && currentRole === "customer")) ? "super_admin" : currentRole);
      const payload = {
        uid,
        email: user.email || "",
        displayName: user.displayName || "",
        providerId: userProviderId(user),
        lastLoginAt: now,
        updatedAt: now,
        role: nextRole
      };
      if (!currentSnapshot.exists()) {
        payload.createdAt = now;
        payload.status = "active";
        payload.phone = "";
        payload.address = "";
        payload.gender = "";
        payload.birthday = "";
        payload.note = "";
        payload.tags = [];
      }
      await firestoreSdk.setDoc(userRef, payload, { merge: true });
      return { uid, ...payload };
    }

    async function updateUserProfile(userId, updates) {
      const uid = String(userId || "").trim();
      if (!uid) throw new Error("找不到用戶 UID。");
      const allowed = {};
      if ("displayName" in updates) allowed.displayName = String(updates.displayName || "").trim();
      if ("phone" in updates) allowed.phone = String(updates.phone || "").trim();
      if ("address" in updates) allowed.address = String(updates.address || "").trim();
      if ("birthday" in updates) allowed.birthday = String(updates.birthday || "").trim();
      if ("gender" in updates) allowed.gender = String(updates.gender || "").trim();
      if ("note" in updates) allowed.note = String(updates.note || "").trim();
      if ("tags" in updates) {
        allowed.tags = Array.isArray(updates.tags)
          ? updates.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
          : String(updates.tags || "").split(/[\n,]/).map((tag) => tag.trim()).filter(Boolean);
      }
      allowed.updatedAt = firestoreSdk.serverTimestamp();
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "users", uid), allowed, { merge: true });
      return { id: uid, ...allowed };
    }

    async function updateUserAccess(userId, updates) {
      const uid = String(userId || "").trim();
      if (!uid) throw new Error("找不到用戶 UID。");
      const allowed = {};
      if ("role" in updates) allowed.role = normalizeRole(updates.role);
      if ("status" in updates) allowed.status = String(updates.status || "active").trim() || "active";
      allowed.updatedAt = firestoreSdk.serverTimestamp();
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "users", uid), allowed, { merge: true });
      return { id: uid, ...allowed };
    }

    function generateInviteToken() {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    function normalizeInviteRecord(snapshot) {
      if (!snapshot.exists()) return null;
      const data = { id: snapshot.id, ...snapshot.data() };
      return {
        ...data,
        role: normalizeRole(data.role),
        email: String(data.email || "").trim().toLowerCase(),
        token: String(data.token || snapshot.id),
        status: String(data.status || "pending"),
        used: data.used === true,
        hidden: data.hidden === true,
        createdAt: normalizeTimestamp(data.createdAt),
        usedAt: normalizeTimestamp(data.usedAt),
        deletedAt: normalizeTimestamp(data.deletedAt)
      };
    }

    async function getUserInvite(token) {
      const normalizedToken = String(token || "").trim();
      if (!normalizedToken) return null;
      return normalizeInviteRecord(await firestoreSdk.getDoc(firestoreSdk.doc(db, "userInvites", normalizedToken)));
    }

    async function createUserInvite(email, role, createdBy) {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const normalizedRole = normalizeRole(role);
      if (!normalizedEmail) throw new Error("請輸入邀請電郵。");
      if (!["admin", "staff"].includes(normalizedRole)) throw new Error("只能邀請管理員或員工。");
      const token = generateInviteToken();
      const payload = {
        email: normalizedEmail,
        role: normalizedRole,
        token,
        createdBy: String(createdBy || auth.currentUser?.uid || ""),
        createdAt: firestoreSdk.serverTimestamp(),
        used: false,
        status: "pending"
      };
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "userInvites", token), payload);
      return { id: token, ...payload };
    }

    async function acceptUserInvite(token, user) {
      const normalizedToken = String(token || "").trim();
      if (!normalizedToken || !user?.uid) throw new Error("邀請資料不完整。");
      const invite = await getUserInvite(normalizedToken);
      const userEmail = String(user.email || "").trim().toLowerCase();
      if (!invite || invite.used || invite.status !== "pending") throw new Error("邀請連結無效或已使用。");
      if (invite.email !== userEmail) throw new Error("註冊電郵與邀請電郵不一致。");
      const batch = firestoreSdk.writeBatch(db);
      const now = firestoreSdk.serverTimestamp();
      const userRef = firestoreSdk.doc(db, "users", String(user.uid));
      const userSnapshot = await firestoreSdk.getDoc(userRef);
      const userPayload = {
        uid: String(user.uid),
        email: user.email || "",
        displayName: user.displayName || "",
        providerId: userProviderId(user),
        role: invite.role,
        status: "active",
        inviteToken: normalizedToken,
        updatedAt: now
      };
      if (!userSnapshot.exists()) userPayload.createdAt = now;
      batch.set(userRef, userPayload, { merge: true });
      batch.update(firestoreSdk.doc(db, "userInvites", normalizedToken), {
        used: true,
        status: "used",
        usedBy: String(user.uid),
        usedAt: now
      });
      await batch.commit();
      return invite;
    }

    function listenUserInvites(callback, onError) {
      return firestoreSdk.onSnapshot(
        firestoreSdk.collection(db, "userInvites"),
        (snapshot) => callback(
          snapshot.docs
            .map(normalizeInviteRecord)
            .filter(Boolean)
            .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        ),
        onError
      );
    }

    async function hideOrDeleteUserInvite(inviteId) {
      const normalizedId = String(inviteId || "").trim();
      if (!normalizedId) throw new Error("找不到邀請記錄 ID。");
      const allowed = {
        status: "deleted",
        hidden: true,
        deletedAt: firestoreSdk.serverTimestamp()
      };
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "userInvites", normalizedId), allowed, { merge: true });
      return { id: normalizedId, ...allowed };
    }

    async function updateCurrentUserProfile(updates) {
      const user = auth.currentUser;
      if (!user?.uid) throw new Error("請先登入。");
      const uid = String(user.uid);
      const allowed = {};
      const nextDisplayName = "displayName" in updates ? String(updates.displayName || "").trim() : null;
      if (nextDisplayName !== null) allowed.displayName = nextDisplayName;
      if ("phone" in updates) allowed.phone = String(updates.phone || "").trim();
      if ("address" in updates) allowed.address = String(updates.address || "").trim();
      if ("gender" in updates) allowed.gender = String(updates.gender || "").trim();
      if ("birthday" in updates) allowed.birthday = String(updates.birthday || "").trim();
      allowed.updatedAt = firestoreSdk.serverTimestamp();
      if (nextDisplayName !== null) {
        await authSdk.updateProfile(user, { displayName: nextDisplayName });
      }
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "users", uid), allowed, { merge: true });
      return { id: uid, ...allowed };
    }

    async function updateCurrentUserEmail(newEmail) {
      const user = auth.currentUser;
      const email = String(newEmail || "").trim();
      if (!user?.uid) throw new Error("請先登入。");
      if (!email) throw new Error("請輸入電郵。");
      await authSdk.updateEmail(user, email);
      await firestoreSdk.setDoc(
        firestoreSdk.doc(db, "users", String(user.uid)),
        {
          email,
          providerId: userProviderId(auth.currentUser || user),
          updatedAt: firestoreSdk.serverTimestamp()
        },
        { merge: true }
      );
      return email;
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

    function mergeOrderSnapshots(callback) {
      return (snapshots) => {
        const merged = new Map();
        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnapshot) => {
            merged.set(docSnapshot.id, normalizeOrderRecord(docSnapshot));
          });
        });
        callback(Array.from(merged.values()).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
      };
    }

    function combineOrderListeners(listeners) {
      return () => {
        listeners.forEach((unsubscribe) => {
          try {
            unsubscribe?.();
          } catch (error) {
            console.warn("Unable to stop order listener.", error);
          }
        });
      };
    }

    function listenCurrentUserOrders(userId, email, callback, onError) {
      const listeners = [];
      const snapshots = [];
      const emit = mergeOrderSnapshots(callback);
      if (userId) {
        const queryByCustomerUid = firestoreSdk.query(
          firestoreSdk.collection(db, "orders"),
          firestoreSdk.where("customerUid", "==", String(userId))
        );
        listeners.push(firestoreSdk.onSnapshot(queryByCustomerUid, (snapshot) => {
          snapshots[0] = snapshot;
          emit(snapshots.filter(Boolean));
        }, onError));
        const queryByUser = firestoreSdk.query(
          firestoreSdk.collection(db, "orders"),
          firestoreSdk.where("userId", "==", String(userId))
        );
        listeners.push(firestoreSdk.onSnapshot(queryByUser, (snapshot) => {
          snapshots[1] = snapshot;
          emit(snapshots.filter(Boolean));
        }, onError));
      }
      if (email) {
        const queryByEmail = firestoreSdk.query(
          firestoreSdk.collection(db, "orders"),
          firestoreSdk.where("customerEmail", "==", String(email))
        );
        listeners.push(firestoreSdk.onSnapshot(queryByEmail, (snapshot) => {
          snapshots[2] = snapshot;
          emit(snapshots.filter(Boolean));
        }, onError));
      }
      return combineOrderListeners(listeners);
    }

    function listenOrdersByCustomer(userId, email, callback, onError) {
      return listenCurrentUserOrders(userId, email, callback, onError);
    }

    async function createOrder(orderData) {
      const payload = {
        orderNumber: String(orderData.orderNumber || "").trim(),
        customerUid: String(orderData.customerUid || "").trim(),
        customerEmail: String(orderData.customerEmail || "").trim(),
        customerName: String(orderData.customerName || "").trim(),
        customerPhone: String(orderData.customerPhone || "").trim(),
        recipientName: String(orderData.recipientName || "").trim(),
        recipientPhone: String(orderData.recipientPhone || "").trim(),
        deliveryMethod: orderData.deliveryMethod === "delivery" ? "delivery" : "pickup",
        deliveryAddress: String(orderData.deliveryAddress || "").trim(),
        items: Array.isArray(orderData.items) ? orderData.items : [],
        subtotal: Number(orderData.subtotal || 0),
        discount: Number(orderData.discount || 0),
        shippingFee: Number(orderData.shippingFee || 0),
        extraFee: Number(orderData.extraFee || 0),
        total: Number(orderData.total || 0),
        paymentMethod: "credit_card",
        paymentStatus: "mock_paid",
        status: "pending",
        note: String(orderData.note || "").trim(),
        createdAt: firestoreSdk.serverTimestamp()
      };
      if (!payload.orderNumber) throw new Error("訂單編號無效。");
      if (!payload.customerUid) throw new Error("請先登入再提交訂單。");
      if (!payload.customerEmail) throw new Error("請填寫顧客電郵。");
      if (!payload.customerName) throw new Error("請填寫顧客名稱。");
      if (!payload.recipientName) throw new Error("請填寫收件人名稱。");
      if (!payload.recipientPhone) throw new Error("請填寫收件人聯絡電話。");
      if (payload.deliveryMethod === "delivery" && !payload.deliveryAddress) {
        throw new Error("送貨上門需要填寫收貨地址。");
      }
      if (!payload.items.length) throw new Error("購物車暫時沒有商品。");
      const docRef = await firestoreSdk.addDoc(firestoreSdk.collection(db, "orders"), payload);
      return { id: docRef.id, ...payload };
    }

    async function updateOrder(orderId, updates) {
      const normalizedId = String(orderId || "").trim();
      if (!normalizedId) throw new Error("找不到訂單 ID。");
      const allowed = {};
      if ("status" in updates) allowed.status = String(updates.status || "").trim() || "pending";
      if ("merchantNote" in updates) allowed.merchantNote = String(updates.merchantNote || "").trim();
      allowed.updatedAt = firestoreSdk.serverTimestamp();
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "orders", normalizedId), allowed, { merge: true });
      return { id: normalizedId, ...allowed };
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
      getDefaultRolePermissions,
      listenRolePermissions,
      updateRolePermission,
      getUserProfile,
      upsertCurrentUserProfile,
      updateUserProfile,
      updateUserAccess,
      updateCurrentUserProfile,
      updateCurrentUserEmail,
      listenUsers,
      listenUserProfile,
      listenOrders,
      listenCurrentUserOrders,
      listenOrdersByCustomer,
      createOrder,
      updateOrder,
      createUserInvite,
      listenUserInvites,
      hideOrDeleteUserInvite,
      getUserInvite,
      acceptUserInvite,
      uploadProductImage,
      deleteProductImage,
      isManagedStorageUrl
    };

    window.onlineShopFirebase = service;
    window.dispatchEvent(new CustomEvent("online-shop-firebase-ready", { detail: service }));
    return service;
  })();
})();
