/**
 * E7: the offline seed and the backend catalog are one truth for skills.
 *
 * Its skill rows are exactly the 28 installable skills of `SKILL_CATALOG`
 * (pinned in-repo by apps/api/tests/test_skill_catalog.py). Pinning the seed
 * allowlist keeps that equality visible in review instead of letting either
 * list drift silently away from the other.
 */
import { SEED_CAPABILITIES } from './capabilities-data';

const SEED_SKILL_SLUGS = [
  'academic-cv-builder',
  'application-form-filler',
  'ats-audit',
  'ats-resume-builder',
  'career-changer-translator',
  'career-coaching',
  'cold-email-writer',
  'cover-letter-architect',
  'creative-portfolio-resume',
  'executive-resume-writer',
  'interview-prep-generator',
  'job-description-analyzer',
  'job-discovery-radar',
  'linkedin-humanizer',
  'linkedin-interviewer',
  'linkedin-post-writer',
  'linkedin-profile-optimizer',
  'offer-comparison-analyzer',
  'portfolio-case-study-writer',
  'reference-list-builder',
  'resume-bullet-writer',
  'resume-optimization',
  'resume-quantifier',
  'resume-tailor',
  'resume-version-manager',
  'salary-negotiation-playbook',
  'star-interview-prep',
  'tech-resume-optimizer',
];

describe('SEED_CAPABILITIES', () => {
  it('pins the seed skill slug allowlist', () => {
    const seedSkills = SEED_CAPABILITIES.filter((item) => item.category === 'skills');

    expect(seedSkills.every((item) => item.id.startsWith('skill-'))).toBe(true);

    const slugs = seedSkills.map((item) => item.id.slice('skill-'.length)).sort();

    expect(slugs).toEqual([...SEED_SKILL_SLUGS].sort());
  });
});
