/**
 * Фасад движка: сборка, проверка и миграция отчёта 1-ВЛ.
 *
 * Главное правило, ради которого всё это устроено именно так: **файл отчёта
 * появляется на диске только если он прошёл проверку по официальной XSD-схеме**.
 * Сборка идёт во временный файл, и только успешная валидация переносит его в
 * целевой путь. Невалидный документ не может «утечь» дальше по процессу.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { BuildError, Builder } from './build';
import { type AttachmentFacts, factsOf } from './files';
import { ERROR, type FileResolver, type Finding, Linter } from './lint';
import { measures } from './measures';
import {
  DICTIONARIES,
  type DictionaryName,
  DICTIONARY_NAMES,
  dictionary,
  type Entry,
} from './nsi';
import { COMMON_VERSION, mainXsd, SCHEMA_VERSION } from './paths';
import { type AttachmentSource, expand, InputError, type ReportInput } from './report';
import { Schema } from './schema';
import { findAll, parseXml, stripBom, type XmlNode } from './xml';

export { BuildError } from './build';
export { type AttachmentFacts, factsOf } from './files';
export { ERROR, type Finding, INFO, WARN } from './lint';
export { type MeasureRow } from './measures';
export { DICTIONARIES, type DictionaryName, DICTIONARY_NAMES } from './nsi';
export { type AttachmentSource, InputError, type ReportInput, type ReportRowInput } from './report';

let cachedSchema: Schema | undefined;

/** Схема читается один раз на процесс: разбор 22 файлов заметно дороже поиска. */
export const schema = (): Schema => {
  cachedSchema ??= new Schema(mainXsd());
  return cachedSchema;
};

export interface Verification {
  findings: Finding[];
  /** Готов ли документ к подписанию и подаче: валиден и без ошибок уровня ОШИБКА. */
  ready: boolean;
  schemaVersion: string;
  xsd: { available: boolean; errors: string[]; valid: boolean };
}

export interface BuildResult extends Verification {
  /** Вложения, прошедшие проверку и подлежащие выдаче вместе с XML. */
  attachmentFiles?: Map<string, Buffer>;
  /** Путь к записанному файлу; отсутствует, если путь не задан или документ не валиден. */
  file?: string;
  log: string[];
  /** Размер документа в байтах. */
  size?: number;
  /**
   * Текст готового документа — только если он прошёл проверку по XSD.
   *
   * Возвращается, чтобы вызывающий слой мог отдать файл пользователю на
   * скачивание, не завися от файловой системы сервера. Невалидный документ
   * сюда не попадает: наружу не должно уходить ничего непроверенного.
   */
  xml?: string;
}

const UTF8_BOM = '﻿';

const verify = async (
  xmlPath: string,
  xmlText: string,
  resolveFile: FileResolver | undefined,
): Promise<Verification> => {
  const s = schema();
  const xsd = await s.validate(xmlPath);
  const findings: Finding[] = xsd.valid
    ? new Linter(measures(), resolveFile).check(parseXml(xmlText))
    : [];
  return {
    findings,
    ready: xsd.valid && !findings.some((f) => f.level === ERROR),
    schemaVersion: s.version,
    xsd,
  };
};

/**
 * Собирает отчёт из прикладных данных и записывает XML.
 *
 * Порядок шагов принципиален: раскрытие по форме -> сборка по схеме ->
 * валидация -> смысловые проверки. Файл записывается между третьим и четвёртым
 * шагом, поэтому невалидного файла не существует ни секунды.
 */
export const buildReport = async (options: {
  /** Источник байтов вложений помимо диска: файлы из переписки. */
  attachmentSource?: AttachmentSource;
  filesDir?: string;
  /** Куда записать файл. Необязателен: документ всегда возвращается и текстом. */
  outputPath?: string;
  report: ReportInput;
}): Promise<BuildResult> => {
  const filesDir =
    options.filesDir ??
    (options.outputPath ? path.dirname(path.resolve(options.outputPath)) : process.cwd());
  const { attachmentFiles, document, facts, log } = await expand(
    options.report,
    measures(),
    filesDir,
    options.attachmentSource,
  );

  const builder = new Builder(schema());
  const xml = builder.build('forestReproduction', document);
  const full = [...log, ...builder.log.map((line) => `справочник → ${line}`)];

  // BOM обязателен: именно так документ выгружает портал и так он подписывается
  const text = UTF8_BOM + xml;
  const staging = path.join(
    tmpdir(),
    `fgislk-${Date.now()}-${Math.random().toString(36).slice(2)}.xml`,
  );
  writeFileSync(staging, text, 'utf8');
  try {
    // проверяются ровно те байты, по которым посчитан MD5 при сборке
    const result = await verify(staging, text, (uri) => facts.get(uri));
    if (!result.xsd.valid) {
      rmSync(staging, { force: true });
      return { ...result, log: full };
    }
    let target: string | undefined;
    if (options.outputPath) {
      target = path.resolve(options.outputPath);
      mkdirSync(path.dirname(target), { recursive: true });
      renameSync(staging, target);
    } else {
      rmSync(staging, { force: true });
    }
    return {
      ...result,
      attachmentFiles,
      file: target,
      log: full,
      size: Buffer.byteLength(text, 'utf8'),
      xml: text,
    };
  } catch (error) {
    rmSync(staging, { force: true });
    throw error;
  }
};

/**
 * Собирает сведения о вложениях для проверки готового документа: сначала диск,
 * затем файлы из переписки. Читается один раз, байты не удерживаются в памяти.
 */
const collectFacts = async (
  root: XmlNode,
  filesDir: string | undefined,
  source: AttachmentSource | undefined,
): Promise<FileResolver | undefined> => {
  if (!filesDir && !source) return undefined;
  const facts = new Map<string, AttachmentFacts>();
  for (const node of findAll(root, 'fileURI')) {
    const name = node.text.trim();
    if (!name || facts.has(name)) continue;
    const onDisk = filesDir ? path.join(filesDir, name) : undefined;
    const content =
      onDisk && existsSync(onDisk) ? readFileSync(onDisk) : await source?.(name);
    if (content) facts.set(name, factsOf(name, content));
  }
  return (uri) => facts.get(uri);
};

/** Проверка любого готового XML — в том числе выгруженного из портала. */
export const checkReport = async (options: {
  attachmentSource?: AttachmentSource;
  filesDir?: string;
  xmlPath: string;
}): Promise<Verification & { documentNamespace: string; file: string }> => {
  const file = path.resolve(options.xmlPath);
  const text = readFileSync(file, 'utf8');
  const resolver = await collectFacts(
    parseXml(stripBom(text)),
    options.filesDir,
    options.attachmentSource,
  );
  const result = await verify(file, text, resolver);
  let documentNamespace = '';
  try {
    documentNamespace = parseXml(stripBom(text)).ns;
  } catch {
    documentNamespace = '';
  }
  return { ...result, documentNamespace, file };
};

/** Перевод документа на актуальные версии пространств имён. */
export const migrateReport = async (options: {
  attachmentSource?: AttachmentSource;
  filesDir?: string;
  outputPath: string;
  xmlPath: string;
}): Promise<BuildResult & { documentNamespace: string }> => {
  const source = readFileSync(path.resolve(options.xmlPath), 'utf8');
  const hadBom = source.codePointAt(0) === 0xfe_ff;
  const { log, text } = schema().migrate(stripBom(source));
  const output = (hadBom ? UTF8_BOM : '') + text;
  const target = path.resolve(options.outputPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, output, 'utf8');
  const resolver = await collectFacts(
    parseXml(stripBom(output)),
    options.filesDir,
    options.attachmentSource,
  );
  const result = await verify(target, output, resolver);
  if (!result.xsd.valid) rmSync(target, { force: true });
  return {
    ...result,
    documentNamespace: parseXml(stripBom(output)).ns,
    file: result.xsd.valid ? target : undefined,
    log: log.length > 0 ? log : ['документ уже на актуальных версиях пространств имён'],
    size: result.xsd.valid ? Buffer.byteLength(output, 'utf8') : undefined,
  };
};

export interface DictionaryHit extends Entry {
  dictionary: DictionaryName;
  dictionaryTitle: string;
}

/** Поиск кода в справочнике по наименованию или коду. */
export const searchDictionary = (options: {
  dictionary: DictionaryName;
  limit?: number;
  query: string;
}): { hits: DictionaryHit[]; size: number; title: string } => {
  const dict = dictionary(options.dictionary);
  const hits = dict.lookup(options.query, options.limit ?? 10).map((entry) => ({
    ...entry,
    dictionary: options.dictionary,
    dictionaryTitle: dict.title,
  }));
  return { hits, size: dict.size, title: dict.title };
};

/** Строка формы отчёта по мнемонике, коду строки, пункту или наименованию. */
export const findReportLine = (query: string, limit = 5) => measures().find(query).slice(0, limit);

/** Состав комплекта: версии схемы и справочников. Нужен для отчёта о готовности. */
export const environment = () => {
  const s = schema();
  return {
    commonVersion: COMMON_VERSION,
    dictionaries: DICTIONARY_NAMES.map((name) => ({
      name,
      size: dictionary(name).size,
      title: DICTIONARIES[name].title,
    })),
    documentNamespace: s.targetNs,
    reportLines: measures().size,
    schemaVersion: s.version,
    supportedSchemaVersion: SCHEMA_VERSION,
    xsd: s.mainXsd,
  };
};

/** Ошибка ввода прикладного слоя — экспортируется для точной обработки в UI. */
export const isInputError = (error: unknown): error is InputError => error instanceof InputError;
export const isBuildError = (error: unknown): error is BuildError => error instanceof BuildError;
