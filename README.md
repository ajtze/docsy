# DOCSY

A minimal, browser-based document studio. No backend or account is required.

## Run locally
Because service workers require a secure context, use a local static server rather than opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages
1. Create a public repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**, choose `main` and `/ (root)`.
5. Save and wait for the deployment.

## Current starter scope
- Rich text editing, page setup, live preview, themes and local draft saving.
- TXT, Markdown and HTML import/export.
- DOCX export via the docx library loaded from jsDelivr.
- PDF via the browser print dialog (choose Save as PDF).
- Tables, images, links, signature line, find/replace and browser text-to-speech.
- Installable PWA shell and same-origin offline caching.

## Important limitations
This is a functional starter, not yet a production-grade publishing engine. DOCX import, precise multi-page pagination, reliable page-numbering across all pages, PDF background-color fidelity, and fully offline availability of third-party libraries need further implementation and testing. Google Fonts and the DOCX library are external CDN resources. For a fully self-contained offline build, vendor dependencies locally and test the service worker after deployment.

## Privacy
Document text is processed in the browser. A draft is saved in browser LocalStorage on this device. The external font and DOCX CDN may receive normal network requests. Hosting providers may retain ordinary connection logs.

## Copyright
© 2026 DOCSY. All rights reserved.

DOCSY's original branding, interface and source code are protected to the extent applicable by law. Third-party dependencies remain subject to their respective licenses.
