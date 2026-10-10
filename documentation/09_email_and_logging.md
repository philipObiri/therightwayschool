# Email & Logging Strategy

**Last Updated**: 2026-05-23

---

## Email Architecture

| Environment | Strategy |
|-------------|----------|
| Local development | Log emails to `/var/log/rightway/email.log` (no actual sending) |
| Production | Mailtrap SMTP — all transactional emails |

---

## Mailtrap Setup (Production)

### 1. Create a Mailtrap Account

1. Go to [mailtrap.io](https://mailtrap.io) → Sign Up (free tier available)
2. In the dashboard: **Email Sending → Sending Domains**
3. Add your domain: `learnrightschool.com`
4. Complete DNS verification (add DKIM/SPF/DMARC records to your domain registrar)
5. Go to **SMTP/API Credentials** → copy your credentials

### 2. Environment Variables

```bash
# .env (production)
MAILTRAP_HOST=live.smtp.mailtrap.io
MAILTRAP_PORT=587
MAILTRAP_USERNAME=api
MAILTRAP_PASSWORD=your_mailtrap_api_token_here
EMAIL_FROM=no-reply@learnrightschool.com
EMAIL_FROM_NAME=RightWay Centre of Learning
```

---

## FastAPI Email (aiosmtplib)

```bash
pip install aiosmtplib
```

### `backend/email_service.py`

```python
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import os

logger = logging.getLogger("app")

MAILTRAP_HOST = os.environ.get("MAILTRAP_HOST", "")
MAILTRAP_PORT = int(os.environ.get("MAILTRAP_PORT", "587"))
MAILTRAP_USERNAME = os.environ.get("MAILTRAP_USERNAME", "")
MAILTRAP_PASSWORD = os.environ.get("MAILTRAP_PASSWORD", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "no-reply@learnrightschool.com")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "RightWay Centre of Learning")
EMAIL_LOG_FILE = os.environ.get("EMAIL_LOG_FILE", "/var/log/rightway/email.log")
IS_DEVELOPMENT = os.environ.get("ENVIRONMENT", "development") == "development"

email_logger = logging.getLogger("email")


async def send_email(to: str, subject: str, html_body: str, text_body: str = ""):
    """Send transactional email. In development, logs to file instead."""
    if IS_DEVELOPMENT:
        _log_email(to, subject, html_body)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{EMAIL_FROM_NAME} <{EMAIL_FROM}>"
    msg["To"] = to

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=MAILTRAP_HOST,
            port=MAILTRAP_PORT,
            username=MAILTRAP_USERNAME,
            password=MAILTRAP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Email sent to={to} subject='{subject}'")
    except Exception as e:
        logger.error(f"Email failed to={to} subject='{subject}' error={e}")
        raise


def _log_email(to: str, subject: str, body: str):
    email_logger.info(
        f"\n{'='*60}\n"
        f"TO: {to}\n"
        f"SUBJECT: {subject}\n"
        f"BODY:\n{body}\n"
        f"{'='*60}\n"
    )
```

---

## Email Templates

### Password Reset

```python
def password_reset_email(reset_link: str, user_name: str) -> tuple[str, str]:
    subject = "Reset Your Password — RightWay Centre"
    html = f"""
    <div style="font-family: Manrope, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2A7A5A; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-family: Outfit, sans-serif; margin: 0;">RightWay Centre</h1>
      </div>
      <div style="background: #FBF8F3; padding: 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1A1A2E;">Hello, {user_name}</h2>
        <p style="color: #1A1A2E; line-height: 1.7;">
          We received a request to reset your password. Click the button below to set a new password.
          This link expires in 1 hour.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{reset_link}"
             style="background: #2A7A5A; color: white; padding: 12px 32px; border-radius: 9999px;
                    text-decoration: none; font-weight: 600; font-family: Outfit, sans-serif;">
            Reset Password
          </a>
        </div>
        <p style="color: #6B7280; font-size: 0.875rem;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
    """
    return subject, html


def community_registration_email(user_name: str) -> tuple[str, str]:
    subject = "Welcome to RightWay Community — Account Under Review"
    html = f"""
    <div style="font-family: Manrope, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2A7A5A; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-family: Outfit, sans-serif; margin: 0;">RightWay Centre</h1>
      </div>
      <div style="background: #FBF8F3; padding: 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1A1A2E;">Welcome, {user_name}!</h2>
        <p style="color: #1A1A2E; line-height: 1.7;">
          Thank you for joining the RightWay Centre of Learning community.
          Your account has been received and is currently under review by our team.
        </p>
        <div style="background: #F0F7F4; border-left: 4px solid #2A7A5A; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #2A7A5A; margin: 0; font-weight: 600;">
            You'll receive an email once your account is approved.
          </p>
        </div>
        <p style="color: #6B7280; font-size: 0.875rem;">
          Questions? Contact us at info@learnrightschool.com
        </p>
      </div>
    </div>
    """
    return subject, html


def community_approval_email(user_name: str, login_url: str) -> tuple[str, str]:
    subject = "Your RightWay Account Has Been Approved!"
    html = f"""
    <div style="font-family: Manrope, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2A7A5A; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-family: Outfit, sans-serif; margin: 0;">RightWay Centre</h1>
      </div>
      <div style="background: #FBF8F3; padding: 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1A1A2E;">Great news, {user_name}!</h2>
        <p style="color: #1A1A2E; line-height: 1.7;">
          Your RightWay Community account has been approved. You can now sign in and access member content.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{login_url}"
             style="background: #F4A261; color: white; padding: 12px 32px; border-radius: 9999px;
                    text-decoration: none; font-weight: 600; font-family: Outfit, sans-serif;">
            Sign In Now
          </a>
        </div>
      </div>
    </div>
    """
    return subject, html


def invoice_email(student_name: str, invoice_number: str, amount: float,
                  due_date: str, pdf_attached: bool = False) -> tuple[str, str]:
    subject = f"Invoice {invoice_number} — RightWay Centre of Learning"
    html = f"""
    <div style="font-family: Manrope, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2A7A5A; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-family: Outfit, sans-serif; margin: 0;">RightWay Centre</h1>
      </div>
      <div style="background: #FBF8F3; padding: 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1A1A2E;">Invoice for {student_name}</h2>
        <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 4px 12px rgba(42,122,90,0.08);">
          <p style="margin: 0; color: #6B7280;">Invoice Number</p>
          <p style="margin: 4px 0 16px; font-weight: 600; color: #1A1A2E;">{invoice_number}</p>
          <p style="margin: 0; color: #6B7280;">Amount Due</p>
          <p style="margin: 4px 0 16px; font-size: 1.5rem; font-weight: 700; color: #2A7A5A;">TTD {amount:,.2f}</p>
          <p style="margin: 0; color: #6B7280;">Due Date</p>
          <p style="margin: 4px 0; font-weight: 600; color: #E76F51;">{due_date}</p>
        </div>
        {'<p style="color: #6B7280; font-size: 0.875rem;">📎 Invoice PDF attached.</p>' if pdf_attached else ''}
        <p style="color: #6B7280; font-size: 0.875rem;">
          For payment queries, contact the finance office at finance@learnrightschool.com
        </p>
      </div>
    </div>
    """
    return subject, html
```

---

## Django Email (CMS Service)

```python
# cms/settings.py

import os

if os.environ.get("ENVIRONMENT") == "development":
    # Log to file in dev — never actually send
    EMAIL_BACKEND = "django.core.mail.backends.filebased.EmailBackend"
    EMAIL_FILE_PATH = "/var/log/rightway/email.log"
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ["MAILTRAP_HOST"]
    EMAIL_PORT = int(os.environ.get("MAILTRAP_PORT", "587"))
    EMAIL_HOST_USER = os.environ["MAILTRAP_USERNAME"]
    EMAIL_HOST_PASSWORD = os.environ["MAILTRAP_PASSWORD"]
    EMAIL_USE_TLS = True
    DEFAULT_FROM_EMAIL = f"{os.environ.get('EMAIL_FROM_NAME', 'RightWay Centre')} <{os.environ.get('EMAIL_FROM', 'no-reply@learnrightschool.com')}>"
```

---

## Python Logging Architecture

### Log Files

```
/var/log/rightway/
├── app.log          General application events (10MB × 5 rotating)
├── error.log        Errors and exceptions only (10MB × 5 rotating)
├── finance.log      Finance operations audit trail (10MB × 10 rotating)
├── ai_usage.log     AI API calls — model, tokens, cost, duration (10MB × 5)
├── email.log        Email log in development (10MB × 3 rotating)
├── fastapi.log      FastAPI stdout captured by Supervisor
├── django.log       Django stdout captured by Supervisor
├── nextjs.log       Next.js stdout captured by Supervisor
└── backup.log       MongoDB backup cron output
```

### Log Format

```
[2026-05-23 14:32:01] [finance] [INFO] [user:abc123] Invoice INV-2026-001 created amount=2500.00 student=John Smith
[2026-05-23 14:32:05] [ai_usage] [INFO] feature=tutor model=claude-sonnet-4-6 user=abc123 in_tokens=412 out_tokens=287 duration_ms=1842
[2026-05-23 14:32:10] [error] [ERROR] [user:abc123] Payment webhook signature mismatch
```

---

### `backend/logging_config.py`

```python
import logging
from logging.handlers import RotatingFileHandler
import os

LOG_DIR = os.environ.get("LOG_DIR", "/var/log/rightway")


def setup_logging():
    fmt = logging.Formatter(
        "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    def make_handler(filename: str, max_bytes: int = 10_000_000, backup_count: int = 5) -> RotatingFileHandler:
        h = RotatingFileHandler(
            f"{LOG_DIR}/{filename}",
            maxBytes=max_bytes,
            backupCount=backup_count
        )
        h.setFormatter(fmt)
        return h

    # App logger — general events
    app_logger = logging.getLogger("app")
    app_logger.setLevel(logging.INFO)
    app_logger.addHandler(make_handler("app.log"))

    # Error logger — errors only, separate file
    error_logger = logging.getLogger("error")
    error_logger.setLevel(logging.ERROR)
    error_logger.addHandler(make_handler("error.log"))

    # Finance audit — 10 backups (longer retention)
    finance_logger = logging.getLogger("finance")
    finance_logger.setLevel(logging.INFO)
    finance_logger.addHandler(make_handler("finance.log", backup_count=10))

    # AI usage tracking
    ai_logger = logging.getLogger("ai_usage")
    ai_logger.setLevel(logging.INFO)
    ai_logger.addHandler(make_handler("ai_usage.log"))

    # Email dev logger
    email_logger = logging.getLogger("email")
    email_logger.setLevel(logging.DEBUG)
    email_logger.addHandler(make_handler("email.log", backup_count=3))

    # Suppress noisy third-party loggers
    logging.getLogger("motor").setLevel(logging.WARNING)
    logging.getLogger("pymongo").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("aiosmtplib").setLevel(logging.WARNING)
```

### Call in `backend/server.py`

```python
from backend.logging_config import setup_logging

setup_logging()
```

---

## Logging Patterns Per Module

### Auth Events

```python
import logging
logger = logging.getLogger("app")
error_logger = logging.getLogger("error")

# Login
logger.info(f"Login success user_id={user['_id']} role={user['role']} ip={request.client.host}")
error_logger.error(f"Login failed email={email} reason=wrong_password ip={request.client.host}")
error_logger.error(f"Login blocked email={email} reason=account_pending ip={request.client.host}")
```

### Finance Events

```python
finance_logger = logging.getLogger("finance")

finance_logger.info(f"Invoice created invoice_id={invoice_id} student_id={student_id} amount={amount} school_id={school_id}")
finance_logger.info(f"Payment recorded payment_id={payment_id} invoice_id={invoice_id} amount={amount} method={method}")
finance_logger.info(f"Credit note issued credit_id={credit_id} student_id={student_id} amount={amount} reason={reason}")
finance_logger.warning(f"Payment reconciliation mismatch invoice_id={invoice_id} expected={expected} found={found}")
```

### AI Usage Events

```python
import time

ai_logger = logging.getLogger("ai_usage")

def log_ai_call(feature: str, model: str, user_id: str,
                input_tokens: int, output_tokens: int, duration_ms: float):
    ai_logger.info(
        f"feature={feature} model={model} user={user_id} "
        f"in_tokens={input_tokens} out_tokens={output_tokens} "
        f"duration_ms={duration_ms:.0f} "
        f"est_cost_usd={_estimate_cost(model, input_tokens, output_tokens):.4f}"
    )

def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    rates = {
        "claude-sonnet-4-6": (3.00, 15.00),
        "gpt-4.1":           (2.00, 8.00),
        "gemini-2.0-flash":  (0.10, 0.40),
    }
    in_rate, out_rate = rates.get(model, (0, 0))
    return (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000

# Usage in route:
start = time.time()
response = client.messages.create(...)
log_ai_call(
    feature="tutor",
    model="claude-sonnet-4-6",
    user_id=str(current_user["_id"]),
    input_tokens=response.usage.input_tokens,
    output_tokens=response.usage.output_tokens,
    duration_ms=(time.time() - start) * 1000,
)
```

### HTTP Request Logging Middleware

```python
# backend/middleware/logging_middleware.py
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("app")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        # Skip health checks to avoid log spam
        if request.url.path not in ("/api/health", "/api/ping"):
            logger.info(
                f"{request.method} {request.url.path} "
                f"status={response.status_code} "
                f"duration_ms={duration_ms:.0f} "
                f"ip={request.client.host}"
            )

        return response
```

Register in `server.py`:
```python
from backend.middleware.logging_middleware import RequestLoggingMiddleware
app.add_middleware(RequestLoggingMiddleware)
```

---

## Django Logging Config (CMS)

```python
# cms/settings.py
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "app_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "/var/log/rightway/django_app.log",
            "maxBytes": 10_000_000,
            "backupCount": 5,
            "formatter": "standard",
        },
        "error_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "/var/log/rightway/django_error.log",
            "maxBytes": 10_000_000,
            "backupCount": 5,
            "formatter": "standard",
            "level": "ERROR",
        },
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["app_file", "console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["error_file"],
            "level": "ERROR",
            "propagate": False,
        },
        "cms": {
            "handlers": ["app_file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
```
