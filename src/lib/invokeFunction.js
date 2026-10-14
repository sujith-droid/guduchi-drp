import { appParams } from "@/lib/app-params";

// Call a backend function via direct fetch (not base44.functions.invoke) so the
// AdminSession UUID is NOT sent as a Bearer token in the Authorization
// header — the Base44 platform rejects that as 401 before the function runs.
// The adminToken is sent in the request body and validated server-side.
export const invokeFunction = async (fnName, payload) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`/api/apps/${appParams.appId}/functions/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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