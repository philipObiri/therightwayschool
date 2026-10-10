"""
Populate teacher resources with Cambridge IGCSE/A-Level past papers, syllabi and teaching slides.
10 past papers + 10 syllabus/scheme docs + 10 teaching slides per subject.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db = client[os.environ.get('DB_NAME', 'test_database')]

def gen_id(prefix="res_"):
    import uuid
    return prefix + uuid.uuid4().hex[:12]

# Cambridge subject codes and resource URLs
SUBJECT_RESOURCES = {
    "English Language": {
        "code": "0500", "alevel_code": "9093",
        "past_papers": [
            {"title": "IGCSE English Language Paper 1 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2024/0500_s24_qp_12.pdf"},
            {"title": "IGCSE English Language Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2024/0500_s24_qp_22.pdf"},
            {"title": "IGCSE English Language Paper 1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2023/0500_w23_qp_12.pdf"},
            {"title": "IGCSE English Language Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2023/0500_w23_qp_22.pdf"},
            {"title": "IGCSE English Language Paper 1 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2023/0500_s23_qp_12.pdf"},
            {"title": "IGCSE English Language Mark Scheme P1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2024/0500_s24_ms_12.pdf"},
            {"title": "IGCSE English Language Mark Scheme P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2024/0500_s24_ms_22.pdf"},
            {"title": "IGCSE English Language Paper 1 Feb/Mar 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2023/0500_m23_qp_12.pdf"},
            {"title": "IGCSE English Language Paper 2 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2022/0500_s22_qp_22.pdf"},
            {"title": "IGCSE English Language Paper 1 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/English%20-%20First%20Language%20(0500)/2022/0500_w22_qp_12.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE English Language 0500 Syllabus 2025-2027", "url": "https://www.cambridgeinternational.org/Images/595424-2025-2027-syllabus.pdf"},
            {"title": "IGCSE English Scheme of Work Term 1", "url": ""},
            {"title": "IGCSE English Scheme of Work Term 2", "url": ""},
            {"title": "IGCSE English Scheme of Work Term 3", "url": ""},
            {"title": "IGCSE English Language Learner Guide", "url": ""},
            {"title": "English Language Directed Writing Guide", "url": ""},
            {"title": "English Composition Writing Techniques", "url": ""},
            {"title": "English Language Reading Comprehension Skills", "url": ""},
            {"title": "Summary Writing Framework & Tips", "url": ""},
            {"title": "English Language Exam Preparation Guide", "url": ""},
        ],
        "slides": [
            {"title": "Directed Writing - Letters & Reports", "url": ""},
            {"title": "Narrative & Descriptive Writing Techniques", "url": ""},
            {"title": "Reading Comprehension Strategies", "url": ""},
            {"title": "Summary Writing Skills", "url": ""},
            {"title": "Argumentative Writing Structure", "url": ""},
            {"title": "Language Analysis & Effects", "url": ""},
            {"title": "Punctuation & Grammar Review", "url": ""},
            {"title": "Paper 1 Exam Technique", "url": ""},
            {"title": "Paper 2 Exam Technique", "url": ""},
            {"title": "Creative Writing Workshop", "url": ""},
        ]
    },
    "Mathematics": {
        "code": "0580", "alevel_code": "9709",
        "past_papers": [
            {"title": "IGCSE Mathematics Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2024/0580_s24_qp_22.pdf"},
            {"title": "IGCSE Mathematics Paper 4 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2024/0580_s24_qp_42.pdf"},
            {"title": "IGCSE Mathematics Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2023/0580_w23_qp_22.pdf"},
            {"title": "IGCSE Mathematics Paper 4 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2023/0580_w23_qp_42.pdf"},
            {"title": "IGCSE Mathematics Paper 2 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2023/0580_s23_qp_22.pdf"},
            {"title": "IGCSE Mathematics Mark Scheme P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2024/0580_s24_ms_22.pdf"},
            {"title": "IGCSE Mathematics Mark Scheme P4 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2024/0580_s24_ms_42.pdf"},
            {"title": "IGCSE Mathematics Paper 4 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2022/0580_s22_qp_42.pdf"},
            {"title": "IGCSE Mathematics Paper 2 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2022/0580_w22_qp_22.pdf"},
            {"title": "IGCSE Mathematics Paper 4 Feb/Mar 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Mathematics%20(0580)/2023/0580_m23_qp_42.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Mathematics 0580 Syllabus 2025-2027", "url": ""},
            {"title": "Mathematics Scheme of Work Term 1 - Number & Algebra", "url": ""},
            {"title": "Mathematics Scheme of Work Term 2 - Geometry & Measures", "url": ""},
            {"title": "Mathematics Scheme of Work Term 3 - Statistics & Probability", "url": ""},
            {"title": "IGCSE Maths Formula Sheet", "url": ""},
            {"title": "Mathematics Revision Checklist", "url": ""},
            {"title": "Mathematics Learner Guide 0580", "url": ""},
            {"title": "Extended Mathematics Topic List", "url": ""},
            {"title": "Core Mathematics Study Guide", "url": ""},
            {"title": "Mathematics Exam Preparation Planner", "url": ""},
        ],
        "slides": [
            {"title": "Algebra - Equations & Inequalities", "url": ""},
            {"title": "Trigonometry - Sine, Cosine, Tangent", "url": ""},
            {"title": "Statistics - Mean, Median, Mode", "url": ""},
            {"title": "Geometry - Circle Theorems", "url": ""},
            {"title": "Probability - Tree Diagrams & Venn Diagrams", "url": ""},
            {"title": "Functions & Graphs", "url": ""},
            {"title": "Vectors & Transformations", "url": ""},
            {"title": "Number - Percentages & Ratios", "url": ""},
            {"title": "Sequences & Patterns", "url": ""},
            {"title": "Mensuration - Area, Volume, Surface Area", "url": ""},
        ]
    },
    "Biology": {
        "code": "0610", "alevel_code": "9700",
        "past_papers": [
            {"title": "IGCSE Biology Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2024/0610_s24_qp_22.pdf"},
            {"title": "IGCSE Biology Paper 4 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2024/0610_s24_qp_42.pdf"},
            {"title": "IGCSE Biology Paper 6 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2024/0610_s24_qp_62.pdf"},
            {"title": "IGCSE Biology Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2023/0610_w23_qp_22.pdf"},
            {"title": "IGCSE Biology Paper 4 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2023/0610_w23_qp_42.pdf"},
            {"title": "IGCSE Biology Mark Scheme P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2024/0610_s24_ms_22.pdf"},
            {"title": "IGCSE Biology Mark Scheme P4 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2024/0610_s24_ms_42.pdf"},
            {"title": "IGCSE Biology Paper 2 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2023/0610_s23_qp_22.pdf"},
            {"title": "IGCSE Biology Paper 4 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2022/0610_s22_qp_42.pdf"},
            {"title": "IGCSE Biology Paper 2 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Biology%20(0610)/2022/0610_w22_qp_22.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Biology 0610 Syllabus 2025-2027", "url": ""}, {"title": "Biology Scheme of Work Term 1", "url": ""}, {"title": "Biology Scheme of Work Term 2", "url": ""}, {"title": "Biology Scheme of Work Term 3", "url": ""},
            {"title": "Biology Revision Checklist", "url": ""}, {"title": "Biology Key Definitions List", "url": ""}, {"title": "Biology Practical Skills Guide", "url": ""}, {"title": "Biology Learner Guide 0610", "url": ""},
            {"title": "Biology Exam Command Words", "url": ""}, {"title": "Biology Diagram Drawing Guide", "url": ""},
        ],
        "slides": [
            {"title": "Cell Structure & Organisation", "url": ""}, {"title": "Biological Molecules - Enzymes", "url": ""}, {"title": "Plant Nutrition - Photosynthesis", "url": ""}, {"title": "Human Nutrition & Digestion", "url": ""},
            {"title": "Transport in Plants & Animals", "url": ""}, {"title": "Respiration - Aerobic & Anaerobic", "url": ""}, {"title": "Reproduction in Plants & Humans", "url": ""}, {"title": "Genetics & Inheritance", "url": ""},
            {"title": "Ecology & Environment", "url": ""}, {"title": "Homeostasis & Excretion", "url": ""},
        ]
    },
    "Chemistry": {
        "code": "0620", "alevel_code": "9701",
        "past_papers": [
            {"title": "IGCSE Chemistry Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2024/0620_s24_qp_22.pdf"},
            {"title": "IGCSE Chemistry Paper 4 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2024/0620_s24_qp_42.pdf"},
            {"title": "IGCSE Chemistry Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2023/0620_w23_qp_22.pdf"},
            {"title": "IGCSE Chemistry Paper 4 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2023/0620_w23_qp_42.pdf"},
            {"title": "IGCSE Chemistry Paper 6 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2024/0620_s24_qp_62.pdf"},
            {"title": "IGCSE Chemistry Mark Scheme P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2024/0620_s24_ms_22.pdf"},
            {"title": "IGCSE Chemistry Mark Scheme P4 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2024/0620_s24_ms_42.pdf"},
            {"title": "IGCSE Chemistry Paper 2 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2023/0620_s23_qp_22.pdf"},
            {"title": "IGCSE Chemistry Paper 4 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2022/0620_s22_qp_42.pdf"},
            {"title": "IGCSE Chemistry Paper 2 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Chemistry%20(0620)/2022/0620_w22_qp_22.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Chemistry 0620 Syllabus 2025-2027", "url": ""}, {"title": "Chemistry Scheme of Work Term 1", "url": ""}, {"title": "Chemistry Scheme of Work Term 2", "url": ""}, {"title": "Chemistry Scheme of Work Term 3", "url": ""},
            {"title": "Chemistry Periodic Table & Data Sheet", "url": ""}, {"title": "Chemistry Key Equations List", "url": ""}, {"title": "Chemistry Practical Skills Guide", "url": ""}, {"title": "Chemistry Revision Checklist", "url": ""},
            {"title": "Chemistry Learner Guide 0620", "url": ""}, {"title": "Chemistry Exam Technique Guide", "url": ""},
        ],
        "slides": [
            {"title": "Atomic Structure & Periodic Table", "url": ""}, {"title": "Bonding - Ionic, Covalent, Metallic", "url": ""}, {"title": "Stoichiometry & Mole Calculations", "url": ""}, {"title": "Electrolysis & Electrochemistry", "url": ""},
            {"title": "Acids, Bases & Salts", "url": ""}, {"title": "Rates of Reaction & Energetics", "url": ""}, {"title": "Organic Chemistry Introduction", "url": ""}, {"title": "Metals & Reactivity Series", "url": ""},
            {"title": "Redox Reactions", "url": ""}, {"title": "Chemical Tests & Analysis", "url": ""},
        ]
    },
    "Physics": {
        "code": "0625", "alevel_code": "9702",
        "past_papers": [
            {"title": "IGCSE Physics Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2024/0625_s24_qp_22.pdf"},
            {"title": "IGCSE Physics Paper 4 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2024/0625_s24_qp_42.pdf"},
            {"title": "IGCSE Physics Paper 6 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2024/0625_s24_qp_62.pdf"},
            {"title": "IGCSE Physics Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2023/0625_w23_qp_22.pdf"},
            {"title": "IGCSE Physics Paper 4 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2023/0625_w23_qp_42.pdf"},
            {"title": "IGCSE Physics Mark Scheme P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2024/0625_s24_ms_22.pdf"},
            {"title": "IGCSE Physics Mark Scheme P4 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2024/0625_s24_ms_42.pdf"},
            {"title": "IGCSE Physics Paper 2 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2023/0625_s23_qp_22.pdf"},
            {"title": "IGCSE Physics Paper 4 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2022/0625_s22_qp_42.pdf"},
            {"title": "IGCSE Physics Paper 2 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Physics%20(0625)/2022/0625_w22_qp_22.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Physics 0625 Syllabus 2025-2027", "url": ""}, {"title": "Physics Scheme of Work Term 1", "url": ""}, {"title": "Physics Scheme of Work Term 2", "url": ""}, {"title": "Physics Scheme of Work Term 3", "url": ""},
            {"title": "Physics Formula Sheet", "url": ""}, {"title": "Physics Revision Checklist", "url": ""}, {"title": "Physics Practical Skills Guide", "url": ""}, {"title": "Physics Learner Guide 0625", "url": ""},
            {"title": "Physics Key Definitions", "url": ""}, {"title": "Physics Exam Preparation Guide", "url": ""},
        ],
        "slides": [
            {"title": "Motion, Forces & Energy", "url": ""}, {"title": "Thermal Physics - Heat Transfer", "url": ""}, {"title": "Waves - Sound & Light", "url": ""}, {"title": "Electricity - Circuits & Components", "url": ""},
            {"title": "Magnetism & Electromagnetism", "url": ""}, {"title": "Nuclear Physics & Radioactivity", "url": ""}, {"title": "Pressure & Density", "url": ""}, {"title": "Energy Resources & Transfer", "url": ""},
            {"title": "Space Physics", "url": ""}, {"title": "Practical Skills & Experiments", "url": ""},
        ]
    },
    "Economics": {
        "code": "0455", "alevel_code": "9708",
        "past_papers": [
            {"title": "IGCSE Economics Paper 1 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2024/0455_s24_qp_12.pdf"},
            {"title": "IGCSE Economics Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2024/0455_s24_qp_22.pdf"},
            {"title": "IGCSE Economics Paper 1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2023/0455_w23_qp_12.pdf"},
            {"title": "IGCSE Economics Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2023/0455_w23_qp_22.pdf"},
            {"title": "IGCSE Economics Paper 1 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2023/0455_s23_qp_12.pdf"},
            {"title": "IGCSE Economics Mark Scheme P1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2024/0455_s24_ms_12.pdf"},
            {"title": "IGCSE Economics Mark Scheme P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2024/0455_s24_ms_22.pdf"},
            {"title": "IGCSE Economics Paper 2 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2022/0455_s22_qp_22.pdf"},
            {"title": "IGCSE Economics Paper 1 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2022/0455_w22_qp_12.pdf"},
            {"title": "IGCSE Economics Paper 2 Feb/Mar 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Economics%20(0455)/2023/0455_m23_qp_22.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Economics 0455 Syllabus 2025-2027", "url": ""}, {"title": "Economics Scheme of Work Term 1", "url": ""}, {"title": "Economics Scheme of Work Term 2", "url": ""}, {"title": "Economics Scheme of Work Term 3", "url": ""},
            {"title": "Economics Key Terms Glossary", "url": ""}, {"title": "Economics Diagram Reference", "url": ""}, {"title": "Economics Revision Checklist", "url": ""}, {"title": "Economics Learner Guide", "url": ""},
            {"title": "Economics Essay Writing Guide", "url": ""}, {"title": "Economics Data Response Technique", "url": ""},
        ],
        "slides": [
            {"title": "Basic Economic Problem & Opportunity Cost", "url": ""}, {"title": "Supply & Demand - Market Equilibrium", "url": ""}, {"title": "Price Elasticity of Demand & Supply", "url": ""}, {"title": "Government Intervention - Taxes & Subsidies", "url": ""},
            {"title": "Market Failure & Externalities", "url": ""}, {"title": "Money, Banking & Inflation", "url": ""}, {"title": "International Trade & Exchange Rates", "url": ""}, {"title": "Employment & Unemployment", "url": ""},
            {"title": "GDP & Economic Growth", "url": ""}, {"title": "Fiscal & Monetary Policy", "url": ""},
        ]
    },
    "Business Studies": {
        "code": "0450", "alevel_code": "9609",
        "past_papers": [
            {"title": "IGCSE Business Studies Paper 1 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2024/0450_s24_qp_12.pdf"},
            {"title": "IGCSE Business Studies Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2024/0450_s24_qp_22.pdf"},
            {"title": "IGCSE Business Studies Paper 1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2023/0450_w23_qp_12.pdf"},
            {"title": "IGCSE Business Studies Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2023/0450_w23_qp_22.pdf"},
            {"title": "IGCSE Business Studies Paper 1 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2023/0450_s23_qp_12.pdf"},
            {"title": "IGCSE Business Studies MS P1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2024/0450_s24_ms_12.pdf"},
            {"title": "IGCSE Business Studies MS P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2024/0450_s24_ms_22.pdf"},
            {"title": "IGCSE Business Studies Paper 1 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2022/0450_s22_qp_12.pdf"},
            {"title": "IGCSE Business Studies Paper 2 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2022/0450_w22_qp_22.pdf"},
            {"title": "IGCSE Business Studies Paper 1 Feb/Mar 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Business%20Studies%20(0450)/2023/0450_m23_qp_12.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Business Studies 0450 Syllabus 2025-2027", "url": ""}, {"title": "Business Studies Scheme of Work Term 1", "url": ""}, {"title": "Business Studies Scheme of Work Term 2", "url": ""}, {"title": "Business Studies Scheme of Work Term 3", "url": ""},
            {"title": "Business Studies Key Terms", "url": ""}, {"title": "Business Studies Revision Checklist", "url": ""}, {"title": "Business Case Study Guide", "url": ""}, {"title": "Business Studies Learner Guide", "url": ""},
            {"title": "Business Calculations Guide", "url": ""}, {"title": "Business Studies Exam Technique", "url": ""},
        ],
        "slides": [
            {"title": "Business Activity & Stakeholders", "url": ""}, {"title": "Marketing - 4Ps & Market Research", "url": ""}, {"title": "Human Resources & Motivation", "url": ""}, {"title": "Operations Management", "url": ""},
            {"title": "Finance - Cash Flow & Break-Even", "url": ""}, {"title": "Business Organisation & Ownership", "url": ""}, {"title": "External Environment & Globalisation", "url": ""}, {"title": "Leadership & Management Styles", "url": ""},
            {"title": "Quality Management & Lean Production", "url": ""}, {"title": "Business Growth & Expansion", "url": ""},
        ]
    },
    "Accounting": {
        "code": "0452", "alevel_code": "9706",
        "past_papers": [
            {"title": "IGCSE Accounting Paper 1 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2024/0452_s24_qp_12.pdf"},
            {"title": "IGCSE Accounting Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2024/0452_s24_qp_22.pdf"},
            {"title": "IGCSE Accounting Paper 1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2023/0452_w23_qp_12.pdf"},
            {"title": "IGCSE Accounting Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2023/0452_w23_qp_22.pdf"},
            {"title": "IGCSE Accounting Paper 1 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2023/0452_s23_qp_12.pdf"},
            {"title": "IGCSE Accounting MS P1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2024/0452_s24_ms_12.pdf"},
            {"title": "IGCSE Accounting MS P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2024/0452_s24_ms_22.pdf"},
            {"title": "IGCSE Accounting Paper 1 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2022/0452_s22_qp_12.pdf"},
            {"title": "IGCSE Accounting Paper 2 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2022/0452_w22_qp_22.pdf"},
            {"title": "IGCSE Accounting Paper 1 Feb/Mar 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Accounting%20(0452)/2023/0452_m23_qp_12.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Accounting 0452 Syllabus 2025-2027", "url": ""}, {"title": "Accounting Scheme of Work Term 1", "url": ""}, {"title": "Accounting Scheme of Work Term 2", "url": ""}, {"title": "Accounting Scheme of Work Term 3", "url": ""},
            {"title": "Double Entry Bookkeeping Guide", "url": ""}, {"title": "Accounting Key Formats & Layouts", "url": ""}, {"title": "Accounting Revision Checklist", "url": ""}, {"title": "Accounting Learner Guide", "url": ""},
            {"title": "Financial Statements Guide", "url": ""}, {"title": "Accounting Ratios Formula Sheet", "url": ""},
        ],
        "slides": [
            {"title": "Double Entry & T-Accounts", "url": ""}, {"title": "Trial Balance & Errors", "url": ""}, {"title": "Income Statement & Balance Sheet", "url": ""}, {"title": "Bank Reconciliation", "url": ""},
            {"title": "Depreciation Methods", "url": ""}, {"title": "Inventory Valuation (FIFO, LIFO, AVCO)", "url": ""}, {"title": "Partnership Accounts", "url": ""}, {"title": "Cash Flow Statements", "url": ""},
            {"title": "Ratio Analysis & Interpretation", "url": ""}, {"title": "Budgeting & Variance Analysis", "url": ""},
        ]
    },
    "Information Technology": {
        "code": "0417", "alevel_code": "9626",
        "past_papers": [
            {"title": "IGCSE IT Paper 1 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2024/0417_s24_qp_12.pdf"},
            {"title": "IGCSE IT Paper 1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2023/0417_w23_qp_12.pdf"},
            {"title": "IGCSE IT Paper 1 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2023/0417_s23_qp_12.pdf"},
            {"title": "IGCSE IT MS P1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2024/0417_s24_ms_12.pdf"},
            {"title": "IGCSE IT Paper 1 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2022/0417_w22_qp_12.pdf"},
            {"title": "IGCSE IT Paper 1 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2022/0417_s22_qp_12.pdf"},
            {"title": "IGCSE IT MS P1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2023/0417_w23_ms_12.pdf"},
            {"title": "IGCSE IT Paper 1 Feb/Mar 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2023/0417_m23_qp_12.pdf"},
            {"title": "IGCSE IT Paper 1 Oct/Nov 2021", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2021/0417_w21_qp_12.pdf"},
            {"title": "IGCSE IT Paper 1 May/Jun 2021", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Information%20Technology%20(0417)/2021/0417_s21_qp_12.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE IT 0417 Syllabus 2025-2027", "url": ""}, {"title": "IT Scheme of Work Term 1", "url": ""}, {"title": "IT Scheme of Work Term 2", "url": ""}, {"title": "IT Scheme of Work Term 3", "url": ""},
            {"title": "IT Theory Revision Checklist", "url": ""}, {"title": "IT Practical Skills Guide", "url": ""}, {"title": "IT Learner Guide 0417", "url": ""}, {"title": "IT Key Terms Glossary", "url": ""},
            {"title": "IT Exam Preparation Guide", "url": ""}, {"title": "IT Practical Exam Tips", "url": ""},
        ],
        "slides": [
            {"title": "Types & Components of Computer Systems", "url": ""}, {"title": "Input & Output Devices", "url": ""}, {"title": "Storage Devices & Media", "url": ""}, {"title": "Networks & Internet", "url": ""},
            {"title": "Database Management Systems", "url": ""}, {"title": "Spreadsheet Modelling", "url": ""}, {"title": "Web Development & HTML/CSS", "url": ""}, {"title": "Cyber Security & Data Protection", "url": ""},
            {"title": "Multimedia & Presentations", "url": ""}, {"title": "Systems Analysis & Design", "url": ""},
        ]
    },
    "French": {
        "code": "0520",
        "past_papers": [
            {"title": "IGCSE French Paper 1 Listening May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2024/0520_s24_qp_12.pdf"},
            {"title": "IGCSE French Paper 2 Reading May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2024/0520_s24_qp_22.pdf"},
            {"title": "IGCSE French Paper 4 Writing May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2024/0520_s24_qp_42.pdf"},
            {"title": "IGCSE French Paper 1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2023/0520_w23_qp_12.pdf"},
            {"title": "IGCSE French Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2023/0520_w23_qp_22.pdf"},
            {"title": "IGCSE French MS P2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2024/0520_s24_ms_22.pdf"},
            {"title": "IGCSE French Paper 2 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2023/0520_s23_qp_22.pdf"},
            {"title": "IGCSE French Paper 4 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2023/0520_w23_qp_42.pdf"},
            {"title": "IGCSE French Paper 2 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2022/0520_s22_qp_22.pdf"},
            {"title": "IGCSE French Paper 4 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/French%20-%20Foreign%20Language%20(0520)/2022/0520_s22_qp_42.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE French 0520 Syllabus 2025-2027", "url": ""}, {"title": "French Scheme of Work Term 1", "url": ""}, {"title": "French Scheme of Work Term 2", "url": ""}, {"title": "French Scheme of Work Term 3", "url": ""},
            {"title": "French Vocabulary List by Topic", "url": ""}, {"title": "French Grammar Reference Guide", "url": ""}, {"title": "French Revision Checklist", "url": ""}, {"title": "French Oral Exam Preparation", "url": ""},
            {"title": "French Writing Skills Guide", "url": ""}, {"title": "French Listening Practice Guide", "url": ""},
        ],
        "slides": [
            {"title": "Les Vacances et les Voyages", "url": ""}, {"title": "La Famille et les Relations", "url": ""}, {"title": "La Vie Quotidienne", "url": ""}, {"title": "L'Education et le Travail", "url": ""},
            {"title": "La Nourriture et la Sante", "url": ""}, {"title": "Les Loisirs et le Sport", "url": ""}, {"title": "L'Environnement", "url": ""}, {"title": "Les Tenses - Passe, Present, Futur", "url": ""},
            {"title": "French Grammar - Verbs & Conjugation", "url": ""}, {"title": "French Exam Technique & Tips", "url": ""},
        ]
    },
    "Geography": {
        "code": "0460",
        "past_papers": [
            {"title": "IGCSE Geography Paper 1 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2024/0460_s24_qp_12.pdf"},
            {"title": "IGCSE Geography Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2024/0460_s24_qp_22.pdf"},
            {"title": "IGCSE Geography Paper 1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2023/0460_w23_qp_12.pdf"},
            {"title": "IGCSE Geography Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2023/0460_w23_qp_22.pdf"},
            {"title": "IGCSE Geography Paper 1 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2023/0460_s23_qp_12.pdf"},
            {"title": "IGCSE Geography MS P1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2024/0460_s24_ms_12.pdf"},
            {"title": "IGCSE Geography Paper 2 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2022/0460_s22_qp_22.pdf"},
            {"title": "IGCSE Geography Paper 1 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2022/0460_w22_qp_12.pdf"},
            {"title": "IGCSE Geography Paper 2 Feb/Mar 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2023/0460_m23_qp_22.pdf"},
            {"title": "IGCSE Geography Paper 1 May/Jun 2021", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Geography%20(0460)/2021/0460_s21_qp_12.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Geography 0460 Syllabus 2025-2027", "url": ""}, {"title": "Geography Scheme of Work Term 1", "url": ""}, {"title": "Geography Scheme of Work Term 2", "url": ""}, {"title": "Geography Scheme of Work Term 3", "url": ""},
            {"title": "Geography Key Terms Glossary", "url": ""}, {"title": "Geography Map Skills Guide", "url": ""}, {"title": "Geography Revision Checklist", "url": ""}, {"title": "Geography Fieldwork Guide", "url": ""},
            {"title": "Geography Learner Guide 0460", "url": ""}, {"title": "Geography Case Studies Summary", "url": ""},
        ],
        "slides": [
            {"title": "Population & Settlement", "url": ""}, {"title": "Rivers & Flooding", "url": ""}, {"title": "Weather & Climate", "url": ""}, {"title": "Plate Tectonics & Earthquakes", "url": ""},
            {"title": "Economic Development & Aid", "url": ""}, {"title": "Industry & Tourism", "url": ""}, {"title": "Urbanisation & Migration", "url": ""}, {"title": "Coastal Environments", "url": ""},
            {"title": "Agriculture & Food Supply", "url": ""}, {"title": "Map Reading & OS Skills", "url": ""},
        ]
    },
    "Sociology": {
        "code": "0495",
        "past_papers": [
            {"title": "IGCSE Sociology Paper 1 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2024/0495_s24_qp_12.pdf"},
            {"title": "IGCSE Sociology Paper 2 May/Jun 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2024/0495_s24_qp_22.pdf"},
            {"title": "IGCSE Sociology Paper 1 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2023/0495_w23_qp_12.pdf"},
            {"title": "IGCSE Sociology Paper 2 Oct/Nov 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2023/0495_w23_qp_22.pdf"},
            {"title": "IGCSE Sociology Paper 1 May/Jun 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2023/0495_s23_qp_12.pdf"},
            {"title": "IGCSE Sociology MS P1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2024/0495_s24_ms_12.pdf"},
            {"title": "IGCSE Sociology Paper 1 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2022/0495_s22_qp_12.pdf"},
            {"title": "IGCSE Sociology Paper 2 May/Jun 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2022/0495_s22_qp_22.pdf"},
            {"title": "IGCSE Sociology Paper 1 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2022/0495_w22_qp_12.pdf"},
            {"title": "IGCSE Sociology Paper 2 Oct/Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Sociology%20(0495)/2022/0495_w22_qp_22.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Sociology 0495 Syllabus 2025-2027", "url": ""}, {"title": "Sociology Scheme of Work Term 1", "url": ""}, {"title": "Sociology Scheme of Work Term 2", "url": ""}, {"title": "Sociology Scheme of Work Term 3", "url": ""},
            {"title": "Sociology Key Concepts", "url": ""}, {"title": "Sociology Research Methods Guide", "url": ""}, {"title": "Sociology Revision Checklist", "url": ""}, {"title": "Sociology Essay Writing Guide", "url": ""},
            {"title": "Sociology Learner Guide 0495", "url": ""}, {"title": "Sociology Theorists Summary", "url": ""},
        ],
        "slides": [
            {"title": "Socialisation & Identity", "url": ""}, {"title": "Family - Types & Functions", "url": ""}, {"title": "Education - Functions & Inequality", "url": ""}, {"title": "Crime & Deviance", "url": ""},
            {"title": "Social Inequality & Stratification", "url": ""}, {"title": "Media - Influence & Control", "url": ""}, {"title": "Research Methods in Sociology", "url": ""}, {"title": "Poverty & Social Exclusion", "url": ""},
            {"title": "Power & Politics", "url": ""}, {"title": "Gender & Ethnicity", "url": ""},
        ]
    },
    "Art and Design": {
        "code": "0400",
        "past_papers": [
            {"title": "IGCSE Art & Design Paper 1 2024", "url": ""}, {"title": "IGCSE Art & Design Paper 2 2024", "url": ""}, {"title": "IGCSE Art & Design Paper 1 2023", "url": ""},
            {"title": "IGCSE Art & Design Paper 2 2023", "url": ""}, {"title": "IGCSE Art & Design Paper 1 2022", "url": ""}, {"title": "IGCSE Art & Design Paper 2 2022", "url": ""},
            {"title": "IGCSE Art & Design Examiner Report 2024", "url": ""}, {"title": "IGCSE Art & Design Examiner Report 2023", "url": ""}, {"title": "IGCSE Art & Design Grade Boundaries 2024", "url": ""},
            {"title": "IGCSE Art & Design Grade Boundaries 2023", "url": ""},
        ],
        "syllabus": [
            {"title": "IGCSE Art & Design 0400 Syllabus 2025-2027", "url": ""}, {"title": "Art Scheme of Work Term 1", "url": ""}, {"title": "Art Scheme of Work Term 2", "url": ""}, {"title": "Art Scheme of Work Term 3", "url": ""},
            {"title": "Art & Design Assessment Criteria", "url": ""}, {"title": "Art Sketchbook Guidelines", "url": ""}, {"title": "Art & Design Revision Guide", "url": ""}, {"title": "Art Materials & Techniques Guide", "url": ""},
            {"title": "Art History Reference Sheet", "url": ""}, {"title": "Art Portfolio Preparation Tips", "url": ""},
        ],
        "slides": [
            {"title": "Elements of Art - Line, Shape, Form", "url": ""}, {"title": "Colour Theory & Mixing", "url": ""}, {"title": "Perspective & Composition", "url": ""}, {"title": "Portrait Drawing Techniques", "url": ""},
            {"title": "Printmaking Methods", "url": ""}, {"title": "Sculpture & 3D Design", "url": ""}, {"title": "Photography & Digital Art", "url": ""}, {"title": "Art Movements - Impressionism to Modern", "url": ""},
            {"title": "Mixed Media & Collage", "url": ""}, {"title": "Critical Studies & Artist Analysis", "url": ""},
        ]
    },
    "Global Perspectives": {
        "code": "0457",
        "past_papers": [
            {"title": "IGCSE Global Perspectives Paper 1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2024/0457_s24_qp_12.pdf"},
            {"title": "IGCSE Global Perspectives Paper 2 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2024/0457_s24_qp_22.pdf"},
            {"title": "IGCSE Global Perspectives Paper 1 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2023/0457_w23_qp_12.pdf"},
            {"title": "IGCSE Global Perspectives Paper 2 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2023/0457_w23_qp_22.pdf"},
            {"title": "IGCSE Global Perspectives Paper 1 May 2023", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2023/0457_s23_qp_12.pdf"},
            {"title": "IGCSE Global Perspectives MS P1 2024", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2024/0457_s24_ms_12.pdf"},
            {"title": "IGCSE Global Perspectives Paper 1 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2022/0457_s22_qp_12.pdf"},
            {"title": "IGCSE Global Perspectives Paper 2 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2022/0457_s22_qp_22.pdf"},
            {"title": "IGCSE Global Perspectives Paper 1 Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2022/0457_w22_qp_12.pdf"},
            {"title": "IGCSE Global Perspectives Paper 2 Nov 2022", "url": "https://papers.gceguide.com/Cambridge%20IGCSE/Global%20Perspectives%20(0457)/2022/0457_w22_qp_22.pdf"},
        ],
        "syllabus": [
            {"title": "IGCSE Global Perspectives 0457 Syllabus 2025-2027", "url": ""}, {"title": "Global Perspectives Scheme of Work Term 1", "url": ""}, {"title": "Global Perspectives Scheme of Work Term 2", "url": ""}, {"title": "Global Perspectives Scheme of Work Term 3", "url": ""},
            {"title": "GP Research Skills Guide", "url": ""}, {"title": "GP Individual Report Writing Guide", "url": ""}, {"title": "GP Team Project Guidelines", "url": ""}, {"title": "GP Revision Checklist", "url": ""},
            {"title": "GP Source Evaluation Framework", "url": ""}, {"title": "GP Perspectives Analysis Guide", "url": ""},
        ],
        "slides": [
            {"title": "Demographic Change & Migration", "url": ""}, {"title": "Education for All", "url": ""}, {"title": "Poverty & Inequality", "url": ""}, {"title": "Disease & Health", "url": ""},
            {"title": "Conflict & Peace", "url": ""}, {"title": "Technology & the Digital Divide", "url": ""}, {"title": "Climate Change & Sustainability", "url": ""}, {"title": "Human Rights", "url": ""},
            {"title": "Trade & Globalisation", "url": ""}, {"title": "Cultural Diversity & Identity", "url": ""},
        ]
    },
}

# Map aliases to main subjects
SUBJECT_ALIASES = {
    "Extended Mathematics": "Mathematics",
    "Additional Mathematics": "Mathematics",
    "Pure Mathematics 1": "Mathematics",
    "Pure Mathematics 2": "Mathematics",
    "Probability and Statistics": "Mathematics",
    "Coordinated Science": "Biology",
    "literature": "English Language",
}

async def populate():
    now = datetime.now(timezone.utc).isoformat()
    teachers = await db.users.find({"role": "Teacher"}, {"_id": 0, "user_id": 1, "name": 1, "teaching_subjects": 1}).to_list(50)
    subjects = await db.subjects.find({}, {"_id": 0}).to_list(50)
    subj_map = {s["name"]: s["subject_id"] for s in subjects}
    
    total = 0
    for teacher in teachers:
        t_subjects = teacher.get("teaching_subjects", [])
        if not t_subjects:
            continue
        
        for subj_name in t_subjects:
            lookup = SUBJECT_ALIASES.get(subj_name, subj_name)
            resources = SUBJECT_RESOURCES.get(lookup)
            if not resources:
                print(f"  SKIP: No resources for {subj_name} (teacher: {teacher['name']})")
                continue
            
            subject_id = subj_map.get(subj_name, "")
            
            # Past papers
            for pp in resources["past_papers"]:
                doc = {
                    "resource_id": gen_id(), "title": pp["title"],
                    "description": f"Cambridge {lookup} past paper",
                    "resource_type": "past_paper",
                    "subject_id": subject_id, "subject_name": subj_name,
                    "teacher_id": teacher["user_id"], "teacher_name": teacher["name"],
                    "url": pp["url"], "file_ids": [],
                    "published": False, "published_class_ids": [],
                    "created_at": now
                }
                await db.lms_resources.insert_one(doc)
                total += 1
            
            # Syllabus / Scheme of work
            for sy in resources["syllabus"]:
                doc = {
                    "resource_id": gen_id(), "title": sy["title"],
                    "description": f"Cambridge {lookup} syllabus/scheme of work",
                    "resource_type": "syllabus",
                    "subject_id": subject_id, "subject_name": subj_name,
                    "teacher_id": teacher["user_id"], "teacher_name": teacher["name"],
                    "url": sy["url"], "file_ids": [],
                    "published": False, "published_class_ids": [],
                    "created_at": now
                }
                await db.lms_resources.insert_one(doc)
                total += 1
            
            # Slides / Teaching notes
            for sl in resources["slides"]:
                doc = {
                    "resource_id": gen_id(), "title": sl["title"],
                    "description": f"Teaching slides for {lookup}",
                    "resource_type": "revision_notes",
                    "subject_id": subject_id, "subject_name": subj_name,
                    "teacher_id": teacher["user_id"], "teacher_name": teacher["name"],
                    "url": sl["url"], "file_ids": [],
                    "published": False, "published_class_ids": [],
                    "created_at": now
                }
                await db.lms_resources.insert_one(doc)
                total += 1
        
        print(f"  {teacher['name']}: done ({len(t_subjects)} subjects)")
    
    print(f"\nTotal resources added: {total}")
    final_count = await db.lms_resources.count_documents({})
    print(f"Total resources in DB: {final_count}")

asyncio.run(populate())
