import docx
import sys

doc_path = "/Users/noorullah/Desktop/FYP/output/doc/FYP DOC NOORULLAH - FINAL FORMATTED - PHYSICAL ERD UPDATED.docx"
doc = docx.Document(doc_path)

text = []
for p in doc.paragraphs:
    text.append(p.text)
    
full_text = "\n".join(text)

idx = full_text.find("copied hotspot locality")
if idx != -1:
    start = max(0, idx - 200)
    end = min(len(full_text), idx + 200)
    print("\nContext around 'copied hotspot locality':")
    print("..." + full_text[start:end] + "...")
