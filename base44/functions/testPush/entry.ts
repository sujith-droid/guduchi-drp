import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { sendPushToUser } from '../../shared/firebase-push.ts';

// Temporary diagnostic: sends one test push + in-app notification to a user.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();
    if (!email) return Response.json({ error: 'email is required' }, { status: 400 });

    const title = 'Test notification';
    const body = 'Guduchi DRP test push — ' + new Date().toISOString();

    await base44.asServiceRole.entities.Notification.create({
      user_email: email,
      title,
      message: body,
      type: 'info',
    });

    const push = await sendPushToUser(base44, email, title, body, { url: '/notifications' });

    return Response.json({ email, push });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});