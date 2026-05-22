import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: "pending" | "processing" | "completed" | "failed" }) {
  const styles = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    processing: "bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse",
    completed: "bg-green-500/10 text-green-600 border-green-500/20",
    failed: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  const labels = {
    pending: "Pending",
    processing: "Processing",
    completed: "Resolved",
    failed: "Failed",
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wide", styles[status])}>
      {labels[status]}
    </span>
  );
}
