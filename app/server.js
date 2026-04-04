require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const client = require('prom-client');

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// ── Prometheus setup ──────────────────────────────────────────────────────────
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// ── Duration tracking middleware ──────────────────────────────────────────────
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const getReadableTimestamp = () => {
  return new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  httpRequestCounter.inc({ method: 'GET', route: '/status', status_code: 200 });
  res.status(200).json({
    success: true,
    status: 'ok',
    version: APP_VERSION,
    environment: NODE_ENV,
    timestamp: getReadableTimestamp(),
    hostname: process.env.HOSTNAME || 'local',
  });
});

app.post('/data', (req, res) => {
  const { name, value } = req.body || {};

  if (!name || value === undefined) {
    httpRequestCounter.inc({ method: 'POST', route: '/data', status_code: 400 });
    return res.status(400).json({
      success: false,
      message: 'Both "name" and "value" are required.',
    });
  }

  httpRequestCounter.inc({ method: 'POST', route: '/data', status_code: 201 });
  return res.status(201).json({
    success: true,
    message: 'Data received successfully.',
    data: { name, value },
    timestamp: getReadableTimestamp(),
  });
});

app.get('/healthz', (req, res) => {
  httpRequestCounter.inc({ method: 'GET', route: '/healthz', status_code: 200 });
  res.status(200).send('healthy');
});

app.get('/ready', (req, res) => {
  res.status(200).json({ ready: true });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── Start server ──────────────────────────────────────────────────────────────
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`API running on port ${PORT} in ${NODE_ENV} mode`);
  });
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`${signal} received — shutting down gracefully`);
  if (server) {
    server.close(() => {
      console.log('All requests finished. Exiting.');
      process.exit(0);
    });
  }
  setTimeout(() => process.exit(1), 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;