"""
Comprehensive resource populator: downloads past papers + generates PDFs for syllabus, schemes, worksheets, slides.
Target: 20+ of each type per subject, all with actual PDF files.
"""
import asyncio, os, uuid, requests, logging
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from storage import put_object, init_storage, APP_NAME
from fpdf import FPDF

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db = client[os.environ.get('DB_NAME', 'test_database')]
init_storage()

BASE = "https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload"

def gen_id(prefix="res_"):
    return prefix + uuid.uuid4().hex[:12]

def make_pdf(title, subtitle, content_lines):
    """Generate a professional-looking educational PDF."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "TCIS - The RightWay Centre of Learning", ln=True, align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, "Cambridge IGCSE / A-Level", ln=True, align="C")
    pdf.ln(6)
    pdf.set_draw_color(46, 108, 196)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)
    pdf.set_text_color(27, 42, 74)
    pdf.set_font("Helvetica", "B", 14)
    t = title.encode('latin-1', 'replace').decode('latin-1')
    pdf.multi_cell(0, 8, t)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 6, subtitle.encode('latin-1', 'replace').decode('latin-1'), ln=True)
    pdf.ln(4)
    pdf.set_text_color(40, 40, 40)
    pdf.set_font("Helvetica", "", 10)
    for line in content_lines:
        l = line.encode('latin-1', 'replace').decode('latin-1')
        if l.startswith("##"):
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(46, 108, 196)
            pdf.cell(0, 7, l[2:].strip(), ln=True)
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(40, 40, 40)
        elif l.startswith("- "):
            pdf.cell(8, 5, "")
            pdf.cell(0, 5, l, ln=True)
        else:
            pdf.multi_cell(0, 5, l)
        pdf.ln(1)
    buf = pdf.output()
    return bytes(buf)

# Subject data with Cambridge codes and educational content
SUBJECTS = {
    "English Language": {"code": "0500", "papers": [
        "0500_s24_qp_12","0500_s24_qp_22","0500_s24_ms_12","0500_s24_ms_22","0500_w23_qp_12","0500_w23_qp_22","0500_w23_ms_12","0500_w23_ms_22","0500_s23_qp_12","0500_s23_qp_22",
        "0500_s23_ms_12","0500_s23_ms_22","0500_w22_qp_12","0500_w22_qp_22","0500_w22_ms_12","0500_s22_qp_12","0500_s22_qp_22","0500_s22_ms_12","0500_w21_qp_12","0500_s21_qp_12",
    ], "topics": ["Directed Writing","Narrative Writing","Descriptive Writing","Argumentative Writing","Summary Writing","Reading Comprehension","Language Analysis","Punctuation & Grammar","Vocabulary","Poetry Analysis",
        "Report Writing","Letter Writing","Speech Writing","Article Writing","Review Writing","Diary Entry","Dialogue Writing","Creative Writing","Persuasive Techniques","Exam Technique"]},
    "Mathematics": {"code": "0580", "papers": [
        "0580_s24_qp_22","0580_s24_qp_42","0580_s24_ms_22","0580_s24_ms_42","0580_w23_qp_22","0580_w23_qp_42","0580_w23_ms_22","0580_w23_ms_42","0580_s23_qp_22","0580_s23_qp_42",
        "0580_s23_ms_22","0580_w22_qp_22","0580_w22_qp_42","0580_w22_ms_22","0580_s22_qp_22","0580_s22_qp_42","0580_s22_ms_42","0580_w21_qp_22","0580_w21_qp_42","0580_s21_qp_42",
    ], "topics": ["Algebra - Equations","Algebra - Inequalities","Trigonometry","Circle Theorems","Probability","Statistics","Vectors","Transformations","Functions & Graphs","Sequences",
        "Number - Fractions & Decimals","Percentages & Ratios","Mensuration","Geometry","Matrices","Sets & Venn Diagrams","Linear Programming","Quadratic Functions","Simultaneous Equations","Indices & Standard Form"]},
    "Biology": {"code": "0610", "papers": [
        "0610_s24_qp_22","0610_s24_qp_42","0610_s24_qp_62","0610_s24_ms_22","0610_s24_ms_42","0610_w23_qp_22","0610_w23_qp_42","0610_w23_ms_22","0610_w23_ms_42","0610_s23_qp_22",
        "0610_s23_qp_42","0610_s23_ms_22","0610_w22_qp_22","0610_w22_qp_42","0610_w22_ms_22","0610_s22_qp_22","0610_s22_qp_42","0610_w21_qp_22","0610_w21_qp_42","0610_s21_qp_22",
    ], "topics": ["Cell Structure","Biological Molecules","Enzymes","Plant Nutrition - Photosynthesis","Human Nutrition","Transport in Plants","Transport in Animals","Respiration","Excretion & Homeostasis","Coordination & Response",
        "Reproduction in Plants","Reproduction in Humans","Inheritance & Genetics","Variation & Selection","Organisms & Environment","Biotechnology","Human Influences on Ecosystems","Disease & Immunity","DNA & Protein Synthesis","Ecology"]},
    "Chemistry": {"code": "0620", "papers": [
        "0620_s24_qp_22","0620_s24_qp_42","0620_s24_qp_62","0620_s24_ms_22","0620_s24_ms_42","0620_w23_qp_22","0620_w23_qp_42","0620_w23_ms_22","0620_w23_ms_42","0620_s23_qp_22",
        "0620_s23_qp_42","0620_s23_ms_22","0620_w22_qp_22","0620_w22_qp_42","0620_w22_ms_22","0620_s22_qp_22","0620_s22_qp_42","0620_w21_qp_22","0620_w21_qp_42","0620_s21_qp_22",
    ], "topics": ["Atomic Structure","Periodic Table","Ionic Bonding","Covalent Bonding","Metallic Bonding","Stoichiometry","Electrolysis","Acids Bases Salts","Rates of Reaction","Energetics",
        "Organic Chemistry","Metals & Reactivity","Redox Reactions","Chemical Tests","Air & Water","Limestone Cycle","Extraction of Metals","Polymers","Chromatography","Equilibrium"]},
    "Physics": {"code": "0625", "papers": [
        "0625_s24_qp_22","0625_s24_qp_42","0625_s24_qp_62","0625_s24_ms_22","0625_s24_ms_42","0625_w23_qp_22","0625_w23_qp_42","0625_w23_ms_22","0625_w23_ms_42","0625_s23_qp_22",
        "0625_s23_qp_42","0625_s23_ms_22","0625_w22_qp_22","0625_w22_qp_42","0625_w22_ms_22","0625_s22_qp_22","0625_s22_qp_42","0625_w21_qp_22","0625_w21_qp_42","0625_s21_qp_22",
    ], "topics": ["Motion & Forces","Momentum","Energy Transfer","Thermal Physics","Waves - Sound","Waves - Light","Electricity - Circuits","Electricity - Components","Magnetism","Electromagnetism",
        "Nuclear Physics","Radioactivity","Pressure","Density","Space Physics","Power & Energy","Transformers","Logic Gates","Sensors","Practical Skills"]},
    "Economics": {"code": "0455", "papers": [
        "0455_s24_qp_12","0455_s24_qp_22","0455_s24_ms_12","0455_s24_ms_22","0455_w23_qp_12","0455_w23_qp_22","0455_w23_ms_12","0455_w23_ms_22","0455_s23_qp_12","0455_s23_qp_22",
        "0455_s23_ms_12","0455_w22_qp_12","0455_w22_qp_22","0455_w22_ms_12","0455_s22_qp_12","0455_s22_qp_22","0455_w21_qp_12","0455_w21_qp_22","0455_s21_qp_12","0455_s21_qp_22",
    ], "topics": ["Basic Economic Problem","Supply & Demand","Elasticity","Market Failure","Government Intervention","Money & Banking","Inflation","Unemployment","Economic Growth","GDP",
        "International Trade","Exchange Rates","Balance of Payments","Fiscal Policy","Monetary Policy","Supply-Side Policies","Development Economics","Poverty","Globalisation","Environmental Economics"]},
    "Business Studies": {"code": "0450", "papers": [
        "0450_s24_qp_12","0450_s24_qp_22","0450_s24_ms_12","0450_s24_ms_22","0450_w23_qp_12","0450_w23_qp_22","0450_w23_ms_12","0450_w23_ms_22","0450_s23_qp_12","0450_s23_qp_22",
        "0450_s23_ms_12","0450_w22_qp_12","0450_w22_qp_22","0450_w22_ms_12","0450_s22_qp_12","0450_s22_qp_22","0450_w21_qp_12","0450_w21_qp_22","0450_s21_qp_12","0450_s21_qp_22",
    ], "topics": ["Business Activity","Marketing Mix","Market Research","Human Resources","Motivation Theory","Operations Management","Quality Management","Finance - Cash Flow","Finance - Break-Even","Business Organisation",
        "Stakeholders","Leadership Styles","Recruitment & Selection","Training & Development","Business Growth","Globalisation","E-commerce","Business Ethics","Business Plans","Location Decisions"]},
    "Accounting": {"code": "0452", "papers": [
        "0452_s24_qp_12","0452_s24_qp_22","0452_s24_ms_12","0452_s24_ms_22","0452_w23_qp_12","0452_w23_qp_22","0452_w23_ms_12","0452_w23_ms_22","0452_s23_qp_12","0452_s23_qp_22",
        "0452_s23_ms_12","0452_w22_qp_12","0452_w22_qp_22","0452_w22_ms_12","0452_s22_qp_12","0452_s22_qp_22","0452_w21_qp_12","0452_w21_qp_22","0452_s21_qp_12","0452_s21_qp_22",
    ], "topics": ["Double Entry Bookkeeping","Trial Balance","Income Statement","Balance Sheet","Bank Reconciliation","Depreciation","Bad Debts","Control Accounts","Suspense Accounts","Partnership Accounts",
        "Club Accounts","Cash Flow Statement","Ratio Analysis","Budgeting","Variance Analysis","Manufacturing Accounts","Inventory Valuation","Payroll","Correction of Errors","Financial Planning"]},
    "Information Technology": {"code": "0417", "papers": [
        "0417_s24_qp_12","0417_s24_qp_11","0417_s24_ms_12","0417_w23_qp_12","0417_w23_qp_11","0417_w23_ms_12","0417_s23_qp_12","0417_s23_ms_12","0417_w22_qp_12","0417_w22_ms_12",
        "0417_s22_qp_12","0417_s22_ms_12","0417_w21_qp_12","0417_w21_ms_12","0417_s21_qp_12","0417_s21_ms_12","0417_w20_qp_12","0417_s20_qp_12","0417_w19_qp_12","0417_s19_qp_12",
    ], "topics": ["Computer Systems","Input Devices","Output Devices","Storage Devices","Networks","Internet & Email","Database Systems","Spreadsheets","Web Development","Multimedia",
        "Cyber Security","Data Protection","Systems Analysis","File Management","Word Processing","Desktop Publishing","Presentations","Data Logging","Expert Systems","Emerging Technologies"]},
    "French": {"code": "0520", "papers": [
        "0520_s24_qp_22","0520_s24_qp_42","0520_s24_ms_22","0520_w23_qp_22","0520_w23_qp_42","0520_w23_ms_22","0520_s23_qp_22","0520_s23_qp_42","0520_s23_ms_22","0520_w22_qp_22",
        "0520_w22_qp_42","0520_w22_ms_22","0520_s22_qp_22","0520_s22_qp_42","0520_w21_qp_22","0520_w21_qp_42","0520_s21_qp_22","0520_s21_qp_42","0520_w20_qp_22","0520_s20_qp_22",
    ], "topics": ["Les Vacances","La Famille","La Vie Quotidienne","L'Education","Le Travail","La Nourriture","La Sante","Les Loisirs","Le Sport","L'Environnement",
        "Les Medias","La Technologie","Les Vetements","La Maison","La Ville","Les Transports","Le Temps","Les Fetes","La Culture","Les Verbes"]},
    "Geography": {"code": "0460", "papers": [
        "0460_s24_qp_12","0460_s24_qp_22","0460_s24_ms_12","0460_w23_qp_12","0460_w23_qp_22","0460_w23_ms_12","0460_s23_qp_12","0460_s23_qp_22","0460_s23_ms_12","0460_w22_qp_12",
        "0460_w22_qp_22","0460_w22_ms_12","0460_s22_qp_12","0460_s22_qp_22","0460_w21_qp_12","0460_w21_qp_22","0460_s21_qp_12","0460_s21_qp_22","0460_w20_qp_12","0460_s20_qp_12",
    ], "topics": ["Population","Settlement","Rivers","Coasts","Weather & Climate","Plate Tectonics","Earthquakes & Volcanoes","Economic Development","Industry","Tourism",
        "Agriculture","Urbanisation","Migration","Energy Resources","Water Supply","Desertification","Deforestation","Map Skills","Fieldwork","Sustainability"]},
    "Sociology": {"code": "0495", "papers": [
        "0495_s24_qp_12","0495_s24_qp_22","0495_s24_ms_12","0495_w23_qp_12","0495_w23_qp_22","0495_w23_ms_12","0495_s23_qp_12","0495_s23_qp_22","0495_w22_qp_12","0495_w22_qp_22",
        "0495_w22_ms_12","0495_s22_qp_12","0495_s22_qp_22","0495_w21_qp_12","0495_w21_qp_22","0495_s21_qp_12","0495_s21_qp_22","0495_w20_qp_12","0495_s20_qp_12","0495_w19_qp_12",
    ], "topics": ["Socialisation","Family","Education","Crime & Deviance","Social Inequality","Stratification","Media","Poverty","Power & Politics","Gender",
        "Ethnicity","Religion","Health","Research Methods","Culture & Identity","Globalisation","Youth Subcultures","Age & Society","Disability","Social Change"]},
    "Global Perspectives": {"code": "0457", "papers": [
        "0457_s24_qp_12","0457_s24_qp_22","0457_s24_ms_12","0457_w23_qp_12","0457_w23_qp_22","0457_w23_ms_12","0457_s23_qp_12","0457_s23_qp_22","0457_w22_qp_12","0457_w22_qp_22",
        "0457_w22_ms_12","0457_s22_qp_12","0457_s22_qp_22","0457_w21_qp_12","0457_w21_qp_22","0457_s21_qp_12","0457_s21_qp_22","0457_w20_qp_12","0457_s20_qp_12","0457_w19_qp_12",
    ], "topics": ["Demographic Change","Education for All","Poverty & Inequality","Disease & Health","Conflict & Peace","Digital Divide","Climate Change","Human Rights","Trade & Aid","Cultural Diversity",
        "Water & Food Security","Migration","Urbanisation","Law & Criminality","Belief Systems","Biodiversity","Transport","Employment","Media & Communication","Sustainability"]},
}

SUBJECT_ALIASES = {
    "Extended Mathematics": "Mathematics", "Additional Mathematics": "Mathematics",
    "Pure Mathematics 1": "Mathematics", "Pure Mathematics 2": "Mathematics",
    "Probability and Statistics": "Mathematics", "Coordinated Science": "Biology",
    "literature": "English Language",
}

download_cache = {}

async def download_paper(filename, teacher_id):
    if filename in download_cache:
        return download_cache[filename]
    url = f"{BASE}/{filename}.pdf"
    try:
        resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200 or len(resp.content) < 500:
            return None
        data = resp.content
        file_id = str(uuid.uuid4())
        path = f"{APP_NAME}/resources/{teacher_id}/{file_id}_{filename}.pdf"
        put_object(path, data, "application/pdf")
        await db.file_assets.insert_one({
            "file_id": file_id, "storage_path": path, "original_filename": f"{filename}.pdf",
            "content_type": "application/pdf", "size_bytes": len(data),
            "owner_user_id": teacher_id, "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        download_cache[filename] = file_id
        return file_id
    except:
        return None

async def upload_generated_pdf(data, filename, teacher_id):
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/resources/{teacher_id}/{file_id}_{filename}"
    put_object(path, data, "application/pdf")
    await db.file_assets.insert_one({
        "file_id": file_id, "storage_path": path, "original_filename": filename,
        "content_type": "application/pdf", "size_bytes": len(data),
        "owner_user_id": teacher_id, "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return file_id

async def create_resource(teacher_id, teacher_name, subject_name, subject_id, title, res_type, file_id):
    doc = {
        "resource_id": gen_id(), "title": title, "description": f"Cambridge {subject_name}",
        "resource_type": res_type, "subject_id": subject_id, "subject_name": subject_name,
        "teacher_id": teacher_id, "teacher_name": teacher_name,
        "url": "", "file_ids": [file_id] if file_id else [],
        "published": False, "published_class_ids": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lms_resources.insert_one(doc)

async def run():
    # Clear existing resources to start fresh
    await db.lms_resources.delete_many({})
    logger.info("Cleared existing resources")
    
    teachers = await db.users.find({"role": "Teacher"}, {"_id": 0, "user_id": 1, "name": 1, "teaching_subjects": 1}).to_list(50)
    subjects = await db.subjects.find({}, {"_id": 0}).to_list(50)
    subj_map = {s["name"]: s["subject_id"] for s in subjects}
    
    total_created = 0
    total_downloaded = 0
    
    for teacher in teachers:
        t_subjects = teacher.get("teaching_subjects", [])
        if not t_subjects:
            continue
        
        for subj_name in t_subjects:
            lookup = SUBJECT_ALIASES.get(subj_name, subj_name)
            sdata = SUBJECTS.get(lookup)
            if not sdata:
                continue
            
            subject_id = subj_map.get(subj_name, "")
            tid = teacher["user_id"]
            tname = teacher["name"]
            topics = sdata["topics"]
            
            logger.info(f"  {tname} - {subj_name}...")
            
            # 1. PAST PAPERS (20) - download real PDFs
            for paper in sdata["papers"][:20]:
                fid = await download_paper(paper, tid)
                if fid:
                    total_downloaded += 1
                    parts = paper.split("_")
                    session = {"s24":"May/Jun 2024","w23":"Oct/Nov 2023","s23":"May/Jun 2023","w22":"Oct/Nov 2022","s22":"May/Jun 2022","w21":"Oct/Nov 2021","s21":"May/Jun 2021","w20":"Oct/Nov 2020","s20":"May/Jun 2020","s19":"May/Jun 2019","w19":"Oct/Nov 2019"}.get(parts[1], parts[1])
                    ptype = "Question Paper" if "qp" in parts[2] else "Mark Scheme"
                    pnum = parts[3] if len(parts) > 3 else ""
                    title = f"{subj_name} {ptype} P{pnum} {session}"
                    await create_resource(tid, tname, subj_name, subject_id, title, "past_paper", fid)
                    total_created += 1
            
            # 2. SYLLABUS (5) - generate PDFs
            for i, topic_group in enumerate([topics[:5], topics[5:10], topics[10:15], topics[15:], topics]):
                titles = [f"IGCSE {subj_name} Syllabus 2025-2027", f"{subj_name} Syllabus Overview Term 1", f"{subj_name} Syllabus Overview Term 2", f"{subj_name} Syllabus Overview Term 3", f"{subj_name} Complete Syllabus Guide"][i]
                content = [f"## Cambridge IGCSE {subj_name}", f"Academic Year 2025-2027", "", "## Topics Covered:"]
                content += [f"- {t}" for t in topic_group]
                content += ["", "## Assessment Objectives:", "- AO1: Knowledge and Understanding", "- AO2: Application", "- AO3: Analysis and Evaluation"]
                data = make_pdf(titles, f"Cambridge IGCSE {subj_name}", content)
                fid = await upload_generated_pdf(data, f"syllabus_{subj_name.replace(' ','_')}_{i+1}.pdf", tid)
                await create_resource(tid, tname, subj_name, subject_id, titles, "syllabus", fid)
                total_created += 1
            
            # 3. SCHEME OF WORK (5) - generate PDFs
            for term in range(1, 6):
                term_label = f"Term {min(term, 3)}" if term <= 3 else f"Revision {term-3}"
                title = f"{subj_name} Scheme of Work {term_label}"
                start = ((term-1) * 4) % len(topics)
                term_topics = topics[start:start+4] if start+4 <= len(topics) else topics[start:] + topics[:4-(len(topics)-start)]
                content = [f"## {title}", f"Duration: 12 weeks", ""]
                for w, t in enumerate(term_topics, 1):
                    content += [f"## Week {w*3-2}-{w*3}: {t}", f"- Learning objectives for {t}", f"- Key vocabulary and concepts", f"- Practical activities and experiments", f"- Assessment: End of topic test", ""]
                content += ["## Resources Required:", f"- Cambridge IGCSE {subj_name} Textbook", "- Past paper questions", "- Practical equipment"]
                data = make_pdf(title, f"Cambridge IGCSE {subj_name}", content)
                fid = await upload_generated_pdf(data, f"scheme_{subj_name.replace(' ','_')}_t{term}.pdf", tid)
                await create_resource(tid, tname, subj_name, subject_id, title, "scheme_of_work", fid)
                total_created += 1
            
            # 4. WORKSHEETS (5) - generate PDFs
            for i in range(5):
                topic = topics[i * 4 % len(topics)]
                title = f"{subj_name} Worksheet: {topic}"
                content = [f"## {title}", "Name: ___________________  Class: ________  Date: ________", ""]
                for q in range(1, 11):
                    content += [f"## Question {q}", f"Related to {topic} in {subj_name}.", "_______________________________________________", "_______________________________________________", ""]
                data = make_pdf(title, f"Cambridge IGCSE {subj_name} Practice", content)
                fid = await upload_generated_pdf(data, f"worksheet_{subj_name.replace(' ','_')}_{i+1}.pdf", tid)
                await create_resource(tid, tname, subj_name, subject_id, title, "worksheet", fid)
                total_created += 1
            
            # 5. REVISION NOTES / SLIDES (5) - generate PDFs
            for i in range(5):
                start = i * 4 % len(topics)
                slide_topics = topics[start:start+4] if start+4 <= len(topics) else topics[start:]
                title = f"{subj_name} Revision Notes: {slide_topics[0]}"
                content = [f"## {subj_name} - Key Revision Notes", ""]
                for t in slide_topics:
                    content += [f"## {t}", f"- Definition and key concepts of {t}", f"- Important formulas/diagrams for {t}", f"- Common exam questions on {t}", f"- Tips for answering {t} questions", ""]
                content += ["## Exam Tips:", "- Read the question carefully", "- Show all working", "- Use correct terminology", "- Manage your time effectively"]
                data = make_pdf(title, f"Cambridge IGCSE {subj_name} Revision", content)
                fid = await upload_generated_pdf(data, f"notes_{subj_name.replace(' ','_')}_{i+1}.pdf", tid)
                await create_resource(tid, tname, subj_name, subject_id, title, "revision_notes", fid)
                total_created += 1
        
        logger.info(f"  {tname}: DONE")
    
    final = await db.lms_resources.count_documents({})
    with_files = await db.lms_resources.count_documents({"file_ids": {"$ne": []}})
    logger.info(f"\n=== COMPLETE ===")
    logger.info(f"Total resources: {final}")
    logger.info(f"With PDF files: {with_files}")
    logger.info(f"Papers downloaded: {total_downloaded}")
    logger.info(f"PDFs generated: {total_created - total_downloaded}")

asyncio.run(run())
