import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import moment from "moment";

export default function SugarChart({ logs, height = 280 }) {
  const data = logs
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((log) => ({
      date: moment(log.date).format("MMM D"),
      "Morning (Before Food)": log.before_food_morning || log.fasting_sugar || null,
      "Morning (After Food)": log.after_food_morning || log.post_breakfast_sugar || null,
      "Afternoon (Before Food)": log.before_food_afternoon || null,
      "Afternoon (After Food)": log.after_food_afternoon || null,
      "Night (Before Food)": log.before_food_night || null,
      "Night (After Food)": log.after_food_night || log.post_dinner_sugar || null,
      "Random": log.random_sugar || null,
    }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Line type="monotone" dataKey="Morning (Before Food)" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="Morning (After Food)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="Afternoon (Before Food)" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="Afternoon (After Food)" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="Night (Before Food)" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="Night (After Food)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="Random" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}