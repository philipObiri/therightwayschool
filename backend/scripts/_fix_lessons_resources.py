"""
Fix: seed lessons into `lessons` collection (student LMS endpoint) and
seed resources into `lms_resources` — one lesson + one resource per subject (8 subjects).
"""
import asyncio, os, secrets
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

def gen_id(prefix=""):
    return f"{prefix}{secrets.token_hex(8)}"

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


LESSON_DATA = {
    "Mathematics": {
        "lessons": [
            {
                "title": "Place Value and Number Systems",
                "description": "Introduction to the base-10 number system and place value for Year 7.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Understand the base-10 number system\n"
                    "2. Read and write numbers up to one million\n"
                    "3. Compare and order whole numbers\n\n"
                    "KEY VOCABULARY: digit, place value, ones, tens, hundreds, thousands, ten-thousands\n\n"
                    "STARTER (5 min)\nWrite the value of each digit in 347,892.\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• Place Value Chart demonstration\n"
                    "• Students complete place value exercises\n"
                    "• Partner activity: ordering 6-digit numbers\n\n"
                    "PLENARY (5 min)\nExit ticket — write 4 numbers in order from smallest to largest."
                ),
                "days_old": 14,
            },
            {
                "title": "Fractions, Decimals and Percentages",
                "description": "Converting and comparing fractions, decimals and percentages.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Convert between fractions, decimals and percentages\n"
                    "2. Compare fractions with different denominators\n"
                    "3. Solve real-world problems using fractions\n\n"
                    "KEY VOCABULARY: numerator, denominator, equivalent fractions, decimal, percentage\n\n"
                    "STARTER (5 min)\nQuick quiz — what fraction of this shape is shaded?\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• Fraction walls visual aid\n"
                    "• Converting: ½ = 0.5 = 50%\n"
                    "• Class competition: fraction snap game\n\n"
                    "PLENARY (5 min)\nExplain in your own words — what does 3/4 mean?"
                ),
                "days_old": 9,
            },
        ],
        "resource": {
            "title": "Year 7 Maths — Practice Paper: Number Systems & Fractions",
            "resource_type": "past_paper",
            "description": "Practice questions covering number systems, place value, fractions, decimals and percentages.",
            "content_text": (
                "MATHEMATICS PRACTICE PAPER\nYear 7 | Time: 45 min | Marks: 40\n\n"
                "SECTION A — Number (10 marks)\n"
                "1. Write the value of the digit 7 in 475,362. [1]\n"
                "2. Order smallest to largest: 45,021 | 45,210 | 4,521 | 450,021 [2]\n"
                "3. Write XXI + XIV as a Hindu-Arabic number. [1]\n"
                "4. Find the HCF of 24 and 36. [2]\n"
                "5. Find the LCM of 4 and 6. [2]\n"
                "6. What is 3² + 4²? [2]\n\n"
                "SECTION B — Fractions (15 marks)\n"
                "7. Simplify 18/24 to lowest terms. [2]\n"
                "8. Convert 3/5 to a decimal. [1]\n"
                "9. Convert 0.35 to a percentage. [1]\n"
                "10. Which is greater: 2/3 or 3/4? Show your working. [2]\n"
                "11. Add 1/4 + 2/3. Give your answer as a mixed number. [3]\n"
                "12. 15% of 240 = ? [2]\n"
                "13. Decrease 80 by 25%. [2]\n"
                "14. A bag has 20 sweets. 8 are red. What fraction are NOT red? [2]\n\n"
                "SECTION C — Problem Solving (15 marks)\n"
                "15–17. Multi-step word problems on fractions, percentages and ratio."
            ),
            "days_old": 12,
        },
        "syllabus": {
            "title": "Year 7 Mathematics Syllabus — Term 1",
            "resource_type": "syllabus",
            "description": "Full Term 1 Mathematics syllabus covering number, fractions and introduction to algebra.",
            "content_text": (
                "TERM 1 MATHEMATICS SYLLABUS — YEAR 7\n\n"
                "Week 1–2: Number Systems and Place Value\n"
                "Week 3–4: Fractions, Decimals and Percentages\n"
                "Week 5–6: Operations with Integers (BODMAS)\n"
                "Week 7–8: Introduction to Algebra\n"
                "Week 9: Revision | Week 10: Mid-Term Assessment\n\n"
                "Assessment: Progressive test (Wk 5), Mid-term exam (Wk 9)"
            ),
            "days_old": 20,
        },
    },

    "English Language": {
        "lessons": [
            {
                "title": "Writing to Describe — Sensory Techniques",
                "description": "Using sensory language, simile, metaphor and personification in descriptive writing.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Identify features of descriptive writing\n"
                    "2. Use sensory language and figurative devices\n"
                    "3. Craft a descriptive paragraph independently\n\n"
                    "KEY TECHNIQUES: simile, metaphor, personification, sensory detail (sight/sound/smell/touch/taste)\n\n"
                    "STARTER (5 min)\nRead this passage — how does the writer make you feel like you are there?\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• Annotate a model text for descriptive techniques\n"
                    "• Teacher models 'Show don't tell' technique\n"
                    "• Students write a descriptive paragraph about their favourite place\n\n"
                    "PLENARY (5 min)\nPeer review — circle the best descriptive detail in your partner's paragraph."
                ),
                "days_old": 7,
            },
            {
                "title": "Reading Comprehension — PEEE Technique",
                "description": "Developing inference, deduction and structured PEEE response technique.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Use PEEE technique (Point, Evidence, Explain, Effect)\n"
                    "2. Identify explicit and implicit information in a text\n"
                    "3. Respond to inference and deduction questions\n\n"
                    "KEY VOCABULARY: inference, deduction, explicit, implicit, context, evidence\n\n"
                    "STARTER (5 min)\n'What is the character feeling?' — read and infer from a short passage.\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• Model PEEE response as a class\n"
                    "• Students attempt a 4-mark inference question\n"
                    "• Discussion: what clues helped you?\n\n"
                    "PLENARY (5 min)\nTraffic light self-assessment on PEEE technique."
                ),
                "days_old": 5,
            },
        ],
        "resource": {
            "title": "Comprehension: 'The Rainforest at Dawn'",
            "resource_type": "worksheet",
            "description": "Guided reading exercise using inference and PEEE technique.",
            "content_text": (
                "READING COMPREHENSION WORKSHEET\nYear 7 English Language\n\n"
                "THE RAINFOREST AT DAWN\n\n"
                "Before the sun had fully risen, the forest began its morning ritual. A chorus of birds "
                "pierced the cool air — sharp, insistent, almost impatient. Somewhere deep in the canopy "
                "a howler monkey bellowed, its voice rolling through the mist like distant thunder. The "
                "ground was wet underfoot, the soil black and rich, releasing a smell that was somehow "
                "both ancient and alive.\n\n"
                "Marisa pulled her jacket tighter and stepped off the path. She had been in the rainforest "
                "before, but never alone, and never this early.\n\n"
                "──────────────────────────────\n\n"
                "QUESTIONS\n"
                "1. Identify ONE simile and explain its effect. [3]\n"
                "2. What does 'ancient and alive' suggest about the forest? [2]\n"
                "3. What does 'the shapes shifted as her eyes adjusted' tell us about the time of day? [3]\n"
                "4. Using PEEE, explain how the writer makes the rainforest feel both exciting and frightening. [6]\n"
                "5. How does Marisa feel? Give TWO pieces of evidence. [4]\n\nTotal marks: 18"
            ),
            "days_old": 8,
        },
        "syllabus": {
            "title": "Year 7 English Language Syllabus — Term 1",
            "resource_type": "syllabus",
            "description": "Full Term 1 English Language syllabus covering comprehension, descriptive and narrative writing.",
            "content_text": (
                "TERM 1 ENGLISH LANGUAGE SYLLABUS — YEAR 7\n\n"
                "Week 1–2: Reading Comprehension (inference & deduction)\n"
                "Week 3–4: Descriptive Writing (sensory language, figurative devices)\n"
                "Week 5–6: Narrative Writing (story structure, character, dialogue)\n"
                "Week 7–8: Grammar & Punctuation (sentence types, punctuation)\n"
                "Week 9: Revision | Week 10: Mid-Term Assessment\n\n"
                "Assessment: Writing portfolio (ongoing), Mid-term comprehension test (Wk 9)"
            ),
            "days_old": 20,
        },
    },

    "Integrated Science": {
        "lessons": [
            {
                "title": "The Scientific Method — Investigation Skills",
                "description": "Understanding hypothesis, variables, and recording scientific observations.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Define the steps of the scientific method\n"
                    "2. Identify independent, dependent and controlled variables\n"
                    "3. Design a simple investigation\n\n"
                    "KEY VOCABULARY: hypothesis, variable, observation, experiment, conclusion, fair test\n\n"
                    "STARTER (5 min)\nLook at this picture — what questions could a scientist ask?\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• Introduce: Observation → Question → Hypothesis → Experiment → Conclusion\n"
                    "• Class experiment: Does water temperature affect how fast sugar dissolves?\n"
                    "• Students complete results table and write a conclusion\n\n"
                    "PLENARY (5 min)\nWhat would change if you repeated the experiment with salt instead of sugar?"
                ),
                "days_old": 11,
            },
        ],
        "resource": {
            "title": "Science — Lab Safety Rules & Equipment Guide",
            "resource_type": "worksheet",
            "description": "Illustrated guide to lab safety rules and common laboratory equipment for Year 7.",
            "content_text": (
                "LAB SAFETY RULES — YEAR 7 SCIENCE\n\n"
                "GOLDEN RULES\n"
                "1. Always wear safety goggles when heating substances\n"
                "2. Never taste or smell chemicals directly\n"
                "3. Tie back long hair when near a Bunsen burner\n"
                "4. Report all spills or accidents immediately\n"
                "5. Wash hands before leaving the lab\n\n"
                "COMMON EQUIPMENT\n"
                "• Bunsen burner — heating substances\n"
                "• Beaker — holding liquids (not for measuring)\n"
                "• Measuring cylinder — measuring liquid volumes accurately\n"
                "• Thermometer — measuring temperature\n"
                "• Test tube — small-scale reactions\n"
                "• Conical flask — mixing and heating liquids\n"
                "• Tripod & gauze — supporting containers over a Bunsen burner\n\n"
                "TASK: Label the diagram of the lab equipment and write the purpose of each piece."
            ),
            "days_old": 15,
        },
        "syllabus": {
            "title": "Year 7 Integrated Science Syllabus — Term 1",
            "resource_type": "syllabus",
            "description": "Term 1 syllabus: scientific method, cells, states of matter, and ecosystems.",
            "content_text": (
                "TERM 1 INTEGRATED SCIENCE — YEAR 7\n\n"
                "Week 1–2: The Scientific Method & Lab Safety\n"
                "Week 3–4: Cells — Structure and Function\n"
                "Week 5–6: States of Matter (solid, liquid, gas)\n"
                "Week 7–8: Ecosystems and Food Chains\n"
                "Week 9: Revision | Week 10: Mid-Term Practical"
            ),
            "days_old": 20,
        },
    },

    "Information Technology": {
        "lessons": [
            {
                "title": "Introduction to Computers — Hardware and Software",
                "description": "Identifying the main components of a computer and distinguishing hardware from software.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Identify key hardware components of a computer system\n"
                    "2. Distinguish between hardware and software\n"
                    "3. Understand how input, processing, output and storage work together\n\n"
                    "KEY VOCABULARY: hardware, software, CPU, RAM, input device, output device, storage\n\n"
                    "STARTER (5 min)\nQuick sort activity: place these items in Hardware or Software columns.\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• IPO Cycle explanation (Input → Process → Output)\n"
                    "• Identify parts on a computer diagram\n"
                    "• Research task: what does the CPU do?\n\n"
                    "PLENARY (5 min)\nExit ticket — name 2 input devices, 2 output devices, and 1 storage device."
                ),
                "days_old": 10,
            },
        ],
        "resource": {
            "title": "IT — Keyboard Shortcuts & File Management Worksheet",
            "resource_type": "worksheet",
            "description": "Essential keyboard shortcuts and file/folder management practice tasks.",
            "content_text": (
                "IT SKILLS WORKSHEET — YEAR 7\n\n"
                "PART A: KEYBOARD SHORTCUTS\n"
                "Match each shortcut to its function:\n"
                "  Ctrl + C  |  Ctrl + V  |  Ctrl + Z  |  Ctrl + S  |  Ctrl + A\n"
                "  [Select All] [Save] [Undo] [Copy] [Paste]\n\n"
                "PART B: FILE MANAGEMENT\n"
                "1. Create a folder called 'Year 7 Work' on the desktop\n"
                "2. Inside it, create sub-folders: Mathematics | English | Science\n"
                "3. Open Notepad. Type your name, class, and today's date.\n"
                "4. Save the file as 'My Details.txt' inside the English folder\n"
                "5. Rename the file to 'Student Profile.txt'\n\n"
                "PART C: TRUE OR FALSE\n"
                "1. RAM is a type of permanent storage. (T/F)\n"
                "2. A printer is an output device. (T/F)\n"
                "3. The CPU processes instructions. (T/F)\n"
                "4. Software refers to physical computer parts. (T/F)\n"
                "5. A scanner is an input device. (T/F)"
            ),
            "days_old": 10,
        },
        "syllabus": {
            "title": "Year 7 Information Technology Syllabus — Term 1",
            "resource_type": "syllabus",
            "description": "Term 1 IT syllabus: hardware/software, word processing, spreadsheets, and internet safety.",
            "content_text": (
                "TERM 1 INFORMATION TECHNOLOGY — YEAR 7\n\n"
                "Week 1–2: Computer Hardware and Software\n"
                "Week 3–4: Word Processing (Microsoft Word)\n"
                "Week 5–6: Spreadsheets (Microsoft Excel — basic formulas)\n"
                "Week 7–8: Internet Safety and Digital Citizenship\n"
                "Week 9: Revision | Week 10: Practical Assessment"
            ),
            "days_old": 20,
        },
    },

    "Social Studies": {
        "lessons": [
            {
                "title": "Trinidad and Tobago — Our National Identity",
                "description": "Exploring national symbols, cultural heritage and identity in Trinidad and Tobago.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Identify the national symbols of Trinidad and Tobago\n"
                    "2. Explain the significance of Independence Day\n"
                    "3. Appreciate the multicultural heritage of our twin-island nation\n\n"
                    "KEY VOCABULARY: national identity, culture, heritage, independence, multicultural, symbol\n\n"
                    "STARTER (5 min)\nQuick quiz: Can you name 5 national symbols of T&T?\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• National symbols: flag, coat of arms, anthem, bird (scarlet ibis), flower (chaconia)\n"
                    "• Timeline: key dates in T&T history (1498, 1797, 1834, 1962, 1976)\n"
                    "• Group activity: create a national identity poster\n\n"
                    "PLENARY (5 min)\nWhy is it important to know and respect our national symbols?"
                ),
                "days_old": 8,
            },
        ],
        "resource": {
            "title": "Social Studies — Map Skills: The Caribbean Region",
            "resource_type": "worksheet",
            "description": "Labelling and interpreting maps of the Caribbean region.",
            "content_text": (
                "MAP SKILLS WORKSHEET — THE CARIBBEAN\nYear 7 Social Studies\n\n"
                "PART A: Label the following on the Caribbean map provided:\n"
                "1. Trinidad and Tobago\n2. Jamaica\n3. Barbados\n4. Guyana\n5. Cuba\n"
                "6. Haiti\n7. Dominican Republic\n8. The Atlantic Ocean\n9. The Caribbean Sea\n10. Gulf of Mexico\n\n"
                "PART B: Answer these questions:\n"
                "1. Which island is the largest in the Caribbean? ___________\n"
                "2. Name THREE island nations in the Eastern Caribbean. ___________\n"
                "3. What body of water lies to the east of Trinidad? ___________\n"
                "4. Tobago is located _____ km north-east of Trinidad.\n\n"
                "PART C: Using the scale provided, calculate the approximate distance between:\n"
                "(a) Trinidad and Barbados\n"
                "(b) Trinidad and Jamaica"
            ),
            "days_old": 11,
        },
        "syllabus": {
            "title": "Year 7 Social Studies Syllabus — Term 1",
            "resource_type": "syllabus",
            "description": "Term 1 syllabus covering national identity, Caribbean geography and early civilisations.",
            "content_text": (
                "TERM 1 SOCIAL STUDIES — YEAR 7\n\n"
                "Week 1–2: National Identity — T&T Symbols and Heritage\n"
                "Week 3–4: Map Skills and Caribbean Geography\n"
                "Week 5–6: The Amerindians — First Peoples of the Caribbean\n"
                "Week 7–8: European Colonisation and its Impact\n"
                "Week 9: Revision | Week 10: Mid-Term Test"
            ),
            "days_old": 20,
        },
    },

    "Spanish": {
        "lessons": [
            {
                "title": "Greetings and Introductions — Saludos",
                "description": "Learning how to greet people and introduce yourself in Spanish.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Greet people in Spanish at different times of day\n"
                    "2. Introduce yourself: name, age, nationality\n"
                    "3. Ask and answer basic personal questions\n\n"
                    "KEY PHRASES:\n"
                    "  Buenos días (good morning) | Buenas tardes (good afternoon)\n"
                    "  Buenas noches (good evening) | Hola (hello) | Adiós (goodbye)\n"
                    "  ¿Cómo te llamas? — Me llamo...\n"
                    "  ¿Cuántos años tienes? — Tengo... años\n"
                    "  ¿De dónde eres? — Soy de Trinidad\n\n"
                    "STARTER (5 min)\nWatch video clip: greetings in a Spanish school.\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• Choral drilling of greetings\n"
                    "• Pair work: role-play meeting a new student\n"
                    "• Written task: write 5 sentences introducing yourself\n\n"
                    "PLENARY (5 min)\nHot seat: answer questions as a Spanish-speaking character."
                ),
                "days_old": 9,
            },
        ],
        "resource": {
            "title": "Spanish — Vocabulary List: Numbers, Colours & Days",
            "resource_type": "worksheet",
            "description": "Core vocabulary for numbers 1–30, colours and days of the week in Spanish.",
            "content_text": (
                "SPANISH VOCABULARY WORKSHEET — YEAR 7\n\n"
                "NUMBERS (Los números)\n"
                "1 uno | 2 dos | 3 tres | 4 cuatro | 5 cinco\n"
                "6 seis | 7 siete | 8 ocho | 9 nueve | 10 diez\n"
                "11 once | 12 doce | 13 trece | 14 catorce | 15 quince\n"
                "20 veinte | 21 veintiuno | 30 treinta\n\n"
                "COLOURS (Los colores)\n"
                "rojo (red) | azul (blue) | verde (green) | amarillo (yellow)\n"
                "negro (black) | blanco (white) | naranja (orange) | morado (purple)\n\n"
                "DAYS OF THE WEEK (Los días de la semana)\n"
                "lunes (Monday) | martes (Tuesday) | miércoles (Wednesday)\n"
                "jueves (Thursday) | viernes (Friday) | sábado (Saturday) | domingo (Sunday)\n\n"
                "EXERCISES\n"
                "1. Write the Spanish for: 7, 15, 23, green, Tuesday, Friday\n"
                "2. Translate: 'Hoy es martes y mi color favorito es azul.'\n"
                "3. Write a sentence using a number, colour and day in Spanish."
            ),
            "days_old": 13,
        },
        "syllabus": {
            "title": "Year 7 Spanish Syllabus — Term 1",
            "resource_type": "syllabus",
            "description": "Term 1 Spanish syllabus: greetings, introductions, numbers and basic conversation.",
            "content_text": (
                "TERM 1 SPANISH — YEAR 7\n\n"
                "Week 1–2: Greetings, Introductions and Alphabet\n"
                "Week 3–4: Numbers, Colours and Days of the Week\n"
                "Week 5–6: Family Members and Descriptions\n"
                "Week 7–8: Food and Ordering in a Restaurant\n"
                "Week 9: Revision | Week 10: Oral and Written Test"
            ),
            "days_old": 20,
        },
    },

    "Religious Education": {
        "lessons": [
            {
                "title": "World Religions — Beliefs and Practices",
                "description": "Exploring the major world religions and their core beliefs and practices.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Identify the six major world religions\n"
                    "2. Describe key beliefs and practices of at least two religions\n"
                    "3. Reflect on the value of religious diversity in T&T\n\n"
                    "KEY VOCABULARY: religion, belief, worship, sacred, scripture, festival, denomination\n\n"
                    "STARTER (5 min)\nWord association: what words come to mind when you hear 'religion'?\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• Overview: Christianity, Islam, Hinduism, Buddhism, Judaism, Sikhism\n"
                    "• Focus on T&T context: how are these religions practised here?\n"
                    "• Group task: create a fact file for one religion\n\n"
                    "PLENARY (5 min)\nHow does religious diversity make T&T unique?"
                ),
                "days_old": 10,
            },
        ],
        "resource": {
            "title": "RE — World Religions Fact Sheet",
            "resource_type": "worksheet",
            "description": "Quick-reference fact sheet comparing beliefs, holy books, and festivals of major world religions.",
            "content_text": (
                "WORLD RELIGIONS FACT SHEET — YEAR 7 RE\n\n"
                "CHRISTIANITY\n"
                "Holy book: The Bible | God: God the Father, Son & Holy Spirit\n"
                "Key festival: Christmas, Easter | Place of worship: Church\n\n"
                "ISLAM\n"
                "Holy book: The Quran | God: Allah\n"
                "Key festival: Eid-ul-Fitr, Eid-ul-Adha | Place of worship: Mosque\n\n"
                "HINDUISM\n"
                "Holy books: Vedas, Bhagavad Gita | Many deities (e.g. Brahma, Vishnu, Shiva)\n"
                "Key festival: Diwali, Holi | Place of worship: Mandir (Temple)\n\n"
                "BUDDHISM\n"
                "Holy text: Tripitaka | Founder: Siddhartha Gautama (The Buddha)\n"
                "Key belief: The Four Noble Truths, the Eightfold Path | Place of worship: Temple\n\n"
                "TASK\n"
                "1. Name the religion that observes Ramadan.\n"
                "2. Which religion originated in India and has no single founder?\n"
                "3. What does the word 'Islam' mean?\n"
                "4. Name TWO ways different religions are practised in Trinidad and Tobago."
            ),
            "days_old": 14,
        },
        "syllabus": {
            "title": "Year 7 Religious Education Syllabus — Term 1",
            "resource_type": "syllabus",
            "description": "Term 1 RE syllabus exploring world religions, values, and religious diversity in T&T.",
            "content_text": (
                "TERM 1 RELIGIOUS EDUCATION — YEAR 7\n\n"
                "Week 1–2: What is Religion? — Beliefs, Practices and Belonging\n"
                "Week 3–4: World Religions — Overview (Christianity, Islam, Hinduism)\n"
                "Week 5–6: World Religions — Buddhism, Judaism, Sikhism\n"
                "Week 7–8: Religious Diversity in Trinidad and Tobago\n"
                "Week 9: Revision | Week 10: Essay and Discussion Assessment"
            ),
            "days_old": 20,
        },
    },

    "Physical Education": {
        "lessons": [
            {
                "title": "Fitness Components — Health vs. Skill-Related Fitness",
                "description": "Understanding the components of physical fitness and their importance for a healthy life.",
                "content_text": (
                    "LESSON OBJECTIVES\n"
                    "1. Identify and explain the 5 health-related components of fitness\n"
                    "2. Distinguish between health-related and skill-related fitness\n"
                    "3. Perform a fitness circuit and record results\n\n"
                    "KEY VOCABULARY: cardiovascular endurance, muscular strength, muscular endurance, "
                    "flexibility, body composition, agility, balance, coordination, power, speed\n\n"
                    "STARTER (5 min)\nWarm-up jog and dynamic stretches.\n\n"
                    "MAIN ACTIVITY (30 min)\n"
                    "• Discuss: what does it mean to be 'fit'?\n"
                    "• Fitness circuit: 6 stations, 45 seconds each\n"
                    "  (Push-ups | Sit-ups | Shuttle run | Jump squats | Plank | Star jumps)\n"
                    "• Record results in fitness log\n\n"
                    "PLENARY (5 min)\nWhich component of fitness did each station test? Class discussion."
                ),
                "days_old": 12,
            },
        ],
        "resource": {
            "title": "PE — Fitness Components Reference Card",
            "resource_type": "worksheet",
            "description": "Quick-reference card defining all 10 components of physical fitness with examples.",
            "content_text": (
                "FITNESS COMPONENTS REFERENCE CARD — YEAR 7 PE\n\n"
                "HEALTH-RELATED FITNESS\n"
                "1. Cardiovascular Endurance — ability of the heart and lungs to sustain exercise\n"
                "   Example: running 1500m without stopping\n"
                "2. Muscular Strength — maximum force a muscle can produce in one effort\n"
                "   Example: one-rep maximum bench press\n"
                "3. Muscular Endurance — ability to perform repeated muscle contractions\n"
                "   Example: completing 30 sit-ups\n"
                "4. Flexibility — range of movement at a joint\n"
                "   Example: sit-and-reach test\n"
                "5. Body Composition — ratio of fat to muscle and bone\n"
                "   Example: BMI or skinfold measurement\n\n"
                "SKILL-RELATED FITNESS\n"
                "6. Agility — ability to change direction quickly\n"
                "7. Balance — maintaining body position (static or dynamic)\n"
                "8. Coordination — using body parts together smoothly\n"
                "9. Power — strength × speed combined\n"
                "10. Reaction Time — how quickly you respond to a stimulus\n\n"
                "TASK: For each sport below, name the TWO most important fitness components:\n"
                "Football | Swimming | Gymnastics | Boxing | Cricket"
            ),
            "days_old": 15,
        },
        "syllabus": {
            "title": "Year 7 Physical Education Syllabus — Term 1",
            "resource_type": "syllabus",
            "description": "Term 1 PE syllabus: fitness components, athletics, team sports and health education.",
            "content_text": (
                "TERM 1 PHYSICAL EDUCATION — YEAR 7\n\n"
                "Week 1–2: Introduction to Physical Fitness & Components\n"
                "Week 3–4: Athletics — Running, Jumping, Throwing\n"
                "Week 5–6: Team Sports — Football (skills and rules)\n"
                "Week 7–8: Health Education — Nutrition, Hydration, Rest\n"
                "Week 9: Fitness Assessment | Week 10: Sports Day Preparation"
            ),
            "days_old": 20,
        },
    },
}


async def fix():
    # Fetch class and subjects
    cls = await db.classes.find_one({"_demo": True, "name": "Year 7A"}, {"_id": 0})
    if not cls:
        print("ERROR: Year 7A class not found — run seed_demo_data.py first")
        return
    class_id = cls["class_id"]

    subjects = await db.subjects.find({"_demo": True}, {"_id": 0, "subject_id": 1, "name": 1}).to_list(20)
    subj_map = {s["name"]: s["subject_id"] for s in subjects}
    print(f"Found {len(subjects)} demo subjects")

    teacher = await db.users.find_one({"email": "teacher@rightway.demo"}, {"_id": 0, "user_id": 1, "name": 1})
    if not teacher:
        print("ERROR: teacher@rightway.demo not found")
        return

    # ── Clear old demo docs ───────────────────────────────────────────────────────
    del_les = await db.lessons.delete_many({"_demo": True})
    del_res = await db.lms_resources.delete_many({"_demo": True})
    print(f"Cleared: {del_les.deleted_count} old lessons, {del_res.deleted_count} old resources")

    # ── Insert lessons and resources for every subject ────────────────────────────
    lesson_count = 0
    resource_count = 0

    for subj_name, data in LESSON_DATA.items():
        subject_id = subj_map.get(subj_name, "")
        if not subject_id:
            print(f"  WARN: subject '{subj_name}' not found in DB — skipping")
            continue

        # Lessons (1 or 2 per subject)
        for lesson_def in data.get("lessons", []):
            doc = {
                "lesson_id": gen_id("les_"),
                "title": lesson_def["title"],
                "description": lesson_def["description"],
                "objectives": "",
                "subject_id": subject_id,
                "subject_name": subj_name,
                "class_ids": [class_id],
                "teacher_id": teacher["user_id"],
                "teacher_name": teacher["name"],
                "lesson_type": "text",
                "content_url": "",
                "extra_links": [],
                "content_text": lesson_def["content_text"],
                "thumbnail_url": "",
                "file_ids": [],
                "tags": [subj_name, "Year 7"],
                "term": "Term 1",
                "academic_year": "2025-2026",
                "duration_minutes": 40,
                "published": True,
                "submitted_to_management": True,
                "submission_status": "approved",
                "submitted_at": days_ago(lesson_def["days_old"] + 1),
                "created_at": days_ago(lesson_def["days_old"] + 2),
                "_demo": True,
            }
            await db.lessons.insert_one(doc)
            lesson_count += 1

        # Resource (worksheet or past paper)
        r = data.get("resource")
        if r:
            doc = {
                "resource_id": gen_id("res_"),
                "title": r["title"],
                "description": r["description"],
                "resource_type": r["resource_type"],
                "subject_id": subject_id,
                "class_id": class_id,
                "term": "Term 1",
                "year_group": "Year 7",
                "file_ids": [],
                "content_url": "",
                "content_text": r["content_text"],
                "rich_content": "",
                "teacher_id": teacher["user_id"],
                "published": True,
                "published_class_ids": [class_id],
                "published_at": days_ago(r["days_old"]),
                "created_at": days_ago(r["days_old"] + 2),
                "_demo": True,
            }
            await db.lms_resources.insert_one(doc)
            resource_count += 1

        # Syllabus resource
        s = data.get("syllabus")
        if s:
            doc = {
                "resource_id": gen_id("res_"),
                "title": s["title"],
                "description": s["description"],
                "resource_type": s["resource_type"],
                "subject_id": subject_id,
                "class_id": class_id,
                "term": "Term 1",
                "year_group": "Year 7",
                "file_ids": [],
                "content_url": "",
                "content_text": s["content_text"],
                "rich_content": "",
                "teacher_id": teacher["user_id"],
                "published": True,
                "published_class_ids": [class_id],
                "published_at": days_ago(s["days_old"]),
                "created_at": days_ago(s["days_old"] + 2),
                "_demo": True,
            }
            await db.lms_resources.insert_one(doc)
            resource_count += 1

    print(f"\nDone: {lesson_count} lessons, {resource_count} resources inserted")
    print(f"  Subjects covered: {list(LESSON_DATA.keys())}")
    client.close()

asyncio.run(fix())
