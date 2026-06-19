import type { AgentPresetDetail, AgentPresetListItem } from '@/database/models/agentPreset';
import { lambdaClient } from '@/libs/trpc/client';

export type AgentPresetStatus = 'draft' | 'published' | 'archived';

export interface AgentPresetUpsertInput {
  avatar?: string | null;
  backgroundColor?: string | null;
  category?: string | null;
  config: Record<string, unknown>;
  description?: string | null;
  editorData?: unknown;
  featured?: boolean;
  identifier: string;
  status?: AgentPresetStatus;
  tags?: string[];
  title: string;
}

class AgentPresetService {
  detail = async (id: string): Promise<AgentPresetDetail> => {
    return lambdaClient.agentPreset.detail.query({ id });
  };

  install = async (id: string): Promise<{ agentId: string }> => {
    return lambdaClient.agentPreset.install.mutate({ id });
  };

  list = async (): Promise<AgentPresetListItem[]> => {
    return lambdaClient.agentPreset.list.query();
  };

  // ---------- Admin ----------
  adminList = async (): Promise<AgentPresetListItem[]> => {
    return lambdaClient.agentPreset.adminList.query();
  };

  adminDetail = async (id: string): Promise<AgentPresetDetail> => {
    return lambdaClient.agentPreset.adminDetail.query({ id });
  };

  adminCreate = async (input: AgentPresetUpsertInput): Promise<{ id: string }> => {
    return lambdaClient.agentPreset.adminCreate.mutate(input as any);
  };

  adminUpdate = async (
    id: string,
    patch: Partial<AgentPresetUpsertInput>,
  ): Promise<{ id: string }> => {
    return lambdaClient.agentPreset.adminUpdate.mutate({ id, patch: patch as any });
  };

  adminSetStatus = async (
    id: string,
    status: AgentPresetStatus,
  ): Promise<{ id: string; status: string }> => {
    return lambdaClient.agentPreset.adminSetStatus.mutate({ id, status });
  };

  adminDelete = async (id: string): Promise<{ ok: boolean }> => {
    return lambdaClient.agentPreset.adminDelete.mutate({ id });
  };
}

export const agentPresetService = new AgentPresetService();
