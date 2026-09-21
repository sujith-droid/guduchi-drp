// The app treats the platform default role "user" and the app role "patient"
// as the same thing. Use these helpers anywhere a role is checked or displayed
// so both names behave identically.

export function isPatientRole(role) {
  return role === "patient" || role === "user";
}

export function isAdminRole(role) {
  return role === "admin";
}

export function isSubadminRole(role) {
  return role === "subadmin";
}

export function isViewerRole(role) {
  return role === "viewer";
}

export function isAdminOrSubadmin(role) {
  return role === "admin" || role === "subadmin";
}

export function roleDisplayLabel(role) {
  if (role === "doctor") return "Health Coach";
  if (role === "viewer") return "Doctor";
  if (role === "admin") return "Admin";
  if (role === "subadmin") return "Subadmin";
  return "Patient"; // "patient" and "user" both display as "Patient"
}