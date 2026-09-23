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

// Sends a push notification to every device token registered by userEmail.
// Returns { sent, failed } — never throws (push failures must not break chat).
export async function sendPushToUser(base44, userEmail, title, body, data = {}) {
  try {
    const fbAdmin = getAdmin();
    if (!fbAdmin) return { sent: 0, reason: "firebase_not_configured" };

    const tokens = await base44.asServiceRole.entities.DeviceToken.filter(
      { user_email: userEmail },
      "-created_date",
      100
    );
    if (!tokens || tokens.length === 0) return { sent: 0, reason: "no_tokens" };

    // FCM data payload values must be strings
    const stringData = {};
    for (const [k, v] of Object.entries(data)) {
      stringData[k] = String(v);
    }

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

    // Remove invalid/expired tokens
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i]?.error) {
        failed++;
        const errCode = results[i].error.code;
        // UNREGISTERED / invalid-token → delete the stale token
        if (errCode === "messaging/invalid-registration-token" || errCode === "messaging/registration-token-not-registered" || errCode === "messaging/invalid-argument") {
          await base44.asServiceRole.entities.DeviceToken.delete(tokens[i].id).catch(() => {});
        }
      } else {
        sent++;
      }
    }
    return { sent, failed };
  } catch (e) {
    return { sent: 0, error: e.message };
  }
}