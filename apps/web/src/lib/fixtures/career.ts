/**
 * Vaeloom Deterministic Career Planning & Strategic Roadmap Fixtures
 * Cleanly separated demo state — never fabricated as real backend data.
 */

export interface SkillGapItem {
  skill: string;
  category:
    | 'Distributed Systems'
    | 'AI / Machine Learning'
    | 'Security & Compliance'
    | 'Cloud Infrastructure';
  currentLevel: number; // 1-5
  requiredLevel: number; // 1-5
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  learningResource: string;
}

export interface RoadmapMilestone {
  id: string;
  quarter: string;
  title: string;
  description: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
  targetDate: string;
  skillsAcquired: string[];
  evidenceArtifact?: string;
}

export interface TargetRoleBenchmark {
  roleTitle: string;
  level: string;
  targetCompensation: string;
  industryDemand: string;
  overallMatchPercentage: number;
}

export interface TargetCompany {
  id: string;
  name: string;
  domain: string;
  matchScore: number;
  openRolesCount: number;
  salaryBand: string;
  tier: 'TIER_1' | 'TIER_2' | 'HIGH_GROWTH';
  notes: string;
}

export interface CareerStrategyData {
  isStaticDemo: true;
  primaryTargetRole: TargetRoleBenchmark;
  skillGaps: SkillGapItem[];
  milestones: RoadmapMilestone[];
  targetCompanies: TargetCompany[];
  agentDirectives: Array<{
    id: string;
    agent: string;
    directive: string;
    active: boolean;
  }>;
}

export const DEMO_CAREER_STRATEGY: CareerStrategyData = {
  isStaticDemo: true,
  primaryTargetRole: {
    roleTitle: 'Principal Distributed Systems Architect (AI / Infrastructure)',
    level: 'L7 / Principal',
    targetCompensation: '$380,000 - $480,000 Total Target Comp',
    industryDemand: 'Very High (+34% YoY)',
    overallMatchPercentage: 88,
  },
  skillGaps: [
    {
      skill: 'Temporal.io Workflow Orchestration',
      category: 'Distributed Systems',
      currentLevel: 4,
      requiredLevel: 5,
      priority: 'HIGH',
      learningResource: 'Temporal Advanced Determinism & Workflow Versioning Lab',
    },
    {
      skill: 'eBPF Kernel Telemetry & Network Policies',
      category: 'Security & Compliance',
      currentLevel: 3,
      requiredLevel: 4,
      priority: 'CRITICAL',
      learningResource: 'Cilium & eBPF Zero-Trust Observability Blueprint',
    },
    {
      skill: 'vLLM / Triton PagedAttention Inference',
      category: 'AI / Machine Learning',
      currentLevel: 3,
      requiredLevel: 4,
      priority: 'HIGH',
      learningResource: 'High-Throughput GPU Inference Optimization Guide',
    },
    {
      skill: 'PostgreSQL Row-Level Security (RLS) Cryptographic Hardening',
      category: 'Security & Compliance',
      currentLevel: 5,
      requiredLevel: 5,
      priority: 'MEDIUM',
      learningResource: 'Validated: Zero-Trust RLS Matrix & Tests in Production',
    },
  ],
  milestones: [
    {
      id: 'm1',
      quarter: 'Q3 2026',
      title: 'Architect Sovereign Multi-Agent Dual-Brain Runtime',
      description:
        'Ship sub-50ms System 1 typed routing coupled with System 2 grounded generative synthesis.',
      status: 'COMPLETED',
      targetDate: '2026-08-30',
      skillsAcquired: ['Sub-50ms typed routing', 'XML Context Fencing', 'Ollama Cloud Gemma 4'],
      evidenceArtifact: 'W3C-Credential-AgentCouncil-089',
    },
    {
      id: 'm2',
      quarter: 'Q4 2026',
      title: 'Open Source Distributed ATS Semantic Parser Benchmark',
      description:
        'Publish high-accuracy embeddings cosine distance gazetteer with 95%+ Workday/Greenhouse parseability.',
      status: 'IN_PROGRESS',
      targetDate: '2026-11-15',
      skillsAcquired: ['Vector Embeddings', 'Cosine Similarity', 'FastAPI High-Concurrency'],
      evidenceArtifact: 'GitHub: vaeloom/ats-core',
    },
    {
      id: 'm3',
      quarter: 'Q1 2027',
      title: 'Zero-Trust SOC2 Type II Continuous Audit Compliance',
      description:
        'Implement automated cryptographic HMAC audit logging and immutable verification trails.',
      status: 'UPCOMING',
      targetDate: '2027-02-28',
      skillsAcquired: ['SOC2 Controls', 'Immutable Ledger', 'Verifiable Credentials'],
    },
  ],
  targetCompanies: [
    {
      id: 'tc1',
      name: 'Anthropic',
      domain: 'anthropic.com',
      matchScore: 94,
      openRolesCount: 4,
      salaryBand: '$380k - $460k + Equity',
      tier: 'TIER_1',
      notes: 'Strong culture fit for sovereign alignment and deterministic verification.',
    },
    {
      id: 'tc2',
      name: 'OpenAI',
      domain: 'openai.com',
      matchScore: 91,
      openRolesCount: 6,
      salaryBand: '$400k - $520k + PPU',
      tier: 'TIER_1',
      notes: 'Infrastructure team scaling massive GPU clusters and autonomous agents.',
    },
    {
      id: 'tc3',
      name: 'Vercel',
      domain: 'vercel.com',
      matchScore: 89,
      openRolesCount: 3,
      salaryBand: '$350k - $420k + Equity',
      tier: 'HIGH_GROWTH',
      notes: 'Leading edge developer experience and global edge AI orchestration.',
    },
    {
      id: 'tc4',
      name: 'Scale AI',
      domain: 'scale.com',
      matchScore: 87,
      openRolesCount: 5,
      salaryBand: '$340k - $410k + Equity',
      tier: 'HIGH_GROWTH',
      notes: 'Focus on enterprise evaluation datasets and RLHF/RLAIF pipelines.',
    },
  ],
  agentDirectives: [
    {
      id: 'dir1',
      agent: 'JobSearchAgent',
      directive: 'Monitor L7/Principal roles with remote option and salary floor > $350,000.',
      active: true,
    },
    {
      id: 'dir2',
      agent: 'ResumeAgent',
      directive:
        'Auto-tailor master resume highlighting sub-50ms distributed latency for infra roles.',
      active: true,
    },
    {
      id: 'dir3',
      agent: 'MemoryAgent',
      directive:
        'Extract all published engineering metrics from workspace files into career skills graph.',
      active: true,
    },
  ],
};
