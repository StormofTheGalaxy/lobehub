import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';

import type { AgentPresetConfig, AgentPresetItem, AgentPresetStatus } from '../schemas';
import { agentPresets } from '../schemas';
import type { LobeChatDatabase } from '../type';

export interface AgentPresetListItem {
  avatar: string | null;
  backgroundColor: string | null;
  category: string | null;
  description: string | null;
  featured: boolean;
  id: string;
  identifier: string;
  status?: AgentPresetStatus;
  tags: string[];
  title: string;
}

export interface AgentPresetDetail extends AgentPresetListItem {
  config: AgentPresetConfig;
  editorData: unknown;
}

const DEFAULT_PRESETS: AgentPresetDetail[] = [
  {
    avatar: '📊',
    backgroundColor: '#EAF3FF',
    category: 'operations',
    config: {
      avatar: '📊',
      backgroundColor: '#EAF3FF',
      description: 'Analyzes internal PDFs, calculations, and operational documents.',
      openingMessage:
        'Send me a calculation, policy, or PDF excerpt. I will summarize the key numbers, risks, and next actions.',
      openingQuestions: [
        'Summarize this calculation PDF',
        'Find the risks in this estimate',
        'Create an executive summary',
      ],
      systemRole:
        'You are Acensus Operations Analyst. Help employees interpret calculations, PDFs, internal policies, and operational documents. Be precise, cite assumptions, and separate facts from recommendations.',
      tags: ['analysis', 'pdf', 'operations'],
      title: 'Operations Analyst',
    } as AgentPresetConfig,
    description: 'Analyzes internal PDFs, calculations, and operational documents.',
    editorData: null,
    featured: true,
    id: 'system:operations-analyst',
    identifier: 'operations-analyst',
    tags: ['analysis', 'pdf', 'operations'],
    title: 'Operations Analyst',
  },
  {
    avatar: '🧾',
    backgroundColor: '#FFF4E6',
    category: 'finance',
    config: {
      avatar: '🧾',
      backgroundColor: '#FFF4E6',
      description: 'Reviews estimates, invoices, and finance-related calculations.',
      openingMessage:
        'Share the numbers or file context. I will check consistency, explain deltas, and prepare a concise finance note.',
      openingQuestions: [
        'Check this estimate for inconsistencies',
        'Explain the budget variance',
        'Draft a finance approval note',
      ],
      systemRole:
        'You are Acensus Finance Reviewer. Review estimates, invoices, calculation PDFs, and finance notes. Highlight inconsistencies, missing assumptions, approval risks, and concise recommendations.',
      tags: ['finance', 'estimates', 'review'],
      title: 'Finance Reviewer',
    } as AgentPresetConfig,
    description: 'Reviews estimates, invoices, and finance-related calculations.',
    editorData: null,
    featured: true,
    id: 'system:finance-reviewer',
    identifier: 'finance-reviewer',
    tags: ['finance', 'estimates', 'review'],
    title: 'Finance Reviewer',
  },
  {
    avatar: '🛠️',
    backgroundColor: '#EEFBEF',
    category: 'support',
    config: {
      avatar: '🛠️',
      backgroundColor: '#EEFBEF',
      description:
        'Helps employees answer procedural and support questions from the company knowledge base.',
      openingMessage:
        'Ask a process or support question. I will answer using company context and tell you when something needs escalation.',
      openingQuestions: [
        'Where do I find the latest procedure?',
        'Draft a customer response from this policy',
        'What should I escalate?',
      ],
      systemRole:
        'You are Acensus Employee Support Copilot. Answer internal process, support, and policy questions. Prefer company knowledge base context. If context is missing, ask for it or state the uncertainty.',
      tags: ['support', 'knowledge-base', 'process'],
      title: 'Employee Support Copilot',
    } as AgentPresetConfig,
    description: 'Answers employee process and support questions from company knowledge.',
    editorData: null,
    featured: true,
    id: 'system:employee-support',
    identifier: 'employee-support',
    tags: ['support', 'knowledge-base', 'process'],
    title: 'Employee Support Copilot',
  },
];

const toListItem = (preset: AgentPresetItem | AgentPresetDetail): AgentPresetListItem => ({
  avatar: preset.avatar,
  backgroundColor: preset.backgroundColor,
  category: preset.category,
  description: preset.description,
  featured: preset.featured,
  id: preset.id,
  identifier: preset.identifier,
  status: (preset as AgentPresetItem).status ?? 'published',
  tags: preset.tags ?? [],
  title: preset.title,
});

const toDetail = (preset: AgentPresetItem): AgentPresetDetail => ({
  ...toListItem(preset),
  config: preset.config,
  editorData: preset.editorData,
});

export class AgentPresetModel {
  private db: LobeChatDatabase;
  private workspaceId?: string;

  constructor(db: LobeChatDatabase, workspaceId?: string) {
    this.db = db;
    this.workspaceId = workspaceId;
  }

  private visibility = () =>
    this.workspaceId
      ? or(isNull(agentPresets.workspaceId), eq(agentPresets.workspaceId, this.workspaceId))
      : isNull(agentPresets.workspaceId);

  getDetail = async (idOrIdentifier: string): Promise<AgentPresetDetail | null> => {
    const systemPreset = DEFAULT_PRESETS.find(
      (preset) => preset.id === idOrIdentifier || preset.identifier === idOrIdentifier,
    );
    if (systemPreset) return systemPreset;

    const row = await this.db.query.agentPresets.findFirst({
      where: and(
        this.visibility(),
        eq(agentPresets.status, 'published'),
        or(eq(agentPresets.id, idOrIdentifier), eq(agentPresets.identifier, idOrIdentifier)),
      ),
    });

    return row ? toDetail(row) : null;
  };

  /** Admin getter — fetch by id ignoring status (для редактирования черновиков). */
  getAdminDetail = async (id: string): Promise<AgentPresetDetail | null> => {
    const row = await this.db.query.agentPresets.findFirst({
      where: and(this.visibility(), eq(agentPresets.id, id)),
    });
    return row ? toDetail(row) : null;
  };

  listPublished = async (): Promise<AgentPresetListItem[]> => {
    const rows = await this.db.query.agentPresets.findMany({
      orderBy: [desc(agentPresets.featured), asc(agentPresets.title)],
      where: and(this.visibility(), eq(agentPresets.status, 'published')),
    });

    const items = rows.map(toListItem);
    const existingIdentifiers = new Set(items.map((item) => item.identifier));
    const defaults = DEFAULT_PRESETS.filter(
      (item) => !existingIdentifiers.has(item.identifier),
    ).map(toListItem);

    return [...defaults, ...items];
  };

  /** Admin list — все статусы, без системных пресетов. */
  listAll = async (): Promise<AgentPresetListItem[]> => {
    const rows = await this.db.query.agentPresets.findMany({
      orderBy: [desc(agentPresets.featured), asc(agentPresets.title)],
      where: this.visibility(),
    });
    return rows.map(toListItem);
  };

  create = async (input: {
    avatar?: string | null;
    backgroundColor?: string | null;
    category?: string | null;
    config: AgentPresetConfig;
    createdBy?: string | null;
    description?: string | null;
    editorData?: unknown;
    featured?: boolean;
    identifier: string;
    status?: AgentPresetStatus;
    tags?: string[];
    title: string;
  }): Promise<AgentPresetItem> => {
    const [row] = await this.db
      .insert(agentPresets)
      .values({
        avatar: input.avatar ?? null,
        backgroundColor: input.backgroundColor ?? null,
        category: input.category ?? null,
        config: input.config,
        createdBy: input.createdBy ?? null,
        description: input.description ?? null,
        editorData: input.editorData ?? null,
        featured: input.featured ?? false,
        identifier: input.identifier,
        publishedAt: input.status === 'published' ? new Date() : null,
        status: input.status ?? 'draft',
        tags: input.tags ?? [],
        title: input.title,
        updatedBy: input.createdBy ?? null,
        workspaceId: this.workspaceId ?? null,
      })
      .returning();
    return row;
  };

  update = async (
    id: string,
    patch: Partial<{
      avatar: string | null;
      backgroundColor: string | null;
      category: string | null;
      config: AgentPresetConfig;
      description: string | null;
      editorData: unknown;
      featured: boolean;
      identifier: string;
      status: AgentPresetStatus;
      tags: string[];
      title: string;
      updatedBy: string | null;
    }>,
  ): Promise<AgentPresetItem | null> => {
    const next: Record<string, unknown> = { ...patch };
    if (patch.status === 'published') next.publishedAt = new Date();

    const [row] = await this.db
      .update(agentPresets)
      .set(next)
      .where(and(this.visibility(), eq(agentPresets.id, id)))
      .returning();
    return row ?? null;
  };

  delete = async (id: string): Promise<boolean> => {
    const result = await this.db
      .delete(agentPresets)
      .where(and(this.visibility(), eq(agentPresets.id, id)))
      .returning({ id: agentPresets.id });
    return result.length > 0;
  };
}

export const systemAgentPresets = DEFAULT_PRESETS;
