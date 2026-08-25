import type { Metadata } from 'next';
import { AuthRedirectProbe } from '@/components/shared/AuthRedirectProbe';
import { SEO } from '@/lib/landing/copy';

import LandingNav from '@/components/landing/sections/LandingNav';
import { DustField } from '@/components/landing/3d/SceneShell';
import HeroSection from '@/components/landing/sections/HeroSection';
import { PrinciplesStrip, ProductDifference } from '@/components/landing/sections/ProductSections';
import HowItWorks from '@/components/landing/sections/HowItWorks';
import MemorySection from '@/components/landing/sections/MemorySection';
import AgentSection from '@/components/landing/sections/AgentSection';
import {
  ConnectorSection,
  OrganizationSection,
  ResumeSection,
  CareerSection,
  SchedulerSection,
} from '@/components/landing/sections/ProductStorySections';
import {
  TrustSection,
  CompoundingSection,
} from '@/components/landing/sections/TrustCompoundingSections';
import ProductPreview from '@/components/landing/sections/ProductPreview';
import {
  EnterpriseSection,
  FinalCTA,
  LandingFooter,
} from '@/components/landing/sections/ClosingSections';

// W-14: landing is statically renderable — real page metadata.
export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  alternates: { canonical: SEO.url },
  openGraph: {
    title: SEO.title,
    description: SEO.description,
    url: SEO.url,
    siteName: SEO.siteName,
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: SEO.title }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SEO.title,
    description: SEO.description,
    images: ['/og-image.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Vaeloom',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: SEO.description,
  url: SEO.url,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'Persistent structured memory (knowledge graph, vector search, agentic RAG)',
    'Auto-organizing workspace with approval-gated suggestions',
    'Master resume assembled from evidence with provenance links',
    'ATS scoring with known-vs-missing gap analysis',
    'Background job radar with ranked, reasoned shortlists',
    'Gmail digest with deadline extraction — drafts only, never sends',
    'Deadline & conflict detection across schedule sources',
    'Append-only audit trail with reversible actions',
  ],
};

/**
 * The Living Second Brain — one continuous story:
 * fragmentation → understanding → memory → connection →
 * intelligence → action → outcome → compounding.
 *
 * Server-rendered semantic copy first; WebGL scenes progressively
 * enhance via client islands and never gate information.
 */
export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AuthRedirectProbe />
      <LandingNav />
      <DustField />
      <main id="main-content" className="relative z-10 overflow-x-clip">
        <HeroSection />
        <PrinciplesStrip />
        <ProductDifference />
        <HowItWorks />
        <MemorySection />
        <AgentSection />
        <ConnectorSection />
        <OrganizationSection />
        <ResumeSection />
        <CareerSection />
        <SchedulerSection />
        <TrustSection />
        <CompoundingSection />
        <ProductPreview />
        <EnterpriseSection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </>
  );
}
