'use client';

import React, { useState } from 'react';
import { ProjectEntry, ProfileData, profileApi } from '@/lib/api-client';
import { Panel } from '@/components/shared/Panel';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  Badge,
  Button,
  EditIcon,
  ExternalLinkIcon,
  IconButton,
  PlusIcon,
  TrashIcon,
} from '@vaeloom/ui-kit';

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const updated = editId
        ? await profileApi.updateProject(editId, payload, workspaceId)
        : await profileApi.addProject(payload, workspaceId);
      setIsEditing(false);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !workspaceId) return;
    setDeleting(true);
    try {
      const updated = await profileApi.deleteProject(deleteTarget.id, workspaceId);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Project"
        message={`Are you sure you want to remove "${deleteTarget?.title}" from your portfolio?`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="danger"
        loading={deleting}
      />

      <Panel className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              Featured Projects &amp; Artifacts
              <Badge variant="default" size="sm">
                {projects.length}
              </Badge>
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              Demonstrable technical artifacts, live applications, and open-source contributions
            </p>
          </div>
          {workspaceId && !isEditing && (
            <Button variant="secondary" size="sm" onClick={openAdd}>
              <PlusIcon size={13} className="mr-1.5" />
              Add Project
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-error/10 border border-error/20 text-xs text-error">
            {error}
          </div>
        )}

        {isEditing && (
          <form
            onSubmit={handleSave}
            className="mb-6 p-4 rounded-xl border border-border bg-background space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-text">
                {editId ? 'Edit Project' : 'Add Showcase Project'}
              </h3>
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
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
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
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
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Description *
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the architectural problem solved, key design choices, and technical depth..."
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary resize-y"
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
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
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
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
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
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
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
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
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

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={loading}>
                {editId ? 'Update Project' : 'Add Project'}
              </Button>
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
              <Button variant="primary" size="sm" onClick={openAdd}>
                <PlusIcon size={13} className="mr-1.5" />
                Add First Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj, idx) => (
              <div
                key={proj.id || idx}
                className="group p-4 rounded-xl bg-background border border-border hover:border-border-hover transition-colors flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-text">{proj.title}</h3>
                      {proj.tagline && (
                        <p className="text-xs text-text-dim mt-0.5">{proj.tagline}</p>
                      )}
                    </div>
                    {workspaceId && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton
                          aria-label="Edit project"
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(proj)}
                        >
                          <EditIcon size={13} />
                        </IconButton>
                        <IconButton
                          aria-label="Delete project"
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({ id: proj.id || proj.title, title: proj.title })
                          }
                        >
                          <TrashIcon size={13} />
                        </IconButton>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-text-muted line-clamp-3">{proj.description}</p>

                  {proj.metricsSummary && (
                    <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-xs text-success font-mono">
                      ⚡ {proj.metricsSummary}
                    </div>
                  )}

                  {proj.technologies && proj.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {proj.technologies.map((tech, tIdx) => (
                        <Badge key={tIdx} variant="mono" size="sm">
                          {tech}
                        </Badge>
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
                      <ExternalLinkIcon size={12} />
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
                      <ExternalLinkIcon size={12} />
                    </a>
                  )}
                  {proj.featured && (
                    <Badge variant="primary" size="sm" className="ml-auto">
                      Featured
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
