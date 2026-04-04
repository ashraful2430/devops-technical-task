# DevOps Technical Task — Production API System

A production-style system demonstrating containerization, CI/CD automation, traffic management, and observability. Built with Node.js, Docker, Nginx, Prometheus, Grafana, GitHub Actions, deployed on AWS EC2 with Kubernetes EKS and Terraform.

---

## System Architecture

All components run as Docker containers orchestrated by Docker Compose on AWS EC2. Nginx is the only public entry point — app containers are not exposed directly.

    Internet
        │
        ▼
    Nginx :80 (Reverse Proxy + Load Balancer)
        │
        ├─────────────────────┐
        ▼                     ▼
    app1 :3000            app2 :3000
        │                     │
        └──────────┬──────────┘
                   ▼
            Prometheus :9090
                   ▼
            Grafana :3001

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /status | Service health, version, instance info |
| POST | /data | Accepts JSON payload, echoes back with metadata |
| GET | /healthz | Liveness probe for Docker and Nginx |
| GET | /ready | Readiness probe for zero-downtime deploy |
| GET | /metrics | Prometheus scrape endpoint |

---

## Project Structure

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
    ├── k8s/
    │   ├── deployment.yml
    │   ├── service.yml
    │   ├── configmap.yml
    │   └── hpa.yml
    ├── terraform/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── .github/
    │   └── workflows/
    │       └── ci.yml
    ├── Dockerfile
    ├── docker-compose.yml
    └── package.json

---

## Containerization Approach

The Dockerfile uses a three-stage build:

- Stage 1 (deps) — installs all npm packages, cached for faster rebuilds
- Stage 2 (test) — runs Jest test suite, build fails if any test fails
- Stage 3 (production) — lean final image with no devDependencies

Security practices applied:
- Non-root user (appuser) so the container cannot write to system paths
- npm ci --omit=dev so no test tooling ships in the production image
- HEALTHCHECK so Docker automatically monitors container health
- Exec form CMD so the process receives SIGTERM for graceful shutdown
- Environment variables declared via ENV with no hardcoded values

---

## How the System Handles ~100 Requests/Second

Four layers work together:

1. Horizontal scaling — two Node.js containers run in parallel. Each handles ~50-80 req/s giving ~100-160 req/s combined. Adding more instances in docker-compose.yml scales this further with no code changes.

2. Nginx least_conn load balancing — routes each request to whichever upstream has the fewest active connections. Better than round-robin for variable workloads.

3. Nginx keepalive connections — keepalive 32 maintains persistent TCP connections to each upstream container, eliminating handshake overhead at high concurrency.

4. Node.js non-blocking I/O — Express handles concurrent requests via the event loop without spawning threads, efficient for this API workload.

---

## Deployment Process

The CI/CD pipeline runs automatically on every push to main via GitHub Actions in three jobs:

Job 1 — Test: installs Node.js 20, runs npm ci, runs all 6 Jest tests. Pipeline stops here if any test fails.

Job 2 — Build: runs the multi-stage Docker build to confirm the image builds cleanly.

Job 3 — Deploy: SSHs into the EC2 server, pulls latest code, performs a rolling restart, reloads Nginx, and runs a smoke test against the live endpoint.

Pull requests trigger Jobs 1 and 2 only. Only merges to main trigger the full deploy.

---

## Zero-Downtime Deployment

The deploy job restarts containers one at a time:

1. Pull new code on the server
2. Rebuild and restart app1 only
3. Poll Docker health check until app1 returns healthy — Nginx keeps routing to app2 during this entire time
4. Rebuild and restart app2 only
5. Poll Docker health check until app2 returns healthy
6. Run nginx -s reload which applies config in-place with zero dropped connections

At no point are both containers down simultaneously. If a container fails its health check the deploy aborts immediately and the previous version stays running. The /ready endpoint is what Nginx checks before routing any traffic to a newly started container.

---

## Logging and Monitoring Setup

### Logs

Every request produces a structured log line via Morgan showing method, path, status code, response time, and container hostname. View logs with:

    docker compose logs -f app1
    docker compose logs -f

### Metrics

The /metrics endpoint on each container exposes Prometheus metrics including http_requests_total, http_request_duration_seconds, process CPU, and heap memory usage. Prometheus scrapes both instances every 15 seconds automatically.

Grafana reads from Prometheus and displays dashboards for CPU usage per instance, event loop lag, memory usage, active requests, and process restart count. Dashboard used: Node.js Application Dashboard (Grafana ID 11159).

---

## Cloud Deployment

- Provider: AWS EC2
- Instance: t3.small, Ubuntu 22.04 LTS, us-east-1
- Ports open: 22 (SSH), 80 (HTTP), 9090 (Prometheus), 3001 (Grafana)
- Infrastructure provisioned with Terraform (see Bonus section)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | production | Runtime environment |
| PORT | 3000 | Port the app listens on |
| APP_VERSION | 1.0.0 | Version returned by /status |
| INSTANCE_ID | unknown | Container identifier |
| GRAFANA_PASSWORD | admin123 | Grafana admin password |

Copy .env.example to .env and fill in values. Never commit .env to git.

---

## Bonus 1 — Kubernetes on AWS EKS

The API is also deployed on AWS EKS running Kubernetes 1.34 with two t3.small worker nodes created via eksctl.

Manifest files:

| File | Purpose |
|------|---------|
| k8s/deployment.yml | Runs 2 pods with rolling update strategy |
| k8s/service.yml | AWS Load Balancer routing traffic to pods |
| k8s/configmap.yml | Environment variables injected into pods |
| k8s/hpa.yml | Autoscales pods when CPU exceeds 60% |

Rolling update is configured with maxUnavailable 0 and maxSurge 1 — Kubernetes never terminates a pod before its replacement is healthy. HPA automatically scales between 2 and 5 pods based on CPU utilization.

Deploy commands:

    kubectl apply -f k8s/configmap.yml
    kubectl apply -f k8s/deployment.yml
    kubectl apply -f k8s/service.yml
    kubectl apply -f k8s/hpa.yml

Rolling update:

    kubectl set image deployment/devops-api api=ashik6251/devops-api:latest
    kubectl rollout status deployment/devops-api
    kubectl rollout undo deployment/devops-api

Horizontal scaling:

    kubectl scale deployment devops-api --replicas=3
    kubectl get hpa

---

## Bonus 2 — Terraform Infrastructure as Code

The entire AWS infrastructure is defined as code in the terraform/ folder. No manual clicking through the AWS console required.

Resources Terraform creates: VPC, public subnet, internet gateway, route table, security group, EC2 instance, and Elastic IP.

The EC2 user_data bootstrap script automatically installs Docker, clones the repository, creates the .env file, and starts the full Docker Compose stack on first boot — no manual server setup needed.

Security approach: IAM Instance Profile is used instead of hardcoded AWS credentials so no secrets are stored on disk. EC2 storage is encrypted at rest. Terraform state files are excluded from git.

    cd terraform
    terraform init
    terraform plan
    terraform apply
    terraform destroy