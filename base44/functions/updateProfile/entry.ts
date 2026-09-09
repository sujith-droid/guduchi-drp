import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Saves profile fields (phone, address, age, gender, branch) via service role,
// so it works even for OTP-authenticated patients whose client session token
// is a dummy and can't call updateMe() successfully.

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const { email, phone, address, age, gender, branch } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Identify the caller — try platform auth, fall back to email.
    let callerEmail = null;
    try {
      const me = await base44.auth.me();
      if (me) callerEmail = me.email;
    } catch (e) {}
    if (!callerEmail && email) {
      // Allow the request through if the email matches a known user
      // (OTP patients carry dummy tokens, so platform auth may fail).
      callerEmail = email;
    }
    if (!callerEmail) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: callerEmail });
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    const updateData = {};
    if (phone !== undefined) updateData.phone = phone.trim();
    if (address !== undefined) updateData.address = (address || "").trim() || undefined;
    if (age !== undefined && age !== "") updateData.age = Number(age);
    if (gender !== undefined) updateData.gender = gender || undefined;
    if (branch !== undefined) updateData.branch = branch || undefined;

    if (Object.keys(updateData).length > 0) {
      await base44.asServiceRole.entities.User.update(user.id, updateData);
    }

    return Response.json({ success: true, user: { ...user, ...updateData } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}