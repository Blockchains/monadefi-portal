import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export function SpendChart({ data }: { data: { id: number; cumulative: number; label: string }[] }) {
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={6}>
          <XAxis dataKey="label" hide />
          <Tooltip
            cursor={{ fill: "rgba(131,110,249,0.08)" }}
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              fontSize: 12,
              color: "#fafafa",
            }}
            formatter={(value) => [`${value} MON`, "Cumulative"]}
          />
          <Bar dataKey="cumulative" fill="#836EF9" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
