const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

const app = admin.apps.length ? admin.app() : admin.initializeApp();
const databaseId = process.env.FIRESTORE_DATABASE_ID || "scentsation";
const db = getFirestore(app, databaseId);

const requiredLiveEnv = [
  "KPAY_CREATE_PAYMENT_URL",
  "KPAY_MERCHANT_ID",
  "KPAY_API_KEY",
  "KPAY_API_SECRET",
  "KPAY_RETURN_URL",
  "KPAY_WEBHOOK_URL"
];

function normalizeOrderId(value) {
  return String(value || "").trim();
}

function kpayMode() {
  return String(process.env.KPAY_MODE || "mock").trim().toLowerCase();
}

function mockPayment(orderId) {
  return {
    paymentId: `mock_${orderId}_${Date.now()}`,
    orderId,
    status: "mock",
    redirectUrl: null
  };
}

function assertLiveKpayConfig() {
  const missing = requiredLiveEnv.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "KPay configuration is incomplete."
    );
  }
}

async function createLiveKpayPayment() {
  // Official KPay request mapping and signature rules must be added here.
  // Do not guess endpoint payloads or expose secrets to the frontend.
  throw new functions.https.HttpsError(
    "failed-precondition",
    "KPay live adapter is not configured with official API mapping."
  );
}

exports.createKpayPayment = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Please sign in before creating payment.");
  }

  const orderId = normalizeOrderId(data?.orderId);
  if (!orderId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing orderId.");
  }

  const orderSnapshot = await db.collection("orders").doc(orderId).get();
  if (!orderSnapshot.exists) {
    throw new functions.https.HttpsError("not-found", "Order not found.");
  }

  const order = orderSnapshot.data() || {};
  if (String(order.customerUid || "") !== uid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You can only create payment for your own order."
    );
  }

  if (kpayMode() !== "live") {
    return mockPayment(orderId);
  }

  assertLiveKpayConfig();
  return createLiveKpayPayment({ orderId, order, uid });
});

exports.kpayWebhook = functions.https.onRequest((request, response) => {
  response.status(501).json({
    error: "KPay webhook signature verification is not configured with official API documentation."
  });
});
