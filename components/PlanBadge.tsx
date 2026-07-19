import type { Plan } from "@/lib/plan";

/** Nicely capitalized labels for each tier. */
export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  creator: "Creator",
  studio: "Studio",
};

/**
 * Small pill showing the user's subscription tier. Paid tiers use the brand
 * purple→pink gradient; free is a muted slate pill. Presentational only (no
 * hooks), so it works in both server and client components.
 */
export default function PlanBadge({
  plan,
  className = "",
}: {
  plan: Plan;
  className?: string;
}) {
  const isPaid = plan !== "free";
  const style = isPaid
    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
    : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style} ${className}`}
    >
      {PLAN_LABELS[plan]}
    </span>
  );
}
