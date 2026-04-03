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

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

register.registerMetric(httpRequestCounter);

app.get('/status', (req, res) => {
  httpRequestCounter.inc({
    method: 'GET',
    route: '/status',
    status_code: 200,
  });

  res.status(200).json({
    success: true,
    status: 'ok',
    version: APP_VERSION,
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    hostname: process.env.HOSTNAME || 'local',
  });
});

app.post('/data', (req, res) => {
  const { name, value } = req.body || {};

  if (!name || value === undefined) {
    httpRequestCounter.inc({
      method: 'POST',
      route: '/data',
      status_code: 400,
    });

    return res.status(400).json({
      success: false,
      message: 'Both "name" and "value" are required.',
    });
  }

  httpRequestCounter.inc({
    method: 'POST',
    route: '/data',
    status_code: 201,
  });

  return res.status(201).json({
    success: true,
    message: 'Data received successfully.',
    data: {
      name,
      value,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/healthz', (req, res) => {
  httpRequestCounter.inc({
    method: 'GET',
    route: '/healthz',
    status_code: 200,
  });

  res.status(200).send('healthy');
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
}

module.exports = app;