import { authenticatedFetch } from '../auth/authenticatedFetch.js';

export class StreamEchoError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'StreamEchoError';
    this.status = status;
  }
}

function isTextContentType(contentType) {
  const mime = contentType.split(';', 1)[0].trim().toLowerCase();
  return mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' ||
    mime.endsWith('+json') || mime.endsWith('+xml');
}

function textDecoderFor(contentType) {
  const charset = /(?:^|;)\s*charset\s*=\s*"?([^;"\s]+)/i.exec(contentType)?.[1] || 'utf-8';
  try { return new TextDecoder(charset); } catch {
    throw new StreamEchoError('The response text encoding is unsupported.');
  }
}

export async function postStreamEcho(data, { contentType, signal, onProgress = () => {}, onTextChunk = () => {} } = {}) {
  if (Object.prototype.toString.call(data) !== '[object Uint8Array]') throw new TypeError('Streaming echo requires byte data.');
  if (contentType !== undefined && (typeof contentType !== 'string' || !contentType.trim())) {
    throw new TypeError('Content-Type must be a non-empty string when provided.');
  }
  const headers = contentType === undefined ? undefined : { 'Content-Type': contentType };
  const response = await authenticatedFetch('/api/echo/stream', {
    method: 'POST', body: data, headers, signal,
  });
  if (!response.ok) {
    throw new StreamEchoError(
      response.status === 503 ? 'Streaming service is unavailable. Try again later.' : `Streaming request failed (HTTP ${response.status}).`,
      response.status,
    );
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new StreamEchoError('This browser cannot read the streamed response.');
  }

  const responseType = response.headers.get('Content-Type') || 'application/octet-stream';
  const isText = isTextContentType(responseType);
  const decoder = isText ? textDecoderFor(responseType) : null;
  const binaryChunks = [];
  const reader = response.body.getReader();
  let receivedBytes = 0;
  let matches = true;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (Object.prototype.toString.call(value) !== '[object Uint8Array]') throw new StreamEchoError('The streamed response contained invalid bytes.');
      for (let index = 0; index < value.length; index += 1) {
        if (data[receivedBytes + index] !== value[index]) matches = false;
      }
      receivedBytes += value.byteLength;
      if (isText) {
        onTextChunk(decoder.decode(value, { stream: true }));
      } else {
        binaryChunks.push(value.slice());
      }
      onProgress(receivedBytes);
    }
    if (isText) onTextChunk(decoder.decode());
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof StreamEchoError) throw error;
    throw new StreamEchoError('The streamed response could not be read.');
  } finally {
    reader.releaseLock();
  }
  if (!matches || receivedBytes !== data.byteLength) {
    throw new StreamEchoError('Returned bytes do not match the request.');
  }
  return {
    contentType: responseType,
    receivedBytes,
    isText,
    blob: isText ? null : new Blob(binaryChunks, { type: responseType }),
  };
}
