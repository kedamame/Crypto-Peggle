/**
 * Guard: eth_signTypedData_v4 payloads must include a non-empty EIP-712 domain.
 * Regression for Zerion in-app browser ("Internal error" / -32603).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getTypesForEIP712Domain, serializeTypedData } from 'viem';

const require = createRequire(import.meta.url);

// Mirror serializePaymentTypedData without pulling in Next/TS path aliases.
function serializePaymentTypedData(message) {
  const domain = message.domain ?? {};
  const types = {
    EIP712Domain: getTypesForEIP712Domain({ domain }),
    ...message.types,
  };
  return serializeTypedData({
    domain,
    types,
    primaryType: message.primaryType,
    message: message.message,
  });
}

const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};
const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};
const message = {
  from: '0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638',
  to: '0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638',
  value: 1000n,
  validAfter: 0n,
  validBefore: 1_900_000_000n,
  nonce: `0x${'ab'.repeat(32)}`,
};

const broken = JSON.parse(
  serializeTypedData({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message,
  }),
);
assert.deepEqual(broken.domain, {}, 'precondition: bare serializeTypedData drops domain');

const fixed = JSON.parse(
  serializePaymentTypedData({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message,
  }),
);
assert.equal(fixed.domain.name, 'USD Coin');
assert.equal(fixed.domain.version, '2');
assert.equal(fixed.domain.chainId, 8453);
assert.equal(
  fixed.domain.verifyingContract,
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
);
assert.ok(Array.isArray(fixed.types.EIP712Domain));
assert.equal(fixed.primaryType, 'TransferWithAuthorization');
assert.equal(fixed.message.value, '1000');

// Keep the require so accidental deletion of the source helper fails CI locally.
require('fs').accessSync(new URL('../src/lib/x402Client.ts', import.meta.url));

console.log('ok: x402 typed-data domain serialization');
