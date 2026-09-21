# Gate 30 — Frontend Security Red Team
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|---|---|---|---|
| 1 | P0 | `apps/web/src/app/workspace/[workspaceId]/files/page.tsx:1346` | Critical Stored XSS. The frontend viewer renders arbitrary HTML/SVG documents inside an unsandboxed `<iframe>` using a Blob Object URL (`URL.createObjectURL`). |
| 2 | P1 | `apps/web/src/app/workspace/[workspaceId]/files/page.tsx:549` | The frontend circumvents the backend's Content Security Policy. Backend applies `CSP: sandbox` on the HTTP response, but Object URLs strip these HTTP headers, leaving the execution context unrestricted. |

## Evidence
`page.tsx` (Lines 549, 1346):
```tsx
        const blob = await documentApi.getContent(doc.id, docWorkspaceId(doc));
        const url = URL.createObjectURL(blob);
...
            ) : viewerContent?.url && !viewerContent.unsupported ? (
              <iframe
                src={viewerContent.url}
                title="Document Preview"
                className="w-full h-96 rounded-lg border border-border"
              />
```
Because the backend `file_security_service.py` explicitly allows `.html` files (Line 210), an attacker can upload an HTML file containing `<script>fetch('/api/v1/auth/tokens').then(...)</script>`. When an innocent user opens the file preview, the `<iframe>` loads the Blob Object URL (which inherits the `vaeloom.app` origin) without a `sandbox` attribute, executing the script with full access to the user's session and DOM.

## Conclusion
A catastrophic frontend Stored XSS vulnerability exists. The backend security headers are entirely negated by the frontend's architecture.
