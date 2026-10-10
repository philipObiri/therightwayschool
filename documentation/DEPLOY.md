# Production Deployment Guide
## RightWay Centre of Learning — VPS with Nginx + Supervisorctl

> **Target stack:**  
> Ubuntu 22.04 LTS · Nginx (reverse proxy + static files) · Supervisorctl (process manager) · MongoDB 7 · Python 3.11 · Node 20

---

## Architecture Overview

```
Internet
    │
    ▼
Nginx :443 (SSL/HTTPS)
    ├── /          → serves React build (dist/) as static files
    ├── /api/*     → proxy_pass to FastAPI on 127.0.0.1:8000
    └── /media/*   → serves uploaded files from /var/www/rightway/media/
          │
          ▼
      FastAPI (Uvicorn)
      managed by Supervisorctl
          │
          ▼
      MongoDB :27017 (local socket, no external exposure)
```

---

## 1. Provision the VPS

Recommended specs for up to 500 students:
- 4 vCPU · 8 GB RAM · 80 GB SSD
- Ubuntu 22.04 LTS
- Open ports: **22** (SSH), **80** (HTTP), **443** (HTTPS)

```bash
# First login — update everything
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget ufw build-essential
```

Set up firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 2. Install System Dependencies

### Python 3.11
```bash
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip
python3.11 --version   # should print 3.11.x
```

### Node.js 20 + npm
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # v20.x.x
```

### Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### Supervisor
```bash
sudo apt install -y supervisor
sudo systemctl enable supervisor
```

### MongoDB 7
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable mongod && sudo systemctl start mongod

# Verify
mongosh --eval "db.adminCommand('ping')"
```

---

## 3. Deploy the Code

### 3a. Create the app user and directory
```bash
sudo useradd -m -s /bin/bash rightway
sudo mkdir -p /var/www/rightway
sudo chown rightway:rightway /var/www/rightway
```

### 3b. Upload / clone the project
```bash
# Option A — git clone (recommended)
sudo -u rightway git clone https://github.com/your-org/rightway.git /var/www/rightway

# Option B — rsync from your local machine (run on your machine)
rsync -avz --exclude 'node_modules' --exclude '__pycache__' --exclude '.git' \
  ./Trinidad/ user@YOUR_SERVER_IP:/var/www/rightway/
```

---

## 4. Backend Setup

```bash
cd /var/www/rightway/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create directories
mkdir -p media logs
```

### Create the production .env
```bash
sudo nano /var/www/rightway/backend/.env
```

Paste and fill in:
```env
# ── Database ──────────────────────────────────────────────────
MONGO_URL=mongodb://localhost:27017
DB_NAME=rightway

# ── Security ──────────────────────────────────────────────────
# Generate: python3 -c "import secrets; print(secrets.token_hex(64))"
JWT_SECRET=REPLACE_WITH_STRONG_64_CHAR_HEX_SECRET

# ── CORS ──────────────────────────────────────────────────────
CORS_ORIGINS=https://learnrightschool.com,https://www.learnrightschool.com

# ── Environment ───────────────────────────────────────────────
ENVIRONMENT=production

# ── Email (Mailtrap Sending) ──────────────────────────────────
MAILTRAP_HOST=live.smtp.mailtrap.io
MAILTRAP_PORT=587
MAILTRAP_USERNAME=api
MAILTRAP_PASSWORD=YOUR_MAILTRAP_PASSWORD
EMAIL_FROM=no-reply@learnrightschool.com
EMAIL_FROM_NAME=The RightWay Centre of Learning
EMAIL_LOG_FILE=./logs/email.log

# ── File Storage ──────────────────────────────────────────────
MEDIA_ROOT=/var/www/rightway/backend/media
MEDIA_URL=https://learnrightschool.com/media

# ── AI APIs (optional — remove if not used) ───────────────────
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME
GOOGLE_GENAI_API_KEY=AIza-REPLACE_ME

# ── Payments (optional) ───────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_REPLACE_ME
STRIPE_PUBLIC_KEY=pk_live_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME

# ── Google OAuth (optional) ───────────────────────────────────
GOOGLE_CLIENT_ID=REPLACE_ME.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=REPLACE_ME

# ── Logging ───────────────────────────────────────────────────
LOG_DIR=/var/www/rightway/backend/logs
```

Secure the file:
```bash
chmod 600 /var/www/rightway/backend/.env
chown rightway:rightway /var/www/rightway/backend/.env
```

### Seed the database
```bash
cd /var/www/rightway/backend
source venv/bin/activate
python seed_admin.py
```

---

## 5. Build the Frontend

```bash
cd /var/www/rightway/frontend

# Install dependencies
npm install

# Set production API URL
echo "VITE_API_URL=https://learnrightschool.com" > .env.production

# Build
npm run build
# Creates: frontend/dist/
```

The built files go to `/var/www/rightway/frontend/dist/`. Nginx will serve these as static files.

---

## 6. Configure Supervisorctl

Supervisor keeps the FastAPI process alive and restarts it on crash.

### Create the supervisor config
```bash
sudo nano /etc/supervisor/conf.d/rightway.conf
```

Paste:
```ini
[program:rightway-api]
command=/var/www/rightway/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000 --workers 4
directory=/var/www/rightway/backend
user=rightway
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
stderr_logfile=/var/log/supervisor/rightway-api.err.log
stdout_logfile=/var/log/supervisor/rightway-api.out.log
environment=HOME="/home/rightway",USER="rightway"
```

> **workers=4** — a good starting point for 4 vCPUs. Each worker handles requests independently.
> For WebSocket (chat), use a single worker with `--workers 1` until you add Redis pub/sub.

### Load and start
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start rightway-api
sudo supervisorctl status
```

Expected output:
```
rightway-api    RUNNING   pid 12345, uptime 0:00:05
```

### Supervisor management commands
```bash
sudo supervisorctl status          # check status
sudo supervisorctl restart rightway-api   # restart after code changes
sudo supervisorctl stop rightway-api      # stop
sudo supervisorctl tail rightway-api      # live tail logs
```

---

## 7. Configure Nginx

### Remove the default site
```bash
sudo rm /etc/nginx/sites-enabled/default
```

### Create the RightWay site config
```bash
sudo nano /etc/nginx/sites-available/rightway
```

Paste:
```nginx
server {
    listen 80;
    server_name learnrightschool.com www.learnrightschool.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name learnrightschool.com www.learnrightschool.com;

    # SSL certificates (managed by Certbot — see Step 8)
    ssl_certificate     /etc/letsencrypt/live/learnrightschool.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/learnrightschool.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1000;

    # React frontend — serve static build
    root /var/www/rightway/frontend/dist;
    index index.html;

    # All non-API, non-media routes go to index.html (React Router handles them)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # FastAPI backend — proxy all /api/ requests
    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Required for WebSocket (chat module)
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";

        # Increase timeouts for long-running AI requests
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # Serve uploaded media files directly (faster than going through Python)
    location /media/ {
        alias /var/www/rightway/backend/media/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logs
    access_log /var/log/nginx/rightway.access.log;
    error_log  /var/log/nginx/rightway.error.log;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/rightway /etc/nginx/sites-enabled/
sudo nginx -t          # must say: syntax is ok
sudo systemctl reload nginx
```

---

## 8. SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx

# Issue certificate (replace with your domain)
sudo certbot --nginx -d learnrightschool.com -d www.learnrightschool.com

# Follow prompts:
# - Enter email address for renewal notifications
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot installs a cron job that renews the certificate automatically before expiry.

---

## 9. Deploy Updates (After First Setup)

Whenever you push new code:

```bash
# On your local machine — push to server
rsync -avz --exclude 'node_modules' --exclude '__pycache__' --exclude 'venv' --exclude '.git' \
  ./Trinidad/ user@YOUR_SERVER_IP:/var/www/rightway/

# On the server — rebuild frontend + restart API
ssh user@YOUR_SERVER_IP

cd /var/www/rightway/frontend && npm install && npm run build
cd /var/www/rightway/backend && source venv/bin/activate && pip install -r requirements.txt
sudo supervisorctl restart rightway-api
```

---

## 10. MongoDB Backup

### Manual backup
```bash
mongodump --db rightway --out /var/backups/rightway/$(date +%Y-%m-%d)
```

### Automated daily backup (cron)
```bash
sudo crontab -e
```
Add:
```cron
# Backup MongoDB daily at 2am, keep 30 days
0 2 * * * mongodump --db rightway --out /var/backups/rightway/$(date +\%Y-\%m-\%d) && find /var/backups/rightway -maxdepth 1 -mtime +30 -exec rm -rf {} +
```

### Restore from backup
```bash
mongorestore --db rightway /var/backups/rightway/2025-05-24/rightway/
```

---

## 11. Health Checks

```bash
# Is the API running?
curl -I http://localhost:8000/docs
# Expected: HTTP/1.1 200 OK

# Is Nginx proxying correctly?
curl -I https://learnrightschool.com/api/auth/me
# Expected: HTTP/1.1 401 (correct — not logged in)

# Is MongoDB running?
sudo systemctl status mongod

# Is Supervisor managing the API?
sudo supervisorctl status rightway-api
# Expected: RUNNING

# View live API logs
sudo supervisorctl tail -f rightway-api
```

---

## 12. Troubleshooting

### 502 Bad Gateway
The FastAPI process is not running.
```bash
sudo supervisorctl status rightway-api
sudo supervisorctl start rightway-api
sudo tail -50 /var/log/supervisor/rightway-api.err.log
```

### Changes not showing after deploy
```bash
cd /var/www/rightway/frontend && npm run build
sudo systemctl reload nginx
```

### MongoDB connection refused
```bash
sudo systemctl status mongod
sudo systemctl start mongod
```

### SSL certificate expired
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Port 8000 refusing connections from Nginx
Check that FastAPI is binding to `127.0.0.1` not `0.0.0.0` (Nginx proxies internally, it should never be exposed to the internet):
```bash
ss -tlnp | grep 8000
# Should show: 127.0.0.1:8000
```

---

## Quick Reference

| Service | Command |
|---------|---------|
| Start API | `sudo supervisorctl start rightway-api` |
| Restart API | `sudo supervisorctl restart rightway-api` |
| View API logs | `sudo supervisorctl tail -f rightway-api` |
| Reload Nginx | `sudo systemctl reload nginx` |
| Nginx error log | `sudo tail -f /var/log/nginx/rightway.error.log` |
| Start MongoDB | `sudo systemctl start mongod` |
| MongoDB shell | `mongosh rightway` |
| Rebuild frontend | `cd /var/www/rightway/frontend && npm run build` |
| Renew SSL | `sudo certbot renew && sudo systemctl reload nginx` |
