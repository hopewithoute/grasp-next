import { ProjectDetailPage } from "@/features/projects/project-detail-page";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { projectId } = await params;

  return <ProjectDetailPage projectId={projectId} />;
}
