import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';
import { listAll } from '../../shared/pagination.ts';
import { validateAdminToken } from '../../shared/admin-session.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken } = await req.json();
    const session = await validateAdminToken(base44, adminToken);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin' && session.role !== 'subadmin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allUsers = await listAll(base44.asServiceRole.entities.User, '-created_date');
    return Response.json({ users: allUsers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}