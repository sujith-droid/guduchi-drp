import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';
import { listAll, filterAll } from '../../shared/pagination.ts';
import { validateAdminToken } from '../../shared/admin-session.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken } = await req.json();

    const session = await validateAdminToken(base44, adminToken);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = session.role;
    if (role !== 'admin' && role !== 'subadmin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // OTP-authenticated admins have an AdminSession UUID, not a platform token,
    // so all entity reads must go through the service role.
    const [allUsers, assignments, templates, onboardingMessages] = await Promise.all([
      listAll(base44.asServiceRole.entities.User, '-created_date'),
      filterAll(base44.asServiceRole.entities.PatientDoctorAssignment, { status: 'active' }, '-created_date'),
      base44.asServiceRole.entities.MessageTemplate.filter({}, { sort: '-created_date', limit: 500 }),
      base44.asServiceRole.entities.OnboardingMessage.filter({}, { sort: 'sequence', limit: 500 }),
    ]);

    const slimUsers = allUsers.map((u: any) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      display_name: u.display_name,
      phone: u.phone,
      role: u.role,
      profile_complete: u.profile_complete,
      created_date: u.created_date,
    }));

    return Response.json({
      users: slimUsers,
      assignments: (assignments.items || assignments),
      templates: (templates.items || templates),
      onboardingMessages: (onboardingMessages.items || onboardingMessages),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}