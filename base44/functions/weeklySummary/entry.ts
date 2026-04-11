import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Compute date range: last 7 days in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = istNow.toISOString().split("T")[0];
    const weekAgo = new Date(istNow.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    // Get all active assignments grouped by doctor
    const assignments = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({ status: "active" });

    // Group patients by doctor
    const doctorMap = {};
    for (const a of assignments) {
      if (!doctorMap[a.doctor_email]) {
        doctorMap[a.doctor_email] = { doctor_name: a.doctor_name || a.doctor_email, patients: [] };
      }
      doctorMap[a.doctor_email].patients.push({ email: a.patient_email, name: a.patient_name || a.patient_email, patient_id: a.patient_id });
    }

    // Get all logs for the past 7 days
    const allLogs = await base44.asServiceRole.entities.DailyLog.list("-date", 2000);
    const recentLogs = allLogs.filter((l) => l.date >= weekAgoStr && l.date <= todayStr);

    // Build a map: patient_email -> logs[]
    const logsByPatient = {};
    for (const log of recentLogs) {
      if (!logsByPatient[log.patient_email]) logsByPatient[log.patient_email] = [];
      logsByPatient[log.patient_email].push(log);
    }

    const avg = (arr) => {
      const valid = arr.filter((v) => v != null && !isNaN(v));
      if (!valid.length) return null;
      return (valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(1);
    };

    let emailsSent = 0;

    for (const [doctorEmail, { doctor_name, patients }] of Object.entries(doctorMap)) {
      let emailBody = `Dear Dr. ${doctor_name},\n\nHere is the weekly health summary for your patients (${weekAgoStr} to ${todayStr}):\n\n`;
      let hasData = false;

      for (const patient of patients) {
        const logs = logsByPatient[patient.email] || [];
        const idLabel = patient.patient_id ? ` [ID: ${patient.patient_id}]` : "";

        if (logs.length === 0) {
          emailBody += `──────────────────────────\n`;
          emailBody += `Patient: ${patient.name}${idLabel}\n`;
          emailBody += `  ⚠ No logs submitted this week.\n\n`;
          hasData = true;
          continue;
        }

        const avgFasting = avg(logs.map((l) => l.fasting_sugar || l.before_food_morning));
        const avgPostBreakfast = avg(logs.map((l) => l.post_breakfast_sugar || l.after_food_morning));
        const avgPostDinner = avg(logs.map((l) => l.post_dinner_sugar || l.after_food_night));
        const avgWeight = avg(logs.map((l) => l.weight));
        const avgSteps = avg(logs.map((l) => l.step_count));
        const latestWeight = logs.sort((a, b) => b.date.localeCompare(a.date))[0]?.weight;

        emailBody += `──────────────────────────\n`;
        emailBody += `Patient: ${patient.name}${idLabel}\n`;
        emailBody += `  Logs submitted: ${logs.length}/7 days\n`;
        if (avgFasting) emailBody += `  Avg Fasting Sugar:       ${avgFasting} mg/dL\n`;
        if (avgPostBreakfast) emailBody += `  Avg Post Breakfast Sugar: ${avgPostBreakfast} mg/dL\n`;
        if (avgPostDinner) emailBody += `  Avg Post Dinner Sugar:   ${avgPostDinner} mg/dL\n`;
        if (avgWeight) emailBody += `  Avg Weight:              ${avgWeight} kg\n`;
        if (latestWeight) emailBody += `  Latest Weight:           ${latestWeight} kg\n`;
        if (avgSteps) emailBody += `  Avg Daily Steps:         ${avgSteps}\n`;
        emailBody += `\n`;
        hasData = true;
      }

      if (!hasData) continue;

      emailBody += `──────────────────────────\n`;
      emailBody += `Log in to your dashboard to view detailed charts and communicate with your patients.\n\n— Guduchi Health Team`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: doctorEmail,
        subject: `📊 Weekly Patient Summary — ${weekAgoStr} to ${todayStr}`,
        body: emailBody,
      });

      // In-app notification for doctor
      await base44.asServiceRole.entities.Notification.create({
        user_email: doctorEmail,
        title: "Weekly Patient Summary Sent",
        message: `Your weekly summary for ${patients.length} patient(s) has been emailed to you.`,
        type: "info",
      });

      emailsSent++;
    }

    return Response.json({ success: true, doctors_notified: emailsSent, period: `${weekAgoStr} to ${todayStr}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});