import { appParams } from "@/lib/app-params";

// Call a backend function via direct fetch (not base44.functions.invoke) so the
// AdminSession UUID is NOT sent as a Bearer token in the Authorization
// header — the Base44 platform rejects that as 401 before the function runs.
// The adminToken is sent in the request body and validated server-side.
export const invokeFunction = async (fnName, payload) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    // Send the platform Bearer token so platform-authenticated users (builder,
    // invited admins/doctors) pass the server-side auth.me() fallback in
    // validateAdminToken. Skip it for OTP users — their admin_session_token
    // UUID is stored as base44_access_token by setToken() and the platform
    // rejects it with 401; OTP users authenticate via adminToken in the body.
    const adminSessionToken = localStorage.getItem("admin_session_token");
    if (!adminSessionToken) {
      const platformToken = localStorage.getItem("base44_access_token");
      if (platformToken) headers['Authorization'] = `Bearer ${platformToken}`;
    }
    const response = await fetch(`/api/apps/${appParams.appId}/functions/${fnName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await response.json();
    if (!response.ok || data.error) {
      const err = new Error(data.error || `Request failed with status ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return data;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
};