#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';

function generateRsaPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

function envValue(value) {
  return JSON.stringify(value.replace(/\n/g, '\\n'));
}

const access = generateRsaPair();
const refresh = generateRsaPair();

console.log([
  `JWT_ACCESS_PUBLIC_KEY=${envValue(access.publicKey)}`,
  `JWT_ACCESS_PRIVATE_KEY=${envValue(access.privateKey)}`,
  `JWT_REFRESH_PUBLIC_KEY=${envValue(refresh.publicKey)}`,
  `JWT_REFRESH_PRIVATE_KEY=${envValue(refresh.privateKey)}`,
].join('\n'));
