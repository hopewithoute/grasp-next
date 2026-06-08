export class PromptTemplate<T extends Record<string, string | number>> {
  constructor(private template: string) {}

  format(variables: T): string {
    let result = this.template;
    for (const [key, value] of Object.entries(variables)) {
      // Use global replacement for the exact {{key}}
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }

    // Clean up any remaining empty {{variable}} blocks just in case?
    // Not strictly necessary, but can be helpful. For now, strict replacement is best.
    return result;
  }
}
