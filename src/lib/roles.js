// The app treats the platform default role "user" and the app role "patient"
// as the same thing. Use these helpers anywhere a role is checked or displayed
// so both names behave identically.

export function isPatientRole(role) {
  return role === "patient" || role === "user";
}

export function roleDisplayLabel(role) {
  if (role === "doctor") return "Doctor";
  if (role === "admin") return "Admin";
  return "Patient"; // "patient" and "user" both display as "Patient"
}