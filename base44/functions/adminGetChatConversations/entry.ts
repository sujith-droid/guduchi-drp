import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { validateAdminToken } from '../../shared/admin-session.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken, conversationId } = await req.json();
    await validateAdminToken(base44, adminToken);

    const [allMessages, allAssignments] = await Promise.all([
      base44.asServiceRole.entities.ChatMessage.list('-created_date', 500),
      base44.asServiceRole.entities.PatientDoctorAssignment.filter({ status: 'active' }),
    ]);

    // If a specific conversation is requested, return its messages directly
    if (conversationId) {
      const msgs = allMessages
        .filter(m => m.conversation_id === conversationId)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      return Response.json({ messages: msgs });
    }

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
      return {
        id: cid,
        conversation_id: cid,
        patient_email: assignment?.patient_email || latest.sender_email || cid.split('_')[0],
        doctor_email: assignment?.doctor_email || latest.receiver_email || cid.split('_')[1],
        patient_name: assignment?.patient_name || assignment?.patient_email || cid.split('_')[0],
        doctor_name: assignment?.doctor_name || assignment?.doctor_email || cid.split('_')[1],
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