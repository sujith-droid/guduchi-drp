import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Notifications have row-level security (user_email == logged-in user). Mobile-OTP
// users carry a dummy token the platform doesn't recognize, so direct entity
// reads/updates return nothing. This function resolves the caller's email from
// their AdminSession token (falling back to platform auth) and performs
// notification reads/updates server-side via the service role.

async function resolveEmail(base44, adminToken) {
  if (adminToken) {
    const sessions = await base44.asServiceRole.entities.AdminSession.filter({ token: adminToken, is_active: true });
    if (sessions[0] && new Date(sessions[0].expires_at) >= new Date()) return sessions[0].user_email;
  }
  try {
    const me = await base44.auth.me();
    if (me) return me.email;
  } catch {}
  return null;
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const { adminToken, action, id, ids } = await req.json();
    const email = await resolveEmail(base44, adminToken);
    if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    switch (action) {
      case 'list': {
        const notifs = await base44.asServiceRole.entities.Notification.filter({ user_email: email }, "-created_date", 50);
        return Response.json({ notifications: notifs });
      }
      case 'markRead': {
        if (id) await base44.asServiceRole.entities.Notification.update(id, { is_read: true });
        return Response.json({ success: true });
      }
      case 'markAllRead': {
        const list = Array.isArray(ids) ? ids : [];
        for (const i of list) await base44.asServiceRole.entities.Notification.update(i, { is_read: true });
        return Response.json({ success: true });
      }
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}