import { createDbClient } from '@grasp/db/client';
import { wikiConceptSourceRefs, sourcePassages, wikiConcepts } from '@grasp/db/schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const db = createDbClient(process.env.DATABASE_URL!);
  const refs = await db.select().from(wikiConceptSourceRefs);
  console.log('Total evidence rows:', refs.length);
  
  const concepts = await db.select().from(wikiConcepts);
  console.log('Total concepts:', concepts.length);
  
  const passages = await db.select().from(sourcePassages);
  console.log('Total passages:', passages.length);

  process.exit(0);
}
run().catch(console.error);
