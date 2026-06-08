import { PROJECT_STATUS } from '@grasp/domain';
import { DeleteProjectForm, ProjectDetailsForm } from './project-lifecycle-forms';

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
    <details className="group border-border bg-card/50 open:bg-card rounded-[1.75rem] border">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-sm font-medium transition-colors">
        <span className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.18em] uppercase tabular-nums">
            §
          </span>
          <span>Project settings</span>
        </span>
        <span className="text-muted-foreground group-open:text-brand-accent-foreground font-mono text-[0.65rem] tracking-[0.16em] uppercase transition-colors">
          lifecycle
        </span>
      </summary>
      <div className="border-border border-t p-6">
        <div className="border-border mb-5 flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.18em] uppercase tabular-nums">
              Project lifecycle
            </p>
            <h2 className="text-foreground text-xl font-medium tracking-tight">Project details</h2>
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
