import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { validateWebhookSignature } from './webhook-signature.js';

const secret = 'your_secret_key_here';
const requestId = '2066ca19-c6f1-498a-be75-1923005edd06';
const dataId = 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3';
const timestamp = '1742505638683';

function signatureFor({ id = dataId, request = requestId, ts = timestamp } = {}) {
  const fields = [`id:${id}`];
  if (request) fields.push(`request-id:${request}`);
  fields.push(`ts:${ts}`);
  const hash = crypto.createHmac('sha256', secret).update(`${fields.join(';')};`).digest('hex');
  return `ts=${ts},v1=${hash}`;
}

test('acepta el vector oficial y conserva las mayúsculas de data.id', () => {
  const result = validateWebhookSignature({ signature: signatureFor(), requestId, dataId, secret });
  assert.equal(result.valid, true);
});

test('omite request-id del manifiesto cuando el header no está presente', () => {
  const result = validateWebhookSignature({ signature: signatureFor({ request: '' }), dataId, secret });
  assert.equal(result.valid, true);
});

test('rechaza la firma si data.id cambia de mayúsculas a minúsculas', () => {
  const result = validateWebhookSignature({
    signature: signatureFor(),
    requestId,
    dataId: dataId.toLowerCase(),
    secret,
  });
  assert.equal(result.valid, false);
});

test('rechaza firmas manipuladas, incompletas o sin secreto', () => {
  assert.equal(validateWebhookSignature({ signature: signatureFor().replace(/.$/, '0'), requestId, dataId, secret }).valid, false);
  assert.equal(validateWebhookSignature({ signature: `ts=${timestamp}`, requestId, dataId, secret }).valid, false);
  assert.equal(validateWebhookSignature({ signature: signatureFor(), requestId, dataId, secret: '' }).valid, false);
});
