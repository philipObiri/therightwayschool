# Backend Setup Guide — RightWay Centre of Learning

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Runtime |
| MongoDB | 7.0+ | Primary database |
| pip | latest | Package manager |

---

## 1. Install MongoDB

### Windows
1. Download the Community Server from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Run the installer, keep defaults, tick **"Install MongoDB Compass"**
3. MongoDB runs as a Windows Service automatically on boot

Verify it's running:
```powershell
mongosh --eval "db.runCommand({ connectionStatus: 1 })"
```

### Ubuntu / Debian (VPS)
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl enable mongod && sudo systemctl start mongod
```

---

## 2. Set Up Python Environment

```bash
cd Trinidad/backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

> The requirements install 144 packages including FastAPI, Motor (async MongoDB driver),
> JWT, bcrypt, PDF generation, AI SDKs, and more. Allow 2–3 minutes.

---

## 3. Configure Environment Variables

Copy the `.env` file and fill in values:

```bash
# The .env file already exists at backend/.env
# Edit it with your values:
```

**Minimum required values to run in development:**

```env
# Database — these are correct for a local MongoDB install
MONGO_URL=mongodb://localhost:27017
DB_NAME=rightway

# Security — CHANGE THIS before any real use
JWT_SECRET=dev-jwt-secret-change-before-production

# CORS — allow the React frontend
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Environment — keeps emails in a log file instead of sending them
ENVIRONMENT=development
```

**Generate a strong JWT secret:**
```bash
python -c "import secrets; print(secrets.token_hex(64))"
```
Paste the output into `JWT_SECRET=` in `.env`.

**Optional API keys** (features degrade gracefully without them):
```env
ANTHROPIC_API_KEY=sk-ant-...   # AI quiz, lesson generation
GOOGLE_GENAI_API_KEY=AIza-...  # Gemini features
OPENAI_API_KEY=sk-...          # OpenAI features
STRIPE_SECRET_KEY=sk_test_...  # Payment processing
GOOGLE_CLIENT_ID=...           # Google OAuth login
```

---

## 4. Run the Backend

```bash
# From the backend/ directory with venv activated:
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

Open in browser:
- **API docs (Swagger):** http://localhost:8000/docs
- **API docs (ReDoc):** http://localhost:8000/redoc
- **Health check:** http://localhost:8000/api/auth/me (returns 401 — expected)

---

## 5. Seed the Database

The backend ships with several seed scripts. Run them **after** the server has started at least once (to ensure collections exist).

### Step 1 — Create the first Admin user

This is the master admin account. Run this once:

```bash
python seed_admin.py
```

If `seed_admin.py` doesn't exist yet, create it and run it:

```python
# seed_admin.py — run once to bootstrap the system
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os, secrets
from dotenv import load_dotenv
load_dotenv()

pwd_ctx = CryptContext(schemes=["bcrypt"])

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    accounts = [
        {"email": "ceo@rightway.demo",         "password": "ceo123",         "name": "Dr. Margaret Thompson", "role": "CEO"},
        {"email": "principal@rightway.demo",    "password": "principal123",   "name": "Ms. Sandra Clarke",     "role": "Principal"},
        {"email": "headteacher@rightway.demo",  "password": "headteacher123", "name": "Mr. Kevin Joseph",      "role": "HeadTeacher"},
        {"email": "admin@rightway.demo",        "password": "admin123",       "name": "Mrs. Diane Baptiste",   "role": "Admin"},
        {"email": "superadmin@rightway.demo",   "password": "superadmin123",  "name": "System SuperAdmin",     "role": "SuperAdmin"},
        {"email": "edmund@rightway.demo",       "password": "teacher123",     "name": "Mr. Edmund Charles",    "role": "Teacher"},
        {"email": "finance@rightway.demo",      "password": "finance123",     "name": "Ms. Patricia Ramsay",   "role": "FinanceOfficer"},
        {"email": "hr@rightway.demo",           "password": "hr123",          "name": "Mrs. Gloria Phillip",   "role": "HR_Officer"},
        {"email": "parent@rightway.demo",       "password": "parent123",      "name": "Mr. David Hernandez",   "role": "Parent"},
        {"email": "student@rightway.demo",      "password": "student123",     "name": "Ayeyi Forson",          "role": "Student"},
    ]

    for acc in accounts:
        existing = await db.users.find_one({"email": acc["email"]})
        if existing:
            print(f"  [skip]   {acc['email']} already exists")
            continue
        doc = {
            "user_id":    "user_" + secrets.token_hex(8),
            "email":      acc["email"],
            "password":   pwd_ctx.hash(acc["password"]),
            "name":       acc["name"],
            "role":       acc["role"],
            "is_active":  True,
            "picture":    None,
        }
        await db.users.insert_one(doc)
        print(f"  [created] {acc['email']}  ({acc['role']})")

    client.close()
    print("\nDone. Log in at http://localhost:3000/login")

asyncio.run(main())
```

Run it:
```bash
python seed_admin.py
```

### Step 2 — Seed academic structure (optional but recommended)

```bash
# Seed timetable and academic periods
python populate_timetable_real.py

# Seed parent accounts (links to students)
python seed_parents.py
```

### Step 3 — Verify the database

Open MongoDB Compass and connect to `mongodb://localhost:27017`. You should see:
- Database: `rightway`
- Collection `users` with 10 accounts

Or via mongosh:
```bash
mongosh rightway --eval "db.users.find({},{email:1,role:1,_id:0}).pretty()"
```

---

## Seeded Demo Accounts

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| CEO | ceo@rightway.demo | ceo123 | Full system access |
| SuperAdmin | superadmin@rightway.demo | superadmin123 | Full + system settings |
| Principal | principal@rightway.demo | principal123 | Academic oversight |
| Head Teacher | headteacher@rightway.demo | headteacher123 | Teaching staff lead |
| Admin | admin@rightway.demo | admin123 | General administration |
| Teacher | edmund@rightway.demo | teacher123 | Classroom features |
| Finance Officer | finance@rightway.demo | finance123 | Finance module |
| HR Officer | hr@rightway.demo | hr123 | HR module |
| Parent | parent@rightway.demo | parent123 | Parent portal |
| Student | student@rightway.demo | student123 | Student portal |

> **Security note:** Change all passwords before going to production.
> Generate hashed passwords: `python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('your_new_password'))"`

---

## Common Issues

### "ModuleNotFoundError: No module named 'fastapi'"
Your virtual environment is not activated. Run `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Linux).

### "pymongo.errors.ServerSelectionTimeoutError"
MongoDB is not running. Start it:
- Windows: `net start MongoDB` or start from Services
- Linux: `sudo systemctl start mongod`

### "KeyError: 'MONGO_URL'"
The `.env` file is not being read. Make sure you're running `uvicorn` from the `backend/` directory, not a parent folder.

### Port 8000 already in use
```bash
# Find and kill the process
# Windows:
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# Linux:
fuser -k 8000/tcp
```
