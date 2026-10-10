# WiPay Caribbean — Payment Integration Guide
## The RightWay Centre of Learning

> **Gateway:** WiPay Caribbean (https://wipaycaribbean.com)  
> **Currency:** TTD — Trinidad & Tobago Dollar  
> **Model:** Hosted Payment Page (HPP) redirect — card entry happens on WiPay's PCI-compliant servers  
> **3-D Secure:** Yes — included automatically  
> **Backend service:** `backend/routes/wipay.py`

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [Setting Up Your WiPay Account](#2-setting-up-your-wipay-account)
3. [Transactional Fees & Charges](#3-transactional-fees--charges)
4. [Sandbox / Test Mode](#4-sandbox--test-mode)
5. [Environment Variables](#5-environment-variables)
6. [API Endpoints](#6-api-endpoints)
7. [Request & Response Examples](#7-request--response-examples)
8. [Hash Verification (Security)](#8-hash-verification-security)
9. [Going Live Checklist](#9-going-live-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. How It Works

```
Parent Portal (browser)
      │
      │  POST /api/wipay/initiate  { invoice_id, name, email, phone }
      ▼
  FastAPI Backend
      │
      │  POST https://wipaycaribbean.com/api/v1.4/transactions/create
      ▼
  WiPay API ──► returns { url: "https://wipaycaribbean.com/pay/..." }
      │
      ▼
  FastAPI returns { redirect_url, order_id }
      │
      ▼
Parent browser redirects to WiPay's Hosted Payment Page
      │
      │  Parent enters card (3-D Secure authentication)
      ▼
  WiPay processes payment
      │
      ├──► POST /api/wipay/callback  (server-to-server, hash verified)
      │         → marks invoice PAID in DB
      │         → sends email receipt
      │
      └──► GET  /api/wipay/return   (browser redirect)
                → redirects parent to /dashboard/payment-status
```

---

## 2. Setting Up Your WiPay Account

### Step 1 — Register
1. Go to [wipaycaribbean.com](https://wipaycaribbean.com)
2. Click **Sign Up** and create a business account
3. Select **Trinidad & Tobago** as your country

### Step 2 — Verify Your Account
1. Upload the required business documents (business registration, ID)
2. WiPay reviews and verifies your account (1–3 business days)
3. You will receive an email once verified

> **You must be verified before you can access the Developer section.**

### Step 3 — Get Your API Credentials
1. Log in to your WiPay dashboard
2. Click your **profile picture** → **Developer**
3. Enter your website URL: `https://learnrightschool.com`
4. Your credentials will be generated:
   - **Developer ID** — your merchant identifier (public)
   - **Business Key (Merchant Key)** — your secret key (never expose publicly)

### Step 4 — Set Webhook URLs
In the WiPay Developer dashboard, set:
- **Return URL:** `https://learnrightschool.com/api/wipay/return`
- **Callback URL:** `https://learnrightschool.com/api/wipay/callback`

### Step 5 — Link Your Bank Account
1. Go to **Settings → Bank Account**
2. Add your Trinidad & Tobago bank account for TTD payouts
3. Add a USD account if you want to accept international cards

---

## 3. Transactional Fees & Charges

| Fee Type | Amount | Notes |
|----------|--------|-------|
| **Processing fee** | ~3.5% per transaction | Deducted from each payment before settlement |
| **Monthly fee** | $0 | No monthly subscription fee |
| **Setup fee** | $0 | Free to set up |
| **Chargeback fee** | Varies | Standard card network chargeback fees apply |
| **Payout fee** | $0 | Free bank transfers to linked account |

### Example
> Parent pays school fee of **TT$ 1,500.00**  
> WiPay fee: 3.5% = **TT$ 52.50**  
> School receives: **TT$ 1,447.50**

### Settlement Balances
WiPay maintains **two separate balances** in your dashboard:
- **TTD Balance** — from local Trinidad & Tobago cards
- **USD Balance** — from international/foreign cards

Both are paid out to their respective linked bank accounts.

### Payout Schedule
- Funds are typically settled to your bank account **next business day**
- Check your WiPay dashboard under **Settlements** for payout history

---

## 4. Sandbox / Test Mode

The system runs in sandbox mode while `WIPAY_SANDBOX=true` in `.env`. No real charges are made.

### Test Credentials (pre-configured)
```
WIPAY_DEVELOPER_ID = 1
WIPAY_MERCHANT_KEY = 123
```

### Test Card
| Field | Value |
|-------|-------|
| Card Number | `4111 1111 1111 1111` |
| CVV | `123` |
| Expiry | `01/25` |
| Name | Any name |

### Test vs Live URLs
| Mode | WiPay API Base |
|------|----------------|
| Sandbox | `https://wipaycaribbean.com/api/v1.4` (with `sandbox=1` param) |
| Live | `https://wipaycaribbean.com/api/v1.4` (with `sandbox=0` param) |

---

## 5. Environment Variables

Add these to `backend/.env`:

```env
# ── WiPay Caribbean Payment Gateway ──────────────────────────
WIPAY_DEVELOPER_ID=1                           # From WiPay dashboard → Developer
WIPAY_MERCHANT_KEY=123                         # From WiPay dashboard → Developer (SECRET)
WIPAY_BASE_URL=https://wipaycaribbean.com/api/v1.4
WIPAY_RETURN_URL=https://learnrightschool.com/api/wipay/return
WIPAY_CALLBACK_URL=https://learnrightschool.com/api/wipay/callback
WIPAY_SANDBOX=true                             # Set to false in production
```

> **Security:** Never commit `WIPAY_MERCHANT_KEY` to version control. Keep it in `.env` only.

---

## 6. API Endpoints

All endpoints are in `backend/routes/wipay.py` and registered at `/api/wipay/`.

### `POST /api/wipay/initiate`
**Auth required:** Yes (Bearer token)  
**Who calls it:** Parent portal when clicking "Pay Now" on an invoice

**Request body:**
```json
{
  "invoice_id": "inv_a1b2c3d4",
  "customer_name": "David Hernandez",
  "customer_email": "david@email.com",
  "customer_phone": "8681234567"
}
```

**Response:**
```json
{
  "order_id": "RW-a1b2c3d4-20250524143022",
  "redirect_url": "https://wipaycaribbean.com/pay/abc123xyz",
  "amount": 1500.00,
  "currency": "TTD",
  "sandbox": true
}
```

**Frontend action:** Redirect `window.location.href = redirect_url`

---

### `POST /api/wipay/callback`
**Auth required:** No (called by WiPay servers)  
**Who calls it:** WiPay's servers automatically after payment

**WiPay sends (form data):**
```
order_id=RW-a1b2c3d4-20250524143022
status=success
total=1500.00
transaction_id=TXN_12345
hash=<md5_hash>
```

**What the backend does:**
1. Verifies MD5 hash (rejects if mismatch — fraud protection)
2. On `status=success` → marks invoice paid, inserts payment record, emails receipt
3. On failure → logs the failed attempt
4. Always returns `{"received": true}` with HTTP 200

---

### `GET /api/wipay/return`
**Auth required:** No (browser redirect from WiPay)  
**Query params:** `order_id`, `status`

Redirects browser to:
```
https://learnrightschool.com/dashboard/payment-status?order_id=RW-...&status=success
```

---

### `GET /api/wipay/status/{order_id}`
**Auth required:** Yes  
**Who calls it:** Frontend payment-status page to show result

**Response:**
```json
{
  "order_id": "RW-a1b2c3d4-20250524143022",
  "invoice_id": "inv_a1b2c3d4",
  "amount": 1500.00,
  "currency": "TTD",
  "status": "completed",
  "transaction_id": "TXN_12345",
  "completed_at": "2025-05-24T14:32:55Z",
  "sandbox": false
}
```

---

### `GET /api/wipay/payments`
**Auth required:** Yes (Admin/Finance roles only)  
**Query params:** `limit` (default 50), `skip` (default 0)

Lists all WiPay payment records for the admin finance dashboard.

---

## 7. Request & Response Examples

### Initiate payment (curl)
```bash
curl -X POST https://learnrightschool.com/api/wipay/initiate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "inv_a1b2c3d4",
    "customer_name": "David Hernandez",
    "customer_email": "david@example.com",
    "customer_phone": "8681234567"
  }'
```

### Check payment status (curl)
```bash
curl https://learnrightschool.com/api/wipay/status/RW-a1b2c3d4-20250524143022 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Frontend integration (React)
```jsx
const handlePayNow = async (invoice) => {
  const res = await api.post('/wipay/initiate', {
    invoice_id: invoice.invoice_id,
    customer_name: user.name,
    customer_email: user.email,
    customer_phone: user.phone,
  });
  // Redirect to WiPay's hosted payment page
  window.location.href = res.data.redirect_url;
};
```

---

## 8. Hash Verification (Security)

WiPay uses **MD5 hash verification** to prove callbacks are genuine and not forged.

### How it works
1. WiPay sends mandatory fields + a hash in the callback
2. Your backend recomputes the hash using your Merchant Key
3. If they match → callback is genuine; if not → reject it

### Algorithm
```python
import hashlib

def verify_hash(transaction_id, order_id, total, status, merchant_key):
    raw = transaction_id + order_id + total + status + merchant_key
    return hashlib.md5(raw.encode()).hexdigest()
```

> **Never skip hash verification.** A missing or mismatched hash means the callback may be forged by a bad actor trying to mark invoices as paid without actually paying.

---

## 9. Going Live Checklist

Before switching to production:

- [ ] WiPay account fully verified (documents approved)
- [ ] Real **Developer ID** and **Merchant Key** obtained from WiPay dashboard
- [ ] Bank account linked in WiPay dashboard
- [ ] `.env` updated:
  ```env
  WIPAY_DEVELOPER_ID=<your-real-developer-id>
  WIPAY_MERCHANT_KEY=<your-real-merchant-key>
  WIPAY_SANDBOX=false
  WIPAY_RETURN_URL=https://learnrightschool.com/api/wipay/return
  WIPAY_CALLBACK_URL=https://learnrightschool.com/api/wipay/callback
  ```
- [ ] Callback URL registered in WiPay dashboard pointing to your live server
- [ ] HTTPS is active on `learnrightschool.com` (required for callbacks)
- [ ] Test with sandbox card one final time on staging before go-live
- [ ] Backend restarted after `.env` changes: `sudo supervisorctl restart rightway-api`

---

## 10. Troubleshooting

### "WiPay payment gateway unavailable"
- Check that `WIPAY_BASE_URL` is correct
- Verify your server has outbound internet access on port 443
- Check WiPay's status page

### "WiPay did not return a payment URL"
- Your `WIPAY_DEVELOPER_ID` may be wrong
- Check the backend logs: `sudo supervisorctl tail -f rightway-api`

### Hash mismatch in callback
- `WIPAY_MERCHANT_KEY` in `.env` does not match what WiPay has on file
- Re-copy the Merchant Key exactly from your WiPay Developer dashboard (no spaces)

### Invoice not marked as paid after payment
- The callback URL may not be reachable by WiPay's servers (must be public HTTPS)
- Check `backend/email.log` for callback activity
- In dev/sandbox: manually call `/api/wipay/callback` to simulate a callback

### "Invoice is already paid"
- The invoice was already marked paid (either from a previous payment or manual entry)
- Check the invoice status at `GET /api/finance/invoices/{invoice_id}`

### Currency error from WiPay
- Ensure `currency: "TTD"` is in the payload (it is — hardcoded in `wipay.py`)
- Your WiPay merchant account must be activated for TTD (confirm with WiPay support)
