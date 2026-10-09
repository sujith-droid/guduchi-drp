import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { validateAdminToken } from '../../shared/admin-session.ts';
import { listAll, filterAll } from '../../shared/pagination.ts';

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
      const msgs = await filterAll(
        base44.asServiceRole.entities.ChatMessage,
        { conversation_id: conversationId },
        '-created_date'
      );
      msgs.reverse(); // newest-first → oldest-first for display
      return Response.json({ messages: msgs });
    }

    // Load ALL messages via cursor-based pagination so older conversations
    // (patients who haven't messaged in days/weeks) still appear in the list.
    const allMessages = await filterAll(
      base44.asServiceRole.entities.ChatMessage,
      {},
      '-created_date'
    );

    // Index the latest message per conversation_id
    const latestByConv = {};
    for (const m of allMessages) {
      const cid = m.conversation_id;
      if (!cid) continue;
      if (!latestByConv[cid] || new Date(m.created_date) > new Date(latestByConv[cid].created_date)) {
        latestByConv[cid] = m;
      }
    }

    // Build conversation list from ALL active assignments so every assigned
    // patient shows up — even those with no messages or very old messages.
    const convList = allAssignments.map((a) => {
      const cid = [a.patient_email, a.doctor_email].sort().join('_');
      const latest = latestByConv[cid] || null;
      const patientName = userMap[a.patient_email]?.display_name || userMap[a.patient_email]?.full_name || a.patient_name || a.patient_email;
      const doctorName = userMap[a.doctor_email]?.display_name || userMap[a.doctor_email]?.full_name || a.doctor_name || a.doctor_email;
      return {
        id: cid,
        conversation_id: cid,
        patient_email: a.patient_email,
        doctor_email: a.doctor_email,
        patient_name: patientName,
        doctor_name: doctorName,
        patient_id: a.patient_id || null,
        latest_message: latest ? (latest.message || (latest.audio_url ? '🎤 Voice message' : latest.image_url ? '📷 Photo' : '')) : null,
        latest_time: latest ? latest.created_date : null,
      };
    });

    // Also include conversations that have messages but no active assignment
    // (e.g. assignment was deleted but chat history remains)
    for (const [cid, latest] of Object.entries(latestByConv)) {
      if (convList.some((c) => c.conversation_id === cid)) continue;
      const patientEmail = latest.sender_email || cid.split('_')[0];
      const doctorEmail = latest.receiver_email || cid.split('_')[1];
      convList.push({
        id: cid,
        conversation_id: cid,
        patient_email: patientEmail,
        doctor_email: doctorEmail,
        patient_name: userMap[patientEmail]?.display_name || userMap[patientEmail]?.full_name || patientEmail,
        doctor_name: userMap[doctorEmail]?.display_name || userMap[doctorEmail]?.full_name || doctorEmail,
        patient_id: null,
        latest_message: latest.message || (latest.audio_url ? '🎤 Voice message' : latest.image_url ? '📷 Photo' : ''),
        latest_time: latest.created_date || null,
      });
    }

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