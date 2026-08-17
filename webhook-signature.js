import crypto from 'node:crypto';

export function extractWebhookDataId(req) {
  const candidates = [req?.query?.['data.id'], req?.body?.data?.id, req?.body?.id];
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

export function validateWebhookSignature({ signature, requestId, dataId, secret }) {
  const normalizedSignature = String(signature || '').trim();
  const normalizedRequestId = String(requestId || '').trim();
  // El SDK oficial actual conserva exactamente data.id al construir el HMAC.
  const normalizedDataId = String(dataId || '').trim();
  const normalizedSecret = String(secret || '').trim();

  if (!normalizedSignature || !normalizedRequestId || !normalizedDataId || !normalizedSecret) {
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
  if (!/^\d+$/.test(timestamp) || !/^[a-f\d]{64}$/i.test(receivedHash)) {
    return { valid: false, reason: 'malformed_signature' };
  }

  const manifestValue = `id:${normalizedDataId};request-id:${normalizedRequestId};ts:${timestamp};`;
  const expectedHash = crypto
    .createHmac('sha256', normalizedSecret)
    .update(manifestValue)
    .digest('hex');

  const expected = Buffer.from(expectedHash, 'hex');
  const received = Buffer.from(receivedHash, 'hex');
  const valid = expected.length === received.length && crypto.timingSafeEqual(expected, received);
  return {
    valid,
    reason: valid ? 'valid' : 'invalid_signature',
    hasTimestamp: true,
    // No contiene la clave ni la firma; se registra únicamente bajo el
    // diagnóstico temporal de pruebas para contrastarlo con Mercado Pago.
    manifest: manifestValue,
  };
}
