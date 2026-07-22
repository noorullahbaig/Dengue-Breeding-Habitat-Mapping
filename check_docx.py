import docx
import sys

doc_path = "/Users/noorullah/Desktop/FYP/output/doc/FYP DOC NOORULLAH - FINAL FORMATTED - PHYSICAL ERD UPDATED.docx"
doc = docx.Document(doc_path)

text = []
for p in doc.paragraphs:
    text.append(p.text)
    
full_text = "\n".join(text)

keywords = [
    "VARCHAR(36)",
    "VARCHAR(128)", 
    "VARCHAR(255)",
    "nearest_hotspot_id",
    "snapshot",
    "denormalization",
    "traceability",
    "0..1",
    "0..many",
    "HOTSPOTS"
]

for k in keywords:
    count = full_text.count(k)
    print(f"'{k}' found {count} times")

# Let's also print context around nearest_hotspot_id
idx = full_text.find("nearest_hotspot_id")
if idx != -1:
    start = max(0, idx - 200)
    end = min(len(full_text), idx + 200)
    print("\nContext around 'nearest_hotspot_id':")
    print("..." + full_text[start:end] + "...")
    
idx2 = full_text.find("denormalization")
if idx2 != -1:
    start = max(0, idx2 - 200)
    end = min(len(full_text), idx2 + 200)
    print("\nContext around 'denormalization':")
    print("..." + full_text[start:end] + "...")
