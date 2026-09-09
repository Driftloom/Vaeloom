'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicProfileData, profileApi } from '@/lib/api-client';
import { Avatar } from '@/components/shared/Avatar';

interface PublicProfileViewProps {
  userId: string;
  initialData?: PublicProfileData | null;
}

export default function PublicProfileView({ userId, initialData }: PublicProfileViewProps) {
  const [profile, setProfile] = useState<PublicProfileData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setProfile(initialData);
      setLoading(false);
      return;
    }
    if (!userId) return;

    let isMounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        const data = await profileApi.getPublic(userId);
        if (isMounted) setProfile(data);
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Profile not found or unavailable');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [userId, initialData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text">
        <header className="border-b border-border bg-surface/50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-lg text-primary">
            <span>✨</span>
            <span>Vaeloom</span>
          </div>
        </header>
        <main className="max-w-4xl mx-auto py-12 px-4 space-y-6">
          <div className="card p-8 animate-pulse space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-surface-200 shrink-0" />
              <div className="space-y-3 flex-1">
                <div className="h-7 w-48 bg-surface-200 rounded" />
                <div className="h-5 w-72 bg-surface-200 rounded" />
                <div className="h-4 w-36 bg-surface-200 rounded" />
              </div>
            </div>
          </div>
          <div className="card p-6 animate-pulse space-y-4">
            <div className="h-5 w-32 bg-surface-200 rounded" />
            <div className="flex gap-2 flex-wrap">
              <div className="h-8 w-20 bg-surface-200 rounded-full" />
              <div className="h-8 w-24 bg-surface-200 rounded-full" />
              <div className="h-8 w-28 bg-surface-200 rounded-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background text-text flex flex-col">
        <header className="border-b border-border bg-surface/50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-display font-bold text-lg text-primary"
          >
            <span>✨</span>
            <span>Vaeloom</span>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="card max-w-md p-8 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-200 flex items-center justify-center text-text-muted text-xl font-mono">
              ?
            </div>
            <h1 className="text-xl font-semibold text-text">Profile Not Found</h1>
            <p className="text-sm text-text-muted">
              The public profile you requested is not available or does not exist.
            </p>
            <Link
              href="/signup"
              className="inline-block px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Build Your Profile with Vaeloom
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text flex flex-col">
      {/* Top Banner */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display font-bold text-lg text-primary hover:opacity-90 transition-opacity"
        >
          <span>✨</span>
          <span>Vaeloom</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-text-dim">
            Powered by AI Career Intelligence
          </span>
          <Link
            href="/signup"
            className="px-3.5 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            Create Your Profile
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full py-8 px-4 sm:px-6 space-y-6 flex-1">
        {/* Profile Card Header */}
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Avatar
              src={profile.avatarUrl}
              alt={profile.displayName}
              fallback={profile.displayName?.[0] || 'U'}
              className="w-24 h-24 sm:w-28 sm:h-28 text-3xl font-display shadow-md shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-text truncate">
                  {profile.displayName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Verified Talent
                </span>
              </div>

              {profile.headline && (
                <p className="text-base sm:text-lg text-text-muted font-medium">
                  {profile.headline}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs sm:text-sm text-text-dim flex-wrap pt-1">
                {profile.location && (
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4 text-text-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                      />
                    </svg>
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.yearsExperience && (
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4 text-text-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{profile.yearsExperience}+ years experience</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 text-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M6.75 3v2.25M17.25 3v2.253 3.75h18m-18 0v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V7.5H3z"
                    />
                  </svg>
                  <span>
                    Member since{' '}
                    {new Date(profile.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Social Links */}
              {profile.socialLinks && Object.keys(profile.socialLinks).length > 0 && (
                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  {Object.entries(profile.socialLinks).map(([platform, url]) => {
                    if (!url) return null;
                    const href = url.startsWith('http') ? url : `https://${url}`;
                    return (
                      <a
                        key={platform}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-border bg-surface-200 hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                      >
                        <span className="capitalize">{platform}</span>
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bio Section */}
        {profile.bio && (
          <div className="card p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-semibold text-text flex items-center gap-2">
              <span>About</span>
            </h2>
            <p className="text-sm sm:text-base text-text-muted leading-relaxed whitespace-pre-wrap">
              {profile.bio}
            </p>
          </div>
        )}

        {/* Verified Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="card p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text flex items-center gap-2">
                <span>Verified Skills</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                  {profile.skills.length}
                </span>
              </h2>
              <span className="text-xs text-text-dim">Validated against career evidence</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <div
                  key={skill.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-200 text-text text-sm font-medium hover:border-primary/40 transition-colors"
                >
                  <span>{skill.name}</span>
                  {skill.verified && (
                    <svg
                      className="w-3.5 h-3.5 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Career History Timeline */}
        {profile.careerHistory && profile.careerHistory.length > 0 && (
          <div className="card p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-semibold text-text">Experience Timeline</h2>
            <div className="relative border-l-2 border-border pl-6 space-y-8">
              {profile.careerHistory.map((item, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-surface border-2 border-primary group-hover:scale-125 transition-transform" />
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-text">{item.role}</h3>
                    <p className="text-sm font-medium text-primary">{item.company}</p>
                    {(item.startDate || item.endDate) && (
                      <p className="text-xs text-text-dim font-mono">
                        {item.startDate || 'Past'} — {item.endDate || 'Present'}
                      </p>
                    )}
                    {item.achievements && item.achievements.length > 0 && (
                      <ul className="mt-2.5 space-y-1 list-disc list-inside text-xs sm:text-sm text-text-muted">
                        {item.achievements.map((ach, achIdx) => (
                          <li key={achIdx} className="leading-relaxed">
                            {ach}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 text-center text-xs text-text-dim mt-auto">
        <p>
          Verified profile hosted on{' '}
          <Link href="/" className="text-primary hover:underline font-medium">
            Vaeloom
          </Link>{' '}
          • Autonomous Career Intelligence
        </p>
      </footer>
    </div>
  );
}
