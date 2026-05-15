import { NextResponse } from 'next/server';
import {
  ProjectForbiddenError,
  ProjectNotFoundError,
  submitSourceMaterial,
  updateSourceMaterialDto,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { parseJsonRequest, validationErrorResponse } from '../../../http';

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const actor = await getActor();

  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { projectId } = await context.params;
  const body = await parseJsonRequest(request);

  if (!body.ok) {
    return body.response;
  }

  try {
    const input = updateSourceMaterialDto.parse({
      ...(typeof body.value === 'object' && body.value !== null ? body.value : {}),
      projectId,
    });
    const project = await submitSourceMaterial(input, createProjectDeps(), actor);

    return NextResponse.json(project);
  } catch (error) {
    const response = validationErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    if (error instanceof ProjectForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    throw error;
  }
}
