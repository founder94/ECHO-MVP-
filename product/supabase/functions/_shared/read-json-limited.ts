// Read at most the server limit before parsing; Content-Length is only an early hint.
export class RequestProblem extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export async function readJsonObject(req: Request, limit: number): Promise<Record<string, unknown>> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('INVALID_SERVER_LIMIT');
  if ((req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestProblem('UNSUPPORTED_MEDIA_TYPE', 415, 'JSON 형식으로 보내 주세요.');
  }
  const reader = req.body?.getReader();
  if (!reader) throw new RequestProblem('BAD_REQUEST', 400, '요청 형식이 잘못됐어요.');
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        throw new RequestProblem('TOO_LARGE', 413, '요청이 너무 커요.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new RequestProblem('BAD_REQUEST', 400, '요청 형식이 잘못됐어요.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestProblem('BAD_REQUEST', 400, '요청 형식이 잘못됐어요.');
  }
  return body as Record<string, unknown>;
}
