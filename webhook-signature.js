import crypto from 'node:crypto';

export function validateWebhookSignature({ signature, requestId, dataId, secret }) {
  const normalizedSignature = String(signature || '').trim();
  const normalizedRequestId = String(requestId || '').trim();
  // El SDK oficial actual conserva exactamente data.id al construir el HMAC.
  const normalizedDataId = String(dataId || '').trim();
  const normalizedSecret = String(secret || '').trim();

  if (!normalizedSignature || !normalizedDataId || !normalizedSecret) {
    return { valid: false, reason: 'missing_values' };
  }

  let timestamp = '';
  let receivedHash = '';
  for (const part of normalizedSignature.split(',')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    if (key === 'ts') timestamp = value;
    if (key === 'v1') receivedHash = value;
  }

  if (!timestamp || !receivedHash) {
    return { valid: false, reason: 'incomplete_signature' };
  }
  if (!/^\d+$/.test(timestamp)) {
    return { valid: false, reason: 'malformed_signature' };
  }

  const manifest = [`id:${normalizedDataId}`];
  if (normalizedRequestId) manifest.push(`request-id:${normalizedRequestId}`);
  manifest.push(`ts:${timestamp}`);
  const expectedHash = crypto
    .createHmac('sha256', normalizedSecret)
    .update(`${manifest.join(';')};`)
    .digest('hex');

  const valid = Buffer.byteLength(expectedHash) === Buffer.byteLength(receivedHash)
    && crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(receivedHash));
  return { valid, reason: valid ? 'valid' : 'invalid_signature', hasTimestamp: true };
}
