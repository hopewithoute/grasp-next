import { ProjectDetailPage } from '@/features/projects/components/project-detail-page';

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    stage?: string;
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const [{ projectId }, { stage }] = await Promise.all([params, searchParams]);

  return <ProjectDetailPage currentStage={stage} projectId={projectId} />;
}
