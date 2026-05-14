import { Badge } from "@/components/ui/badge";

type ProjectStatus =
  | "draft"
  | "failed"
  | "processed"
  | "processing"
  | "reviewing";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const classNameByStatus = {
    draft: "bg-[#ecefe5] text-[#4f5a45]",
    failed: "bg-red-50 text-red-700",
    processed: "bg-green-50 text-green-700",
    processing: "bg-amber-50 text-amber-700",
    reviewing: "bg-blue-50 text-blue-700",
  };

  const labelByStatus = {
    draft: "Draft",
    failed: "Failed",
    processed: "Processed",
    processing: "Processing",
    reviewing: "Reviewing",
  };

  return (
    <Badge className={classNameByStatus[status]} variant="secondary">
      {labelByStatus[status]}
    </Badge>
  );
}
