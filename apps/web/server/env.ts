import 'server-only';

import './load-env';
import { parseServerEnv } from '@grasp/domain';

export const serverEnv = parseServerEnv(process.env);
