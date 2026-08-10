import { AGENT_KNOWLEDGE_FILE_CHAR_LIMIT, AGENT_KNOWLEDGE_TOTAL_CHAR_LIMIT } from '@lobechat/const';
import type { FileContent, KnowledgeBaseInfo } from '@lobechat/prompts';
import { promptAgentKnowledge } from '@lobechat/prompts';
import debug from 'debug';

import { BaseFirstUserContentProvider } from '../base/BaseFirstUserContentProvider';
import type { PipelineContext, ProcessorOptions } from '../types';

declare module '../types' {
  interface PipelineContextMetadataOverrides {
    filesCount?: number;
    knowledgeBasesCount?: number;
    /** Characters actually injected for knowledge files, after budgeting */
    knowledgeFileCharsInjected?: number;
    /** Total characters the enabled knowledge files hold, before budgeting */
    knowledgeFileCharsTotal?: number;
    knowledgeInjected?: boolean;
  }
}

const log = debug('context-engine:provider:KnowledgeInjector');

export interface KnowledgeInjectorConfig {
  /**
   * Max characters injected inline per file. Defaults to
   * `AGENT_KNOWLEDGE_FILE_CHAR_LIMIT`; oversized files are clipped and the
   * model is told to read the rest via the Knowledge Base tool.
   */
  fileCharLimit?: number;
  /** File contents to inject */
  fileContents?: FileContent[];
  /** Knowledge bases to inject */
  knowledgeBases?: KnowledgeBaseInfo[];
  /** Max characters injected inline across all files combined */
  totalCharLimit?: number;
}

/**
 * Knowledge Injector
 * Responsible for injecting agent's knowledge (files and knowledge bases) into context
 * before the first user message
 */
export class KnowledgeInjector extends BaseFirstUserContentProvider {
  readonly name = 'KnowledgeInjector';

  constructor(
    private config: KnowledgeInjectorConfig,
    options: ProcessorOptions = {},
  ) {
    super(options);
  }

  protected buildContent(_context: PipelineContext): string | null {
    const fileContents = this.config.fileContents || [];
    const knowledgeBases = this.config.knowledgeBases || [];

    // Generate unified knowledge prompt.
    // NOTE: file content is budgeted here — this block is replayed on every
    // request of the topic, so an unbounded file multiplies the cost of every
    // turn instead of costing once.
    const formattedContent = promptAgentKnowledge({
      fileContents,
      fileCharLimit: this.config.fileCharLimit,
      knowledgeBases,
      totalCharLimit: this.config.totalCharLimit,
    });

    if (!formattedContent) {
      log('No knowledge to inject');
      return null;
    }

    log(
      `Knowledge prepared: ${fileContents.length} file(s), ${knowledgeBases.length} knowledge base(s)`,
    );

    return formattedContent;
  }

  protected async doProcess(context: PipelineContext): Promise<PipelineContext> {
    const result = await super.doProcess(context);

    // Update metadata
    const fileContents = this.config.fileContents || [];
    const knowledgeBases = this.config.knowledgeBases || [];

    if (fileContents.length > 0 || knowledgeBases.length > 0) {
      const fileCharLimit = Math.max(
        this.config.fileCharLimit ?? AGENT_KNOWLEDGE_FILE_CHAR_LIMIT,
        0,
      );
      let remainingChars = Math.max(
        this.config.totalCharLimit ?? AGENT_KNOWLEDGE_TOTAL_CHAR_LIMIT,
        0,
      );
      const charsTotal = fileContents.reduce(
        (sum, file) => sum + Math.max(file.charCount ?? 0, file.content?.length ?? 0),
        0,
      );
      const charsInjected = fileContents.reduce((sum, file) => {
        if (file.error) return sum;

        const injected = Math.min(file.content?.length ?? 0, fileCharLimit, remainingChars);
        remainingChars -= injected;
        return sum + injected;
      }, 0);

      result.metadata.knowledgeInjected = true;
      result.metadata.filesCount = fileContents.length;
      result.metadata.knowledgeBasesCount = knowledgeBases.length;
      result.metadata.knowledgeFileCharsTotal = charsTotal;
      result.metadata.knowledgeFileCharsInjected = charsInjected;
    }

    return result;
  }
}
