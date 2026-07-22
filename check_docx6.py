import docx

doc_path = "/Users/noorullah/Desktop/FYP/output/doc/FYP DOC NOORULLAH - FINAL FORMATTED - PHYSICAL ERD UPDATED.docx"
doc = docx.Document(doc_path)

for table in doc.tables:
    for row in table.rows:
        row_text = [cell.text for cell in row.cells]
        full_row_lower = " ".join(row_text).lower()
        if "string(36)" in full_row_lower or "string(128)" in full_row_lower or "id" in full_row_lower.split():
            print(" | ".join([t.replace('\n', ' ') for t in row_text]))
