// Static placeholder data — all content is overridden at runtime by /api/website/* endpoints

export const SCHOOL_INFO = {
  name: "The RightWay Centre of Learning",
  tagline: "The only way is the Rightway!",
  phone: "+1 (868) 221-2794",
  whatsapp: "18684713888",
  email: "therightwaycloud@gmail.com",
  address: "Lot 26A Phillips Street, Montrose, Chaguanas, Trinidad & Tobago",
  facebook: "https://facebook.com/rightwayttschool",
  instagram: "https://instagram.com/rightwayttschool",
  youtube: "",
  mapEmbed: "",
  established: "2018",
};

export const HERO_SLIDES = [
  {
    image: "/slider/2149068381.jpg",
    heading: "The Only Way is the Rightway",
    subheading: "Elite without being elitist — an academically rigorous, technology-driven, values-based education for every child.",
    cta1: { label: "Explore Academics", href: "#programmes" },
    cta2: { label: "Apply Now", href: "#admissions" },
  },
  {
    image: "/slider/2149091553.jpg",
    heading: "Developing Future Leaders",
    subheading: "From Early Childhood through Standard Five — preparing confident thinkers, innovators, and globally ready graduates.",
    cta1: { label: "About Rightway", href: "#about" },
    cta2: { label: "Book a Visit", href: "#contact" },
  },
  {
    image: "/slider/IMG_1850.jpg",
    heading: "Learn, Play & Discover",
    subheading: "17+ clubs and activities, international travel, and a vibrant school life that goes far beyond the classroom.",
    cta1: { label: "Student Life", href: "#programmes" },
    cta2: { label: "Get in Touch", href: "#contact" },
  },
  {
    image: "/slider/IMG_4051.jpg",
    heading: "Education Beyond Examinations",
    subheading: "STEM, financial literacy, international travel, and holistic development — all in the heart of Central Trinidad.",
    cta1: { label: "Explore Academics", href: "#programmes" },
    cta2: { label: "Apply Now", href: "#admissions" },
  },
];

export const STATS = [
  { value: 200, suffix: "+", label: "Happy Students" },
  { value: 20, suffix: "+", label: "Qualified Teachers" },
  { value: 5, suffix: "+", label: "Years of Excellence" },
  { value: 98, suffix: "%", label: "Parent Satisfaction" },
];

export const PROGRAMMES = [
  {
    id: "nursery",
    name: "Nursery",
    ageRange: "Ages 2 – 3",
    color: "#84C4A0",
    image: "/kids/3796.jpg",
    icon: "🌱",
    description: "A warm, safe space where toddlers begin their journey of discovery through play, sensory exploration, and early social skills.",
    features: ["Sensory Play", "Story Time", "Music & Movement", "Toilet Training Support", "Daily Nap Time"],
  },
  {
    id: "kindergarten",
    name: "Kindergarten",
    ageRange: "Ages 4 – 5",
    color: "#F4A261",
    image: "/kids/2149557939.jpg",
    icon: "🌻",
    description: "Building confident learners through hands-on Montessori materials, phonics, numeracy, and creative arts.",
    features: ["Phonics & Early Reading", "Number Concepts", "Arts & Crafts", "Outdoor Play", "Social Skills"],
  },
  {
    id: "primary",
    name: "Primary",
    ageRange: "Ages 6 – 11",
    color: "#2A7A5A",
    image: "/kids/2149068381.jpg",
    icon: "📚",
    description: "A rigorous primary curriculum aligned with Trinidad & Tobago national standards, delivered in an engaging, child-centred environment.",
    features: ["Mathematics", "Language Arts", "Science", "Social Studies", "ICT", "Physical Education"],
  },
];

export const WHY_US = [
  { title: "Qualified Educators", description: "All our teachers hold Ministry-recognised qualifications and undergo continuous professional development." },
  { title: "Montessori Approach", description: "Child-led learning that respects each child's pace, building independence and intrinsic motivation." },
  { title: "Safe Environment", description: "CCTV-monitored premises, secure entry, and trained staff ensuring every child is always protected." },
  { title: "Real-Time Progress Reports", description: "Parents receive regular updates through our digital portal — never out of the loop." },
  { title: "Community-Centred", description: "We partner with families, believing parents are the first and most important teachers in a child's life." },
  { title: "Proven Results", description: "Consistent SEA placement success and a track record of nurturing well-rounded young citizens." },
];

export const CURRICULUM_SUBJECTS = [
  { name: "Mathematics", description: "Number sense, problem-solving, and logical reasoning from concrete to abstract." },
  { name: "Language Arts", description: "Reading, writing, phonics, comprehension, and oral communication skills." },
  { name: "Science", description: "Hands-on experiments exploring biology, chemistry, and earth sciences." },
  { name: "Social Studies", description: "History, geography, and civics grounded in Caribbean and global contexts." },
  { name: "Visual Arts", description: "Creative expression through drawing, painting, sculpture, and mixed media." },
  { name: "Music", description: "Trinidad's musical heritage — melody, rhythm, and ensemble performance." },
  { name: "Physical Education", description: "Team sports, fitness, and movement for healthy body and mind." },
  { name: "ICT / Computing", description: "Digital literacy, coding fundamentals, and responsible technology use." },
  { name: "Spanish", description: "Conversational Spanish and cultural appreciation from an early age." },
  { name: "Religious Education", description: "Values, ethics, and an understanding of world faiths and traditions." },
  { name: "Drama & Expression", description: "Confidence, empathy, and storytelling through performance and roleplay." },
  { name: "Design & Technology", description: "Practical problem-solving, making, and engineering thinking." },
];

export const ACTIVITIES = [
  { name: "Football", category: "Sports", description: "Team-based play that builds fitness, strategy, and sportsmanship." },
  { name: "Swimming", category: "Sports", description: "Water safety and competitive swimming for all skill levels." },
  { name: "Art Club", category: "Creative", description: "Explore painting, drawing, and mixed media with guided instruction." },
  { name: "School Choir", category: "Creative", description: "Vocal training, harmony, and performance for confident young singers." },
  { name: "Steel Pan", category: "Creative", description: "Our national instrument — from basics to full band performance." },
  { name: "Book Club", category: "Academic", description: "Guided reading and discussion to build a lifelong love of literature." },
  { name: "Gardening Club", category: "Life Skills", description: "Grow fruits, vegetables, and herbs while learning about ecology." },
  { name: "Drama Club", category: "Creative", description: "Script writing, rehearsal, and stage performance for budding actors." },
  { name: "Cricket", category: "Sports", description: "Trinidad's favourite sport — technique, teamwork, and spirit." },
  { name: "Chess Club", category: "Academic", description: "Critical thinking, patience, and strategy through the game of kings." },
  { name: "Debate Society", category: "Academic", description: "Research, public speaking, and persuasive argument skills." },
  { name: "Home Economics", category: "Life Skills", description: "Practical cooking, nutrition, and household management basics." },
];

export const GALLERY_IMAGES = [
  { src: "/kids/1181.jpg", alt: "Students in classroom activity", category: "Learning Activities" },
  { src: "/kids/1226.jpg", alt: "Children during art class", category: "Activities" },
  { src: "/kids/19180.jpg", alt: "Group learning session", category: "Learning Activities" },
  { src: "/kids/2147851843.jpg", alt: "Students reading together", category: "Learning Activities" },
  { src: "/kids/2148764069.jpg", alt: "Outdoor play and exploration", category: "Activities" },
  { src: "/kids/3875.jpg", alt: "Science experiment in progress", category: "Learning Activities" },
  { src: "/kids/46286.jpg", alt: "Music and movement class", category: "Activities" },
  { src: "/kids/59574.jpg", alt: "Collaborative project work", category: "Facilities" },
];

export const TESTIMONIALS = [
  {
    name: "Shalini Ramkissoon",
    child: "Parent of Asha, Grade 2",
    rating: 5,
    text: "RightWay has transformed my daughter. She went from being shy to leading her class presentations. The teachers genuinely care about every child here.",
  },
  {
    name: "Marcus Joseph",
    child: "Parent of Liam & Kezia, Nursery & KG",
    rating: 5,
    text: "Best decision we ever made for our children. The Montessori approach really works — both kids love going to school every single day.",
  },
  {
    name: "Priya Maharaj",
    child: "Parent of Arjun, Grade 4",
    rating: 5,
    text: "The parent portal keeps us informed about everything. We feel truly partnered in our son's education. Exceptional school, exceptional team.",
  },
  {
    name: "Denise Williams",
    child: "Parent of Jordan, Grade 1",
    rating: 5,
    text: "I appreciated how the teachers handled the transition period for my son. The whole school community made us feel welcomed from day one.",
  },
  {
    name: "Kevin Chin",
    child: "Parent of Mei, Kindergarten",
    rating: 5,
    text: "As working parents, the digital updates and real-time progress reports are invaluable. We always know what's happening in Mei's world.",
  },
];

export const BLOG_POSTS = [
  {
    slug: "montessori-benefits",
    title: "5 Ways Montessori Education Builds Lifelong Learners",
    excerpt: "Discover how the Montessori method cultivates independence, creativity, and a genuine love for learning in children aged 2–12.",
    category: "Education",
    date: "May 15, 2026",
    image: "/kids/2149091553.jpg",
    author: "Mrs. T. Hosein",
  },
  {
    slug: "sea-preparation-tips",
    title: "SEA Preparation: How We Support Our Grade 6 Students",
    excerpt: "Our structured approach to SEA preparation ensures every student enters the exam with confidence, skills, and a calm mindset.",
    category: "Academic",
    date: "April 28, 2026",
    image: "/kids/2149129485.jpg",
    author: "Mr. D. Charles",
  },
  {
    slug: "reading-at-home",
    title: "10 Ways to Foster a Reading Culture at Home",
    excerpt: "Simple, practical strategies for parents to support their child's reading journey — from phonics games to bedtime stories.",
    category: "Parenting",
    date: "April 10, 2026",
    image: "/kids/young_school_boy_in_class.jpg",
    author: "Mrs. A. Mohammed",
  },
];

export const EVENTS = [
  {
    title: "Open Day 2026",
    date: "June 14, 2026",
    time: "9:00 AM – 1:00 PM",
    location: "Main Campus",
    category: "School Event",
    description: "Tour our facilities, meet our teachers, and learn about admissions for the 2026/2027 academic year.",
  },
  {
    title: "Term 3 Examinations Begin",
    date: "June 3, 2026",
    time: "8:30 AM",
    location: "All Classrooms",
    category: "Academic",
    description: "End-of-year examinations for all grades. Detailed schedules distributed to parents via the portal.",
  },
  {
    title: "Annual Sports Day",
    date: "May 30, 2026",
    time: "8:00 AM – 3:00 PM",
    location: "School Grounds",
    category: "Sports",
    description: "A fun-filled day of athletic competition and team spirit. Parents are welcome to cheer on their champions!",
  },
  {
    title: "Graduation Ceremony 2026",
    date: "July 25, 2026",
    time: "5:00 PM",
    location: "Main Hall",
    category: "Ceremony",
    description: "Celebrating our Grade 6 graduates as they move on to secondary school. A proud moment for our whole community.",
  },
];

export const ADMISSIONS_STEPS = [
  { step: 1, title: "Schedule a Tour", description: "Visit our campus and see our Montessori classrooms in action." },
  { step: 2, title: "Submit Application", description: "Complete our simple enrollment form." },
  { step: 3, title: "Meet & Interview", description: "Connect with our educators and discuss your child's needs." },
  { step: 4, title: "Enroll & Begin", description: "Welcome to the RightWay family!" },
];

export const FAQS = [
  {
    question: "What ages do you accept?",
    answer: "We accept children from ages 2 to 11 across our Nursery, Kindergarten, and Primary programmes. Each level is designed to meet the developmental needs of that age group.",
  },
  {
    question: "What documents do I need for admission?",
    answer: "You will need your child's birth certificate, immunisation card, most recent report card (if transferring), and two passport-size photos. Full details are provided after your school visit.",
  },
  {
    question: "Do you follow the national curriculum?",
    answer: "Yes. Our Primary programme is fully aligned with the Trinidad & Tobago Ministry of Education national curriculum, enriched with Montessori and project-based learning approaches.",
  },
  {
    question: "What is your school day schedule?",
    answer: "School runs from 7:30 AM to 2:30 PM. We also offer an extended care programme from 2:30 PM to 5:30 PM for working parents.",
  },
  {
    question: "How do parents receive updates about their child?",
    answer: "We use a secure digital parent portal where you can view grades, attendance, teacher notes, and school announcements in real time. Formal report cards are issued each term.",
  },
  {
    question: "Do you offer after-school activities?",
    answer: "Yes! We offer a wide range of after-school clubs including football, swimming, steel pan, art, chess, drama, and more. Most activities are included in the term fee.",
  },
];
