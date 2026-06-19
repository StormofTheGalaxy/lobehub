import { isNotNull, isNull } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamps, timestamptz } from './_helpers';
import type { AgentItem } from './agent';
import { users } from './user';
import { workspaces } from './workspace';

export type AgentPresetStatus = 'draft' | 'published' | 'archived';
export type AgentPresetConfig = Partial<AgentItem> & {
  category?: string;
};

export const agentPresets = pgTable(
  'agent_presets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('agentPresets'))
      .notNull(),
    identifier: varchar('identifier', { length: 120 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    avatar: text('avatar'),
    backgroundColor: text('background_color'),
    tags: jsonb('tags').$type<string[]>().default([]),
    category: varchar('category', { length: 120 }),
    config: jsonb('config').$type<AgentPresetConfig>().notNull(),
    editorData: jsonb('editor_data'),
    status: varchar('status', { length: 20 }).$type<AgentPresetStatus>().default('draft').notNull(),
    featured: boolean('featured').default(false).notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    publishedAt: timestamptz('published_at'),
    ...timestamps,
  },
  (t) => [
    index('agent_presets_status_idx').on(t.status),
    index('agent_presets_workspace_id_idx').on(t.workspaceId),
    index('agent_presets_featured_idx').on(t.featured),
    uniqueIndex('agent_presets_identifier_global_unique')
      .on(t.identifier)
      .where(isNull(t.workspaceId)),
    uniqueIndex('agent_presets_identifier_workspace_unique')
      .on(t.identifier, t.workspaceId)
      .where(isNotNull(t.workspaceId)),
  ],
);

export type AgentPresetItem = typeof agentPresets.$inferSelect;
export type NewAgentPreset = typeof agentPresets.$inferInsert;
