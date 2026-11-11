import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { sendPushToUser } from '../../shared/firebase-push.ts';

// Temporary: sends one push notification to a single user by phone number.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { phone, title, message } = await req.json();
    const norm = (p) => (p || '').replace(/\D/g, '').slice(-10);

    let target = null;
    for (let skip = 0; !target; skip += 200) {
      const page = await base44.asServiceRole.entities.User.filter({}, '-created_date', 200, skip);
      for (const u of page) if (norm(u.phone) === norm(phone)) target = u;
      if (page.length < 200) break;
    }
    if (!target) return Response.json({ error: 'user not found' }, { status: 404 });

    const tokens = await base44.asServiceRole.entities.DeviceToken.filter(
      { user_email: target.email },
      '-created_date',
      20
    );
    const push = await sendPushToUser(base44, target.email, title || 'Guduchi', message, {
      url: '/notifications',
    });

    return Response.json({
      email: target.email,
      deviceTokens: tokens.map((t) => t.platform),
      push,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});