import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import admin from 'npm:firebase-admin@12.6.0';

// Temporary diagnostic: reports exactly what FCM and the native push API answer.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, title, body } = await req.json();

  const out = { email, title, web: null, native: null };

  // Web (FCM) — raw result per device token.
  const tokens = await base44.asServiceRole.entities.DeviceToken.filter(
    { user_email: email },
    '-created_date',
    20
  );
  out.tokenCount = tokens.length;
  out.web = [];
  try {
    const sa = JSON.parse(secrets.get('FIREBASE_SERVICE_ACCOUNT_JSON'));
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
    for (const t of tokens) {
      try {
        const id = await admin.messaging().send({
          notification: { title, body },
          data: { url: '/notifications' },
          token: t.token,
          webpush: {
            notification: { title, body, tag: 'diag-' + Date.now() },
            fcm_options: { link: '/notifications' },
          },
        });
        out.web.push({ platform: t.platform, messageId: id });
      } catch (e) {
        out.web.push({ platform: t.platform, error: e.code || e.message });
      }
    }
  } catch (e) {
    out.web = { setupError: e.message };
  }

  // Native app push — raw platform response.
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email }, undefined, 1);
    out.native = await base44.asServiceRole.integrations.Core.SendPushNotification({
      user_id: users[0].id,
      title,
      content: body,
      action_label: 'View',
      action_url: '/notifications',
    });
  } catch (e) {
    out.native = { error: e.message };
  }

  return Response.json(out);
});