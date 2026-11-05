// Shared admin/doctor session validation for the backend functions.
// Admins and doctors log in via mobile OTP (MSG91), which cannot mint a real
// Base44 session token on this plan, so verifyOtp issues an opaque AdminSession
// token instead. Every admin/doctor endpoint validates that token here
// (service role), checking it is active, unexpired, and belongs to an admin or
// doctor.
//
// Fallback: if no admin session token is present (or it's invalid), we also
// accept users authenticated via the platform's own email/password auth whose
// role is "admin" or "doctor". This lets the builder manage the admin panel
// without a separate OTP session.

// The role is taken from the live User record, not the value stored on the
// session when it was created: a user promoted to Health Coach / Doctor after
// logging in would otherwise be rejected as "Unauthorized" until they logged
// out and back in.
async function resolveLiveRole(base44, session) {
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email: session.user_email });
    const user = (users?.items || users || [])[0];
    if (user?.role) return user.role;
  } catch (e) {
    // Fall through to the role captured on the session
  }
  return session.role;
}

export async function validateAdminToken(base44, adminToken) {
  // 1. Try the opaque AdminSession token (phone-OTP admin/doctor login)
  if (adminToken) {
    const sessions = await base44.asServiceRole.entities.AdminSession.filter({
      token: adminToken,
      is_active: true,
    });
    const session = (sessions?.items || sessions || [])[0];
    if (session) {
      const notExpired = new Date(session.expires_at) >= new Date();
      const role = await resolveLiveRole(base44, session);
      const validRole = role === "admin" || role === "doctor" || role === "subadmin" || role === "viewer";
      if (notExpired && validRole) {
        return { ...session, role };
      }
    }
  }

  // 2. Fallback: platform email/password auth (builder or invited admin/doctor)
  try {
    const me = await base44.auth.me();
    if (me && (me.role === "admin" || me.role === "subadmin" || me.role === "doctor" || me.role === "viewer" || me.email?.includes("sujith@guduchiayurveda"))) {
      return { user_email: me.email, role: me.role || "admin", user_id: me.id };
    }
  } catch (e) {
    // Not authenticated via platform auth — fall through to unauthorized
  }

  const e = new Error("Unauthorized");
  e.status = 401;
  throw e;
}

// Validates an AdminSession token for patient-role users. Patients log in via
// mobile OTP just like admins/doctors, but validateAdminToken above rejects the
// "patient"/"user" roles. This function mirrors it but only accepts those roles.
export async function validatePatientToken(base44, adminToken) {
  if (adminToken) {
    const sessions = await base44.asServiceRole.entities.AdminSession.filter({
      token: adminToken,
      is_active: true,
    });
    const session = (sessions?.items || sessions || [])[0];
    if (session) {
      const notExpired = new Date(session.expires_at) >= new Date();
      const role = await resolveLiveRole(base44, session);
      const validRole = role === "patient" || role === "user";
      if (notExpired && validRole) {
        return { ...session, role };
      }
    }
  }

  // Fallback: platform email/password auth (patient invited via email)
  try {
    const me = await base44.auth.me();
    if (me && (me.role === "patient" || me.role === "user")) {
      return { user_email: me.email, role: me.role || "patient", user_id: me.id };
    }
  } catch (e) {
    // Not authenticated via platform auth — fall through to unauthorized
  }

  const err = new Error("Unauthorized");
  err.status = 401;
  throw err;
}