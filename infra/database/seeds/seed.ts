/**
 * Database seed script (Docs/Engineering/Implementation/02-database-schema.md).
 *
 * Creates a demo workspace with sample entities, documents, memory records,
 * and relationships for local development and manual QA.
 *
 * Usage: npx ts-node database/seeds/seed.ts
 * Or:    npx prisma db seed
 */

import { PrismaClient, MemoryType } from '../../apps/api/src/generated/prisma';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding Vaeloom database...');

  // ─── Demo User ───
  const passwordHash = await bcrypt.hash('DemoPass123!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@vaeloom.dev' },
    update: {},
    create: {
      email: 'demo@vaeloom.dev',
      displayName: 'Demo User',
      passwordHash,
      authProvider: 'email',
    },
  });
  console.log(`  ✓ User: ${user.email} (${user.id})`);

  // ─── Demo Workspace ───
  const existingWorkspace = await prisma.workspace.findFirst({
    where: { userId: user.id, name: 'Demo Workspace' },
  });
  const workspace = existingWorkspace ?? await prisma.workspace.create({
    data: {
      userId: user.id,
      name: 'Demo Workspace',
      description: 'A sample workspace for local development and QA',
    },
  });
  console.log(`  ✓ Workspace: ${workspace.name} (${workspace.id})`);

  // ─── Sample Document ───
  const doc = await prisma.document.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      workspaceId: workspace.id,
      path: '/uploads/resume-v1.pdf',
      type: 'pdf',
      rawStorageKey: 'local/demo/resume-v1.pdf',
      summary: 'Software engineer resume with 3 years of experience in TypeScript, Python, and cloud infrastructure.',
    },
  });
  console.log(`  ✓ Document: ${doc.path}`);

  // ─── Document Version ───
  await prisma.documentVersion.upsert({
    where: { documentId_versionNumber: { documentId: doc.id, versionNumber: 1 } },
    update: {},
    create: {
      documentId: doc.id,
      versionNumber: 1,
      storageKey: 'local/demo/resume-v1.pdf',
      sizeBytes: 245000,
      checksum: 'sha256:demo-checksum-placeholder',
    },
  });
  console.log(`  ✓ Document version: v1`);

  // ─── Memory Records (6 types per MVP) ───
  const memoryRecords = [
    {
      type: MemoryType.profile,
      content: {
        name: 'Demo User',
        email: 'demo@vaeloom.dev',
        title: 'Software Engineer',
        location: 'San Francisco, CA',
        skills: ['TypeScript', 'Python', 'PostgreSQL', 'Docker', 'AWS'],
        yearsExperience: 3,
      },
      confidence: 0.95,
      importance: 1.0,
    },
    {
      type: MemoryType.career,
      content: {
        company: 'TechCorp Inc.',
        role: 'Software Engineer',
        startDate: '2023-06-01',
        endDate: null,
        achievements: [
          'Led migration from monolith to microservices',
          'Reduced API latency by 40%',
          'Mentored 2 junior engineers',
        ],
      },
      confidence: 0.9,
      importance: 0.8,
    },
    {
      type: MemoryType.document,
      content: {
        documentId: doc.id,
        extractedText: 'Software Engineer with 3 years experience...',
        sections: ['education', 'experience', 'skills', 'projects'],
      },
      confidence: 1.0,
      importance: 0.7,
      sourceDocumentId: doc.id,
    },
    {
      type: MemoryType.episodic,
      content: {
        event: 'Applied to Senior Engineer position at StartupXYZ',
        date: '2026-07-15',
        outcome: 'pending',
        sentiment: 'hopeful',
      },
      confidence: 1.0,
      importance: 0.6,
    },
    {
      type: MemoryType.preference,
      content: {
        jobTypes: ['full-time', 'remote'],
        salaryRange: { min: 120000, max: 180000, currency: 'USD' },
        preferredIndustries: ['tech', 'fintech', 'healthtech'],
        dealbreakers: ['no-remote', 'relocation-required'],
      },
      confidence: 0.85,
      importance: 0.9,
    },
    {
      type: MemoryType.working,
      content: {
        currentTask: 'Preparing for TechCorp Q3 review',
        context: 'Need to compile performance metrics',
        deadline: '2026-07-20',
      },
      confidence: 1.0,
      importance: 0.5,
    },
  ];

  for (const record of memoryRecords) {
    const sourceDocId = (record as Record<string, unknown>).sourceDocumentId as string | undefined;
    await prisma.memoryRecord.create({
      data: {
        workspaceId: workspace.id,
        type: record.type,
        content: record.content,
        confidence: record.confidence,
        importance: record.importance,
        sourceDocumentId: sourceDocId,
      },
    });
  }
  console.log(`  ✓ Memory records: ${memoryRecords.length} (all 6 MVP types)`);

  // ─── Entities (Knowledge Graph nodes) ───
  const entities = await Promise.all([
    prisma.entity.create({
      data: {
        workspaceId: workspace.id,
        type: 'person',
        canonicalName: 'Demo User',
        aliases: ['demo@vaeloom.dev'],
      },
    }),
    prisma.entity.create({
      data: {
        workspaceId: workspace.id,
        type: 'company',
        canonicalName: 'TechCorp Inc.',
        aliases: ['TechCorp', 'TC'],
      },
    }),
    prisma.entity.create({
      data: {
        workspaceId: workspace.id,
        type: 'skill',
        canonicalName: 'TypeScript',
        aliases: ['TS', 'typescript'],
      },
    }),
    prisma.entity.create({
      data: {
        workspaceId: workspace.id,
        type: 'skill',
        canonicalName: 'Python',
        aliases: ['python3', 'py'],
      },
    }),
    prisma.entity.create({
      data: {
        workspaceId: workspace.id,
        type: 'company',
        canonicalName: 'StartupXYZ',
        aliases: ['SXYZ'],
      },
    }),
  ]);
  console.log(`  ✓ Entities: ${entities.length}`);

  // ─── Relationships (Knowledge Graph edges) ───
  const [person, techcorp, typescript, python, startupxyz] = entities;

  await Promise.all([
    prisma.relationship.create({
      data: {
        workspaceId: workspace.id,
        fromEntityId: person.id,
        toEntityId: techcorp.id,
        relationType: 'works_at',
        confidence: 0.95,
      },
    }),
    prisma.relationship.create({
      data: {
        workspaceId: workspace.id,
        fromEntityId: person.id,
        toEntityId: typescript.id,
        relationType: 'has_skill',
        confidence: 0.9,
      },
    }),
    prisma.relationship.create({
      data: {
        workspaceId: workspace.id,
        fromEntityId: person.id,
        toEntityId: python.id,
        relationType: 'has_skill',
        confidence: 0.85,
      },
    }),
    prisma.relationship.create({
      data: {
        workspaceId: workspace.id,
        fromEntityId: person.id,
        toEntityId: startupxyz.id,
        relationType: 'applied_to',
        confidence: 1.0,
      },
    }),
  ]);
  console.log(`  ✓ Relationships: 4`);

  // ─── Sample Application ───
  await prisma.application.create({
    data: {
      workspaceId: workspace.id,
      jobExternalId: 'linkedin-12345',
      platform: 'linkedin',
      status: 'SUBMITTED',
      coverLetter: 'Dear Hiring Manager, I am excited to apply for the Senior Engineer position...',
      submittedAt: new Date('2026-07-15'),
    },
  });
  console.log(`  ✓ Application: 1`);

  // ─── Sample Schedule Event ───
  await prisma.scheduleEvent.create({
    data: {
      workspaceId: workspace.id,
      source: 'agent_generated',
      title: 'Follow up on StartupXYZ application',
      date: new Date('2026-07-22'),
      type: 'reminder',
    },
  });
  console.log(`  ✓ Schedule event: 1`);

  // ─── Sample Agent Action (audit log entry) ───
  await prisma.agentAction.create({
    data: {
      workspaceId: workspace.id,
      agentName: 'resume_agent',
      actionType: 'generate_resume',
      inputRef: `document:${doc.id}`,
      outputRef: 'resume:demo-v1',
      status: 'COMPLETED',
      durationMs: 2340,
      tokensUsed: 1500,
      cost: 0.003,
    },
  });
  console.log(`  ✓ Agent action (audit): 1`);

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
