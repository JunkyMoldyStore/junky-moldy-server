import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { extractWebhookDataId, validateWebhookSignature } from './webhook-signature.js';

const secret = 'your_secret_key_here';
const requestId = '2066ca19-c6f1-498a-be75-1923005edd06';
const dataId = 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3';
const timestamp = '1742505638683';

function signatureFor({ id = dataId, request = requestId, ts = timestamp, reversed = false } = {}) {
  const manifest = `id:${id};request-id:${request};ts:${ts};`;
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  if (reversed) return `v1=${hash},ts=${ts}`;
  return `ts=${ts},v1=${hash}`;
}

test('acepta el vector oficial y conserva las mayúsculas de data.id', () => {
  const result = validateWebhookSignature({ signature: signatureFor(), requestId, dataId, secret });
  assert.equal(result.valid, true);
});

test('acepta x-signature con v1 y ts en orden inverso', () => {
  const result = validateWebhookSignature({
    signature: signatureFor({ reversed: true }),
    requestId,
    dataId,
    secret,
  });
  assert.equal(result.valid, true);
});

test('extrae data.id del query antes que cualquier valor del body', () => {
  const req = { query: { 'data.id': 'query-id' }, body: { data: { id: 'body-data-id' }, id: 'body-id' } };
  assert.equal(extractWebhookDataId(req), 'query-id');
});

test('extrae el ID desde body.data.id cuando no llega en el query', () => {
  const req = { query: { 'data.id': ' ' }, body: { data: { id: dataId } } };
  const extractedId = extractWebhookDataId(req);
  assert.equal(extractedId, dataId);
  assert.equal(validateWebhookSignature({ signature: signatureFor(), requestId, dataId: extractedId, secret }).valid, true);
});

test('usa body.id como último fallback', () => {
  assert.equal(extractWebhookDataId({ query: {}, body: { id: 'body-id' } }), 'body-id');
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

test('rechaza firmas manipuladas, incompletas, sin request-id o sin secreto', () => {
  assert.equal(validateWebhookSignature({ signature: signatureFor().replace(/.$/, '0'), requestId, dataId, secret }).valid, false);
  assert.equal(validateWebhookSignature({ signature: `ts=${timestamp}`, requestId, dataId, secret }).valid, false);
  assert.equal(validateWebhookSignature({ signature: signatureFor(), requestId: '', dataId, secret }).valid, false);
  assert.equal(validateWebhookSignature({ signature: signatureFor(), requestId, dataId, secret: '' }).valid, false);
});
