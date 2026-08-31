# Vaeloom Test Corpus — LICENSES

**Generated:** 2026-08-30
**Policy:** §4 Legal+Privacy — prefer openly licensed, synthetic where personal.

## Summary

| License | Count (artifacts) | Use |
| :--- | :--- | :--- |
| **CC0-1.0** | ~287 synthetic | Personas, resumes, certs, transcripts, projects, jobs (synthetic slice), email, calendar, negative, edge-cases, graph — waived |
| **MIT** | ~6 | `datasetmaster/resumes` archetype ref (MIT), GitHub `octocat/Hello-World` (MIT), synthetic persona repos (MIT synthetic) |
| **CC-BY-4.0** | 0 ingested, 1 reference | Qarera `Most In-Demand Job Skills 2026` 360k postings (23.7 kB) — attribution required if redistributing that skill CSV; we used as calibration reference only, not ingested raw |
| **CC0 (Kaggle Innovatiana)** | 0 bulk, archetype ref | Innovatiana 2,485 resumes text/HTML/PDF — CC0 (public domain) — archetype reference for resume structures |
| **U.S. Gov Public Domain** | pattern | USAJOBS/Greenhouse/Lever board patterns — not bulk scraped |

## Texts

- **CC0-1.0:** https://creativecommons.org/publicdomain/zero/1.0/ — No rights reserved. Synthetic corpus may be used without restriction; no attribution required.
- **MIT:** https://opensource.org/licenses/MIT — Permissive; requires preservation of copyright notice. Our synthetic repos carry `MIT (synthetic)` marker.
- **CC-BY-4.0:** https://creativecommons.org/licenses/by/4.0/ — Attribution required. If we later vendor Qarera `skills-2026-overall.csv`, we must cite `Qarera (2026). The Most In-Demand Job Skills of 2026: Skill-Demand Frequencies from 360,336 Job Postings [Data set]. Zenodo. https://doi.org/10.5281/zenodo.21204423 . CC BY 4.0.`

## Allowed Usage

- `CC0` synthetic: unrestricted — may be committed to `git`, used in CI, seeded to `dev.db`, rendered to `test-data/EXPECTED/`.
- `MIT` (octocat/Hello-World): unrestricted with notice — our fixture `GITHUB/github-001.json` attributes correctly.
- `CC-BY` (Qarera): attribution required — we keep as reference, not redistribution; if used, add citation in `SOURCES.md`.
- No `NC`, `ND`, or proprietary sources included — verified before selection (§29).

## Personal Data Risk

- **synthetic-no-pii (294/295):** All names (`Aarav Mehta`, `Emily Carter` etc.) fictional, emails `@example.com`, no real phones/addresses. Faker-style generation; GDPR §6 `synthetic-no-pii`.
- **public-no-pii-minimal (1/295):** `octocat/Hello-World` — public repo, MIT, 3 commits, no personal data beyond `octocat@github.com` (public bot account).
- **No passwords/tokens/private emails/breached data** per §4.

## Retrieval Dates

- Synthetic generation: `2026-08-30`
- Web source license verification: `2026-08-30` (Kaggle/HF pages live excerpts)

## Notes

- Full dataset downloads **not performed** for CC0 Kaggle `job-description-dataset` (1.74 GB) — we generated synthetic slice 42 jobs inspired by schema to avoid over-collection (§5) and to keep corpus `small enough to understand, large enough to break` (§24).
- If reusing Qarera skill CSV in CI, add `LICENSE` attribution header per CC-BY.
