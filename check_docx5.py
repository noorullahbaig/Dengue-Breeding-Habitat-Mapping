import docx

doc_path = "/Users/noorullah/Desktop/FYP/output/doc/FYP DOC NOORULLAH - FINAL FORMATTED - PHYSICAL ERD UPDATED.docx"
doc = docx.Document(doc_path)

print("Rows containing 'integer' or 'nearest_hotspot_id':")
for table in doc.tables:
    for row in table.rows:
        row_text = [cell.text for cell in row.cells]
        full_row_lower = " ".join(row_text).lower()
        if "integer" in full_row_lower or "nearest_hotspot_id" in full_row_lower or "varchar" in full_row_lower or "uuid" in full_row_lower:
            print(" | ".join([t.replace('\n', ' ') for t in row_text]))
