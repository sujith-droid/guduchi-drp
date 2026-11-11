import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { validatePatientToken, validateAdminToken } from '../../shared/admin-session.ts';
import { sendPushToUser } from '../../shared/firebase-push.ts';

// Sends a test push notification to the CALLER only (never to another user),
// so a user can check from their own device whether notifications arrive.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken } = await req.json().catch(() => ({}));

    let session = null;
    try {
      session = await validatePatientToken(base44, adminToken);
    } catch {
      session = await validateAdminToken(base44, adminToken);
    }

    const email = session.user_email;
    const title = 'Test notification';
    const body = 'If you can see this, notifications are working on this device.';

    const devices = await base44.asServiceRole.entities.DeviceToken.filter(
      { user_email: email },
      '-created_date',
      50
    );

    await base44.asServiceRole.entities.Notification.create({
      user_email: email,
      title,
      message: body,
      type: 'info',
    });

    const push = await sendPushToUser(base44, email, title, body, { url: '/notifications' });

    return Response.json({ email, devices: (devices || []).length, ...push });
  } catch (error) {
    return Response.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}