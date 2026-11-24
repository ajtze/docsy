# DOCSY — Documents, made simple.

A minimal, private, browser-based document studio. No backend, no account, no cloud storage. Everything runs on your device.

## Features

- **Rich-text editor** — bold/italic/underline, headings, lists, undo/redo, paragraph styles.
- **Real multi-page preview** — content is paginated based on your paper size, margins, and typography. Not a fake page counter.
- **Page setup** — A4 / A3 / A5 / Letter / Legal / Custom sizes, portrait or landscape, adjustable margins.
- **Colors** — text color and page color, preserved in preview and print (enable "Background graphics" in your print dialog).
- **Header, footer, watermark, page numbers** — rendered in the correct margin positions on every page.
- **Insert** — tables, images (up to 4 MB), hyperlinks, signature lines.
- **Find & replace** — case-sensitive text replacement with count feedback.
- **Read aloud** — browser-native speech synthesis.
- **Local autosave** — draft is stored in `localStorage`; clear it any time from Tools → Clear saved draft.
- **Exports** — PDF (via print dialog), DOCX, HTML, Markdown, TXT.
- **Imports** — TXT, Markdown, HTML (DOCX import is not supported).
- **PWA** — installable; the app shell is cached for offline use.
- **Dark mode** — theme toggle, persisted across visits.

## Run locally

Service workers require a secure context. Use a local static server, not `file://`.

```bash
python -m http.server 8000
