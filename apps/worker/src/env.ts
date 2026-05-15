import './load-env.js';

import { parseServerEnv } from '@grasp/domain';

export const serverEnv = parseServerEnv(process.env);
