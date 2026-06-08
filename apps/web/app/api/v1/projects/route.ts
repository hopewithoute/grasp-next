import { NextResponse } from 'next/server';
import { canCreateProject, createProject, createProjectDto, parse } from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { parseJsonRequest, validationErrorResponse } from '../http';

export async function POST(request: Request) {
  const actor = await getActor();

  if (!canCreateProject(actor)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await parseJsonRequest(request);

  if (!body.ok) {
    return body.response;
  }

  try {
    const input = parse(createProjectDto, body.value);
    const project = await createProject(input, createProjectDeps(), actor.id);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const response = validationErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }
}
