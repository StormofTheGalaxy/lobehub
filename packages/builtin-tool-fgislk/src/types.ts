import type { DictionaryName } from './engine/dictionaries';
import type { Finding, MeasureRow, ReportInput } from './engine';

export const FgisLkIdentifier = 'lobe-fgislk';

export const FgisLkApiName = {
  buildReport: 'buildReport',
  checkReport: 'checkReport',
  describeEnvironment: 'describeEnvironment',
  findReportLine: 'findReportLine',
  migrateReport: 'migrateReport',
  searchDictionary: 'searchDictionary',
} as const;

export type FgisLkApiNameType = (typeof FgisLkApiName)[keyof typeof FgisLkApiName];

// ── searchDictionary ─────────────────────────────────────────────────────────

export interface SearchDictionaryParams {
  dictionary: DictionaryName;
  limit?: number;
  query: string;
}

export interface SearchDictionaryState {
  dictionary?: DictionaryName;
  hits?: { code: string; name: string }[];
  query?: string;
  /** Всего значений в справочнике — показывает масштаб поиска. */
  size?: number;
  title?: string;
}

// ── findReportLine ───────────────────────────────────────────────────────────

export interface FindReportLineParams {
  limit?: number;
  query: string;
}

export interface FindReportLineState {
  lines?: MeasureRow[];
  query?: string;
}

// ── buildReport ──────────────────────────────────────────────────────────────

export interface BuildReportParams {
  /** Каталог с файлами вложений. */
  filesDir?: string;
  /**
   * Необязательный путь для записи на диск сервера. Обычно не нужен: готовый
   * документ отдаётся ссылкой на скачивание.
   */
  outputPath?: string;
  report: ReportInput;
}

/** Общая часть результата проверки — одинакова для сборки, проверки и миграции. */
export interface VerificationState {
  findings?: Finding[];
  ready?: boolean;
  schemaVersion?: string;
  xsdAvailable?: boolean;
  xsdErrors?: string[];
  xsdValid?: boolean;
}

/** Ссылка на скачивание готового документа. */
export interface DownloadState {
  /** Постоянная ссылка вида /f/:id. */
  downloadUrl?: string;
  fileId?: string;
  filename?: string;
}

export interface BuildReportState extends VerificationState, DownloadState {
  /** Путь на диске сервера, если он был задан явно. */
  file?: string;
  log?: string[];
  rows?: number;
  size?: number;
}

// ── checkReport ──────────────────────────────────────────────────────────────

export interface CheckReportParams {
  filesDir?: string;
  xmlPath: string;
}

export interface CheckReportState extends VerificationState {
  documentNamespace?: string;
  file?: string;
}

// ── migrateReport ────────────────────────────────────────────────────────────

export interface MigrateReportParams {
  filesDir?: string;
  outputPath: string;
  xmlPath: string;
}

export interface MigrateReportState extends VerificationState, DownloadState {
  documentNamespace?: string;
  file?: string;
  log?: string[];
}

// ── describeEnvironment ──────────────────────────────────────────────────────

export type DescribeEnvironmentParams = Record<string, never>;

export interface DescribeEnvironmentState {
  commonVersion?: string;
  dictionaries?: { name: string; size: number; title: string }[];
  reportLines?: number;
  schemaVersion?: string;
}
