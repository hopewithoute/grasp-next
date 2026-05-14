export type ArtifactType =
  | "concept_graph"
  | "learning_objectives"
  | "lesson_draft";

export type ArtifactStatus =
  | "pending"
  | "generating"
  | "generated"
  | "needs_revision"
  | "approved"
  | "published"
  | "rejected"
  | "failed";

export type ArtifactRecord = {
  id: string;
  projectId: string;
  type: ArtifactType;
  status: ArtifactStatus;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ArtifactVersionRecord = {
  id: string;
  artifactId: string;
  versionNumber: number;
  content: unknown;
  revisionFeedback: string | null;
  createdAt: Date;
};

export type ArtifactRepository = {
  create(input: {
    projectId: string;
    status: ArtifactStatus;
    type: ArtifactType;
  }): Promise<ArtifactRecord>;
  findById(artifactId: string): Promise<ArtifactRecord | null>;
  findByProjectAndType(
    projectId: string,
    type: ArtifactType
  ): Promise<ArtifactRecord | null>;
  findOrCreateForProject(input: {
    projectId: string;
    status: ArtifactStatus;
    type: ArtifactType;
  }): Promise<ArtifactRecord>;
  updateStatus(
    artifactId: string,
    status: ArtifactStatus
  ): Promise<ArtifactRecord | null>;
  createVersion(input: {
    artifactId: string;
    content: unknown;
    revisionFeedback?: string | null;
  }): Promise<ArtifactVersionRecord>;
  listVersions(artifactId: string): Promise<ArtifactVersionRecord[]>;
};
