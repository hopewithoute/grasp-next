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
    <details className="group border-border/40 bg-background/50 open:bg-background relative border">
      <summary className="text-muted-foreground hover:text-brand-accent flex cursor-pointer items-center justify-between gap-4 px-6 py-5 transition-colors">
        <span className="flex items-center gap-3">
          <span className="text-brand-accent/70 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
            [ § ]
          </span>
          <span className="font-mono text-xs tracking-widest uppercase">Project Settings</span>
        </span>
        <span className="text-brand-accent/50 group-open:text-brand-accent font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-colors">
          [ LIFECYCLE ]
        </span>
      </summary>
      <div className="border-border/40 relative border-t p-6">
        <div className="border-brand-accent/50 absolute top-0 left-0 size-2 border-t border-l" />
        <div className="border-border/40 mb-6 flex flex-col gap-6 border-b border-dashed pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-brand-accent/70 font-mono text-[0.65rem] tracking-[0.3em] uppercase">
              [ SYS.LIFECYCLE ]
            </p>
            <h2 className="text-foreground font-mono text-xl font-light tracking-widest uppercase">
              [ PROJECT_DETAILS ]
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
