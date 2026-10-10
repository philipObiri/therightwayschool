# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  role: 'Admin',
  is_active: true,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
API_URL="https://tcis-lms-hub-1.preview.emergentagent.com"

# Login as admin
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@tcis.edu.gh","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Test auth endpoint
curl -X GET "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN"

# Test admin dashboard
curl -X GET "$API_URL/api/admin/dashboard" -H "Authorization: Bearer $TOKEN"
```

## Step 3: Browser Testing
```python
# Set auth and navigate
TOKEN = "..." # from step 2
await page.evaluate(f"localStorage.setItem('tcis_token', '{TOKEN}')")
await page.evaluate(f"localStorage.setItem('tcis_user', JSON.stringify(...))")
await page.goto("https://tcis-lms-hub-1.preview.emergentagent.com/admin/dashboard")
```

## Demo Accounts
- Admin: admin@tcis.edu.gh / admin123
- Teacher: abena.osei@tcis.edu.gh / teacher123  
- Student: yaa.amoah@tcis.edu.gh / student123
- Parent: nana.parent@tcis.edu.gh / parent123




Dear RightWay Centre of Learning Team,

It was a pleasure speaking with you, and I truly appreciate the time you took to share your vision for the school. What you are building at RightWay matters, and I am excited about the opportunity to be part of it.

As discussed on our call, I have prepared five proposal documents covering each module of the platform. You will find them all attached.

Each price below reflects a goodwill discount applied exclusively to The RightWay Centre of Learning in recognition of the referral by Prof. Elvis Cornerstone:

Module	Market Rate	Your Price
Phase 1 — Professional Website	$9,500	$2,000
Phase 2 — LMS Platform	$38,000	$14,000
Phase 3 — Finance Suite	$16,000	$7,000
Phase 4 — HR & Administration	$10,000	$5,000
Phase 5 — Complete Platform	$55,000	$25,000
The Complete Platform at $25,000 also includes a free second website — same full scope as Phase 1 — at no additional charge. Buying each module separately would cost $28,000; the Complete bundle saves you $3,000.

Given your interest in getting started with the full project, I would recommend starting with the Phase 5 document. The individual module proposals are included so you can see exactly what goes into each component.

The platform supports 1,000+ concurrent users, is built on enterprise-grade technology, and is owned by you outright — no monthly seat fees, no annual licences, ever.

Payment is the full amount on signing and work begins immediately. The complete platform is delivered within 10 weeks.

Please do not hesitate to reach out with any questions. I am happy to jump on another call to walk you through the documents at your convenience.

Looking forward to building something exceptional for RightWay.

Warm regards,

Philip Obiri
Lead Software Engineer — Telson Technologies
pobiriofficial@gmail.com | +233 550 049 921

These prices are exclusive to The RightWay Centre of Learning and valid until 31 July 2026.
