# DevOps Technical Task — Production API System

A production-style system demonstrating containerization, CI/CD automation, traffic management, and observability.

Built with:

* Node.js (API)
* Docker (containerization)
* Nginx (reverse proxy + load balancing)
* Prometheus + Grafana (monitoring)
* GitHub Actions (CI/CD)
* AWS EC2 (deployment)

---

## System Architecture

```
Internet
    │
    │ HTTP :80
    ▼
 Nginx (Reverse Proxy + Load Balancer)
    │
    │ least_conn load balancing
    ├─────────────────────┐
    ▼                     ▼
app1 (Node.js :3000)  app2 (Node.js :3000)
    │                     │
    └──────────┬──────────┘
               │ /metrics scrape every 15s
               ▼
          Prometheus :9090
               │
               ▼
          Grafana :3001
```

All components run as Docker containers using Docker Compose on a single EC2 instance.

---

## API Endpoints

| Method | Path     | Description                 |
| ------ | -------- | --------------------------- |
| GET    | /status  | Service status and metadata |
| POST   | /data    | Accepts JSON payload        |
| GET    | /healthz | Liveness check              |
| GET    | /ready   | Readiness check             |
| GET    | /metrics | Prometheus metrics endpoint |

---

### GET /status

```
curl http://YOUR_SERVER_IP/status
```

---

### POST /data

```
curl -X POST http://YOUR_SERVER_IP/data \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "value": 123}'
```

---

## How the System Handles ~100 Requests/Second

The system achieves this using:

### 1. Horizontal Scaling

Two Node.js containers (`app1`, `app2`) run in parallel.

* Each instance handles requests independently
* Combined throughput increases linearly
* Easily scalable by adding more containers

### 2. Nginx Load Balancing (least_conn)

* Routes requests to the least busy server
* Prevents uneven load distribution
* Better than round-robin for variable workloads

### 3. Persistent Connections (keepalive)

* Reuses TCP connections
* Reduces latency
* Improves throughput under high load

### 4. Non-blocking Node.js Runtime

* Uses event-driven architecture
* Handles concurrent requests efficiently
* No thread overhead

---

## Project Structure

```
devops-technical-task/
├── app/
│   └── server.js
├── tests/
│   └── app.test.js
├── nginx/
│   └── nginx.conf
├── monitoring/
│   └── prometheus/
│       └── prometheus.yml
├── .github/
│   └── workflows/
│       └── ci.yml
├── Dockerfile
├── docker-compose.yml
├── package.json
└── .env.example
```

---

## Containerization

Multi-stage Dockerfile:

* deps → install dependencies
* test → run tests
* production → lightweight production image

Key Features:

* Non-root container user
* Health checks enabled
* Only production dependencies included
* Graceful shutdown support

---

## Running Locally

```
git clone <your-repo-url>
cd devops-technical-task

npm install
npm test

docker compose up --build
```

Access:

* API → http://localhost/status
* Grafana → http://localhost:3001
* Prometheus → http://localhost:9090

---

## CI/CD Pipeline

Pipeline file:

```
.github/workflows/ci.yml
```

Flow:

```
Push to main
   ↓
Run tests
   ↓
Build Docker image
   ↓
Deploy to EC2
```

CI:

* Install dependencies
* Run tests
* Fail if tests fail

CD:

* SSH into server using GitHub Secrets
* Pull latest code
* Rolling update (app1 → app2)
* Reload Nginx
* Smoke test

---

## Zero-Downtime Deployment

```
1. Update app1
2. Wait for health check
3. Update app2
4. Wait for health check
5. Reload Nginx
```

Why it works:

* At least one instance is always running
* No traffic interruption
* Health checks prevent bad deploy

---

## Monitoring & Logging

Logs:

```
docker compose logs -f
```

Metrics available at:

```
/metrics
```

Collected data:

* request count
* request duration
* CPU usage
* memory usage

Prometheus:

```
http://YOUR_SERVER_IP:9090
```

Grafana:

```
http://YOUR_SERVER_IP:3001
```

Login:

* user: admin
* pass: admin123

---

## Cloud Deployment (AWS EC2)

Setup:

```
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

git clone <your-repo>
cd devops-technical-task

docker compose up -d --build
```

Open Ports:

* 22 → SSH
* 80 → API
* 9090 → Prometheus
* 3001 → Grafana

Live URLs:

```
http://YOUR_SERVER_IP/status
http://YOUR_SERVER_IP/data
http://YOUR_SERVER_IP:9090
http://YOUR_SERVER_IP:3001
```

---

## Environment Variables

| Variable         | Description      |
| ---------------- | ---------------- |
| NODE_ENV         | Environment mode |
| PORT             | App port         |
| APP_VERSION      | Version          |
| INSTANCE_ID      | Container ID     |
| GRAFANA_PASSWORD | Grafana password |

---

## Summary

This project demonstrates:

* Scalable API architecture
* Containerized deployment
* Load balancing with Nginx
* CI/CD automation with GitHub Actions
* Zero-downtime deployment
* Monitoring with Prometheus & Grafana
