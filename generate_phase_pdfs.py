# Generates all 6 phase proposal PDFs with interactive AcroForm signature fields.

import io, os, subprocess, time, threading
import http.server, socketserver
import pypdf
from pypdf.generic import NameObject, ArrayObject
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white

BASE_DIR = r"C:\Users\TeslaTelson\OneDrive\Desktop\Entreprise\Trinidad"
CHROME   = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

PORT     = 8770

PROPOSALS = [
    ("phase1_website_proposal.html",       "proposal_website_interactive.pdf",    "Website Module"),
    ("phase2_lms_proposal.html",           "proposal_lms_interactive.pdf",        "LMS Module"),
    ("phase3_finance_suite_proposal.html", "proposal_finance_suite_interactive.pdf", "Finance Suite"),
    ("phase4_hr_admin_proposal.html",      "proposal_hr_admin_interactive.pdf",   "HR & Administration"),
    ("phase5_complete_proposal.html",      "proposal_complete_interactive.pdf",   "Complete Platform"),
]

# AcroForm field positions (calibrated from PDF coordinate analysis)
W, H = 612.0, 792.0
NAVY   = HexColor("#044875")
GRAY   = HexColor("#94a3b8")
BORDER = HexColor("#e2e8f0")

DEV_X, CLIENT_X, COL_W, FLD_H = 42, 323, 248, 22
DEV_NAME_Y, DEV_DATE_Y, DEV_CB_Y     = 306, 255, 204
CLIENT_NAME_Y, CLIENT_DATE_Y, CB_SIZE = 342, 291, 15
CLIENT_CB_Y = 239


def build_overlay(dev_name_prefill="Philip Obiri"):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(W, H))
    form = c.acroForm

    def tf(name, x, y, w=COL_W, h=FLD_H, value="", color=NAVY):
        form.textfield(name=name, tooltip=name.replace("_", " "),
                       x=x, y=y, width=w, height=h, value=value,
                       fontSize=11, borderColor=BORDER, fillColor=white,
                       borderWidth=1.2, borderStyle="solid", textColor=color)

    def cb(name, x, y):
        form.checkbox(name=name, tooltip="I agree to all terms and conditions",
                      x=x, y=y, size=CB_SIZE, buttonStyle="check",
                      borderColor=NAVY, fillColor=white, textColor=NAVY,
                      borderWidth=1.5, checked=False)

    tf("Developer_FullName", DEV_X,    DEV_NAME_Y,    value=dev_name_prefill)
    tf("Developer_Date",     DEV_X,    DEV_DATE_Y,    value="", color=GRAY)
    cb("Developer_Agreement", DEV_X,   DEV_CB_Y)
    tf("Client_FullName",    CLIENT_X, CLIENT_NAME_Y, value="")
    tf("Client_Date",        CLIENT_X, CLIENT_DATE_Y, value="", color=GRAY)
    cb("Client_Agreement",   CLIENT_X, CLIENT_CB_Y)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf


def merge_overlay(src_pdf_path, out_pdf_path):
    overlay_buf  = build_overlay()
    src_reader   = pypdf.PdfReader(src_pdf_path)
    ovl_reader   = pypdf.PdfReader(overlay_buf)
    writer       = pypdf.PdfWriter()

    for page in src_reader.pages:
        writer.add_page(page)

    last_idx  = len(src_reader.pages) - 1
    last_page = writer.pages[last_idx]
    ovl_page  = ovl_reader.pages[0]

    last_page.merge_page(ovl_page)

    acroform = ovl_reader.trailer["/Root"].get("/AcroForm")
    if acroform:
        writer._root_object[NameObject("/AcroForm")] = acroform

    ovl_annots = ovl_page.get("/Annots")
    if ovl_annots:
        ovl_annots = ovl_annots.get_object()
        existing = last_page.get("/Annots")
        if existing:
            existing.get_object().extend(ovl_annots)
        else:
            last_page[NameObject("/Annots")] = ArrayObject(ovl_annots)

    with open(out_pdf_path, "wb") as f:
        writer.write(f)


def start_server():
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a: None  # silence logs
    httpd = socketserver.TCPServer(("", PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def chrome_to_pdf(html_file, out_pdf):
    url      = f"http://localhost:{PORT}/{html_file}"
    abs_pdf  = os.path.join(BASE_DIR, out_pdf)
    result = subprocess.run([
        CHROME,
        "--headless=new", "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={abs_pdf}",
        "--virtual-time-budget=8000",
        url,
    ], capture_output=True)
    if result.returncode != 0:
        print(f"  Chrome stderr: {result.stderr[-300:].decode('utf-8','replace')}")


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    print(f"Starting HTTP server on port {PORT}...")
    srv = start_server()
    time.sleep(1)

    for html, out_pdf, label in PROPOSALS:
        abs_out_pdf = os.path.join(BASE_DIR, out_pdf)
        print(f"\n[{label}]")
        print(f"  -> Generating PDF: {out_pdf}")
        chrome_to_pdf(html, out_pdf)
        time.sleep(2)

        size = os.path.getsize(abs_out_pdf) if os.path.exists(abs_out_pdf) else 0
        if size == 0:
            print(f"  ERROR: Chrome did not produce {out_pdf}")
            continue

        print(f"  OK: {size // 1024} KB")

    srv.shutdown()
    print("\nAll done. 6 interactive PDFs generated.")
