'use client';

import React, { useState } from 'react';
import { ProjectEntry, ProfileData, profileApi } from '@/lib/api-client';

interface PortfolioShowcaseProps {
  projects: ProjectEntry[];
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function PortfolioShowcase({
  projects = [],
  workspaceId,
  onUpdate,
}: PortfolioShowcaseProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [techText, setTechText] = useState('');
  const [metricsSummary, setMetricsSummary] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [featured, setFeatured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAdd = () => {
    setEditId(null);
    setTitle('');
    setTagline('');
    setDescription('');
    setTechText('');
    setMetricsSummary('');
    setLiveUrl('');
    setGithubUrl('');
    setFeatured(true);
    setError(null);
    setIsEditing(true);
  };

  const openEdit = (proj: ProjectEntry) => {
    setEditId(proj.id || proj.title);
    setTitle(proj.title);
    setTagline(proj.tagline || '');
    setDescription(proj.description || '');
    setTechText((proj.technologies || []).join(', '));
    setMetricsSummary(proj.metricsSummary || '');
    setLiveUrl(proj.liveUrl || '');
    setGithubUrl(proj.githubUrl || '');
    setFeatured(proj.featured ?? true);
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !title.trim() || !description.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const technologies = techText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: title.trim(),
        tagline: tagline.trim() || null,
        description: description.trim(),
        technologies,
        metricsSummary: metricsSummary.trim() || null,
        liveUrl: liveUrl.trim() || null,
        githubUrl: githubUrl.trim() || null,
        featured,
      };

      let updated: ProfileData;
      if (editId) {
        updated = await profileApi.updateProject(editId, payload, workspaceId);
      } else {
        updated = await profileApi.addProject(payload, workspaceId);
      }
      setIsEditing(false);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projId: string, projTitle: string) => {
    if (!workspaceId) return;
    if (!window.confirm(`Are you sure you want to remove ${projTitle} from your projects?`)) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await profileApi.deleteProject(projId, workspaceId);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <span>Featured Projects & Artifacts</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-surface-200 text-text-muted border border-border">
              {projects.length}
            </span>
          </h2>
          <p className="text-xs text-text-dim mt-0.5">
            Demonstrable technical artifacts, live applications, and open-source contributions
          </p>
        </div>
        {workspaceId && !isEditing && (
          <button
            onClick={openAdd}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-surface-200 hover:bg-surface-hover text-text border border-border transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Project
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {error}
        </div>
      )}

      {isEditing && (
        <form
          onSubmit={handleSave}
          className="mb-6 p-4 rounded-xl border border-border bg-surface-200 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-text">
              {editId ? 'Edit Project' : 'Add Showcase Project'}
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-text-muted hover:text-text text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Project Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Vector Search Engine"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Tagline / One-liner
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Sub-millisecond ANN search across 10M embeddings"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Description *</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the architectural problem solved, key design choices, and technical depth..."
              className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Technologies / Stack (comma separated)
              </label>
              <input
                type="text"
                value={techText}
                onChange={(e) => setTechText(e.target.value)}
                placeholder="e.g. Rust, PyO3, SIMD, Tokio, Docker"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Quantified Impact / Metrics
              </label>
              <input
                type="text"
                value={metricsSummary}
                onChange={(e) => setMetricsSummary(e.target.value)}
                placeholder="e.g. Reduced p99 latency from 45ms to 3.8ms"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Live Demo URL
              </label>
              <input
                type="url"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                GitHub Repository URL
              </label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="featured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="featured" className="text-xs text-text-muted cursor-pointer">
              Feature prominently on candidate portfolio exports
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface hover:bg-surface-hover text-text border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : editId ? 'Update Project' : 'Add Project'}
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 && !isEditing ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl">
          <p className="text-text-muted text-sm mb-3">
            Add open-source projects, system designs, or live products to provide verifiable
            evidence for hiring teams
          </p>
          {workspaceId && (
            <button
              onClick={openAdd}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add First Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj, idx) => (
            <div
              key={proj.id || idx}
              className="group p-4 rounded-xl bg-surface-200 border border-border hover:border-border-hover transition-colors flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-text">{proj.title}</h3>
                    {proj.tagline && <p className="text-xs text-text-dim mt-0.5">{proj.tagline}</p>}
                  </div>
                  {workspaceId && (
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(proj)}
                        className="p-1 rounded text-text-muted hover:text-text hover:bg-surface transition-colors"
                        title="Edit project"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(proj.id || proj.title, proj.title)}
                        className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-surface transition-colors"
                        title="Delete project"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-text-muted line-clamp-3">{proj.description}</p>

                {proj.metricsSummary && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-mono">
                    ⚡ {proj.metricsSummary}
                  </div>
                )}

                {proj.technologies && proj.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {proj.technologies.map((tech, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface border border-border text-text-muted font-mono"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-3 mt-3 border-t border-border">
                {proj.liveUrl && (
                  <a
                    href={proj.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Live Demo</span>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                  </a>
                )}
                {proj.githubUrl && (
                  <a
                    href={proj.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-muted hover:text-text flex items-center gap-1 font-medium"
                  >
                    <span>GitHub</span>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
