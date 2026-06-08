import * as v from 'valibot';

export const requiredString = v.pipe(v.string(), v.trim(), v.minLength(1));
export const confidenceScore = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
export const uuidString = v.pipe(v.string(), v.uuid());
export const urlString = v.pipe(v.string(), v.url());

export function safeParse<TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown
): v.SafeParseResult<TSchema> {
  return v.safeParse(schema, input);
}

export function parse<TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown
): v.InferOutput<TSchema> {
  return v.parse(schema, input);
}

export function validationIssues(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'success' in error &&
    error.success === false &&
    'issues' in error
  ) {
    return error.issues;
  }

  return v.isValiError(error) ? error.issues : null;
}

export { v };
