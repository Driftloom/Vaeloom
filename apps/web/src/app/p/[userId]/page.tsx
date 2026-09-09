import React from 'react';
import type { Metadata } from 'next';
import PublicProfileView from './PublicProfileView';
import { PublicProfileData } from '@/lib/api-client';

interface PageProps {
  params: Promise<{ userId: string }>;
}

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://vaeloom.app';
const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000';

async function getProfileData(userId: string): Promise<PublicProfileData | null> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/profile/public/${encodeURIComponent(userId)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getProfileData(userId);

  if (!profile) {
    return {
      title: 'Profile Not Found | Vaeloom',
      description: 'The requested public profile is not available on Vaeloom.',
    };
  }

  const name = profile.displayName || 'Professional';
  const headline = profile.headline ? ` — ${profile.headline}` : '';
  const title = `${name}${headline} | Vaeloom`;
  const description =
    profile.bio?.slice(0, 160) ||
    `${name}'s verified skills, experience, and career trajectory backed by Vaeloom AI memory graph.`;
  const profileUrl = `${siteUrl}/p/${userId}`;
  const avatar = profile.avatarUrl || `${siteUrl}/og-image.png`;

  return {
    title,
    description,
    alternates: {
      canonical: profileUrl,
    },
    openGraph: {
      title,
      description,
      url: profileUrl,
      type: 'profile',
      images: [
        {
          url: avatar,
          width: 800,
          height: 800,
          alt: `${name} on Vaeloom`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [avatar],
      creator: '@vaeloom',
    },
    other: {
      'profile:username': userId,
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const initialData = await getProfileData(userId);

  // Schema.org Person JSON-LD for rich Google Search indexing
  const jsonLd = initialData
    ? {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: initialData.displayName,
        jobTitle: initialData.headline || initialData.jobTitle,
        description: initialData.bio,
        image: initialData.avatarUrl,
        url: `${siteUrl}/p/${userId}`,
        knowsAbout: (initialData.skills || []).map((s) => s.name),
        address: initialData.location
          ? {
              '@type': 'PostalAddress',
              addressLocality: initialData.location,
            }
          : undefined,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <PublicProfileView userId={userId} initialData={initialData} />
    </>
  );
}
