import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { validateAdminToken } from '../../shared/admin-session.ts';
import { sendPushToUser } from '../../shared/firebase-push.ts';

// Broadcasts a push notification to every patient account, reminding them to
// send a photo of their lunch plate to their health coach.
// Admin only (Health Coaches / Doctors cannot broadcast).
const DEFAULT_TITLE = 'Lunch plate photo';
const DEFAULT_MESSAGE =
  "Please share a photo of today's lunch plate with your health coach. It helps your coach fine-tune your plan.";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    let session;
    try {
      session = await validateAdminToken(base44, payload.adminToken);
    } catch (e) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'admin' && session.role !== 'subadmin') {
      return Response.json({ error: 'Only an admin can broadcast to patients' }, { status: 403 });
    }

    const title = String(payload.title || DEFAULT_TITLE).trim();
    const message = String(payload.message || DEFAULT_MESSAGE).trim();

    // Every patient account — the platform default role "user" is a patient too.
    const patients: any[] = [];
    for (let skip = 0; ; skip += 200) {
      const page = await base44.asServiceRole.entities.User.filter({}, '-created_date', 200, skip);
      const items = page?.items || page || [];
      for (const u of items) {
        if ((u.role === 'patient' || u.role === 'user' || !u.role) && u.email) {
          patients.push(u);
        }
      }
      if (items.length < 200) break;
    }

    if (payload.dryRun) {
      return Response.json({ dryRun: true, recipients: patients.length, title, message });
    }

    let pushed = 0;
    let failed = 0;
    // Batches of 6 keep within the worker's connection limit.
    for (let i = 0; i < patients.length; i += 6) {
      const batch = patients.slice(i, i + 6);
      const results = await Promise.allSettled(
        batch.map((p) =>
          sendPushToUser(base44, p.email, title, message, { url: '/chat', tag: 'lunch-reminder' })
        )
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && (r.value.native || r.value.sent > 0)) pushed++;
        else failed++;
      }
    }

    return Response.json({ recipients: patients.length, pushed, failed, title, message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}