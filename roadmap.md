# Nawabig legacy book-upload restoration
- [x] Inspect Git and identify `fe542d2321386f6420912b0bbb53dd1fdcaaae6a` as the last available snapshot before the end of 13 November 2026.
- [x] Preserve the current code at commit `130f5f5a655993f7c9d16057bf74da63cabc07f2` and temporary copies of the two target files.
- [ ] Restore only AdminUpload to the historical PDF/TXT UI, local legacy text extraction, manual start, one AI request, and single draft save.
- [ ] Restore the historical explanation and summary instructions; require exactly 15 concise flashcards and 15 four-option quiz questions per lesson.
- [ ] Leave every other page, shared PDF reader, database object, existing book, draft, student, result, subscription, and all 55 stuck files untouched.
- [ ] Run focused tests and inspect the build log and scoped diff.
- [ ] Test a new isolated small book upload and actual AI/draft saving only if an owner session and Gemini quota are available; report PASS/FAIL/NOT TESTED honestly.
- [ ] Commit the scoped code changes.
