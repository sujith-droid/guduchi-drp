import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { validateAdminToken } from '../../shared/admin-session.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken } = await req.json();
    await validateAdminToken(base44, adminToken);

    const [users, assignments, templates] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 200),
      base44.asServiceRole.entities.PatientDoctorAssignment.filter({ status: 'active' }),
      base44.asServiceRole.entities.MessageTemplate.list('-created_date', 100),
    ]);

    return Response.json({ users, assignments, templates });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}