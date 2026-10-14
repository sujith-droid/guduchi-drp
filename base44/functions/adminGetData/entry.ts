import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';
import { listAll } from '../../shared/pagination.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken } = await req.json();

    // Validate the caller via base44.auth.me() — the AdminSession UUID in the
    // Bearer header is accepted by the platform for auth endpoints.
    let me;
    try {
      me = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!me || (me.role !== 'admin' && me.role !== 'subadmin' && !me.email?.includes('sujith@guduchiayurveda'))) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // User entity requires service role to list all users (regular users can
    // only read their own record). asServiceRole uses the app's service token,
    // which is available in backend function context.
    // Other entities use the regular client (Bearer token accepted by platform).
    const [allUsers, assignments, templates, onboardingMessages] = await Promise.all([
      listAll(base44.asServiceRole.entities.User, '-created_date'),
      base44.entities.PatientDoctorAssignment.filter({ status: 'active' }, { sort: '-created_date', limit: 500 }),
      base44.entities.MessageTemplate.filter({}, { sort: '-created_date', limit: 500 }),
      base44.entities.OnboardingMessage.filter({}, { sort: 'sequence', limit: 500 }),
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