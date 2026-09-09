import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

    const updateData = {};
    // Set phone only if not already set (prevents hijacking an existing account's phone)
    if (!user.phone) updateData.phone = phone;
    // Promote the platform default role ('user') to the app default ('patient'); never downgrade doctor/admin
    if (!user.role || user.role === 'user') updateData.role = role || 'patient';
    // Generate a unique patient_id at signup so it exists from the start
    if (!user.patient_id) updateData.patient_id = `DRP-${Date.now().toString(36).toUpperCase()}`;
    // Explicitly store profile_complete=false so the ProfileSetup step is triggered after login
    if (user.profile_complete === undefined || user.profile_complete === null) {
      updateData.profile_complete = false;
    }

    if (Object.keys(updateData).length > 0) {
      await base44.asServiceRole.entities.User.update(user.id, updateData);
    }

    // Best-effort: register() ignores full_name and updateMe can't change it, so set it via service role.
    if (full_name && !user.full_name) {
      try {
        await base44.asServiceRole.entities.User.update(user.id, { full_name });
      } catch (e) {
        console.error('Could not set full_name:', e);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});