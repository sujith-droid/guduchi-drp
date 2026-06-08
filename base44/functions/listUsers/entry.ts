import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin users can list all users
    if (user.role !== 'admin' && !user.email?.includes('sujith@guduchiayurveda')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
    return Response.json({ users: allUsers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});