"""
Adds real AcroForm interactive fields to the signature page of
therightway_proposal.pdf and saves as therightway_proposal_interactive.pdf

Coordinates derived from PDF content stream analysis:
  - Content coords to PDF coords:
      x_pdf = x_content * 0.826
      y_pdf = 792 - (y_content - 8838) * 0.862
  - Text labels extracted: FULL NAME @ y~9369(dev)/9327(client),
    DATE @ y~9428(dev)/9387(client), checkbox text @ y~9500(dev)/9459(client)
"""

import io
import pypdf
from pypdf.generic import NameObject, ArrayObject
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white

W, H = 612.0, 792.0

# ── Calculated positions (Y from bottom of PDF page, X from left) ───────────
# Dev column (left):  x starts at 42, width 248
# Client column (right): x starts at 323, width 248

DEV_X    = 42
CLIENT_X = 323
COL_W    = 248
FLD_H    = 22

DEV_NAME_Y    = 306   # bottom of FULL NAME field
DEV_DATE_Y    = 255   # bottom of DATE field
DEV_CB_Y      = 204   # bottom of checkbox
DEV_CB_X      = 42

CLIENT_NAME_Y = 342   # bottom of FULL NAME field
CLIENT_DATE_Y = 291   # bottom of DATE field
CLIENT_CB_Y   = 239   # bottom of checkbox
CLIENT_CB_X   = 323

CB_SIZE = 15

NAVY   = HexColor("#044875")
GRAY   = HexColor("#94a3b8")
BORDER = HexColor("#e2e8f0")

# ── Build an overlay page with AcroForm widgets ──────────────────────────────
buf = io.BytesIO()
c = canvas.Canvas(buf, pagesize=(W, H))
form = c.acroForm

def tf(name, x, y, w=COL_W, h=FLD_H, value="", color=NAVY):
    form.textfield(
        name=name,
        tooltip=name.replace("_", " "),
        x=x, y=y, width=w, height=h,
        value=value,
        fontSize=11,
        borderColor=BORDER,
        fillColor=white,
        borderWidth=1.2,
        borderStyle="solid",
        textColor=color,
    )

def cb(name, x, y):
    form.checkbox(
        name=name,
        tooltip="I agree to all terms and conditions",
        x=x, y=y,
        size=CB_SIZE,
        buttonStyle="check",
        borderColor=NAVY,
        fillColor=white,
        textColor=NAVY,
        borderWidth=1.5,
        checked=False,
    )

# Dev column
tf("Developer_FullName", DEV_X, DEV_NAME_Y, value="Philip Obiri")
tf("Developer_Date",     DEV_X, DEV_DATE_Y, value="", color=GRAY)
cb("Developer_Agreement", DEV_CB_X, DEV_CB_Y)

# Client column
tf("Client_FullName", CLIENT_X, CLIENT_NAME_Y)
tf("Client_Date",     CLIENT_X, CLIENT_DATE_Y, color=GRAY)
cb("Client_Agreement", CLIENT_CB_X, CLIENT_CB_Y)

c.showPage()
c.save()
buf.seek(0)

# ── Merge onto the last page of the source PDF ───────────────────────────────
src_reader     = pypdf.PdfReader(
    r"C:\Users\TeslaTelson\OneDrive\Desktop\Entreprise\Trinidad\therightway_proposal.pdf"
)
overlay_reader = pypdf.PdfReader(buf)
writer         = pypdf.PdfWriter()

for page in src_reader.pages:
    writer.add_page(page)

last_idx   = len(src_reader.pages) - 1
last_page  = writer.pages[last_idx]
ovl_page   = overlay_reader.pages[0]

# Merge visual content streams
last_page.merge_page(ovl_page)

# ── Copy AcroForm to document root ───────────────────────────────────────────
acroform = overlay_reader.trailer["/Root"].get("/AcroForm")
if acroform:
    writer._root_object[NameObject("/AcroForm")] = acroform

# ── Copy widget annotations to the page /Annots array ────────────────────────
# THIS is what makes the fields actually clickable.
ovl_annots = ovl_page.get("/Annots")
if ovl_annots:
    ovl_annots = ovl_annots.get_object()  # dereference if indirect
    existing = last_page.get("/Annots")
    if existing:
        existing = existing.get_object()
        existing.extend(ovl_annots)
    else:
        last_page[NameObject("/Annots")] = ArrayObject(ovl_annots)

# ── Write output ─────────────────────────────────────────────────────────────
out_path = r"C:\Users\TeslaTelson\OneDrive\Desktop\Entreprise\Trinidad\therightway_proposal_interactive.pdf"
with open(out_path, "wb") as f:
    writer.write(f)

import os
kb = os.path.getsize(out_path) // 1024
print(f"Done: {kb} KB -> {out_path}")
