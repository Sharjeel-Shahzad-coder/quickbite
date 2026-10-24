# QuickBite - Food Delivery System (DevOps Lab Project)

A multi-page food ordering app deployed with Docker Compose on AWS EC2, behind an Application Load Balancer and Auto Scaling Group, and tested with Selenium.

**Pages:** Restaurants, Menu, Cart + checkout, Order tracking (live status), Kitchen admin (stats + status updates).

## Architecture
```
Browser -> AWS ALB -> [EC2 #1 | EC2 #2]  (Auto Scaling Group, min 2 / max 3)
                        each runs Docker Compose:
                        web (Nginx + static pages) -> api (Flask/Gunicorn) -> db (PostgreSQL + pgdata volume)
Selenium (pytest) -> ALB DNS name
```
| Folder | Contents |
|---|---|
| `frontend/` | HTML/CSS/JS pages, Nginx config and Dockerfile |
| `backend/` | Flask REST API, multi-stage Dockerfile, `schema.sql` (tables + seed data) |
| `docker-compose.yml` | web, api, db; two networks; named volumes `pgdata` and `applogs` |
| `tests/` | Selenium + pytest tests |
| `aws/user-data.sh` | Launch Template bootstrap script |
| `scripts/` | Linux setup, DB backup (cron), volume persistence demo |

## 1. Run locally (Task 3 and 5)
```bash
cp .env.example .env        # edit the passwords
docker compose up -d --build
docker compose ps           # all three should be healthy
```
Open http://localhost. Admin key is `ADMIN_KEY` from `.env`.
Useful evidence commands: `docker images`, `docker ps`, `docker logs quickbite-api`, `docker exec -it quickbite-api sh`.

## 2. Linux administration (Task 2)
On the EC2 instance run `bash scripts/linux_setup.sh`, then screenshot `ls -l`, `id deploy`, `df -h`, `free -m`, `systemctl status docker`.
Cron backup: `crontab -e` then `0 2 * * * /opt/quickbite/scripts/backup.sh`.

## 3. Docker volumes (Task 4)
Place an order in the app, then run `bash scripts/volume_demo.sh`. The order count is identical after `docker compose down` and `up` because data lives in the `pgdata` volume. (Never use `down -v` in the demo, it deletes the volume.)
Note: the Compose project name comes from the folder name, so keep the folder named `quickbite`, otherwise the volume is `<folder>_pgdata`.

## 4. AWS: ALB + Auto Scaling (Task 1)
1. **Push the project to GitHub** and set `REPO_URL` in `aws/user-data.sh`.
2. **Security groups:** `alb-sg` (inbound 80 from anywhere); `app-sg` (inbound 80 from `alb-sg` only, 22 from your IP).
3. **Launch Template:** Ubuntu 24.04, t3.micro, `app-sg`, paste `aws/user-data.sh` into *Advanced details > User data*.
4. **Target Group:** type Instances, HTTP 80, health check path `/health`.
5. **Application Load Balancer:** internet-facing, 2 AZs, `alb-sg`, listener HTTP 80 forwarding to the target group.
6. **Auto Scaling Group:** use the Launch Template, same 2 AZs, attach the target group, enable ELB health checks, min 2 / desired 2 / max 3, scaling policy *Target tracking - average CPU 50%*.
7. Wait about 5 minutes, check that both targets are *healthy*, then open `http://<ALB-DNS-name>`. The footer shows the instance hostname, so refresh to see traffic switch between instances.
8. **Demonstrate scaling:** on one instance run `sudo apt install -y stress && stress --cpu 2 --timeout 400`, or load-test the ALB with `hey -z 3m http://<ALB-DNS>/api/restaurants`. Screenshot the ASG *Activity* tab showing the new instance.

Each instance has its own database (as in the exam diagram). In production you would use a shared Amazon RDS database.

## 5. Selenium (Task 6)
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r tests/requirements.txt
BASE_URL=http://<ALB-DNS-name> pytest tests -v --html=reports/report.html --self-contained-html
```
Needs Chrome installed on the machine running the tests (your laptop is fine). Set `ADMIN_KEY` if you changed it.
Tests cover: home page, cart badge, checkout, order tracking, admin status change, health endpoint.

## Evidence checklist (screenshots)
ALB + target group healthy, ASG settings and activity, `docker ps`/`docker images`, Dockerfile + compose in editor, volume demo output, Linux commands, Selenium pytest output and HTML report.

## API
`GET /health` | `GET /api/restaurants` | `GET /api/restaurants/<id>/menu` | `POST /api/orders` | `GET /api/orders/<id>` | admin (header `X-Admin-Key`): `GET /api/admin/orders`, `GET /api/admin/stats`, `PATCH /api/admin/orders/<id>/status`
