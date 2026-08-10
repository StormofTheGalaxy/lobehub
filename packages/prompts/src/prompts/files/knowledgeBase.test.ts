import { AGENT_KNOWLEDGE_FILE_CHAR_LIMIT, AGENT_KNOWLEDGE_TOTAL_CHAR_LIMIT } from '@lobechat/const';
import { describe, expect, it } from 'vitest';

import type { FileContent } from '../knowledgeBaseQA';
import type { KnowledgeBaseInfo } from './knowledgeBase';
import { promptAgentKnowledge } from './knowledgeBase';

describe('promptAgentKnowledge', () => {
  it('should return empty string when no files and no knowledge bases', () => {
    const result = promptAgentKnowledge({});
    expect(result).toBe('');
  });

  it('should format only files when no knowledge bases', () => {
    const fileContents: FileContent[] = [
      {
        content: 'This is the content of document 1',
        fileId: 'file1',
        filename: 'doc1.txt',
      },
      {
        content: 'This is the content of document 2',
        fileId: 'file2',
        filename: 'doc2.md',
      },
    ];

    const result = promptAgentKnowledge({ fileContents });
    expect(result).toMatchSnapshot();
  });

  it('should format only knowledge bases when no files', () => {
    const knowledgeBases: KnowledgeBaseInfo[] = [
      {
        description: 'API documentation',
        id: 'kb1',
        name: 'Documentation',
      },
      {
        description: null,
        id: 'kb2',
        name: 'FAQs',
      },
    ];

    const result = promptAgentKnowledge({ knowledgeBases });
    expect(result).toMatchSnapshot();
  });

  it('should format both files and knowledge bases', () => {
    const fileContents: FileContent[] = [
      {
        content: 'File content here',
        fileId: 'file1',
        filename: 'readme.md',
      },
    ];

    const knowledgeBases: KnowledgeBaseInfo[] = [
      {
        description: 'Company knowledge base',
        id: 'kb1',
        name: 'Internal Docs',
      },
    ];

    const result = promptAgentKnowledge({ fileContents, knowledgeBases });
    expect(result).toMatchSnapshot();
  });

  it('should handle file with error', () => {
    const fileContents: FileContent[] = [
      {
        content: '',
        error: 'File not found',
        fileId: 'file1',
        filename: 'missing.txt',
      },
    ];

    const result = promptAgentKnowledge({ fileContents });
    expect(result).toMatchSnapshot();
  });

  it('should handle multiple files and multiple knowledge bases', () => {
    const fileContents: FileContent[] = [
      {
        content: 'Content of first file',
        fileId: 'file1',
        filename: 'first.txt',
      },
      {
        content: 'Content of second file',
        fileId: 'file2',
        filename: 'second.md',
      },
      {
        content: '',
        error: 'Parse error',
        fileId: 'file3',
        filename: 'broken.pdf',
      },
    ];

    const knowledgeBases: KnowledgeBaseInfo[] = [
      {
        description: 'Technical documentation',
        id: 'kb1',
        name: 'Tech Docs',
      },
      {
        description: null,
        id: 'kb2',
        name: 'User Guides',
      },
      {
        description: 'Frequently asked questions',
        id: 'kb3',
        name: 'FAQ Database',
      },
    ];

    const result = promptAgentKnowledge({ fileContents, knowledgeBases });
    expect(result).toMatchSnapshot();
  });

  it('should handle knowledge base without description', () => {
    const knowledgeBases: KnowledgeBaseInfo[] = [
      {
        id: 'kb1',
        name: 'Simple KB',
      },
    ];

    const result = promptAgentKnowledge({ knowledgeBases });
    expect(result).toMatchSnapshot();
  });

  it('should handle file with special characters in filename', () => {
    const fileContents: FileContent[] = [
      {
        content: 'Special content',
        fileId: 'file1',
        filename: 'file with spaces & special-chars.txt',
      },
    ];

    const result = promptAgentKnowledge({ fileContents });
    expect(result).toMatchSnapshot();
  });

  it('should handle file with multiline content', () => {
    const fileContents: FileContent[] = [
      {
        content: `Line 1
Line 2
Line 3

Line 5 with gap`,
        fileId: 'file1',
        filename: 'multiline.txt',
      },
    ];

    const result = promptAgentKnowledge({ fileContents });
    expect(result).toMatchSnapshot();
  });

  describe('char budget', () => {
    it('should clip a file that exceeds the per-file limit', () => {
      const fileContents: FileContent[] = [
        { content: 'a'.repeat(5000), fileId: 'file1', filename: 'big.txt' },
      ];

      const result = promptAgentKnowledge({ fileContents, fileCharLimit: 100 });

      expect(result).toContain('<file id="file1" name="big.txt" chars="5000" injectedChars="100"');
      expect(result).toContain('truncated="true"');
      expect(result).toContain('<truncation_notice>');
      // only the budgeted slice made it in
      expect(result).toContain('a'.repeat(100));
      expect(result).not.toContain('a'.repeat(101));
    });

    it('should report the original size when content was already clipped upstream', () => {
      const fileContents: FileContent[] = [
        // DB handed us a prefix; charCount is the real document size
        { charCount: 5_000_000, content: 'a'.repeat(100), fileId: 'file1', filename: 'huge.csv' },
      ];

      const result = promptAgentKnowledge({ fileContents, fileCharLimit: 100 });

      expect(result).toContain(
        '<file id="file1" name="huge.csv" chars="5000000" injectedChars="100"',
      );
      expect(result).toContain('<truncation_notice>');
    });

    it('should list files by name only once the total budget is spent', () => {
      const fileContents: FileContent[] = [
        { content: 'a'.repeat(100), fileId: 'file1', filename: 'first.txt' },
        { content: 'b'.repeat(100), fileId: 'file2', filename: 'second.txt' },
      ];

      const result = promptAgentKnowledge({
        fileContents,
        fileCharLimit: 100,
        totalCharLimit: 100,
      });

      // first file fits and is injected whole
      expect(result).toContain(`<file id="file1" name="first.txt">\n${'a'.repeat(100)}\n</file>`);
      // second file is advertised but carries no content
      expect(result).toContain(
        '<file id="file2" name="second.txt" chars="100" injectedChars="0" truncated="true" />',
      );
      expect(result).not.toContain('b'.repeat(100));
    });

    it('should count truncated files against the total budget', () => {
      const fileContents: FileContent[] = [
        { content: 'a'.repeat(100), fileId: 'file1', filename: 'first.txt' },
        { content: 'b'.repeat(100), fileId: 'file2', filename: 'second.txt' },
        { content: 'c'.repeat(100), fileId: 'file3', filename: 'third.txt' },
        { content: 'd'.repeat(100), fileId: 'file4', filename: 'fourth.txt' },
      ];

      const result = promptAgentKnowledge({
        fileCharLimit: 100,
        fileContents,
        totalCharLimit: 250,
      });

      expect(result).toContain(
        `<file id="file3" name="third.txt" chars="100" injectedChars="50" truncated="true">`,
      );
      expect(result).toContain(
        '<file id="file4" name="fourth.txt" chars="100" injectedChars="0" truncated="true" />',
      );
      expect(result).toContain('c'.repeat(50));
      expect(result).not.toContain('c'.repeat(51));
      expect(result).not.toContain('d'.repeat(100));
    });

    it('should not add a truncation notice when everything fits', () => {
      const fileContents: FileContent[] = [
        { content: 'small', fileId: 'file1', filename: 'small.txt' },
      ];

      const result = promptAgentKnowledge({ fileContents });

      expect(result).not.toContain('<truncation_notice>');
      expect(result).not.toContain('truncated="true"');
    });

    it('should keep errored files intact regardless of budget', () => {
      const fileContents: FileContent[] = [
        { content: '', error: 'File not found', fileId: 'file1', filename: 'missing.txt' },
      ];

      const result = promptAgentKnowledge({ fileContents, totalCharLimit: 0 });

      expect(result).toContain('<file id="file1" name="missing.txt" error="File not found" />');
      expect(result).not.toContain('<truncation_notice>');
    });

    it('should apply a default budget that bounds a multi-megabyte file', () => {
      const fileContents: FileContent[] = [
        { content: 'a'.repeat(5_000_000), fileId: 'file1', filename: 'huge.txt' },
      ];

      const result = promptAgentKnowledge({ fileContents });

      expect(result.length).toBeLessThan(AGENT_KNOWLEDGE_TOTAL_CHAR_LIMIT + 2000);
      expect(result).toContain('chars="5000000"');
      expect(result).toContain(`injectedChars="${AGENT_KNOWLEDGE_FILE_CHAR_LIMIT}"`);
    });
  });
});
