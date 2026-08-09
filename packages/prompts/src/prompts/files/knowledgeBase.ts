import { AGENT_KNOWLEDGE_FILE_CHAR_LIMIT, AGENT_KNOWLEDGE_TOTAL_CHAR_LIMIT } from '@lobechat/const';

import type { FileContent } from '../knowledgeBaseQA';

export interface KnowledgeBaseInfo {
  description?: string | null;
  id: string;
  name: string;
}

export interface PromptKnowledgeOptions {
  /** File contents to inject */
  fileContents?: FileContent[];
  /**
   * Max characters injected inline for a single file.
   * @default AGENT_KNOWLEDGE_FILE_CHAR_LIMIT
   */
  fileCharLimit?: number;
  /** Knowledge bases to include */
  knowledgeBases?: KnowledgeBaseInfo[];
  /**
   * Max characters injected inline across all files combined.
   * @default AGENT_KNOWLEDGE_TOTAL_CHAR_LIMIT
   */
  totalCharLimit?: number;
}

/** How a file ended up being rendered, used to build the instruction block. */
type FileRenderMode = 'full' | 'truncated' | 'omitted';

interface RenderedFile {
  mode: FileRenderMode;
  xml: string;
}

/**
 * Total size of a file's content. `charCount` is the size of the ORIGINAL
 * document — the data layer may already have truncated `content` before it got
 * here, so `content.length` alone would under-report and make a clipped file
 * look complete.
 */
const fullCharCount = (file: FileContent): number =>
  Math.max(file.charCount ?? 0, file.content?.length ?? 0);

/**
 * Formats a single file, clipping its content to `budget` characters.
 *
 * A clipped file keeps its `id` so the model can fetch the rest through the
 * Knowledge Base tool, and advertises `chars` / `injectedChars` so it can
 * judge how much it is missing instead of assuming it saw everything.
 */
const formatFileContent = (file: FileContent, budget: number): RenderedFile => {
  if (file.error)
    return {
      mode: 'full',
      xml: `<file id="${file.fileId}" name="${file.filename}" error="${file.error}" />`,
    };

  const charCount = fullCharCount(file);

  // No budget left at all: advertise the file without paying for its content.
  if (budget <= 0)
    return {
      mode: 'omitted',
      xml: `<file id="${file.fileId}" name="${file.filename}" chars="${charCount}" injectedChars="0" truncated="true" />`,
    };

  const content = file.content ?? '';

  if (content.length <= budget && charCount <= budget)
    return {
      mode: 'full',
      xml: `<file id="${file.fileId}" name="${file.filename}">
${content}
</file>`,
    };

  return {
    mode: 'truncated',
    xml: `<file id="${file.fileId}" name="${file.filename}" chars="${charCount}" injectedChars="${budget}" truncated="true">
${content.slice(0, budget)}
</file>`,
  };
};

/**
 * Format agent knowledge (files + knowledge bases) as unified XML prompt.
 *
 * File content is injected under a character budget: this block lands in the
 * first user message and is therefore replayed on every request of the topic,
 * so an unbounded file would multiply the cost of every single turn (and blow
 * past the context window of small models). See `@lobechat/const/knowledge`.
 */
export const promptAgentKnowledge = ({
  fileContents = [],
  fileCharLimit = AGENT_KNOWLEDGE_FILE_CHAR_LIMIT,
  knowledgeBases = [],
  totalCharLimit = AGENT_KNOWLEDGE_TOTAL_CHAR_LIMIT,
}: PromptKnowledgeOptions) => {
  const hasFiles = fileContents.length > 0;
  const hasKnowledgeBases = knowledgeBases.length > 0;

  // If no knowledge at all, return empty
  if (!hasFiles && !hasKnowledgeBases) {
    return '';
  }

  const contentParts: string[] = [];

  // Render files first: the instruction depends on whether anything got clipped.
  let remaining = totalCharLimit;
  let clipped = false;
  const renderedFiles = fileContents.map((file) => {
    const budget = Math.min(fileCharLimit, remaining);
    const rendered = formatFileContent(file, budget);

    if (rendered.mode !== 'full') clipped = true;
    else remaining -= file.content?.length ?? 0;

    return rendered;
  });

  // Add instruction based on what's available
  if (hasFiles && hasKnowledgeBases) {
    contentParts.push(
      '<instruction>The following files and knowledge bases are available. For files, refer to their content directly. For knowledge bases, use the searchKnowledgeBase tool to find relevant information.</instruction>',
    );
  } else if (hasFiles) {
    contentParts.push(
      '<instruction>The following files are available. Refer to their content directly to answer questions. No knowledge bases are associated.</instruction>',
    );
  } else {
    contentParts.push(
      '<instruction>The following knowledge bases are available for semantic search. Use the searchKnowledgeBase tool to find relevant information.</instruction>',
    );
  }

  if (clipped) {
    contentParts.push(
      `<truncation_notice>Files marked truncated="true" are too large to include in full — only the first injectedChars of chars are shown (files with injectedChars="0" are listed by name only). Do NOT assume the omitted part is empty or irrelevant. When the answer may depend on it, retrieve the rest on demand with the Knowledge Base tool: readKnowledge with the file id, or searchKnowledgeBase to locate the relevant passage. If that tool is not available to you, say so instead of answering from the partial content.</truncation_notice>`,
    );
  }

  // Add files section
  if (hasFiles) {
    const filesXml = renderedFiles.map((file) => file.xml).join('\n');
    contentParts.push(`<files totalCount="${fileContents.length}">
${filesXml}
</files>`);
  }

  // Add knowledge bases section
  if (hasKnowledgeBases) {
    const kbItems = knowledgeBases
      .map(
        (kb) =>
          `<knowledge_base id="${kb.id}" name="${kb.name}"${kb.description ? ` description="${kb.description}"` : ''} />`,
      )
      .join('\n');
    contentParts.push(`<knowledge_bases totalCount="${knowledgeBases.length}">
${kbItems}
</knowledge_bases>`);
  }

  return `<agent_knowledge>
${contentParts.join('\n')}
</agent_knowledge>`;
};
