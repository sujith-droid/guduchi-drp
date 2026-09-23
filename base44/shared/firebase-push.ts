// Shared Firebase Cloud Messaging helper — initializes firebase-admin from
// the FIREBASE_SERVICE_ACCOUNT_JSON secret and sends push notifications to a
// user's registered device tokens. Used by patientApi/doctorApi when a chat
// message is sent so the receiver gets a native push.

import { secrets } from "base44:runtime";
import admin from "npm:firebase-admin@12.6.0";

let initialized = false;

function getAdmin() {
  if (initialized) return admin;
  const serviceAccountJson = secrets.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) return null;
  const serviceAccount = JSON.parse(serviceAccountJson);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  initialized = true;
  return admin;
}

// Sends a push notification to userEmail across all channels:
//   1. Web browsers — via Firebase Admin (FCM) using DeviceToken records.
//   2. Native mobile app — via Base44 SendPushNotification integration,
//      which reaches the installed iOS/Android app. The native app's FCM/APNs
//      token is managed by the platform, NOT stored in DeviceToken, so this
//      path is required for mobile users (the WebView cannot register a web
//      FCM token).
// Returns { sent, failed, native } — never throws (push failures must not
// break chat).
export async function sendPushToUser(base44, userEmail, title, body, data = {}) {
  const result = { sent: 0, failed: 0, native: false };

  // FCM data payload values must be strings
  const stringData = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = String(v);
  }

  // 1. Web push — send to every registered browser device token.
  try {
    const fbAdmin = getAdmin();
    if (fbAdmin) {
      const tokens = await base44.asServiceRole.entities.DeviceToken.filter(
        { user_email: userEmail },
        "-created_date",
        100
      );
      if (tokens && tokens.length > 0) {
        const results = await Promise.all(
          tokens.map((t) =>
            fbAdmin
              .messaging()
              .send({
                notification: { title, body },
                data: stringData,
                token: t.token,
                webpush: {
                  notification: { title, body, icon: "/icon.png", click_action: stringData.url || "/chat" },
                },
              })
              .catch((err) => ({ error: err }))
          )
        );
        for (let i = 0; i < results.length; i++) {
          if (results[i]?.error) {
            result.failed++;
            const errCode = results[i].error.code;
            if (errCode === "messaging/invalid-registration-token" || errCode === "messaging/registration-token-not-registered" || errCode === "messaging/invalid-argument") {
              await base44.asServiceRole.entities.DeviceToken.delete(tokens[i].id).catch(() => {});
            }
          } else {
            result.sent++;
          }
        }
      }
    }
  } catch (e) {
    // web push failure must not block native push
  }

  // 2. Native mobile push — reach the installed iOS/Android app. The platform
  //    manages the native token; we only need the Base44 user id. Fails
  //    silently for web-only users (no native build/install).
  try {
    const users = await base44.asServiceRole.entities.User.filter(
      { email: userEmail },
      undefined,
      1
    );
    if (users.length > 0) {
      await base44.asServiceRole.integrations.Core.SendPushNotification({
        user_id: users[0].id,
        title,
        content: body,
        action_label: stringData.url ? "View" : undefined,
        action_url: stringData.url || undefined,
      });
      result.native = true;
    }
  } catch (e) {
    // native push unavailable (no native build / credentials) — ignore
  }

  return result;
}