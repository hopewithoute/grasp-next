import { randomUUID } from 'crypto';
import type { ProjectSourceRepository, ProjectSourceType, ProjectSourceRecord } from '@grasp/domain';
import type { EvidenceKbService } from './evidence-kb';

export function createEvidenceKbProjectSourceRepository(
  evidenceKbService: EvidenceKbService
): ProjectSourceRepository {
  if (!evidenceKbService) {
    throw new Error("evidenceKbService is required");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapSource = (source: any): ProjectSourceRecord => {
    const rawMetadata = source.metadata || source.metadata_ || {};
    return {
      id: source.external_source_id,
      projectId: source.project_id,
      type: source.source_type as ProjectSourceType,
      title: source.title,
      content: rawMetadata.content as string | null || null,
      fileRef: rawMetadata.filename as string | null || null,
      metadata: {
        ...rawMetadata,
        passageCount: source.passage_count || 0,
        status: source.status || 'candidate',
        warnings: source.quality_warnings || []
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  return {
    async createForProjectOwner(projectId, ownerId, input) {
      const sourceId = randomUUID();
      if (input.type !== 'pdf') {
        await evidenceKbService.ingestSourceForOwner({
          ownerId,
          projectId,
          sourceId,
          sourceTitle: input.title,
          sourceType: input.type as 'text' | 'markdown' | 'web',
          content: input.content || '',
        });
      }
      return {
        id: sourceId,
        projectId,
        type: input.type,
        title: input.title,
        content: input.content || null,
        fileRef: input.fileRef || null,
        metadata: input.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async deleteForProjectOwner(sourceId, ownerId) {
      const source = await this.findByIdForOwner(sourceId, ownerId);
      if (source) {
        await evidenceKbService.deleteSourceBySourceIdForOwner({ ownerId, sourceId });
      }
      return source;
    },
    async findByIdForOwner(sourceId, ownerId) {
      try {
        const source = await evidenceKbService.getSourceBySourceIdForOwner({ sourceId, ownerId });
        if (!source) return null;
        return mapSource(source);
      } catch {
        return null;
      }
    },
    async listByProject() {
      throw new Error("listByProject without ownerId not supported in KB adapter");
    },
    async listByProjectForOwner(projectId, ownerId) {
      const sources = await evidenceKbService.listSourcesForOwner({ ownerId, projectId });
      return sources.map(mapSource);
    },
    async updateForProjectOwner(sourceId, ownerId, input) {
      const source = await this.findByIdForOwner(sourceId, ownerId);
      if (!source) return null;
      
      const newType = input.type || source.type;
      const newTitle = input.title || source.title;
      const newContent = input.content !== undefined ? input.content : source.content;
      
      await evidenceKbService.ingestSourceForOwner({
        ownerId,
        projectId: source.projectId,
        sourceId,
        sourceTitle: newTitle,
        sourceType: newType as 'text' | 'markdown' | 'web',
        content: newContent || '',
      });
      
      return this.findByIdForOwner(sourceId, ownerId);
    }
  };
}
