import { PROJECT_STATUS } from '@grasp/domain';
import { DeleteProjectForm, ProjectDetailsForm } from '../project-lifecycle-forms';

type ProjectSettingsProps = {
  detail: {
    project: {
      description: string | null;
      id: string;
      status: string;
      title: string;
    };
  };
};

export function ProjectSettings({ detail }: ProjectSettingsProps) {
  return (
    <details className="group rounded-[1.75rem] border border-border bg-card/50 open:bg-card">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <span className="flex items-center gap-3">
          <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
            §
          </span>
          <span>Project settings</span>
        </span>
        <span className="font-mono text-[0.65rem] tracking-[0.16em] uppercase text-muted-foreground transition-colors group-open:text-brand-accent-foreground">
          lifecycle
        </span>
      </summary>
      <div className="border-t border-border p-6">
        <div className="mb-5 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
              Project lifecycle
            </p>
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Project details
            </h2>
          </div>
          <DeleteProjectForm
            disabled={detail.project.status === PROJECT_STATUS.PROCESSING}
            projectId={detail.project.id}
          />
        </div>
        <ProjectDetailsForm
          description={detail.project.description}
          projectId={detail.project.id}
          title={detail.project.title}
        />
      </div>
    </details>
  );
}
