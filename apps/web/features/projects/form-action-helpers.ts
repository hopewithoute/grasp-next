import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ZodSchema } from 'zod';
import { getActor as auth } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';

// --- Types ---

export type FormActionResult<TExtra extends Record<string, unknown> = Record<string, never>> = {
  error: string | null;
} & TExtra;

export type SuccessFormState = FormActionResult<{ success: boolean }>;

// --- Auth helpers ---

export async function requireActor() {
  const actor = await auth();
  if (!actor) {
    redirect('/sign-in');
  }
  return actor;
}

export async function getOptionalActor() {
  return auth();
}

export async function getDeps() {
  return createProjectDeps();
}

// --- Generic form action builder ---

type FormActionConfig<TResult> = {
  /** Extract and parse form data. Return null to signal parse failure. */
  parseFormData: (formData: FormData) => TResult | null;
  /** Execute the domain action with parsed data. */
  execute: (parsed: TResult) => Promise<{ error: string | null; revalidatePaths?: string[] }>;
};

/**
 * Builds a standard form action that follows the pattern:
 * execute → return { error, ...rest }
 *
 * Callers provide parseFormData and execute. The helper handles the try/catch
 * and revalidation.
 */
export function buildFormAction<TResult>(
  config: FormActionConfig<TResult>
): (_state: SuccessFormState, formData: FormData) => Promise<SuccessFormState> {
  return async (_state: SuccessFormState, formData: FormData): Promise<SuccessFormState> => {
    const parsed = config.parseFormData(formData);
    if (!parsed) {
      return { error: 'Invalid form data.', success: false };
    }

    try {
      const result = await config.execute(parsed);
      if (result.error) {
        return { error: result.error, success: false };
      }
      for (const path of result.revalidatePaths ?? []) {
        revalidatePath(path);
      }
      return { error: null, success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Operation failed.',
        success: false,
      };
    }
  };
}

// --- Zod-based form action builder ---

type ZodFormActionConfig<TParsed> = {
  /** Zod schema to parse form data. */
  schema: ZodSchema<TParsed>;
  /** Transform FormData into the shape expected by the schema. */
  extractFormData: (formData: FormData) => Record<string, unknown>;
  /** Execute the domain action with parsed data. */
  execute: (parsed: TParsed) => Promise<{ error: string | null; revalidatePaths?: string[] }>;
  /** Error message when Zod parsing fails. */
  parseErrorMessage?: string;
};

/**
 * Builds a form action that parses FormData with a Zod schema, then executes
 * a domain action. Handles try/catch and revalidation.
 */
export function buildZodFormAction<TParsed>(
  config: ZodFormActionConfig<TParsed>
): (_state: SuccessFormState, formData: FormData) => Promise<SuccessFormState> {
  return buildFormAction({
    parseFormData: (formData) => {
      const raw = config.extractFormData(formData);
      const result = config.schema.safeParse(raw);
      if (!result.success) return null;
      return result.data;
    },
    execute: config.execute,
  });
}
