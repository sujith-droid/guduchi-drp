import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);

    const users = await base44.asServiceRole.entities.User.filter({ role: "doctor" });

    const doctors = users
      .filter((u) => u.email)
      .map((u) => ({
        email: u.email,
        full_name: u.full_name || null,
        specialty: u.specialty || null,
        city: u.city || null,
      }));

    return Response.json({ doctors });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}