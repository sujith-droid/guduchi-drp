import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get today's date in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().split("T")[0];

    // Get all active patient assignments (unique patients)
    const assignments = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({ status: "active" });
    const patientEmails = [...new Set(assignments.map((a) => a.patient_email))];

    // Get today's logs
    const todayLogs = await base44.asServiceRole.entities.DailyLog.filter({ date: today });
    const loggedEmails = new Set(todayLogs.map((l) => l.patient_email));

    // Send reminder to patients who haven't logged yet
    let reminded = 0;
    for (const email of patientEmails) {
      if (!loggedEmails.has(email)) {
        await base44.asServiceRole.entities.Notification.create({
          user_email: email,
          title: "⏰ Daily Log Reminder",
          message: "You haven't submitted your health log today. Please record your blood sugar, weight, and steps!",
          type: "reminder",
        });
        reminded++;
      }
    }

    return Response.json({ success: true, date: today, total_patients: patientEmails.length, reminders_sent: reminded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});