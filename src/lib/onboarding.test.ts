import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePhoneNumber, simHealth } from './onboarding.ts';

test('normalizes common Indian phone formats', () => {
  assert.equal(normalizePhoneNumber('98765 43210'), '+919876543210');
  assert.equal(normalizePhoneNumber('09876543210'), '+919876543210');
  assert.equal(normalizePhoneNumber('+91 98765 43210'), '+919876543210');
  assert.equal(normalizePhoneNumber('not a phone'), null);
});

test('derives advisory SIM health without using it as authentication', () => {
  assert.equal(simHealth('+919876543210', '9876543210', true), 'ok');
  assert.equal(simHealth('+919876543210', null, true), 'number-unavailable');
  assert.equal(simHealth('+919876543210', '+919000000000', true), 'mismatch');
  assert.equal(simHealth('+919876543210', '+919876543210', false), 'absent');
  assert.equal(simHealth('+919876543210', null, null), 'not-reported');
});
