// start.js — boots all three microservices + the gateway as separate processes.
// One command, "yield and go" — this is what islo runs inside the sandbox.
const { spawn } = require('child_process');
const path = require('path');

const services = [
  ['markets-svc', 'services/markets-svc/index.js'],
  ['trading-svc', 'services/trading-svc/index.js'],
  ['settlement-svc', 'services/settlement-svc/index.js'],
  ['gateway', 'gateway/index.js'],
];

console.log('\x1b[1mWorld Cup Prediction Market — booting 3 microservices + gateway\x1b[0m\n');

const children = services.map(([name, file]) => {
  const child = spawn('node', [path.join(__dirname, file)], { stdio: 'inherit', env: process.env });
  child.on('exit', (code) => {
    console.error(`\x1b[31m[${name}] exited (${code}) — shutting down\x1b[0m`);
    children.forEach((c) => c !== child && c.kill());
    process.exit(code || 1);
  });
  return child;
});

process.on('SIGINT', () => { children.forEach((c) => c.kill()); process.exit(0); });
process.on('SIGTERM', () => { children.forEach((c) => c.kill()); process.exit(0); });
