import { ProjectDetailPage } from '@/features/projects/project-detail-page';

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    stage?: string;
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { stage } = await searchParams;

  return <ProjectDetailPage currentStage={stage} projectId={projectId} />;
}
