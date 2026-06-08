import { NextResponse } from 'next/server';
import { validationIssues } from '@grasp/domain';

export type ParsedJson =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function parseJsonRequest(request: Request): Promise<ParsedJson> {
  try {
    return {
      ok: true,
      value: await request.json(),
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 }),
    };
  }
}

export function validationErrorResponse(error: unknown): NextResponse | null {
  const issues = validationIssues(error);

  if (!issues) {
    return null;
  }

  return NextResponse.json(
    {
      error: 'Invalid request body.',
      issues,
    },
    { status: 400 }
  );
}
