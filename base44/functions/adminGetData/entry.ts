import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { validateAdminToken } from '../../shared/admin-session.ts';
import { listAll, filterAll } from '../../shared/pagination.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken } = await req.json();
    await validateAdminToken(base44, adminToken);

    const [users, assignments, templates, onboardingMessages] = await Promise.all([
      listAll(base44.asServiceRole.entities.User, '-created_date'),
      filterAll(base44.asServiceRole.entities.PatientDoctorAssignment, { status: 'active' }),
      listAll(base44.asServiceRole.entities.MessageTemplate, '-created_date'),
      listAll(base44.asServiceRole.entities.OnboardingMessage, 'sequence'),
    ]);

    return Response.json({ users, assignments, templates, onboardingMessages });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}