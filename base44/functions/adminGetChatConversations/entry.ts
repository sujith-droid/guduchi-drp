import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { validateAdminToken } from '../../shared/admin-session.ts';

export default async function(req: Request): Promise<Response> {
  let stage = 'authentication';
  try {
    const base44 = createClientFromRequest(req);
    const { adminToken, conversationId, cursor } = await req.json();
    const session = await validateAdminToken(base44, adminToken);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = session.role;
    if (role !== 'admin' && role !== 'subadmin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    // OTP-authenticated admins have an AdminSession UUID, not a platform token,
    // so entity reads must go through the service role.
    const entities = base44.asServiceRole.entities;

    // Opening a chat needs only that chat, not the entire admin directory.
    if (conversationId) {
      const page = await entities.ChatMessage.filter(
        { conversation_id: conversationId },
        { sort: '-created_date', limit: 100, ...(cursor ? { cursor } : {}) }
      );
      return Response.json({
        messages: page.items.reverse(),
        next_cursor: page.next_cursor,
        has_more: page.has_more,
      });
    }

    // Compute latest dates on the server instead of downloading every message.
    stage = 'conversation summaries';
    const assignmentOptions = { sort: '-created_date', limit: 500, fields: ['patient_email', 'doctor_email', 'patient_name', 'doctor_name', 'patient_id'] };
    const [firstAssignments, summaries] = await Promise.all([
      entities.PatientDoctorAssignment.filter({ status: 'active' }, assignmentOptions).catch((error) => { error.chatStage = 'assignments'; throw error; }),
      entities.ChatMessage.aggregate({ groupBy: 'conversation_id', max: 'created_date', limit: 1000 }).catch((error) => { error.chatStage = 'latest dates'; throw error; }),
    ]);
    const allAssignments = [...firstAssignments.items];
    let assignmentCursor = firstAssignments.has_more ? firstAssignments.next_cursor : null;
    while (assignmentCursor) {
      const page = await entities.PatientDoctorAssignment.filter({ status: 'active' }, { ...assignmentOptions, cursor: assignmentCursor });
      allAssignments.push(...page.items);
      assignmentCursor = page.has_more ? page.next_cursor : null;
    }
    const dates = [...new Set(summaries.rows.map((r) => r.max_created_date).filter(Boolean))];
    const latestMessages = [];
    // Keep each date query small and bounded; never scan the full chat history.
    stage = 'latest messages';
    for (let i = 0; i < dates.length; i += 150) {
      let nextCursor;
      do {
        const page = await entities.ChatMessage.filter(
          { created_date: { $in: dates.slice(i, i + 150) } },
          { sort: '-created_date', limit: 500, fields: ['conversation_id', 'sender_email', 'receiver_email', 'message', 'image_url', 'audio_url', 'created_date'], ...(nextCursor ? { cursor: nextCursor } : {}) }
        );
        latestMessages.push(...page.items);
        nextCursor = page.has_more ? page.next_cursor : null;
      } while (nextCursor);
    }
    const emails = [...new Set([
      ...allAssignments.flatMap((a) => [a.patient_email, a.doctor_email]),
      ...latestMessages.flatMap((m) => [m.sender_email, m.receiver_email]),
    ].filter(Boolean))];
    const userMap = {};
    stage = 'participant names';
    for (let i = 0; i < emails.length; i += 400) {
      const users = await entities.User.filter({ email: { $in: emails.slice(i, i + 400) } }, '-created_date', 500, 0, ['email', 'full_name', 'display_name', 'role']);
      for (const u of users) userMap[u.email] = u;
    }

    const latestByConv = {};
    for (const m of latestMessages) {
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
      const senderIsCoach = ['doctor', 'viewer'].includes(userMap[latest.sender_email]?.role);
      const patientEmail = senderIsCoach ? latest.receiver_email : latest.sender_email;
      const doctorEmail = senderIsCoach ? latest.sender_email : latest.receiver_email;
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
    console.error('Admin chat load failed', { stage: error.chatStage || stage, status: error.status, message: error.message });
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}