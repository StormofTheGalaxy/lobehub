export enum FilesTabs {
  All = 'all',
  Audios = 'audios',
  Documents = 'documents',
  Home = 'home',
  Images = 'images',
  Pages = 'pages',
  Videos = 'videos',
  Websites = 'websites',
}

export enum FileSource {
  ImageGeneration = 'image_generation',
  PageEditor = 'page-editor',
  VideoGeneration = 'video_generation',
}

export interface FileItem {
  /**
   * Character count of the full document behind this file. `content` may hold
   * only a bounded prefix (see `AGENT_KNOWLEDGE_FILE_CHAR_LIMIT`), so this is
   * the field to trust for "how big is it really".
   */
  charCount?: number;
  content?: string;
  createdAt: Date;
  enabled?: boolean;
  id: string;
  name: string;
  size: number;
  source?: FileSource | null;
  type: string;
  updatedAt: Date;
  url: string;
}

export * from './list';
export * from './upload';
