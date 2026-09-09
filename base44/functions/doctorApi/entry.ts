import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { validateAdminToken } from '../../shared/admin-session.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { adminToken, action, ...payload } = body;
    const session = await validateAdminToken(base44, adminToken);

    const doctorEmail = session.user_email;
    const isAdmin = session.role === "admin" || doctorEmail?.includes("sujith@guduchiayurveda");

    switch (action) {
      // ── DoctorDashboard ──────────────────────────────────────────
      case 'getData': {
        const query = isAdmin ? { status: "active" } : { doctor_email: doctorEmail, status: "active" };
        const [assignments, recentLogs] = await Promise.all([
          base44.asServiceRole.entities.PatientDoctorAssignment.filter(query),
          base44.asServiceRole.entities.DailyLog.list("-date", 200),
        ]);
        // Fetch phone numbers for all assigned patients.
        const patientEmails = [...new Set(assignments.map((a) => a.patient_email))];
        const patientPhones = {};
        for (const email of patientEmails) {
          try {
            const users = await base44.asServiceRole.entities.User.filter({ email });
            if (users[0]?.phone) patientPhones[email] = users[0].phone;
          } catch (e) {}
        }
        return Response.json({ assignments, recentLogs, patientPhones });
      }

      // ── PatientDetail ─────────────────────────────────────────────
      case 'getPatientData': {
        const { patientEmail, period } = payload;
        if (!patientEmail) return Response.json({ error: 'patientEmail is required' }, { status: 400 });
        const assignQuery = isAdmin
          ? { patient_email: patientEmail, status: "active" }
          : { patient_email: patientEmail, doctor_email: doctorEmail, status: "active" };
        const [assignments, logs] = await Promise.all([
          base44.asServiceRole.entities.PatientDoctorAssignment.filter(assignQuery),
          base44.asServiceRole.entities.DailyLog.filter({ patient_email: patientEmail }, "-date", Number(period) || 30),
        ]);
        let patientPhone = null;
        try {
          const phoneUsers = await base44.asServiceRole.entities.User.filter({ email: patientEmail });
          if (phoneUsers[0]?.phone) patientPhone = phoneUsers[0].phone;
        } catch (e) {}
        return Response.json({ assignment: assignments[0] || null, logs, patientPhone });
      }

      case 'savePatientId': {
        const { assignmentId, patientId } = payload;
        if (!assignmentId) return Response.json({ error: 'assignmentId is required' }, { status: 400 });
        await base44.asServiceRole.entities.PatientDoctorAssignment.update(assignmentId, { patient_id: (patientId || "").trim() });
        if ((patientId || "").trim()) {
          // Find the patient email to notify
          const assignments = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({ id: assignmentId });
          const patientEmail = assignments[0]?.patient_email;
          if (patientEmail) {
            await base44.asServiceRole.entities.Notification.create({
              user_email: patientEmail,
              title: "Patient ID Assigned",
              message: `Your doctor has assigned you the Patient ID: ${(patientId || "").trim()}. You can view it on your profile.`,
              type: "info",
            });
          }
        }
        return Response.json({ success: true });
      }

      // ── Chat ──────────────────────────────────────────────────────
      case 'getConversations': {
        const query = isAdmin
          ? { status: "active" }
          : { doctor_email: doctorEmail };
        const assignments = await base44.asServiceRole.entities.PatientDoctorAssignment.filter(query);

        // Get all messages involving this doctor
        const [sentMsgs, receivedMsgs] = await Promise.all([
          base44.asServiceRole.entities.ChatMessage.filter({ sender_email: doctorEmail }, "-created_date", 500),
          base44.asServiceRole.entities.ChatMessage.filter({ receiver_email: doctorEmail }, "-created_date", 500),
        ]);
        const allMsgs = [...sentMsgs, ...receivedMsgs];

        // Build conversation -> latest message map
        const convLatest = {};
        const convUnread = {};
        for (const m of allMsgs) {
          const cid = m.conversation_id;
          if (!convLatest[cid] || new Date(m.created_date) > new Date(convLatest[cid].created_date)) {
            convLatest[cid] = m;
          }
          if (m.receiver_email === doctorEmail && !m.is_read) {
            convUnread[cid] = (convUnread[cid] || 0) + 1;
          }
        }

        // Only return assignments that have at least one message, sorted by latest message
        const conversationsWithMsgs = assignments
          .filter((a) => {
            const cid = [a.patient_email, a.doctor_email].sort().join("_");
            return convLatest[cid];
          })
          .sort((a, b) => {
            const cidA = [a.patient_email, a.doctor_email].sort().join("_");
            const cidB = [b.patient_email, b.doctor_email].sort().join("_");
            return new Date(convLatest[cidB]?.created_date || 0) - new Date(convLatest[cidA]?.created_date || 0);
          });

        // Attach latest message preview
        const conversations = conversationsWithMsgs.map((a) => {
          const cid = [a.patient_email, a.doctor_email].sort().join("_");
          const lastMsg = convLatest[cid];
          return {
            ...a,
            last_message: lastMsg?.message || (lastMsg?.image_url ? "📷 Photo" : (lastMsg?.audio_url ? "🎤 Voice message" : "")),
            last_message_date: lastMsg?.created_date,
            last_message_sender: lastMsg?.sender_email,
          };
        });

        return Response.json({ assignments: conversations, unreadMap: convUnread });
      }

      case 'getMessages': {
        const { conversationId } = payload;
        if (!conversationId) return Response.json({ error: 'conversationId is required' }, { status: 400 });
        const msgs = await base44.asServiceRole.entities.ChatMessage.filter({ conversation_id: conversationId }, "created_date", 100);
        return Response.json({ messages: msgs });
      }

      case 'sendMessage': {
        const { receiverEmail, conversationId, message, imageUrl, audioUrl, messageType } = payload;
        if (!conversationId) return Response.json({ error: 'conversationId is required' }, { status: 400 });
        const msgData = {
          sender_email: doctorEmail,
          receiver_email: receiverEmail || "group",
          conversation_id: conversationId,
          message: message || undefined,
          message_type: messageType || "text",
        };
        if (imageUrl) msgData.image_url = imageUrl;
        if (audioUrl) msgData.audio_url = audioUrl;
        const created = await base44.asServiceRole.entities.ChatMessage.create(msgData);
        if (receiverEmail) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: receiverEmail,
            title: `New message from Dr. ${doctorEmail}`,
            message: (message || (imageUrl ? "📷 Photo" : (audioUrl ? "🎤 Voice message" : "New message"))).substring(0, 100),
            type: "info",
            related_patient_email: receiverEmail,
          }).catch(() => {});
        }
        return Response.json({ success: true, message: created });
      }

      case 'markRead': {
        const { messageIds } = payload;
        if (!messageIds || !Array.isArray(messageIds)) return Response.json({ error: 'messageIds is required' }, { status: 400 });
        for (const id of messageIds) {
          await base44.asServiceRole.entities.ChatMessage.update(id, { is_read: true });
        }
        return Response.json({ success: true });
      }

      case 'getTemplates': {
        const templates = await base44.asServiceRole.entities.MessageTemplate.list('-created_date', 100);
        return Response.json({ templates });
      }

      case 'logout': {
        const sessions = await base44.asServiceRole.entities.AdminSession.filter({ token: adminToken });
        if (sessions[0]) {
          await base44.asServiceRole.entities.AdminSession.update(sessions[0].id, { is_active: false });
        }
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}