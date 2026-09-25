/**
 * Local-only: trust Windows root CAs so Next can proxy to the ASP.NET HTTPS
 * development certificate when BACKEND_API_URL is https://localhost:7140.
 * Prefer NEXT_PUBLIC_API_BASE_URL=https://localhost:7140 (browser → API direct).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { spawn } = require('child_process');
const child = spawn(
  process.execPath,
  ['--use-system-ca', require.resolve('next/dist/bin/next'), 'dev', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  }
);

child.on('exit', (code) => process.exit(code ?? 0));
