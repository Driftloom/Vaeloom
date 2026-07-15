Vaeloom Â· Agent Workflow

# One file in, one application out

The same memory loop runs underneath every feature. This is what actually happens between a student uploading a resume draft and an application landing in front of a recruiter.

**Scenario:** A student drags **Resume\_draft\_v3.pdf** into Vaeloom, then later asks: "find me backend internships."

1

TRIGGER

## File uploaded

User drags in a resume draft. No action required from the user beyond this.

reads: nothing yet

2

ORGANIZATION AGENT

## Reads, names, files it

Recognizes it as a resume, detects it's a newer version of an existing one, proposes: rename to `Resume_2026.pdf`, move to `/Career/Resume`, archive the older version.

reads: document memory
writes: document memory, version chain

3

MEMORY AGENT

## Extracts & merges into the graph

Pulls out skills, projects, education, dates. Merges "React" and "React.js" into one node. Links the new project to the skills it used.

reads: knowledge graph
writes: entities, relationships, vector store

4

RESUME AGENT

## Updates the master resume

Folds new content into the always-current master resume. Notices no GPA is recorded anywhere and asks one specific question instead of guessing.

reads: profile + career memory
writes: master resume, profile memory (on answer)

5

USER

## "Find me backend internships"

A normal chat request â€” the Orchestrator routes it to the Job Search Agent.

reads: working memory (conversation)

6

JOB SEARCH AGENT

## Searches, ranks, shortlists

Searches connected platforms, ranks results against the skill graph, filters out roles already rejected before, returns a ranked shortlist of 8 with a fit reason for each.

reads: skill graph, career memory (past outcomes)
writes: shortlist (pending)

7

ATS AGENT

## Scores fit per role

For each shortlisted role: 78% match, missing keywords "Docker," "system design," suggests two specific resume edits â€” shown as a diff, not applied automatically.

reads: master resume, job description

8

USER APPROVAL

## Picks 3 of the 8 to pursue

Nothing leaves the system until this point. The user selects which roles to actually apply to.

9

APPLICATION AGENT

## Tailors and submits â€” or hands off

Builds a tailored resume + cover letter per role. Where the platform has an official API, applies directly. Where it doesn't, deep-links the user to the listing with documents ready to attach, rather than scraping the form.

reads: master resume, ATS suggestions
writes: career memory â€” application + status

10

MEMORY AGENT

## Outcome feeds the next loop

Whatever happens next â€” interview, rejection, silence â€” gets logged. The next time the Job Search Agent ranks roles, this outcome is part of what it's reading.

writes: episodic memory, preference memory