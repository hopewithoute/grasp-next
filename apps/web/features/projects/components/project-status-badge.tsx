import { PROJECT_STATUS, type ProjectStatus } from '@grasp/domain';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariants } from '../project-style-variants';

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const labelByStatus = {
    [PROJECT_STATUS.DRAFT]: 'Draft',
    [PROJECT_STATUS.FAILED]: 'Failed',
    [PROJECT_STATUS.PROCESSED]: 'Processed',
    [PROJECT_STATUS.PROCESSING]: 'Processing',
    [PROJECT_STATUS.REVIEWING]: 'Reviewing',
  };

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
