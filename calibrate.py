import pypdf, sys

reader = pypdf.PdfReader(r"C:\Users\TeslaTelson\OneDrive\Desktop\Entreprise\Trinidad\therightway_proposal.pdf")
page_idx = int(sys.argv[1]) if len(sys.argv) > 1 else -1
page = reader.pages[page_idx]

results = []
def visitor(text, cm, tm, fontDict, fontSize):
    t = text.strip()
    if t:
        try:
            safe = t.encode('ascii', 'replace').decode('ascii')
            results.append((round(tm[5], 1), round(tm[4], 1), safe[:35]))
        except Exception:
            pass

page.extract_text(visitor_text=visitor)

print(f"Page {page_idx} — {len(results)} text items")
print("Sorted top-to-bottom (ascending Y = top of PDF page):")
for y, x, t in sorted(results):
    print(f"  y={y:8.2f}  x={x:6.2f}  [{t}]")
