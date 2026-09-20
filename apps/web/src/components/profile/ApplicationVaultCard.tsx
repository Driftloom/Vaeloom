'use client';

import React, { useState } from 'react';
import { ApplicationVaultData, ProfileData, profileApi } from '@/lib/api-client';
import { Panel } from '@/components/shared/Panel';

interface ApplicationVaultCardProps {
  vault?: ApplicationVaultData | null;
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function ApplicationVaultCard({
  vault,
  workspaceId,
  onUpdate,
}: ApplicationVaultCardProps) {
  const [demographicsPolicy, setDemographicsPolicy] = useState(
    vault?.demographicsPolicy ?? 'decline',
  );
  const [gender, setGender] = useState(vault?.gender ?? '');
  const [ethnicity, setEthnicity] = useState(vault?.ethnicity ?? '');
  const [veteranStatus, setVeteranStatus] = useState(vault?.veteranStatus ?? '');
  const [disabilityStatus, setDisabilityStatus] = useState(vault?.disabilityStatus ?? '');
  const [countriesText, setCountriesText] = useState(
    (vault?.authorizedCountries ?? ['US']).join(', '),
  );
  const [visaStatus, setVisaStatus] = useState(vault?.visaStatus ?? 'Citizen');
  const [requiresSponsorship, setRequiresSponsorship] = useState(
    vault?.requiresSponsorship ?? false,
  );
  const [securityClearance, setSecurityClearance] = useState(vault?.securityClearance ?? 'None');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const authorizedCountries = countriesText
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      const payload: Partial<ApplicationVaultData> = {
        demographicsPolicy,
        gender: gender || null,
        ethnicity: ethnicity || null,
        veteranStatus: veteranStatus || null,
        disabilityStatus: disabilityStatus || null,
        authorizedCountries: authorizedCountries.length > 0 ? authorizedCountries : ['US'],
        visaStatus,
        requiresSponsorship,
        securityClearance,
      };

      const updated = await profileApi.updateVault(payload, workspaceId);
      onUpdate?.(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save application vault');
    } finally {
      setSaving(false);
    }
  };

  const policies = [
    {
      id: 'decline',
      title: 'Always Decline to State',
      badge: 'Recommended',
      description:
        'Auto-selects "I decline to self-identify" on all voluntary EEO, diversity, and disability forms.',
    },
    {
      id: 'autofill',
      title: 'Auto-fill with Saved Answers',
      badge: 'Fastest',
      description:
        'Fills standard EEO forms using your encrypted answers below to speed through applications.',
    },
    {
      id: 'blank',
      title: 'Leave Blank for Review',
      badge: 'Manual',
      description:
        'Leaves demographic fields untouched so you can manually answer on a per-application basis.',
    },
  ];

  return (
    <Panel className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <span>Application & EEO Vault</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span>🔒</span> Zero-Trust Encrypted
            </span>
          </h2>
          <p className="text-xs text-text-dim mt-0.5">
            Standard ATS compliance vault: Work authorization eligibility and voluntary demographic
            self-identification
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          ✓ Application credentials and demographic vault updated successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Work Authorization */}
        <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
          <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
            1. Work Authorization & Immigration Eligibility
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Authorized Countries (ISO codes or names)
              </label>
              <input
                type="text"
                value={countriesText}
                onChange={(e) => setCountriesText(e.target.value)}
                placeholder="US, CA, UK, IN"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
              <span className="text-2xs text-text-dim mt-0.5 block">
                Countries legally authorized to work in
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Current Immigration / Visa Status
              </label>
              <select
                value={visaStatus}
                onChange={(e) => setVisaStatus(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              >
                <option value="Citizen">Citizen (U.S. / Target Country)</option>
                <option value="Permanent Resident / Green Card">
                  Permanent Resident / Green Card
                </option>
                <option value="H-1B Specialty Occupation">H-1B Specialty Occupation</option>
                <option value="F-1 OPT">F-1 OPT (Post-Completion)</option>
                <option value="F-1 STEM OPT">F-1 STEM OPT (24-Month Extension)</option>
                <option value="TN NAFTA Professional">TN NAFTA Professional (Canada/Mexico)</option>
                <option value="E-3 Australian Specialty">E-3 Australian Specialty</option>
                <option value="L-1 Intracompany Transferee">L-1 Intracompany Transferee</option>
                <option value="O-1 Extraordinary Ability">O-1 Extraordinary Ability</option>
                <option value="Employment Authorization Document (EAD)">
                  Employment Authorization Document (EAD)
                </option>
                <option value="Requires Work Visa">Requires Work Visa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Security Clearance
              </label>
              <select
                value={securityClearance}
                onChange={(e) => setSecurityClearance(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              >
                <option value="None">None</option>
                <option value="Public Trust">Public Trust</option>
                <option value="Confidential">Confidential</option>
                <option value="Secret">Secret</option>
                <option value="Top Secret">Top Secret</option>
                <option value="Top Secret / SCI">Top Secret / SCI</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-border mt-3">
            <input
              type="checkbox"
              id="sponsorship"
              checked={requiresSponsorship}
              onChange={(e) => setRequiresSponsorship(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="sponsorship" className="text-xs font-medium text-text cursor-pointer">
              I now or in the future will require sponsorship for employment visa status (e.g. H-1B
              transfer, green card)
            </label>
          </div>
        </div>

        {/* Section 2: Demographic Policy & Self-ID */}
        <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              2. Voluntary Demographics & EEO-1 Policy
            </h3>
            <span className="text-xs text-text-dim">Federal EEO & Section 503 Survey</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {policies.map((pol) => {
              const selected = demographicsPolicy === pol.id;
              return (
                <div
                  key={pol.id}
                  onClick={() => setDemographicsPolicy(pol.id)}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    selected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface border-border hover:border-border-hover'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-text">{pol.title}</span>
                      <span
                        className={`text-2xs font-medium px-2 py-0.5 rounded-full ${
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-200 text-text-muted border border-border'
                        }`}
                      >
                        {pol.badge}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">{pol.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {demographicsPolicy === 'autofill' && (
            <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Gender Identity
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select or decline...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Decline">Decline to self-identify</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Race / Ethnicity
                </label>
                <select
                  value={ethnicity}
                  onChange={(e) => setEthnicity(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select or decline...</option>
                  <option value="Hispanic or Latino">Hispanic or Latino</option>
                  <option value="White">White (Not Hispanic)</option>
                  <option value="Black or African American">Black or African American</option>
                  <option value="Asian">Asian (Not Hispanic)</option>
                  <option value="Native Hawaiian or Pacific Islander">
                    Native Hawaiian / Pacific Islander
                  </option>
                  <option value="American Indian or Alaska Native">
                    American Indian / Alaska Native
                  </option>
                  <option value="Two or More Races">Two or More Races</option>
                  <option value="Decline">Decline to self-identify</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Veteran Status
                </label>
                <select
                  value={veteranStatus}
                  onChange={(e) => setVeteranStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select or decline...</option>
                  <option value="I am a protected veteran">I am a protected veteran</option>
                  <option value="I am not a protected veteran">I am not a protected veteran</option>
                  <option value="Decline">Decline to self-identify</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Disability Status
                </label>
                <select
                  value={disabilityStatus}
                  onChange={(e) => setDisabilityStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select or decline...</option>
                  <option value="Yes, I have a disability">Yes, I have a disability</option>
                  <option value="No, I do not have a disability">
                    No, I do not have a disability
                  </option>
                  <option value="Decline">Decline to self-identify</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Encrypting & Saving...' : 'Save Application Vault'}
          </button>
        </div>
      </form>
    </Panel>
  );
}
