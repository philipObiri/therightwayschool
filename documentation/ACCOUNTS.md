# Demo Accounts — RightWay Centre of Learning

> All accounts are seeded into `rightway_db` by running `python seed_users.py` from the `backend/` directory.  
> Login at: **http://localhost:3000/login** (dev) or **https://learnrightschool.com/login** (production)

---

## Staff & Administration

| Role | Name | Email | Password | Dashboard Route |
|------|------|-------|----------|----------------|
| CEO | Dr. Margaret Thompson | ceo@rightway.demo | ceo123 | /admin/dashboard |
| SuperAdmin | System SuperAdmin | superadmin@rightway.demo | superadmin123 | /admin/dashboard |
| Principal | Ms. Sandra Clarke | principal@rightway.demo | principal123 | /admin/dashboard |
| Head Teacher | Mr. Kevin Joseph | headteacher@rightway.demo | headteacher123 | /admin/dashboard |
| Admin | Mrs. Diane Baptiste | admin@rightway.demo | admin123 | /admin/dashboard |
| Teacher | Mr. Edmund Charles | teacher@rightway.demo | teacher123 | /teacher/dashboard |
| Finance Officer | Ms. Patricia Ramsay | finance@rightway.demo | finance123 | /admin/finance |
| HR Officer | Mrs. Gloria Phillip | hr@rightway.demo | hr123 | /admin/hr |

## Parents & Students

| Role | Name | Email | Password | Dashboard Route |
|------|------|-------|----------|----------------|
| Parent | Mr. David Hernandez | parent@rightway.demo | parent123 | /parent/home |
| Student | Ayeyi Forson | student@rightway.demo | student123 | /student/home |

---

## Access Levels at a Glance

| Role | Users | Finance | Approvals | HR | Website CMS |
|------|-------|---------|-----------|----|----|
| CEO | ✅ Full | ✅ | ✅ Final | ✅ | ✅ |
| SuperAdmin | ✅ Full | ✅ | ✅ Full | ✅ | ✅ |
| Principal | View | View | ✅ Stage 2 | View | ❌ |
| Head Teacher | View | ❌ | ✅ Stage 1 | View | ❌ |
| Admin | ✅ Manage | ❌ | ❌ | ❌ | ❌ |
| Teacher | ❌ | ❌ | Submit only | ❌ | ❌ |
| Finance Officer | ❌ | ✅ Full | ❌ | ❌ | ❌ |
| HR Officer | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| Parent | ❌ | View own | ❌ | ❌ | ❌ |
| Student | ❌ | ❌ | ❌ | ❌ | ❌ |

---

> **Security reminder:** Change all passwords before going to production.  
> Generate a bcrypt hash: `python -c "import bcrypt; print(bcrypt.hashpw(b'newpassword', bcrypt.gensalt()).decode())"`
