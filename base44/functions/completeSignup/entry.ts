import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const { email, phone, role, full_name } = await req.json();

    if (!email || !phone) {
      return Response.json({ error: 'Email and phone are required' }, { status: 400 });
    }

    // Find the just-registered user by email
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (users.length === 0) {
      return Response.json({ error: 'User not found. Please complete registration first.' }, { status: 404 });
    }
    const user = users[0];

    // Build the update payload — phone, role, patient_id, profile_complete,
    // signup_date, and full_name are all set here because platform register()
    // only persists email/password/full_name (and full_name defaults to the
    // email prefix, not the name the user typed).
    const updateData = {
      phone,
      role: (!user.role || user.role === 'user') ? (role || 'patient') : user.role,
      patient_id: user.patient_id || `DRP-${Date.now().toString(36).toUpperCase()}`,
      profile_complete: false,
      signup_date: new Date().toISOString()
    };
    if (full_name) updateData.full_name = full_name;

    await base44.asServiceRole.entities.User.update(user.id, updateData);

    return Response.json({ success: true });
  } catch (error) {
    console.error('completeSignup error:', JSON.stringify({ message: error.message, stack: error.stack, name: error.name }));
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});