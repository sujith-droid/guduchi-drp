import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken } = await req.json();

    // Validate the session token (accepts any role — this just restores the
    // logged-in user; admin/doctor endpoints still enforce role via
    // validateAdminToken).
    if (!adminToken) {
      return Response.json({ error: 'No session token provided' }, { status: 401 });
    }
    const sessions = await base44.asServiceRole.entities.AdminSession.filter({
      token: adminToken,
      is_active: true,
    });
    if (!sessions || sessions.length === 0) {
      return Response.json({ error: 'Invalid or expired session' }, { status: 401 });
    }
    const session = sessions[0];
    const notExpired = new Date(session.expires_at) >= new Date();
    if (!notExpired) {
      return Response.json({ error: 'Session expired' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: session.user_email });
    const user = users && users[0];
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
    return Response.json({ user });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}