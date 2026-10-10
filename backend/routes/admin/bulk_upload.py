"""
Bulk upload endpoint for creating student and parent accounts from Excel/Word files.
Parses the file, auto-detects columns, and creates accounts.
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from auth import require_roles
from database import db
import bcrypt
import uuid
import io
import re
from datetime import datetime, timezone

router = APIRouter(prefix="/api/bulk-upload", tags=["bulk-upload"])

MGMT_ROLES = ("Admin", "SuperAdmin", "CEO", "Founder", "Principal", "HeadTeacher", "HeadOfAcademics")
DEFAULT_PARENT_PW = "parent123"
DEFAULT_STUDENT_PW = "student123"


def gen_id(prefix="user_"):
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def hash_pw(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


# Column name detection patterns
COL_PATTERNS = {
    "name": r"(?:student|pupil|child|full)?\s*name|name\s*of\s*(?:student|child)",
    "year_group": r"year\s*(?:group)?|class|form|grade|level",
    "gender": r"gender|sex",
    "dob": r"d\.?o\.?b|date\s*of\s*birth|birth\s*date",
    "admission_number": r"adm(?:ission)?\s*(?:no|num|number|#)?|student\s*(?:id|no)",
    "boarding_status": r"board(?:ing)?\s*(?:status)?|day\s*/?\s*board|residence|status",
    "parent_name": r"parent|guardian|father|mother|(?:parent|guardian)\s*name",
    "parent_phone": r"(?:parent|guardian|father|mother)?\s*(?:phone|tel|mobile|contact|cell)|phone\s*(?:no|num|number)?",
    "parent_email": r"(?:parent|guardian|father|mother)?\s*e?\-?mail|email\s*(?:address)?",
    "address": r"address|location|town|residence\s*address",
    "parent_phone2": r"(?:second|2nd|other|alt)\s*(?:parent\s*)?(?:phone|contact|number|tel|mobile|cell)|phone\s*2|contact\s*2",
    "parent_email2": r"(?:second|2nd|other|alt)\s*(?:parent\s*)?e?\-?mail|email\s*2",
}


def detect_columns(headers):
    """Auto-detect which column maps to which field."""
    mapping = {}
    used = set()
    for field, pattern in COL_PATTERNS.items():
        for i, h in enumerate(headers):
            if i in used:
                continue
            cleaned = str(h).strip().lower()
            if re.search(pattern, cleaned, re.IGNORECASE):
                mapping[field] = i
                used.add(i)
                break
    return mapping


def parse_excel(file_bytes):
    """Parse Excel (.xlsx/.xls) file and return rows."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    rows = []
    headers = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        vals = [str(c).strip() if c is not None else "" for c in row]
        if i == 0 or (not headers and any(v for v in vals)):
            # Detect header row: if row has mostly text (not numbers)
            text_count = sum(1 for v in vals if v and not v.replace('.', '').isdigit())
            if text_count >= len(vals) // 2 and not headers:
                headers = vals
                continue
        if headers and any(v for v in vals):
            rows.append(vals)
    return headers, rows


def parse_docx(file_bytes):
    """Parse Word (.docx) file tables and return rows."""
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    headers = []
    rows = []
    for table in doc.tables:
        for i, row in enumerate(table.rows):
            vals = [cell.text.strip() for cell in row.cells]
            if i == 0 and not headers:
                headers = vals
                continue
            if any(v for v in vals):
                rows.append(vals)
    return headers, rows


def normalize_boarding(val):
    v = str(val).strip().lower()
    if "week" in v:
        return "weekday_boarder"
    if "board" in v:
        return "boarding"
    return "day"


def normalize_gender(val):
    v = str(val).strip().lower()
    if v.startswith("m"):
        return "Male"
    if v.startswith("f"):
        return "Female"
    return ""


def clean_email(val):
    val = str(val).strip().lower()
    if "@" in val:
        return val
    return ""


@router.get("/template")
async def download_template(fmt: str = Query("xlsx", pattern="^(xlsx|docx)$")):
    """
    Download a pre-formatted Excel/Word template with the exact column headers
    the parser auto-detects. Includes 3 example rows and an instructions sheet.
    No auth required so users can grab the template from anywhere.
    """
    headers = [
        "Student Name", "Year Group", "Gender", "Date of Birth",
        "Admission Number", "Boarding Status",
        "Parent Name", "Parent Phone", "Parent Email",
        "Second Parent Phone", "Second Parent Email", "Address",
    ]
    examples = [
        ["John K. Mensah", "Year 7", "Male", "2014-05-12", "TCIS-2026-001", "Day",
         "Mr Kwame Mensah", "+233240000001", "kwame.mensah@example.com",
         "+233240000002", "mother.mensah@example.com", "12 Cantonments Rd, Accra"],
        ["Akosua Boateng", "Year 8", "Female", "2013-09-03", "TCIS-2026-002", "Boarding",
         "Mrs Ama Boateng", "+233240000003", "ama.boateng@example.com",
         "", "", "East Legon, Accra"],
        ["Kofi Owusu", "Year 10", "Male", "2011-01-20", "TCIS-2026-003", "Weekday Boarder",
         "Mr Yaw Owusu", "+233240000004", "yaw.owusu@example.com",
         "", "", "Kumasi"],
    ]

    if fmt == "xlsx":
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        wb = openpyxl.Workbook()

        # ── Sheet 1: Data ──
        ws = wb.active
        ws.title = "Students"

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1B2A4A", end_color="1B2A4A", fill_type="solid")
        header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin = Side(border_style="thin", color="CCCCCC")
        border = Border(left=thin, right=thin, top=thin, bottom=thin)

        for col_idx, h in enumerate(headers, start=1):
            c = ws.cell(row=1, column=col_idx, value=h)
            c.font = header_font
            c.fill = header_fill
            c.alignment = header_align
            c.border = border

        for r_idx, row in enumerate(examples, start=2):
            for c_idx, val in enumerate(row, start=1):
                cell = ws.cell(row=r_idx, column=c_idx, value=val)
                cell.border = border
                cell.alignment = Alignment(vertical="center", wrap_text=True)

        # Column widths
        widths = [22, 11, 9, 13, 18, 15, 22, 17, 30, 20, 30, 35]
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
        ws.row_dimensions[1].height = 32
        ws.freeze_panes = "A2"

        # ── Sheet 2: Instructions ──
        info = wb.create_sheet("Instructions")
        info["A1"] = "TCIS Bulk Upload Template"
        info["A1"].font = Font(size=14, bold=True, color="1B2A4A")
        notes = [
            "",
            "How to use this template:",
            "1. Keep the header row exactly as-is on the 'Students' sheet.",
            "2. Replace the 3 example rows with your real student data (add as many rows as needed).",
            "3. You can delete columns you don't have data for — only 'Student Name' is required.",
            "4. Save the file and upload it via Administration → Bulk Upload.",
            "",
            "Field values:",
            "  • Year Group: Year 7, Year 8, Year 9, Year 10, Year 11, Year 12, Year 13",
            "  • Gender: Male or Female (M/F also accepted)",
            "  • Boarding Status: Day, Boarding, or Weekday Boarder",
            "  • Date of Birth: YYYY-MM-DD recommended",
            "  • Parent Email: used as login. If blank, system auto-generates one.",
            "",
            "Defaults set by the system on creation:",
            "  • Students password: student123",
            "  • Parents password: parent123",
            "  • Duplicates (same student name) are automatically skipped.",
            "  • Siblings that share a Parent Email are linked to the same parent account.",
        ]
        for i, line in enumerate(notes, start=2):
            info.cell(row=i, column=1, value=line)
        info.column_dimensions["A"].width = 90

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="TCIS_Bulk_Upload_Template.xlsx"'},
        )

    # ── Word template ──
    from docx import Document
    from docx.shared import Pt, RGBColor
    from docx.enum.table import WD_ALIGN_VERTICAL
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    doc = Document()
    doc.add_heading("TCIS Bulk Upload Template", level=1)

    doc.add_paragraph(
        "Fill the table below with your student and parent data, then upload this file via "
        "Administration → Bulk Upload. Only 'Student Name' is required — other columns may be left blank."
    )

    tbl = doc.add_table(rows=1 + len(examples), cols=len(headers))
    tbl.style = "Light Grid Accent 1"

    # Header row
    for i, h in enumerate(headers):
        cell = tbl.rows[0].cells[i]
        cell.text = h
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.bold = True
                r.font.size = Pt(10)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        # Shade header cell dark-blue
        shd = OxmlElement("w:shd")
        shd.set(qn("w:fill"), "1B2A4A")
        cell._tc.get_or_add_tcPr().append(shd)

    for r_idx, row in enumerate(examples, start=1):
        for c_idx, val in enumerate(row):
            tbl.rows[r_idx].cells[c_idx].text = str(val)

    doc.add_paragraph("")
    doc.add_heading("Notes", level=2)
    for n in [
        "Defaults on creation: Students password = student123, Parents password = parent123.",
        "Duplicates (same student name) are automatically skipped.",
        "Siblings sharing a Parent Email are linked to the same parent account.",
        "Boarding Status accepts: Day, Boarding, Weekday Boarder.",
    ]:
        p = doc.add_paragraph(n, style="List Bullet")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="TCIS_Bulk_Upload_Template.docx"'},
    )


@router.post("/preview")
async def preview_upload(file: UploadFile = File(...), account_type: str = Query("student"), user: dict = Depends(require_roles(*MGMT_ROLES))):
    """
    Preview what accounts will be created from the uploaded file.
    Returns parsed data without creating accounts.
    """
    content = await file.read()
    fname = file.filename.lower()

    if fname.endswith((".xlsx", ".xls")):
        headers, rows = parse_excel(content)
    elif fname.endswith(".docx"):
        headers, rows = parse_docx(content)
    else:
        raise HTTPException(400, "Unsupported file type. Upload .xlsx, .xls, or .docx")

    if not headers:
        raise HTTPException(400, "Could not detect column headers in the file")

    col_map = detect_columns(headers)

    parsed = []
    for row in rows:
        def get(field):
            idx = col_map.get(field)
            if idx is not None and idx < len(row):
                return row[idx].strip()
            return ""

        student_name = get("name")
        if not student_name:
            continue

        entry = {
            "student_name": student_name,
            "year_group": get("year_group"),
            "gender": normalize_gender(get("gender")),
            "dob": get("dob"),
            "admission_number": get("admission_number"),
            "boarding_status": normalize_boarding(get("boarding_status")),
            "parent_name": get("parent_name"),
            "parent_phone": get("parent_phone"),
            "parent_email": clean_email(get("parent_email")),
            "parent_phone2": get("parent_phone2"),
            "parent_email2": clean_email(get("parent_email2")),
            "address": get("address"),
        }
        parsed.append(entry)

    return {
        "file_name": file.filename,
        "headers_detected": headers,
        "column_mapping": {k: headers[v] if v < len(headers) else "?" for k, v in col_map.items()},
        "total_rows": len(parsed),
        "preview": parsed[:5],
        "all_data": parsed,
    }


@router.post("/create-accounts")
async def create_accounts_from_upload(
    data: dict,
    user: dict = Depends(require_roles(*MGMT_ROLES))
):
    """
    Create student and/or parent accounts from parsed upload data.
    Expects { records: [...], create_students: true, create_parents: true, default_year_group: "Year 7" }
    """
    records = data.get("records", [])
    create_students = data.get("create_students", True)
    create_parents = data.get("create_parents", True)
    default_year_group = data.get("default_year_group", "")

    if not records:
        raise HTTPException(400, "No records provided")

    hashed_parent = hash_pw(DEFAULT_PARENT_PW)
    hashed_student = hash_pw(DEFAULT_STUDENT_PW)
    now = datetime.now(timezone.utc).isoformat()

    students_created = 0
    students_skipped = 0
    parents_created = 0
    parents_updated = 0
    results = []

    for rec in records:
        student_name = rec.get("student_name", "").strip()
        if not student_name:
            continue

        year_group = rec.get("year_group", "") or default_year_group
        student_id = None

        # ── Create Student ──
        if create_students:
            existing_student = await db.users.find_one(
                {"name": {"$regex": f"^{re.escape(student_name)}$", "$options": "i"}, "role": "Student"},
                {"_id": 0, "user_id": 1}
            )
            if existing_student:
                student_id = existing_student["user_id"]
                students_skipped += 1
            else:
                student_id = gen_id("user_")
                student_doc = {
                    "user_id": student_id,
                    "name": student_name,
                    "email": f"{student_name.lower().replace(' ', '.')}@student.tcis.edu.gh",
                    "password_hash": hashed_student,
                    "last_set_password": DEFAULT_STUDENT_PW,
                    "role": "Student",
                    "year_group": year_group,
                    "class_id": "",
                    "gender": rec.get("gender", ""),
                    "date_of_birth": rec.get("dob", ""),
                    "admission_number": rec.get("admission_number", ""),
                    "boarding_status": rec.get("boarding_status", "day"),
                    "address": rec.get("address", ""),
                    "is_active": True,
                    "created_at": now,
                }
                await db.users.insert_one(student_doc)
                students_created += 1

        # ── Create / Update Parent ──
        if create_parents:
            parent_email = rec.get("parent_email", "").strip().lower()
            parent_name = rec.get("parent_name", "").strip()
            parent_phone = rec.get("parent_phone", "").strip()

            if not parent_email and parent_name:
                parent_email = f"parent.{student_name.lower().replace(' ', '.')}@tcis.edu.gh"

            if parent_email:
                existing_parent = await db.users.find_one({"email": parent_email}, {"_id": 0, "user_id": 1, "children_ids": 1})
                if existing_parent:
                    children_ids = list(set((existing_parent.get("children_ids") or []) + ([student_id] if student_id else [])))
                    await db.users.update_one(
                        {"email": parent_email},
                        {"$set": {"children_ids": children_ids, "phone": parent_phone or existing_parent.get("phone", "")}}
                    )
                    parents_updated += 1
                else:
                    parent_id = gen_id("user_")
                    if not parent_name:
                        parent_name = f"Parent of {student_name}"
                    parent_doc = {
                        "user_id": parent_id,
                        "name": parent_name,
                        "email": parent_email,
                        "password_hash": hashed_parent,
                        "last_set_password": DEFAULT_PARENT_PW,
                        "role": "Parent",
                        "phone": parent_phone,
                        "children_ids": [student_id] if student_id else [],
                        "children_names": [student_name],
                        "is_active": True,
                        "created_at": now,
                    }
                    await db.users.insert_one(parent_doc)
                    parents_created += 1

        results.append({
            "student": student_name,
            "year": year_group,
            "parent_email": rec.get("parent_email", ""),
            "status": "created" if student_id and create_students else "linked",
        })

    return {
        "message": "Bulk upload complete",
        "students_created": students_created,
        "students_skipped": students_skipped,
        "parents_created": parents_created,
        "parents_updated": parents_updated,
        "total_processed": len(results),
        "default_passwords": {"students": DEFAULT_STUDENT_PW, "parents": DEFAULT_PARENT_PW},
    }
