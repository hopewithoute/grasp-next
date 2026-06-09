import { test } from 'vitest';
import { revalidatePath } from 'next/cache';

test('revalidatePath in async', async () => {
  try {
    revalidatePath('/dashboard');
    console.log("Works!");
  } catch(e) {
    console.error("Throws:", e);
  }
});
