import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { validateAdminToken } from '../../shared/admin-session.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken, conversationId } = await req.json();
    await validateAdminToken(base44, adminToken);

    const [allAssignments, allUsers] = await Promise.all([
      base44.asServiceRole.entities.PatientDoctorAssignment.filter({ status: 'active' }),
      base44.asServiceRole.entities.User.list('-created_date', 500),
    ]);
    const userMap = {};
    for (const u of allUsers) { userMap[u.email] = u; }

    // If a specific conversation is requested, fetch its messages directly
    // (avoids loading all 500+ messages just to filter one conversation)
    if (conversationId) {
      const msgs = await base44.asServiceRole.entities.ChatMessage.filter(
        { conversation_id: conversationId },
        '-created_date',
        500
      );
      msgs.reverse(); // newest-first → oldest-first for display
      return Response.json({ messages: msgs });
    }

    // Load ALL messages by paginating (500 per batch) — the SDK caps each
    // call at 500, so without pagination older conversations whose only
    // messages fall beyond the first 500 disappear from the chat list.
    const allMessages = [];
    let skip = 0;
    let batch;
    do {
      batch = await base44.asServiceRole.entities.ChatMessage.list('-created_date', 500, skip);
      allMessages.push(...batch);
      skip += batch.length;
    } while (batch.length === 500);

    // Build conversation list from messages only (no empty conversations)
    const convMap = {};
    for (const m of allMessages) {
      const cid = m.conversation_id;
      if (!convMap[cid] || new Date(m.created_date) > new Date(convMap[cid].created_date)) {
        convMap[cid] = m;
      }
    }

    const convList = Object.entries(convMap).map(([cid, latest]) => {
      const assignment = allAssignments.find(a =>
        [a.patient_email, a.doctor_email].sort().join('_') === cid
      );
      const patientEmail = assignment?.patient_email || latest.sender_email || cid.split('_')[0];
      const doctorEmail = assignment?.doctor_email || latest.receiver_email || cid.split('_')[1];
      return {
        id: cid,
        conversation_id: cid,
        patient_email: patientEmail,
        doctor_email: doctorEmail,
        patient_name: userMap[patientEmail]?.display_name || userMap[patientEmail]?.full_name || assignment?.patient_name || patientEmail || cid.split('_')[0],
        doctor_name: userMap[doctorEmail]?.display_name || userMap[doctorEmail]?.full_name || assignment?.doctor_name || doctorEmail || cid.split('_')[1],
        patient_id: assignment?.patient_id || null,
        latest_message: latest.message || (latest.audio_url ? '🎤 Voice message' : latest.image_url ? '📷 Photo' : ''),
        latest_time: latest.created_date || null,
      };
    });

    convList.sort((a, b) => {
      if (!a.latest_time && !b.latest_time) return a.patient_name.localeCompare(b.patient_name);
      if (!a.latest_time) return 1;
      if (!b.latest_time) return -1;
      return new Date(b.latest_time) - new Date(a.latest_time);
    });

    return Response.json({ conversations: convList });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}