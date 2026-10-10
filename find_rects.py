"""
Dumps ALL draw commands from the last page content stream
to find the signature blank box rectangles.
"""
import pypdf, re

reader = pypdf.PdfReader(
    r"C:\Users\TeslaTelson\OneDrive\Desktop\Entreprise\Trinidad\therightway_proposal.pdf"
)
page = reader.pages[-1]

contents = page.get("/Contents")

def decode_stream(obj):
    obj = obj.get_object()
    data = obj.get_data()
    return data.decode("latin-1", errors="replace")

raw_streams = []
if hasattr(contents, "get_object"):
    raw_streams.append(decode_stream(contents))
else:
    for item in contents:
        raw_streams.append(decode_stream(item))

full = "\n".join(raw_streams)

# Show all rects
rects = re.findall(r"([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+re", full)
print(f"All {len(rects)} rectangles on last page:")
for x, y, w, h in rects:
    x, y, w, h = float(x), float(y), float(w), float(h)
    print(f"  x={x:8.2f}  y={y:8.2f}  w={w:8.2f}  h={h:8.2f}")

# Also look for the current transform matrix (cm operator) to understand coordinate space
print("\nTransform matrices (cm) on last page:")
cms = re.findall(r"([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+cm", full)
for cm in cms[:10]:
    print(" ", cm)
