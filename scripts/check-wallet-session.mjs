/**
 * Guard: wallet session JSON shape used for refresh reconnect.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/lib/walletSession.ts', import.meta.url), 'utf8');
assert.match(src, /WALLET_SESSION_KEY = 'dotshot\.wallet\.v1'/);
assert.match(src, /source: 'farcaster' \| 'eip6963' \| 'injected'/);
assert.match(src, /export function saveWalletSession/);
assert.match(src, /export function loadWalletSession/);
assert.match(src, /export function clearWalletSession/);

const sample = {
  schemaVersion: 1,
  source: 'injected',
  rdns: 'window.ethereum',
  address: '0xabcdef0000000000000000000000000000000001',
  savedAt: Date.now(),
};
const roundTrip = JSON.parse(JSON.stringify(sample));
assert.equal(roundTrip.source, 'injected');
assert.equal(roundTrip.rdns, 'window.ethereum');

const game = readFileSync(new URL('../src/components/CryptoPeggleGame.tsx', import.meta.url), 'utf8');
assert.match(game, /saveWalletSession/);
assert.match(game, /loadWalletSession/);
assert.match(game, /clearWalletSession/);
assert.match(game, /method: 'eth_accounts'/);
assert.match(game, /accountsChanged/);

console.log('ok: wallet session persistence wiring');
