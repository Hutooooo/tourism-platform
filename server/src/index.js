'use strict';

const config = require('./config');
const app = require('./app');

// Bind explicitly to 0.0.0.0 so the API is reachable from outside the host
// (containers, reverse proxies, cloud runtimes). PORT comes from the environment.
const server = app.listen(config.port, config.host, () => {
  console.log('');
  console.log('  Sri Lanka ↔ Italy tourism API');
  console.log(`  → http://${config.host}:${config.port}`);
  console.log(`  → env: ${config.env}`);
  console.log(`  → db:  ${config.db.file}`);
  console.log(`  → uploads: ${config.upload.dir}`);
  console.log(`  → cors origins: ${config.clientOrigins.join(', ')}`);
  console.log('');
  if (!config.isProd) {
    console.log('  Public site runs separately:  npm run dev:client');
    console.log('');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Set PORT to a free port and retry.`);
    process.exit(1);
  }
  throw err;
});

// Graceful shutdown so WAL checkpoints complete and sockets close cleanly.
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => {
    try {
      require('./db').db.close();
    } catch {
      // DB may already be closed.
    }
    process.exit(0);
  });
  // Force-exit if connections refuse to drain.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
