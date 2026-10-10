"""
TCIS Finance PDF Report Generator
Generates branded PDF reports with TCIS logo for download/print.
"""
from fastapi import APIRouter, Depends, Response
from database import db
from auth import require_roles
from datetime import datetime, timezone
from fpdf import FPDF
import os
import io

router = APIRouter(prefix="/api/finance/reports", tags=["finance_reports_pdf"])

FINANCE_VIEW_ROLES = ("Admin", "SuperAdmin", "FinanceOfficer", "CEO", "Founder", "Principal", "HeadTeacher")
LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "main_logo.png")


class TcisPDF(FPDF):
    """Custom PDF with TCIS branding header and footer."""

    def __init__(self, title="Financial Report", term="", academic_year=""):
        super().__init__()
        self.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", uni=True)
        self.add_font("DejaVu", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", uni=True)
        self.add_font("DejaVu", "I", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf", uni=True)
        self.report_title = title
        self.term = term
        self.academic_year = academic_year

    def header(self):
        # Logo - big and centered
        if os.path.exists(LOGO_PATH):
            self.image(LOGO_PATH, 80, 6, 50, 50)
        self.set_y(58)
        # School name
        self.set_font("DejaVu", "B", 16)
        self.set_text_color(27, 42, 74)
        self.cell(0, 8, "The RightWay Centre of Learning", new_x="LMARGIN", new_y="NEXT", align="C")
        # Tagline
        self.set_font("DejaVu", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 4, "Where Every Child Thrives, Transforming Hearts", new_x="LMARGIN", new_y="NEXT", align="C")
        # Report title
        self.set_font("DejaVu", "B", 12)
        self.set_text_color(46, 108, 196)
        self.cell(0, 8, self.report_title, new_x="LMARGIN", new_y="NEXT", align="C")
        # Term info
        if self.term:
            self.set_font("DejaVu", "", 9)
            self.set_text_color(100, 100, 100)
            self.cell(0, 5, f"{self.term} | {self.academic_year}", new_x="LMARGIN", new_y="NEXT", align="C")
        # Line
        self.set_draw_color(46, 108, 196)
        self.set_line_width(0.5)
        self.line(10, self.get_y() + 2, 200, self.get_y() + 2)
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "I", 7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"RightWay Workstation | Generated {datetime.now().strftime('%d %b %Y, %H:%M')} | Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title):
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(27, 42, 74)
        self.set_fill_color(240, 244, 248)
        self.cell(0, 8, f"  {title}", new_x="LMARGIN", new_y="NEXT", fill=True)
        self.ln(2)

    def key_value_row(self, label, value, bold_value=False):
        self.set_font("DejaVu", "", 9)
        self.set_text_color(80, 80, 80)
        self.cell(90, 6, label)
        self.set_font("DejaVu", "B" if bold_value else "", 9)
        self.set_text_color(27, 42, 74)
        self.cell(0, 6, str(value), new_x="LMARGIN", new_y="NEXT")

    def table_header(self, cols):
        self.set_font("DejaVu", "B", 8)
        self.set_fill_color(27, 42, 74)
        self.set_text_color(255, 255, 255)
        for label, w in cols:
            self.cell(w, 7, label, border=1, fill=True, align="C")
        self.ln()

    def table_row(self, cols, values, alt=False):
        self.set_font("DejaVu", "", 8)
        self.set_text_color(50, 50, 50)
        if alt:
            self.set_fill_color(248, 250, 252)
        else:
            self.set_fill_color(255, 255, 255)
        for i, (_, w) in enumerate(cols):
            val = str(values[i]) if i < len(values) else ""
            self.cell(w, 6, val, border=1, fill=True, align="C" if i > 0 else "L")
        self.ln()


async def get_term_info():
    setting = await db.app_settings.find_one({"key": "active_term"}, {"_id": 0})
    if setting:
        return setting.get("value", "Term 1"), setting.get("academic_year", "2025-2026")
    return "Term 1", "2025-2026"


@router.get("/pdf/overview")
async def pdf_overview(user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    """Generate Financial Overview PDF report."""
    term, year = await get_term_info()

    # Gather data
    total_invoiced = 0
    total_paid = 0
    inv_cursor = db.invoices_v2.find({}, {"_id": 0, "total": 1, "paid_amount": 1, "status": 1})
    status_counts = {}
    async for inv in inv_cursor:
        total_invoiced += inv.get("total", 0)
        total_paid += inv.get("paid_amount", 0)
        s = inv.get("status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    total_outstanding = total_invoiced - total_paid
    collection_rate = round((total_paid / total_invoiced * 100), 1) if total_invoiced > 0 else 0

    total_expenses = 0
    async for exp in db.expenses.find({"status": "approved"}, {"_id": 0, "amount": 1}):
        total_expenses += exp.get("amount", 0)

    pc_balance = 0
    async for pc in db.petty_cash_accounts.find({"status": "active"}, {"_id": 0, "balance": 1}):
        pc_balance += pc.get("balance", 0)

    student_count = await db.users.count_documents({"role": "Student"})
    staff_count = await db.users.count_documents({"role": {"$nin": ["Student", "Parent"]}})

    # Build PDF
    pdf = TcisPDF("Financial Overview Report", term, year)
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.section_title("Summary")
    pdf.key_value_row("Total Invoiced", f"TT$ {total_invoiced:,.2f}", True)
    pdf.key_value_row("Total Collected", f"TT$ {total_paid:,.2f}", True)
    pdf.key_value_row("Total Outstanding", f"TT$ {total_outstanding:,.2f}", True)
    pdf.key_value_row("Collection Rate", f"{collection_rate}%")
    pdf.key_value_row("Total Expenses (Approved)", f"TT$ {total_expenses:,.2f}")
    pdf.key_value_row("Petty Cash Balance", f"TT$ {pc_balance:,.2f}")
    pdf.key_value_row("Net Position", f"TT$ {(total_paid - total_expenses):,.2f}", True)
    pdf.ln(4)

    pdf.section_title("Invoice Status Breakdown")
    if status_counts:
        cols = [("Status", 60), ("Count", 40), ("Percentage", 40)]
        pdf.table_header(cols)
        total_inv = sum(status_counts.values())
        for i, (status, count) in enumerate(sorted(status_counts.items())):
            pct = f"{round(count / total_inv * 100, 1)}%" if total_inv > 0 else "0%"
            pdf.table_row(cols, [status.capitalize(), str(count), pct], i % 2 == 1)
    else:
        pdf.set_font("DejaVu", "I", 9)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 8, "No invoices found", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.ln(4)
    pdf.section_title("Institutional Statistics")
    pdf.key_value_row("Total Students", str(student_count))
    pdf.key_value_row("Total Staff", str(staff_count))

    buf = io.BytesIO()
    buf.write(pdf.output())
    buf.seek(0)
    return Response(content=buf.read(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="TCIS_Financial_Overview_{term.replace(" ", "_")}_{year}.pdf"'})


@router.get("/pdf/income-expense")
async def pdf_income_expense(period: str = "month", user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    """Generate Income vs Expense PDF report."""
    term, year = await get_term_info()
    now = datetime.now(timezone.utc)

    if period == "year":
        start = datetime(now.year, 1, 1, tzinfo=timezone.utc).isoformat()
        period_label = f"Year {now.year}"
    elif period == "term":
        start = datetime(now.year, now.month - 3 if now.month > 3 else 1, 1, tzinfo=timezone.utc).isoformat()
        period_label = f"{term} ({year})"
    else:
        start = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()
        period_label = now.strftime("%B %Y")

    # Income (payments)
    payments = await db.payments_v2.find({"created_at": {"$gte": start}}, {"_id": 0, "amount": 1, "method": 1, "student_name": 1, "created_at": 1}).sort("created_at", -1).to_list(500)
    total_income = sum(p.get("amount", 0) for p in payments)

    method_totals = {}
    for p in payments:
        m = p.get("method", "Other")
        method_totals[m] = method_totals.get(m, 0) + p.get("amount", 0)

    # Expenses
    expenses = await db.expenses.find({"status": "approved", "created_at": {"$gte": start}}, {"_id": 0, "amount": 1, "category": 1, "description": 1, "created_at": 1}).sort("created_at", -1).to_list(500)
    total_expenses = sum(e.get("amount", 0) for e in expenses)

    cat_totals = {}
    for e in expenses:
        c = e.get("category", "Other")
        cat_totals[c] = cat_totals.get(c, 0) + e.get("amount", 0)

    pdf = TcisPDF(f"Income & Expense Report - {period_label}", term, year)
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.section_title("Period Summary")
    pdf.key_value_row("Period", period_label)
    pdf.key_value_row("Total Income", f"TT$ {total_income:,.2f}", True)
    pdf.key_value_row("Total Expenses", f"TT$ {total_expenses:,.2f}", True)
    net = total_income - total_expenses
    pdf.key_value_row("Net Position", f"TT$ {net:,.2f}", True)
    pdf.ln(4)

    pdf.section_title("Income by Payment Method")
    if method_totals:
        cols = [("Method", 70), ("Amount (TT$)", 50), ("% of Total", 40)]
        pdf.table_header(cols)
        for i, (method, total) in enumerate(sorted(method_totals.items(), key=lambda x: -x[1])):
            pct = f"{round(total / total_income * 100, 1)}%" if total_income > 0 else "0%"
            pdf.table_row(cols, [method, f"{total:,.2f}", pct], i % 2 == 1)
    else:
        pdf.set_font("DejaVu", "I", 9)
        pdf.cell(0, 8, "No income recorded this period", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.ln(4)
    pdf.section_title("Expenses by Category")
    if cat_totals:
        cols = [("Category", 70), ("Amount (TT$)", 50), ("% of Total", 40)]
        pdf.table_header(cols)
        for i, (cat, total) in enumerate(sorted(cat_totals.items(), key=lambda x: -x[1])):
            pct = f"{round(total / total_expenses * 100, 1)}%" if total_expenses > 0 else "0%"
            pdf.table_row(cols, [cat, f"{total:,.2f}", pct], i % 2 == 1)
    else:
        pdf.set_font("DejaVu", "I", 9)
        pdf.cell(0, 8, "No expenses recorded this period", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.ln(4)
    pdf.section_title("Recent Payments")
    if payments[:20]:
        cols = [("Student/Payer", 60), ("Amount (TT$)", 35), ("Method", 35), ("Date", 30)]
        pdf.table_header(cols)
        for i, p in enumerate(payments[:20]):
            dt = p.get("created_at", "")[:10] if p.get("created_at") else ""
            pdf.table_row(cols, [p.get("student_name", "")[:25], f"{p.get('amount', 0):,.2f}", p.get("method", ""), dt], i % 2 == 1)

    buf = io.BytesIO()
    buf.write(pdf.output())
    buf.seek(0)
    return Response(content=buf.read(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="TCIS_Income_Expense_{period_label.replace(" ", "_")}.pdf"'})


@router.get("/pdf/department")
async def pdf_department(user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    """Generate Department Summary PDF report."""
    term, year = await get_term_info()

    # Build department data
    dept_map = {}
    async for exp in db.expenses.find({"status": "approved"}, {"_id": 0, "department": 1, "amount": 1}):
        d = exp.get("department", "General")
        dept_map.setdefault(d, {"department": d, "expenses": 0, "budget_allocated": 0, "budget_spent": 0, "payroll_monthly": 0, "staff_count": 0})
        dept_map[d]["expenses"] += exp.get("amount", 0)

    async for b in db.budgets.find({}, {"_id": 0, "department": 1, "allocated_amount": 1, "spent_amount": 1}):
        d = b.get("department", "General")
        dept_map.setdefault(d, {"department": d, "expenses": 0, "budget_allocated": 0, "budget_spent": 0, "payroll_monthly": 0, "staff_count": 0})
        dept_map[d]["budget_allocated"] += b.get("allocated_amount", 0)
        dept_map[d]["budget_spent"] += b.get("spent_amount", 0)

    async for u in db.users.find({"role": {"$nin": ["Student", "Parent"]}}, {"_id": 0, "department": 1}):
        d = u.get("department", "General")
        dept_map.setdefault(d, {"department": d, "expenses": 0, "budget_allocated": 0, "budget_spent": 0, "payroll_monthly": 0, "staff_count": 0})
        dept_map[d]["staff_count"] += 1

    async for sal in db.finance_salary_records.find({}, {"_id": 0, "department": 1, "basic_salary": 1}):
        d = sal.get("department", "General")
        dept_map.setdefault(d, {"department": d, "expenses": 0, "budget_allocated": 0, "budget_spent": 0, "payroll_monthly": 0, "staff_count": 0})
        dept_map[d]["payroll_monthly"] += sal.get("basic_salary", 0)

    departments = sorted(dept_map.values(), key=lambda x: -x["expenses"])

    pdf = TcisPDF("Department Financial Summary", term, year)
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.section_title("Department Breakdown")
    if departments:
        cols = [("Department", 40), ("Expenses", 30), ("Budget", 30), ("Spent", 30), ("Payroll", 30), ("Staff", 20)]
        pdf.table_header(cols)
        total_exp = total_bud = total_sp = total_pay = total_st = 0
        for i, d in enumerate(departments):
            pdf.table_row(cols, [
                d["department"][:18],
                f"{d['expenses']:,.0f}",
                f"{d['budget_allocated']:,.0f}",
                f"{d['budget_spent']:,.0f}",
                f"{d['payroll_monthly']:,.0f}",
                str(d["staff_count"]),
            ], i % 2 == 1)
            total_exp += d["expenses"]
            total_bud += d["budget_allocated"]
            total_sp += d["budget_spent"]
            total_pay += d["payroll_monthly"]
            total_st += d["staff_count"]

        # Totals row
        pdf.set_font("DejaVu", "B", 8)
        pdf.set_fill_color(240, 244, 248)
        pdf.set_text_color(27, 42, 74)
        for val, w in [(f"TOTALS", 40), (f"{total_exp:,.0f}", 30), (f"{total_bud:,.0f}", 30),
                       (f"{total_sp:,.0f}", 30), (f"{total_pay:,.0f}", 30), (str(total_st), 20)]:
            pdf.cell(w, 7, val, border=1, fill=True, align="C")
        pdf.ln()
    else:
        pdf.set_font("DejaVu", "I", 9)
        pdf.cell(0, 8, "No department data available", new_x="LMARGIN", new_y="NEXT", align="C")

    buf = io.BytesIO()
    buf.write(pdf.output())
    buf.seek(0)
    return Response(content=buf.read(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="TCIS_Department_Summary_{year}.pdf"'})


@router.get("/pdf/outstanding")
async def pdf_outstanding(user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    """Generate Outstanding Fees PDF report — list of all students who owe."""
    term, year = await get_term_info()

    students = await db.users.find(
        {"role": "Student"},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "year_group": 1}
    ).sort("name", 1).to_list(2000)

    rows = []
    for s in students:
        invoices = await db.invoices_v2.find(
            {"student_id": s["user_id"], "status": {"$in": ["issued", "partial", "overdue"]}},
            {"_id": 0, "total": 1, "paid_amount": 1}
        ).to_list(100)
        total_owed = sum(i.get("total", 0) - i.get("paid_amount", 0) for i in invoices)
        if total_owed > 0:
            rows.append({
                "name": s["name"],
                "year_group": s.get("year_group", "N/A"),
                "total_owed": total_owed,
                "invoice_count": len(invoices),
            })

    rows.sort(key=lambda x: -x["total_owed"])

    pdf = TcisPDF("Outstanding Fees Report", term, year)
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.section_title(f"Students with Outstanding Fees ({len(rows)} students)")
    if rows:
        cols = [("Student Name", 60), ("Year Group", 30), ("Invoices", 25), ("Outstanding (TT$)", 45)]
        pdf.table_header(cols)
        grand_total = 0
        for i, r in enumerate(rows):
            pdf.table_row(cols, [r["name"][:25], r["year_group"], str(r["invoice_count"]), f"{r['total_owed']:,.2f}"], i % 2 == 1)
            grand_total += r["total_owed"]

        pdf.set_font("DejaVu", "B", 8)
        pdf.set_fill_color(240, 244, 248)
        pdf.set_text_color(27, 42, 74)
        pdf.cell(60, 7, "GRAND TOTAL", border=1, fill=True, align="C")
        pdf.cell(30, 7, "", border=1, fill=True)
        pdf.cell(25, 7, str(len(rows)), border=1, fill=True, align="C")
        pdf.cell(45, 7, f"{grand_total:,.2f}", border=1, fill=True, align="C")
        pdf.ln()
    else:
        pdf.set_font("DejaVu", "I", 9)
        pdf.cell(0, 8, "No outstanding fees found", new_x="LMARGIN", new_y="NEXT", align="C")

    buf = io.BytesIO()
    buf.write(pdf.output())
    buf.seek(0)
    return Response(content=buf.read(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="TCIS_Outstanding_Fees_{term.replace(" ", "_")}_{year}.pdf"'})

