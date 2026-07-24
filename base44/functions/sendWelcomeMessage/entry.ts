import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const assignment = body.data;
    if (!assignment) {
      return Response.json({ error: "No assignment data" }, { status: 400 });
    }

    const { patient_email, doctor_email, patient_name, doctor_name } = assignment;

    // Find a template named "Welcome" (case-insensitive), fallback to first template
    const templates = await base44.asServiceRole.entities.MessageTemplate.list("-created_date", 50);
    const welcomeTemplate = templates.find((t) =>
      t.name?.toLowerCase().includes("welcome")
    ) || templates[0];

    if (!welcomeTemplate) {
      return Response.json({ skipped: true, reason: "No message templates found" });
    }

    // Personalize the message — replace {name} placeholder if present
    const personalizedMessage = welcomeTemplate.content.replace(/\{name\}/gi, patient_name || patient_email);

    // Create the chat message from doctor to patient
    const convId = [patient_email, doctor_email].sort().join("_");
    await base44.asServiceRole.entities.ChatMessage.create({
      sender_email: doctor_email,
      receiver_email: patient_email,
      conversation_id: convId,
      message: personalizedMessage,
      message_type: "text",
    });

    // Also send an in-app notification to the patient
    await base44.asServiceRole.entities.Notification.create({
      user_email: patient_email,
      title: `Message from Dr. ${doctor_name || doctor_email}`,
      message: `You have a new welcome message from your doctor. Check your chat!`,
      type: "info",
      related_patient_email: patient_email,
    });

    return Response.json({ success: true, template_used: welcomeTemplate.name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});