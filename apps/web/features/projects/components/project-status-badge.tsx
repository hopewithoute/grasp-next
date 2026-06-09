import { PROJECT_STATUS, type ProjectStatus } from '@grasp/domain';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariants } from '../project-style-variants';

const labelByStatus: Record<ProjectStatus, string> = {
  [PROJECT_STATUS.DRAFT]: '[ DRAFT ]',
  [PROJECT_STATUS.FAILED]: '[ FAILED ]',
  [PROJECT_STATUS.PROCESSED]: '[ PROCESSED ]',
  [PROJECT_STATUS.PROCESSING]: '[ PROCESSING ]',
  [PROJECT_STATUS.REVIEWING]: '[ REVIEWING ]',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge
      className={statusBadgeVariants({ intent: projectStatusIntent(status) })}
      variant="secondary"
    >
      {labelByStatus[status]}
    </Badge>
  );
}

function projectStatusIntent(status: ProjectStatus) {
  const intentByProjectStatus = {
    [PROJECT_STATUS.DRAFT]: 'neutral',
    [PROJECT_STATUS.FAILED]: 'danger',
    [PROJECT_STATUS.PROCESSED]: 'success',
    [PROJECT_STATUS.PROCESSING]: 'warning',
    [PROJECT_STATUS.REVIEWING]: 'info',
  } as const;

  return intentByProjectStatus[status];
}
