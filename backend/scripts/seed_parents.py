"""
Seed parent accounts for Lower Secondary students.
Creates parent accounts and links children.
"""
import asyncio
import bcrypt
from database import db
import uuid

DEFAULT_PASSWORD = "parent123"

# Student → Parent Email mapping (first email only for multi-email students)
STUDENTS_DATA = [
    # Year 7
    {"name": "Ayeyi Forson", "year": "Year 7", "parent_email": "sylvester_forson@yahoo.com", "parent_name": "Mr/Mrs Forson"},
    {"name": "Brandon N.B. Gaisie", "year": "Year 7", "parent_email": "dorennakofiosowah@gmail.com", "parent_name": "Mrs Dorenna Gaisie"},
    {"name": "Duke T.A. Danquah", "year": "Year 7", "parent_email": "parent.duke.danquah@tcis.edu.gh", "parent_name": "Mr/Mrs Danquah"},
    {"name": "Gideon Titi Okyere", "year": "Year 7", "parent_email": "parent.gideon.okyere@tcis.edu.gh", "parent_name": "Mr/Mrs Titi Okyere"},
    {"name": "Inaaya K. Ibrahim", "year": "Year 7", "parent_email": "khashbilkhash@gmail.com", "parent_name": "Mr/Mrs Ibrahim"},
    {"name": "Jaleesa Arthur", "year": "Year 7", "parent_email": "sheilarthur26@gmail.com", "parent_name": "Mrs Sheil Arthur"},
    {"name": "Jasmine Nyarko", "year": "Year 7", "parent_email": "gnyarkogh@gmail.com", "parent_name": "Mr/Mrs Nyarko"},
    {"name": "Lisa K. Nsiah", "year": "Year 7", "parent_email": "abebeq@gmail.com", "parent_name": "Mr/Mrs Nsiah"},
    {"name": "Maame Akua S. Osei-Anim", "year": "Year 7", "parent_email": "yoseianim@gmail.com", "parent_name": "Mr/Mrs Osei-Anim"},
    {"name": "Marvin Genego", "year": "Year 7", "parent_email": "michaelgenego50@hotmail.com", "parent_name": "Mr Michael Genego"},
    {"name": "Naveed Sampah", "year": "Year 7", "parent_email": "mahamayusifmahama@yahoo.com", "parent_name": "Mr/Mrs Sampah"},
    {"name": "Parousia N. Bentum", "year": "Year 7", "parent_email": "miriammalik540@gmail.com", "parent_name": "Mrs Miriam Bentum"},
    {"name": "Pearl Agyei Sarbeng", "year": "Year 7", "parent_email": "shadaigh@yahoo.com", "parent_name": "Mr/Mrs Agyei Sarbeng"},
    {"name": "Olivia Kekeli Azilah", "year": "Year 7", "parent_email": "standfordazilah@yahoo.com", "parent_name": "Mr Standford Azilah"},
    {"name": "Paa Kwadwo Odame Antwi", "year": "Year 7", "parent_email": "abenaana@yahoo.com.uk", "parent_name": "Mrs Abena Antwi"},
    {"name": "Sudiata Tamid Issaka", "year": "Year 7", "parent_email": "tamidissaka98@gmail.com", "parent_name": "Mr Tamid Issaka"},
    # Year 8
    {"name": "Akosua Kane Acheampong", "year": "Year 8", "parent_email": "acheampongj120@gmail.com", "parent_name": "Mr/Mrs Acheampong"},
    {"name": "David Kwasi Atta Antwi", "year": "Year 8", "parent_email": "antwik772@gmail.com", "parent_name": "Mr Antwi"},
    {"name": "Eliana Arthur", "year": "Year 8", "parent_email": "sheilarthur26@gmail.com", "parent_name": "Mrs Sheil Arthur"},
    {"name": "Emmanuel Amponsah-Ababio", "year": "Year 8", "parent_email": "richardamponsahababio@gmail.com", "parent_name": "Mr Richard Amponsah-Ababio"},
    {"name": "Emmanuel Malike Bimpeh", "year": "Year 8", "parent_email": "peterbimpeh@yahoo.com", "parent_name": "Mr Peter Bimpeh"},
    {"name": "Foster Sarpong", "year": "Year 8", "parent_email": "ellaabbew16@gmail.com", "parent_name": "Mrs Ella Sarpong"},
    {"name": "Ian Genego", "year": "Year 8", "parent_email": "michaelgenego50@hotmail.com", "parent_name": "Mr Michael Genego"},
    {"name": "Jornada Lamptey", "year": "Year 8", "parent_email": "minglenancyann08@gmail.com", "parent_name": "Mrs Nancy Lamptey"},
    {"name": "Malachi Attah-Krah", "year": "Year 8", "parent_email": "asamaniwaa@gmail.com", "parent_name": "Mr/Mrs Attah-Krah"},
    {"name": "Maame Adwoa Ohemaa Adjei", "year": "Year 8", "parent_email": "ernsandy@gmail.com", "parent_name": "Mr Ernest Adjei"},
    {"name": "Maame Yaa Antwi", "year": "Year 8", "parent_email": "abenaana@yahoo.com.uk", "parent_name": "Mrs Abena Antwi"},
    {"name": "Nana Kofi Twum Adjei Ampofo", "year": "Year 8", "parent_email": "kntwum@gmail.com", "parent_name": "Mr K.N. Twum Ampofo"},
    {"name": "Nhyira Hayford", "year": "Year 8", "parent_email": "yoofi55@yahoo.com", "parent_name": "Mr/Mrs Hayford"},
    {"name": "Prince Enaifoghe", "year": "Year 8", "parent_email": "princeegboro@yahoo.com", "parent_name": "Mr Prince Enaifoghe Sr"},
    {"name": "Roy N.A. Okine", "year": "Year 8", "parent_email": "okinekelvin@gmail.com", "parent_name": "Mr Kelvin Okine"},
    # Year 9
    {"name": "Bessie E. Ali", "year": "Year 9", "parent_email": "freed2fly34@gmail.com", "parent_name": "Mr/Mrs Ali"},
    {"name": "Blessing Enaifoghe", "year": "Year 9", "parent_email": "dorisegboro@gmail.com", "parent_name": "Mrs Doris Enaifoghe"},
    {"name": "Calista E. Acolatse", "year": "Year 9", "parent_email": "akateliz7@gmail.com", "parent_name": "Mrs Elizabeth Acolatse"},
    {"name": "Carlisa Edumadzie", "year": "Year 9", "parent_email": "arhins@gmail.com", "parent_name": "Mr/Mrs Edumadzie"},
    {"name": "Dell Nyarko Yeboah", "year": "Year 9", "parent_email": "parent.dell.yeboah@tcis.edu.gh", "parent_name": "Mr/Mrs Nyarko Yeboah"},
    {"name": "Ebube Counselor Ihejirika", "year": "Year 9", "parent_email": "hiuucegroup@gmail.com", "parent_name": "Mr/Mrs Ihejirika"},
    {"name": "Elinam Kpesese", "year": "Year 9", "parent_email": "adolphkpesese@gmail.com", "parent_name": "Mr Adolph Kpesese"},
    {"name": "Gerald Badu", "year": "Year 9", "parent_email": "josyadomah@gmail.com", "parent_name": "Mrs Josy Badu"},
    {"name": "Iain Lamptey", "year": "Year 9", "parent_email": "minglenancyann08@gmail.com", "parent_name": "Mrs Nancy Lamptey"},
    {"name": "Kymia M.E.Y. Gligbe", "year": "Year 9", "parent_email": "kgligbe@outlook.fr", "parent_name": "Mr K. Gligbe"},
    {"name": "Heulwynne Nketsia", "year": "Year 9", "parent_email": "mumcy.morrison@yahoo.com", "parent_name": "Mrs Morrison Nketsia"},
    {"name": "Judith Dede Narteh", "year": "Year 9", "parent_email": "nartehi@yahoo.com", "parent_name": "Mr/Mrs Narteh"},
    {"name": "Michelle Mensah-Onumah", "year": "Year 9", "parent_email": "carol.mensah-onumah@gra.gov.gh", "parent_name": "Mrs Carol Mensah-Onumah"},
    {"name": "Nana Kwame Adjei", "year": "Year 9", "parent_email": "ernsandy@gmail.com", "parent_name": "Mr Ernest Adjei"},
    {"name": "Pearl-Petra Alisa Assem", "year": "Year 9", "parent_email": "eugeniamassem@gmail.com", "parent_name": "Mrs Eugenia Assem"},
    {"name": "Renny N.Y.A. Sarpong", "year": "Year 9", "parent_email": "ellaabbew16@gmail.com", "parent_name": "Mrs Ella Sarpong"},
    {"name": "Yvana Korkomaz", "year": "Year 9", "parent_email": "chefmichel.mk@gmail.com", "parent_name": "Mr Michel Korkomaz"},
]


async def seed_parents():
    hashed_pw = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode()
    
    # Group students by parent email
    parent_map = {}  # email -> { parent_name, children: [...] }
    for s in STUDENTS_DATA:
        email = s["parent_email"].lower().strip()
        if email not in parent_map:
            parent_map[email] = {"parent_name": s["parent_name"], "children": []}
        parent_map[email]["children"].append({"name": s["name"], "year": s["year"]})

    created_count = 0
    updated_count = 0
    results = []  # For login table

    for email, info in parent_map.items():
        # Check if parent account already exists
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        
        # Find student user_ids for linking
        children_ids = []
        for child in info["children"]:
            student = await db.users.find_one(
                {"name": {"$regex": f"^{child['name'][:10]}", "$options": "i"}, "role": "Student"},
                {"_id": 0, "user_id": 1, "name": 1}
            )
            if student:
                children_ids.append(student["user_id"])

        if existing:
            # Update existing parent with children links
            updates = {"children_ids": list(set(existing.get("children_ids", []) + children_ids))}
            await db.users.update_one({"email": email}, {"$set": updates})
            updated_count += 1
            results.append({
                "parent_name": info["parent_name"],
                "email": email,
                "password": DEFAULT_PASSWORD,
                "children": [c["name"] + f" ({c['year']})" for c in info["children"]],
                "status": "UPDATED (existed)"
            })
        else:
            # Create new parent account
            parent_id = f"user_{uuid.uuid4().hex[:12]}"
            parent_doc = {
                "user_id": parent_id,
                "name": info["parent_name"],
                "email": email,
                "password_hash": hashed_pw,
                "role": "Parent",
                "children_ids": children_ids,
                "children_names": [c["name"] for c in info["children"]],
                "phone": "",
                "is_active": True,
                "last_set_password": DEFAULT_PASSWORD,
                "created_at": "2026-04-20T00:00:00Z",
            }
            await db.users.insert_one(parent_doc)
            created_count += 1
            results.append({
                "parent_name": info["parent_name"],
                "email": email,
                "password": DEFAULT_PASSWORD,
                "children": [c["name"] + f" ({c['year']})" for c in info["children"]],
                "status": "CREATED"
            })

    print(f"\n{'='*60}")
    print(f"PARENT ACCOUNTS SEED COMPLETE")
    print(f"{'='*60}")
    print(f"Created: {created_count} | Updated: {updated_count} | Total: {len(parent_map)}")
    print(f"\n{'='*60}")
    print(f"{'PARENT LOGIN CREDENTIALS TABLE':^60}")
    print(f"{'='*60}")
    print(f"{'#':<3} {'Parent Name':<28} {'Email':<40} {'Password':<12} {'Children'}")
    print(f"{'-'*120}")
    for i, r in enumerate(results, 1):
        children_str = ", ".join(r["children"])
        print(f"{i:<3} {r['parent_name']:<28} {r['email']:<40} {r['password']:<12} {children_str}")
    print(f"{'='*120}")
    
    return results


if __name__ == "__main__":
    asyncio.run(seed_parents())
