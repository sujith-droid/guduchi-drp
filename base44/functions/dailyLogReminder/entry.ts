import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { sendPushToUser } from '../../shared/firebase-push.ts';
import { filterAll } from '../../shared/pagination.ts';

// Run async tasks in bounded parallel batches to avoid overwhelming the API.
async function runBatch(items, fn, concurrency = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(fn)));
  }
  return results;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Get today's date in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().split("T")[0];

    // Get all active patient assignments (unique patients)
    const assignments = await filterAll(base44.asServiceRole.entities.PatientDoctorAssignment, { status: "active" });
    const patientEmails = [...new Set(assignments.map((a) => a.patient_email))];

    // Get today's logs
    const todayLogs = await filterAll(base44.asServiceRole.entities.DailyLog, { date: today });
    const loggedEmails = new Set(todayLogs.map((l) => l.patient_email));

    // Patients who haven't logged yet
    const remindEmails = patientEmails.filter((email) => !loggedEmails.has(email));

    const title = "⏰ Daily Log Reminder";
    const message = "You haven't submitted your health log today. Please record your blood sugar, weight, and steps!";

    // Bulk-create in-app notifications for all patients at once
    if (remindEmails.length > 0) {
      const notifications = remindEmails.map((email) => ({
        user_email: email,
        title,
        message,
        type: "reminder",
      }));
      // bulkCreate in chunks of 100 (SDK limit)
      for (let i = 0; i < notifications.length; i += 100) {
        await base44.asServiceRole.entities.Notification.bulkCreate(notifications.slice(i, i + 100));
      }

      // Send push notifications in bounded parallel batches (5 at a time)
      await runBatch(remindEmails, (email) =>
        sendPushToUser(base44, email, title, message, { url: "/logbook" }).catch(() => null),
        5
      );
    }

    return Response.json({ success: true, date: today, total_patients: patientEmails.length, reminders_sent: remindEmails.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}