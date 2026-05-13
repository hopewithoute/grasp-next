import { createQueueConfig } from "./queue-config.js";

const queueConfig = createQueueConfig(process.env);

console.log(`Grasp worker placeholder ready for queue prefix "${queueConfig.prefix}".`);
