'use client';

import {
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';

function parseUIMessageChunkStream(
  stream: ReadableStream<Uint8Array>
): ReadableStream<UIMessageChunk> {
  return parseJsonEventStream({
    stream,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.success) {
          throw chunk.error;
        }

        controller.enqueue(chunk.value);
      },
    })
  );
}

export async function consumeUIMessageStream(
  stream: ReadableStream<Uint8Array>,
  onMessage: (message: UIMessage) => void
) {
  const messages = readUIMessageStream({
    stream: parseUIMessageChunkStream(stream),
  });

  for await (const message of messages) {
    onMessage(message);
  }
}

export async function consumeUIMessageChunks(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: UIMessageChunk) => void
) {
  const chunks = parseUIMessageChunkStream(stream);
  const reader = chunks.getReader();

  while (true) {

    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    onChunk(value);
  }
}
