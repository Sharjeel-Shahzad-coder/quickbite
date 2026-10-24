.RECIPEPREFIX := >
up:
> cp -n .env.example .env || true
> docker compose up -d --build
down:
> docker compose down
logs:
> docker compose logs -f
ps:
> docker compose ps
test:
> BASE_URL=$${BASE_URL:-http://localhost} pytest tests -v --html=reports/report.html --self-contained-html
backup:
> bash scripts/backup.sh
