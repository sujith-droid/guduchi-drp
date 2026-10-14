import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken } = await req.json();

    // Validate via base44.auth.me() — this uses the Bearer token from the
    // incoming request (the AdminSession UUID is accepted by the platform
    // for entity endpoints, as evidenced by /entities/User/me returning 200).
    // asServiceRole does NOT work without a real platform token, so we can't
    // use it to look up AdminSession records directly.
    let me;
    try {
      me = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!me || (me.role !== 'admin' && me.role !== 'subadmin' && !me.email?.includes('sujith@guduchiayurveda'))) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use the regular entity client (not asServiceRole) — the Bearer token
    // is accepted by the platform and RLS allows admins to read all records.
    const [users, assignments, templates, onboardingMessages] = await Promise.all([
      base44.entities.User.list({ sort: '-created_date', limit: 500 }),
      base44.entities.PatientDoctorAssignment.filter({ status: 'active' }, { sort: '-created_date', limit: 500 }),
      base44.entities.MessageTemplate.filter({}, { sort: '-created_date', limit: 500 }),
      base44.entities.OnboardingMessage.filter({}, { sort: 'sequence', limit: 500 }),
    ]);

    const slimUsers = (users.items || users).map((u: any) => ({
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