# Deployment Architecture

**Target**: Ubuntu VPS on Namecheap  
**Stack**: Nginx + Supervisor + MongoDB + PostgreSQL + Redis  
**Last Updated**: 2026-05-23

---

## Architecture Diagram

```
Internet
    │
    ▼
[Nginx :80/:443]  ← Certbot SSL (Let's Encrypt)
    │
    ├── / ──────────────────► [Next.js :3000]    (public website)
    ├── /api/ ──────────────► [FastAPI :8000]     (school management)
    ├── /cms/api/ ──────────► [Django REST :8001] (CMS API)
    └── /cms/admin/ ────────► [Django Admin :8001]
    
[Supervisor] manages all processes
    ├── fastapi     → uvicorn
    ├── django      → gunicorn
    └── nextjs      → next start

[MongoDB :27017]   school management data
[PostgreSQL :5432] CMS data
[Redis :6379]      sessions, rate limiting, AI cache
```

---

## VPS Initial Setup

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install essentials
sudo apt install -y python3 python3-pip python3-venv nodejs npm nginx supervisor certbot python3-certbot-nginx redis-server postgresql postgresql-contrib git curl

# 3. Install Node.js 20 (for Next.js)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable mongod && sudo systemctl start mongod

# 5. Create app user
sudo useradd -m -s /bin/bash rightway
sudo mkdir -p /var/log/rightway
sudo chown rightway:rightway /var/log/rightway
```

---

## Directory Structure on VPS

```
/home/rightway/
├── app/
│   ├── backend/          FastAPI school management
│   ├── frontend/         React dashboard (built → /var/www/dashboard)
│   ├── website/          Next.js public website
│   ├── cms/              Django CMS service
│   ├── .env              Production environment variables
│   └── venv/             Python virtual environment
├── logs/ → /var/log/rightway/
└── backups/              MongoDB dump files
```

---

## FastAPI Setup

```bash
cd /home/rightway/app

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Test startup
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

---

## Django CMS Setup

```bash
cd /home/rightway/app/cms

source ../venv/bin/activate
pip install django djangorestframework psycopg2-binary whitenoise gunicorn aiosmtplib

# Database setup
sudo -u postgres createdb rightway_cms
sudo -u postgres createuser rightway_cms_user
sudo -u postgres psql -c "ALTER USER rightway_cms_user WITH PASSWORD 'strongpassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rightway_cms TO rightway_cms_user;"

python manage.py migrate
python manage.py createsuperuser
```

---

## Next.js Setup

```bash
cd /home/rightway/app/website

npm install
npm run build

# Test
npm start
```

---

## Supervisor Configuration

### `/etc/supervisor/conf.d/fastapi.conf`
```ini
[program:fastapi]
command=/home/rightway/app/venv/bin/uvicorn backend.server:app --host 127.0.0.1 --port 8000 --workers 2
directory=/home/rightway/app
user=rightway
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/rightway/fastapi.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=5
environment=ENV_FILE="/home/rightway/app/.env"
```

### `/etc/supervisor/conf.d/django.conf`
```ini
[program:django]
command=/home/rightway/app/venv/bin/gunicorn cms.wsgi:application --bind 127.0.0.1:8001 --workers 2
directory=/home/rightway/app/cms
user=rightway
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/rightway/django.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=5
```

### `/etc/supervisor/conf.d/nextjs.conf`
```ini
[program:nextjs]
command=/usr/bin/node /home/rightway/app/website/node_modules/.bin/next start --port 3000
directory=/home/rightway/app/website
user=rightway
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/rightway/nextjs.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=5
```

### Supervisor Commands
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
sudo supervisorctl status
sudo supervisorctl restart fastapi
```

---

## Nginx Configuration

### `/etc/nginx/sites-available/rightway`
```nginx
server {
    listen 80;
    server_name learnrightschool.com www.learnrightschool.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name learnrightschool.com www.learnrightschool.com;

    ssl_certificate /etc/letsencrypt/live/learnrightschool.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/learnrightschool.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    client_max_body_size 50M;

    # Public website (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # School management API (FastAPI)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /api/ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Django CMS API
    location /cms/api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Django admin
    location /cms/admin/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
    }

    # Serve React dashboard static build (optional - if serving separately)
    location /dashboard/ {
        root /var/www;
        try_files $uri $uri/ /dashboard/index.html;
    }

    # Nginx access log
    access_log /var/log/nginx/rightway_access.log;
    error_log /var/log/nginx/rightway_error.log;
}
```

### Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/rightway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL certificate
sudo certbot --nginx -d learnrightschool.com -d www.learnrightschool.com
```

---

## Redis Setup

```bash
# Redis is already installed via apt
# Configure max memory
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

sudo systemctl enable redis
sudo systemctl start redis
```

---

## Logging Structure

```
/var/log/rightway/
├── fastapi.log         FastAPI stdout (Supervisor)
├── django.log          Django stdout (Supervisor)
├── nextjs.log          Next.js stdout (Supervisor)
├── app.log             Application events (rotating, 10MB × 5)
├── error.log           Errors only (rotating, 10MB × 5)
├── finance.log         Finance operations audit trail
└── ai_usage.log        AI API usage tracking
```

Python logging config in `server.py`:
```python
import logging
from logging.handlers import RotatingFileHandler
import os

LOG_DIR = os.environ.get("LOG_DIR", "/var/log/rightway")

def setup_logging():
    formatter = logging.Formatter(
        "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    handlers = {
        "app": RotatingFileHandler(f"{LOG_DIR}/app.log", maxBytes=10_000_000, backupCount=5),
        "error": RotatingFileHandler(f"{LOG_DIR}/error.log", maxBytes=10_000_000, backupCount=5),
        "finance": RotatingFileHandler(f"{LOG_DIR}/finance.log", maxBytes=10_000_000, backupCount=10),
        "ai": RotatingFileHandler(f"{LOG_DIR}/ai_usage.log", maxBytes=10_000_000, backupCount=5),
    }

    for name, handler in handlers.items():
        handler.setFormatter(formatter)
        logging.getLogger(name).addHandler(handler)

    logging.getLogger("error").setLevel(logging.ERROR)
```

---

## MongoDB Backup Strategy

```bash
# Daily backup script: /home/rightway/scripts/backup_mongo.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/rightway/backups"
DB_NAME="rightway"

mongodump --db $DB_NAME --out "$BACKUP_DIR/mongo_$DATE"
tar -czf "$BACKUP_DIR/mongo_$DATE.tar.gz" "$BACKUP_DIR/mongo_$DATE"
rm -rf "$BACKUP_DIR/mongo_$DATE"

# Keep only last 7 days
find $BACKUP_DIR -name "mongo_*.tar.gz" -mtime +7 -delete

echo "Backup completed: mongo_$DATE.tar.gz"
```

```bash
# Cron job (run daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /home/rightway/scripts/backup_mongo.sh >> /var/log/rightway/backup.log 2>&1
```

---

## Service Start Order

```bash
# Start in this order:
sudo systemctl start mongod
sudo systemctl start postgresql
sudo systemctl start redis
sudo supervisorctl start fastapi
sudo supervisorctl start django
sudo supervisorctl start nextjs
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All security hardening complete (see `02_security_hardening.md`)
- [ ] Emergent vendor removed (see `03_emergent_removal.md`)
- [ ] `.env` file populated with all production keys
- [ ] SSL certificate obtained (Certbot)
- [ ] MongoDB indexes created
- [ ] PostgreSQL database created and migrated
- [ ] DNS pointing to VPS IP

### Go-Live
- [ ] All 3 services running via Supervisor
- [ ] Nginx config tested and active
- [ ] HTTPS working on all domains
- [ ] Health check endpoint responding: `GET /api/health`
- [ ] Login working for all roles
- [ ] File upload working (local media dir + WhiteNoise)
- [ ] Email sending working (Mailtrap)
- [ ] AI features responding (TurboAI, etc.)
