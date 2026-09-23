import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { validatePatientToken, validateAdminToken } from '../../shared/admin-session.ts';

// Registers/unregisters FCM device tokens for push notifications.
// Works for both patient-role and admin/doctor-role users — tries patient
// token validation first, falls back to admin token validation.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { adminToken, action, token, platform } = body;

    let userEmail = null;
    if (adminToken) {
      try {
        const session = await validatePatientToken(base44, adminToken);
        userEmail = session.user_email;
      } catch {
        const session = await validateAdminToken(base44, adminToken);
        userEmail = session.user_email;
      }
    }

    if (!userEmail) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'registerToken') {
      if (!token) return Response.json({ error: 'token is required' }, { status: 400 });
      const resolvedPlatform = platform || 'web';
      // Keep only one token per user: delete all previously registered tokens
      // for this user (old devices/browsers) before inserting the new one.
      // This prevents duplicate DeviceToken rows accumulating across logins.
      const oldTokens = await base44.asServiceRole.entities.DeviceToken.filter(
        { user_email: userEmail },
        undefined,
        100
      );
      for (const t of oldTokens) {
        await base44.asServiceRole.entities.DeviceToken.delete(t.id).catch(() => {});
      }
      await base44.asServiceRole.entities.DeviceToken.create({
        user_email: userEmail,
        token,
        platform: resolvedPlatform,
      });
      return Response.json({ success: true });
    }

    if (action === 'unregisterToken') {
      if (!token) return Response.json({ error: 'token is required' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.DeviceToken.filter(
        { user_email: userEmail, token },
        undefined,
        10
      );
      for (const t of existing) {
        await base44.asServiceRole.entities.DeviceToken.delete(t.id).catch(() => {});
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}