import {
  getNavigationGroups,
  hasDynamicSegments,
  resolveBreadcrumb,
  resolveRoute,
  WORKSPACE_ROUTES,
} from './route-manifest';

describe('route-manifest dynamic detail routes', () => {
  it('flags subpaths that declare a [param] segment', () => {
    expect(hasDynamicSegments('capabilities/skills/[skillId]')).toBe(true);
    expect(hasDynamicSegments('capabilities/skills')).toBe(false);
  });

  it('resolves breadcrumbs for a concrete skill id instead of the prefix fallback', () => {
    expect(resolveBreadcrumb('/workspace/ws-1/capabilities/skills/ats-audit')).toEqual({
      section: 'Assist',
      title: 'Skill Detail',
    });
  });

  it('resolves the manifest route for a concrete skill id', () => {
    const route = resolveRoute('/workspace/ws-1/capabilities/skills/ats-audit');
    expect(route?.id).toBe('capability-skill');
    expect(route?.dataMode).toBe('live');
  });

  it('keeps dynamic routes out of every static navigation surface', () => {
    const dynamicIds = WORKSPACE_ROUTES.filter((r) => hasDynamicSegments(r.subpath)).map(
      (r) => r.id,
    );
    expect(dynamicIds.length).toBeGreaterThan(0);

    const links = getNavigationGroups('ws-1').flatMap((g) => g.links);
    expect(links.some((link) => link.path.includes('['))).toBe(false);
    expect(links.filter((link) => dynamicIds.includes(link.id))).toEqual([]);
  });
});
