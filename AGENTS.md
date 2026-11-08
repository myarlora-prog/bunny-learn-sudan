<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the primary mobile navigation limited to four routes: curriculum, quizzes, streak, and profile, because these are the product's fixed top-level destinations.
- Edit existing lesson explanations through the owner-only revision RPC; render owner-authored rich text through the shared sanitizer to preserve history and prevent unsafe markup.
- Subject exam authoring uses the existing subject_exams records and RLS; student exams read published rows instead of generating replacements at runtime.
- Curriculum AI work uses owner-scoped durable jobs with a database lease and one source item per server invocation, so pause/resume and deduplication survive disconnects.
- New question variants remain backward-compatible with existing published multiple-choice JSON and use the same student exam and attempt records.
- AI-formatted explanations preserve source words in order before owner review; only explicit approval uses the revision RPC, preventing automatic content replacement.
