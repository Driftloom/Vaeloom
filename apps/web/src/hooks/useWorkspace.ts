import useSWR from 'swr';
import { request } from '../lib/api';
import { capabilitiesApi, type SkillListItem } from '../lib/api-client';
import type { Workspace, Agent, Memory, Connector } from '@vaeloom/shared-types';

const fetcher = <T>(url: string) => request<T>(url);

export function useWorkspaces() {
  const { data, error, isLoading, mutate } = useSWR<Workspace[]>('/workspaces', fetcher, {
    revalidateOnFocus: false,
  });

  return {
    workspaces: data ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useWorkspace(workspaceId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Workspace>(
    workspaceId ? `/workspaces/${workspaceId}` : null,
    fetcher,
  );

  return {
    workspace: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useWorkspaceAgents(workspaceId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Agent[]>(
    workspaceId ? `/workspaces/${workspaceId}/agents` : null,
    fetcher,
  );

  return {
    agents: data ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useWorkspaceMemories(workspaceId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Memory[]>(
    workspaceId ? `/workspaces/${workspaceId}/memories` : null,
    fetcher,
  );

  return {
    memories: data ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useWorkspaceConnectors(workspaceId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Connector[]>(
    workspaceId ? `/connectors?workspace_id=${workspaceId}` : null,
    fetcher,
  );

  return {
    connectors: data ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useWorkspaceCapabilities(workspaceId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<SkillListItem[]>(
    workspaceId ? ['workspace-skills', workspaceId] : null,
    () => capabilitiesApi.listSkills(workspaceId!),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  return {
    skills: data ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}
