# Module 05: Frontend UI/UX & Accessibility (WCAG 2.2 AA) Audit

**Requirement**: Enterprise Workspace & Document UI/UX, Folder Tree Navigation,
Multi-File Ingestion Queue, Accessible Data Tables, and WCAG 2.2 AA Compliance  
**Auditor**: Staff Frontend Engineer / Accessibility Specialist  
**Status**: NOT RELEASE VERIFIED (CRITICAL UX DEFICITS & WCAG VIOLATIONS)

---

## 1. Requirement & Expected Behavior

Enterprise web clients require:

1. **Directory Tree & Navigation**: Accessible hierarchical folder view with
   breadcrumbs, drag-and-drop file organization, and search filtering.
2. **Batch Ingestion UX**: Multi-file dropzone displaying real-time upload
   progress per file, retry buttons, and aggregate completion indicators.
3. **WCAG 2.2 AA Compliance**: Screen-reader friendly navigation, focus
   management, zero nested interactive elements (`button` inside `button` /
   `row` role overrides), and multi-modal diff rendering (not relying solely on
   color).

---

## 2. Implementation Findings

### 2.1 Missing Core Enterprise UI Capabilities

- **Location**: `apps/web/src/app/workspace/[workspaceId]/files/page.tsx` (1,018
  lines)
- **Deficiencies**:
  1. **Zero Folder Navigation**: Line 13 calls `getFileName(path)` and flattens
     all files into a single table. There is no folder tree, folder creation
     modal, or breadcrumb trail.
  2. **Multi-File Dropping Discards Files**: Lines 495 and 514 extract only
     `files?.[0]`. Selecting 10 files in the file chooser or dragging 10 files
     onto the browser silently uploads only the first file and drops the other 9
     without an error message.
  3. **Zero Full-Text Search**: The UI contains no search input. Users with
     hundreds of files have no way to search or filter by keyword.
  4. **Zero Bulk Actions**: The table lacks selection checkboxes. There is no
     bulk archive, bulk download, or batch move action.
  5. **No Version History View**: The detail page
     (`files/[documentId]/page.tsx`) displays an action history log of renames
     and archives, but cannot view previous file versions or revert to past
     revisions.

### 2.2 Critical WCAG 2.2 AA Accessibility Violations

#### A. WCAG 4.1.2 & 1.3.1: Table Row Semantic Overrides & Nested Buttons

- **Location**:
  `apps/web/src/app/workspace/[workspaceId]/files/page.tsx:623-637`
- **Observed Code**:
  ```tsx
  <tr
    key={doc.id}
    role="button"
    tabIndex={0}
    onClick={() => openPreview(doc)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPreview(doc);
      }
    }}
    className="..."
  >
    {/* Cells containing nested interactive buttons */}
    <td className="...">
      <button
        onClick={(e) => {
          e.stopPropagation();
          startIngest(doc);
        }}
      >
        Ingest
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setRenaming(doc);
        }}
      >
        Rename
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleArchive(doc);
        }}
      >
        Archive
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          openHistory(doc);
        }}
      >
        History
      </button>
    </td>
  </tr>
  ```
- **Accessibility Defect**: Overriding `<tr>` with `role="button"` destroys the
  table row semantics required by screen readers (JAWS/NVDA/VoiceOver). Screen
  readers can no longer identify row and column relationships. Furthermore,
  nesting four interactive `<button>` elements inside an element marked
  `role="button"` violates HTML and ARIA specifications, causing focus traps and
  keyboard navigation failures.

#### B. Nested Interactive Controls in File Dropzone

- **Location**:
  `apps/web/src/app/workspace/[workspaceId]/files/page.tsx:480-519`
- **Observed Code**:
  ```tsx
  <div
    role="button"
    tabIndex={0}
    onClick={() => fileInputRef.current?.click()}
    ...
  >
    <input ref={fileInputRef} type="file" ... />
  </div>
  ```
- **Accessibility Defect**: An interactive `<input>` is nested inside an element
  declaring `role="button"`. Keyboard users pressing Enter or Space trigger
  conflicting click handlers.

#### C. WCAG 1.4.1: Use of Color in Diff Viewer

- **Location**: `apps/web/src/components/shared/DiffViewer.tsx:113, 124`
- **Observed Code**:
  ```tsx
  <del className="bg-accent/20 text-accent font-semibold no-underline px-1 rounded">
  ...
  <ins className="bg-success/20 text-success font-semibold no-underline px-1 rounded">
  ```
- **Accessibility Defect**: Both `<del>` and `<ins>` explicitly use
  `no-underline`, removing default strikethrough and underline indicators.
  Color-blind users (deuteranopia / protanopia) cannot distinguish additions
  from deletions because the distinction relies solely on green vs red/accent
  background tinting.

---

## 3. Evaluation Matrix

| Vector                     | Requirement                       | Actual Status               | Verdict               |
| :------------------------- | :-------------------------------- | :-------------------------- | :-------------------- |
| **Folder Hierarchy UI**    | Tree navigation & breadcrumbs     | Flat list only              | **FAIL**              |
| **Multi-File Queue**       | Concurrent upload progress list   | Silently drops >1 files     | **CRITICAL FAIL**     |
| **Bulk Select Toolbar**    | Multi-select checkboxes           | Missing                     | **FAIL**              |
| **Search Filter Input**    | Instant keyword filter            | Missing                     | **FAIL**              |
| **Table ARIA Semantics**   | Proper table structure            | `tr role="button"` override | **FAIL (WCAG 4.1.2)** |
| **Nested Controls**        | Zero nested interactive buttons   | 4 buttons nested inside row | **FAIL (WCAG 4.1.2)** |
| **Color-Independent Diff** | Strikethrough / underline styling | `no-underline` used         | **FAIL (WCAG 1.4.1)** |

---

## 4. UI/UX Verdict

**NOT RELEASE VERIFIED (CRITICAL USABILITY & WCAG DEFECTS)**  
Essential enterprise document management controls are absent, multi-file uploads
silently fail, and critical accessibility violations break screen reader
navigation.
