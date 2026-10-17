import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { normalizeFilterResult } from '../../shared/pagination.ts';

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);

    const { search = '', skip = 0 } = await req.json();
    const offset = Number.isSafeInteger(skip) && skip >= 0 ? skip : 0;
    const query = { role: 'doctor' };
    const term = typeof search === 'string' ? search.trim() : '';
    if (term) {
      const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = ['full_name', 'specialty', 'city', 'email'].map((field) => ({
        [field]: { $regex: pattern, $options: 'i' },
      }));
    }
    // User only supports positional pagination, not options-form cursor pages.
    const users = normalizeFilterResult(await base44.asServiceRole.entities.User.filter(query, '-created_date', 51, offset));

    const doctors = users.slice(0, 50)
      .filter((u) => u.email)
      .map((u) => ({
        email: u.email,
        full_name: u.full_name || null,
        specialty: u.specialty || null,
        city: u.city || null,
      }));

    return Response.json({ doctors, has_more: users.length > 50, next_skip: offset + 50 });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}