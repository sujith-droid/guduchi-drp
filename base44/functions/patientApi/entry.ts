import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { validatePatientToken } from '../../shared/admin-session.ts';
import { sendPushToUser } from '../../shared/firebase-push.ts';
import { filterAll } from '../../shared/pagination.ts';

// Patients log in via mobile OTP and receive an opaque AdminSession token
// that the Base44 platform doesn't recognize for direct entity SDK calls.
// This function authenticates the patient (via adminToken or patientEmail)
// and performs all entity operations server-side using asServiceRole.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, patientEmail, adminToken, ...payload } = body;

    // For chat actions, validate the admin token and use the email from the session
    let userEmail = patientEmail;
    if (adminToken) {
      const session = await validatePatientToken(base44, adminToken);
      userEmail = session.user_email;
    }

    if (!userEmail) {
      return Response.json({ error: 'patientEmail or adminToken is required' }, { status: 400 });
    }
    const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
    if (users.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }
    const patient = users[0];

    switch (action) {
      case 'assignDoctor': {
        const { doctorEmail } = payload;
        if (!doctorEmail) return Response.json({ error: 'doctorEmail is required' }, { status: 400 });

        // Check existing assignment
        const existing = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({
          patient_email: userEmail,
          doctor_email: doctorEmail,
          status: 'active',
        });
        if (existing.length > 0) {
          return Response.json({ status: 'already', doctorName: doctorEmail });
        }

        // Deactivate existing active assignments — patient can only have one doctor at a time
        const currentAssignments = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({
          patient_email: userEmail,
          status: 'active',
        });
        for (const a of currentAssignments) {
          await base44.asServiceRole.entities.PatientDoctorAssignment.update(a.id, { status: 'inactive' });
        }

        // Get doctor name
        const doctorUsers = await base44.asServiceRole.entities.User.filter({ email: doctorEmail });
        const doctorName = doctorUsers[0]?.full_name || doctorEmail;

        await base44.asServiceRole.entities.PatientDoctorAssignment.create({
          patient_email: userEmail,
          doctor_email: doctorEmail,
          patient_name: patient.full_name || userEmail,
          doctor_name: doctorName,
          status: 'active',
        });

        // Notify doctor
        await base44.asServiceRole.entities.Notification.create({
          user_email: doctorEmail,
          title: 'New Patient Joined',
          message: `${patient.full_name || userEmail} has joined your care.`,
          type: 'info',
          related_patient_email: userEmail,
        }).catch(() => {});
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: doctorEmail,
          subject: 'New Patient Joined Your Care',
          body: `Hello,\n\n${patient.full_name || userEmail} has joined your care on the Guduchi Diabetes Reversal Program.\n\nLog in to your dashboard to view their profile.\n\n— Guduchi Health Team`,
        }).catch(() => {});

        // Send welcome message
        await base44.asServiceRole.functions.invoke('sendWelcomeMessage', {
          data: {
            patient_email: userEmail,
            doctor_email: doctorEmail,
            patient_name: patient.full_name || userEmail,
            doctor_name: doctorName,
          },
        }).catch(() => {});

        // Notify patient
        await base44.asServiceRole.entities.Notification.create({
          user_email: userEmail,
          title: 'Welcome to the Program!',
          message: `You have been successfully connected to ${doctorName}. Your diabetes reversal journey begins now!`,
          type: 'achievement',
        }).catch(() => {});
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: userEmail,
          subject: 'Welcome to Guduchi Diabetes Reversal Program!',
          body: `Hello ${patient.full_name || ""},\n\nYou have been successfully connected to ${doctorName}.\n\nStart logging your daily health metrics and track your progress toward reversing diabetes!\n\n— Guduchi Health Team`,
        }).catch(() => {});

        return Response.json({ status: 'done', doctorName });
      }

      // ── Chat ──────────────────────────────────────────────────────
      case 'getConversations': {
        const assignments = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({
          patient_email: userEmail,
          status: 'active',
        });

        const [sentMsgs, receivedMsgs] = await Promise.all([
          base44.asServiceRole.entities.ChatMessage.filter({ sender_email: userEmail }, "-created_date", 500),
          base44.asServiceRole.entities.ChatMessage.filter({ receiver_email: userEmail }, "-created_date", 500),
        ]);
        const allMsgs = [...sentMsgs, ...receivedMsgs];

        const convLatest = {};
        const convUnread = {};
        for (const m of allMsgs) {
          const cid = m.conversation_id;
          if (!convLatest[cid] || new Date(m.created_date) > new Date(convLatest[cid].created_date)) {
            convLatest[cid] = m;
          }
          if (m.receiver_email === userEmail && !m.is_read) {
            convUnread[cid] = (convUnread[cid] || 0) + 1;
          }
        }

        const conversations = assignments.map((a) => {
          const cid = [a.patient_email, a.doctor_email].sort().join("_");
          const lastMsg = convLatest[cid];
          return {
            id: cid,
            conversation_id: cid,
            patient_email: a.patient_email,
            doctor_email: a.doctor_email,
            patient_name: a.patient_name || a.patient_email,
            doctor_name: a.doctor_name || a.doctor_email,
            patient_id: a.patient_id || null,
            latest_message: lastMsg ? (lastMsg.message || (lastMsg.audio_url ? "🎤 Voice message" : lastMsg.image_url ? "📷 Photo" : "")) : null,
            latest_time: lastMsg ? lastMsg.created_date : null,
          };
        });

        return Response.json({ conversations, unreadMap: convUnread });
      }

      case 'getMessages': {
        const { conversationId } = payload;
        if (!conversationId) return Response.json({ error: 'conversationId is required' }, { status: 400 });
        const msgs = await filterAll(base44.asServiceRole.entities.ChatMessage, { conversation_id: conversationId }, "-created_date");
        msgs.reverse(); // newest-first → oldest-first for display
        return Response.json({ messages: msgs });
      }

      case 'sendMessage': {
        const { receiverEmail, conversationId, message, imageUrl, audioUrl, messageType } = payload;
        if (!conversationId) return Response.json({ error: 'conversationId is required' }, { status: 400 });
        const msgData = {
          sender_email: userEmail,
          receiver_email: receiverEmail,
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
            title: `New message from ${patient.full_name || userEmail}`,
            message: (message || (imageUrl ? "📷 Photo" : (audioUrl ? "🎤 Voice message" : "New message"))).substring(0, 100),
            type: "info",
            related_patient_email: userEmail,
          }).catch(() => {});
          // Firebase push notification to the receiver's devices
          await sendPushToUser(
            base44,
            receiverEmail,
            `New message from ${patient.full_name || userEmail}`,
            (message || (imageUrl ? "📷 Photo" : (audioUrl ? "🎤 Voice message" : "New message"))).substring(0, 100),
            { url: "/chat" }
          );
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

      case 'deleteMessage': {
        const { messageId } = payload;
        if (!messageId) return Response.json({ error: 'messageId is required' }, { status: 400 });
        const msgs = await base44.asServiceRole.entities.ChatMessage.filter({ id: messageId });
        if (msgs.length === 0) return Response.json({ error: 'Message not found' }, { status: 404 });
        if (msgs[0].sender_email !== userEmail) return Response.json({ error: 'Not authorized' }, { status: 403 });
        await base44.asServiceRole.entities.ChatMessage.delete(messageId);
        return Response.json({ success: true });
      }

      case 'editMessage': {
        const { messageId, message: newMessage } = payload;
        if (!messageId) return Response.json({ error: 'messageId is required' }, { status: 400 });
        const msgs = await base44.asServiceRole.entities.ChatMessage.filter({ id: messageId });
        if (msgs.length === 0) return Response.json({ error: 'Message not found' }, { status: 404 });
        if (msgs[0].sender_email !== userEmail) return Response.json({ error: 'Not authorized' }, { status: 403 });
        await base44.asServiceRole.entities.ChatMessage.update(messageId, { message: newMessage });
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}