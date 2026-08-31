/**
 * Прикладной слой отчёта 1-ВЛ: из «человеческого» ввода — в структуру схемы.
 *
 * Модель или оператор описывает выполненные работы в простом виде: мероприятие
 * названием или кодом строки, порода названием, участок учётными номерами ГЛР,
 * файлы — именами. Здесь это разворачивается в структуру, точно повторяющую XSD:
 *
 *   * <codeLine>   — код строки формы отчёта, из карты приказа № 112;
 *   * <unitType>   — единица измерения этой же строки формы (код ОКЕИ);
 *   * <numberLine> — сквозная нумерация строк документа;
 *   * <attachments>— идентификаторы, имена файлов и MD5 (base64);
 *   * <fileID>     — ссылки из фотофиксации на идентификаторы вложений.
 *
 * Ничего из перечисленного не выдумывается: код строки и единица измерения
 * берутся из формы, MD5 считается по файлу, ссылки проверяются на существование.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { type DocumentData } from './build';
import { type AttachmentFacts, factsOf } from './files';
import { type Measures, type MeasureRow } from './measures';

export class InputError extends Error {}

/**
 * Проверка состава полей на прикладном уровне.
 *
 * Ниже, при сборке по XSD, лишнее поле уже вызовет ошибку. Но прикладной ввод
 * до схемы не доходит: опечатка `organisation` вместо `organization` означала бы
 * не «лишнее поле», а молча пустой раздел реквизитов. Поэтому состав полей
 * проверяется здесь же, на входе.
 *
 * Ключи, начинающиеся с подчёркивания, разрешены как комментарии к данным.
 */
const assertKeys = (value: unknown, allowed: readonly string[], where: string): void => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new InputError(`${where}: ожидался объект с полями`);
  const unknown = Object.keys(value).filter(
    (key) => !key.startsWith('_') && !allowed.includes(key),
  );
  if (unknown.length > 0)
    throw new InputError(
      `${where}: неизвестные поля ${JSON.stringify(unknown.sort())}. ` +
        `Допустимы: ${JSON.stringify([...allowed])}. Проверьте написание — ` +
        `иначе данные молча не попадут в отчёт.`,
    );
};

const REPORT_KEYS = [
  'attachments', 'authority', 'contract', 'date', 'forestry', 'guid', 'landCategory',
  'organization', 'period', 'provider', 'rows', 'signer', 'subject',
] as const;
const ROW_KEYS = [
  'comment', 'location', 'measure', 'photoFixation', 'tree', 'treeAbbr', 'unit', 'value', 'year',
] as const;
const LOCATION_KEYS = ['quarter', 'subforestry', 'taxationUnit', 'tract'] as const;
const PHOTO_KEYS = ['cs', 'datetime', 'files', 'name', 'points'] as const;
const ATTACHMENT_KEYS = ['desc', 'file'] as const;

export interface PhotoPoint {
  lat: number | string;
  lon: number | string;
  n: number | string;
}

export interface PhotoFixation {
  /** Система координат; по умолчанию WGS 84 (EPSG:4326). */
  cs?: string;
  /** Дата и время съёмки в формате 2025-09-29T18:02:00. */
  datetime?: string;
  files: string[];
  name?: string;
  points?: PhotoPoint[];
}

export interface ReportRowInput {
  comment?: string;
  location: {
    quarter?: string;
    subforestry?: string;
    taxationUnit?: string;
    tract?: string;
  };
  /** Мнемоника показателя, код строки формы, номер пункта формы или наименование. */
  measure: string;
  photoFixation?: PhotoFixation;
  tree?: string;
  treeAbbr?: string;
  /** Код ОКЕИ; обычно не указывается — берётся из формы. */
  unit?: string;
  value: number | string;
  year?: number | string;
}

export interface AttachmentInput {
  desc?: string;
  /**
   * Имя файла. Ищется сначала в каталоге вложений на диске, затем среди файлов,
   * загруженных пользователем в переписку.
   */
  file: string;
}

/**
 * Источник байтов вложения помимо диска — файлы, загруженные пользователем.
 *
 * Вынесен интерфейсом, потому что движок не должен знать про хранилище
 * приложения: сервер передаёт сюда реализацию, а в тестах её нет вовсе.
 */
export type AttachmentSource = (name: string) => Promise<Buffer | undefined>;

export interface ReportInput {
  attachments?: AttachmentInput[];
  authority: string;
  contract: Record<string, unknown>;
  date: string;
  forestry: string;
  guid?: string;
  landCategory?: string;
  organization: Record<string, unknown>;
  period: { begin: string; end: string };
  provider?: string;
  rows: ReportRowInput[];
  signer: Record<string, unknown>;
  subject: string;
}

export interface ExpandResult {
  document: DocumentData;
  /** Имя файла в документе -> сведения, посчитанные по его байтам. */
  facts: Map<string, AttachmentFacts>;
  log: string[];
}

const describeVariants = (rows: MeasureRow[]): string =>
  rows
    .slice(0, 6)
    .map(
      (m) =>
        `код строки ${m.codeLine || '—'} (пункт ${m.itemNo || '—'}, ${m.unitForm}) ${m.name}`,
    )
    .join('; ');

/** Выбор строки формы по вводу пользователя. Неоднозначность — всегда ошибка. */
const pickMeasure = (row: ReportRowInput, index: number, measures: Measures): MeasureRow => {
  const found = measures.find(row.measure);
  if (found.length === 0) {
    const similar = measures.similar(row.measure);
    const hint =
      similar.length > 0 ? ` Похожие строки формы: ${describeVariants(similar)}.` : '';
    throw new InputError(
      `строка ${index}: мероприятие «${row.measure}» не найдено — ни мнемоника справочника, ` +
        `ни код строки, ни номер пункта, ни точное наименование из формы не совпали.${hint}`,
    );
  }
  // единица измерения помогает развести строки формы с одинаковым кодом
  const narrowed =
    row.unit && found.length > 1
      ? found.filter((m) => m.unitOkei === row.unit || m.unitForm === row.unit)
      : found;
  const candidates = narrowed.length > 0 ? narrowed : found;
  const rates = new Set(candidates.map((m) => m.reportRate));
  if (rates.size > 1)
    throw new InputError(
      `строка ${index}: «${row.measure}» подходит нескольким показателям отчёта — ` +
        `укажите код строки, номер пункта формы или мнемонику вместо наименования. ` +
        `Варианты: ${describeVariants(candidates)}`,
    );
  const measure = candidates[0];
  if (!measure.codeLine)
    throw new InputError(
      `строка ${index}: у показателя «${measure.name}» в приказе № 112 не указан код строки — ` +
        `этот показатель нельзя подать в составе отчёта, уточните порядок в поддержке ФГИС ЛК`,
    );
  return measure;
};

/** Разворачивает прикладной ввод в структуру документа по схеме. */
export const expand = async (
  source: ReportInput,
  measures: Measures,
  filesDir: string,
  attachmentSource?: AttachmentSource,
): Promise<ExpandResult> => {
  assertKeys(source, REPORT_KEYS, 'отчёт');
  const log: string[] = [];
  const guid = source.guid ?? randomUUID();

  // ── вложения: идентификатор + MD5 по файлу ─────────────────────────────────
  const attachments: DocumentData[] = [];
  const byFileName = new Map<string, string>();
  const facts = new Map<string, AttachmentFacts>();
  for (const [i, item] of (source.attachments ?? []).entries()) {
    assertKeys(item, ATTACHMENT_KEYS, `вложение ${i + 1}`);
    const name = path.basename(item.file);
    const onDisk = path.isAbsolute(item.file) ? item.file : path.resolve(filesDir, item.file);

    // сначала диск сервера, затем файлы, загруженные пользователем в переписку
    let content: Buffer | undefined;
    let origin = '';
    if (existsSync(onDisk)) {
      content = readFileSync(onDisk);
      origin = onDisk;
    } else if (attachmentSource) {
      content = await attachmentSource(name);
      origin = 'загружен в переписку';
    }
    if (!content)
      throw new InputError(
        `вложение «${item.file}» не найдено: его нет ни на диске (${onDisk}), ` +
          `ни среди файлов, загруженных в переписку. Приложите файл к сообщению ` +
          `или укажите верное имя.`,
      );

    const id = `ID_${randomUUID()}`;
    byFileName.set(name, id);
    const attachmentFacts = factsOf(name, content);
    facts.set(name, attachmentFacts);
    attachments.push({
      desc: item.desc ?? name.replace(path.extname(name), ''),
      file: { fileURI: name, md5sum: attachmentFacts.md5 },
      id,
    });
    log.push(
      `вложение ${name} (${origin}): id=${id}, md5=${attachmentFacts.md5}, ` +
        `${attachmentFacts.size} байт` +
        (attachmentFacts.image
          ? `, ${attachmentFacts.image.width}x${attachmentFacts.image.height}`
          : ''),
    );
  }

  // ── строки мероприятий ─────────────────────────────────────────────────────
  const rows: DocumentData[] = [];
  for (const [i, row] of (source.rows ?? []).entries()) {
    const index = i + 1;
    assertKeys(row, ROW_KEYS, `строка ${index}`);
    if (row.location) assertKeys(row.location, LOCATION_KEYS, `строка ${index}, местоположение`);
    if (row.photoFixation)
      assertKeys(row.photoFixation, PHOTO_KEYS, `строка ${index}, фотофиксация`);
    const measure = pickMeasure(row, index, measures);
    log.push(
      `строка ${index}: «${row.measure}» → показатель ${measure.reportRate}, ` +
        `код строки ${measure.codeLine}, ед. изм. ${measure.unitOkei} (${measure.unitForm}), ` +
        `пункт формы ${measure.itemNo || '—'}`,
    );

    const location = row.location ?? {};
    const built: DocumentData = {
      codeLine: measure.codeLine,
      numberLine: String(index),
      reportRate: measure.reportRate,
      typeLocation: {
        choice: { taxationUnit: location.taxationUnit ?? null },
        quarter: location.quarter ?? null,
        subforestry: location.subforestry ?? null,
        tract: location.tract ?? null,
      },
      unitType: row.unit ?? measure.unitOkei,
      value: String(row.value),
      year: row.year === undefined ? null : String(row.year),
    };
    if (row.tree) built.tree = { abbreviation: row.treeAbbr ?? null, tree: row.tree };
    const notes = buildNotes(row, byFileName, index, log);
    if (notes) built.notes = notes;
    rows.push(built);
  }

  const document: DocumentData = {
    attachments: { attachment: attachments },
    date: source.date,
    forest: { forestry: source.forestry, reproduction: { row: rows } },
    header: {
      categoryLand: source.landCategory ?? null,
      contract: source.contract as DocumentData,
      executiveAuthority: source.authority,
      partner: { Organization: source.organization as DocumentData },
      period: source.period as unknown as DocumentData,
      signerData: source.signer as DocumentData,
      subject: source.subject,
    },
    ID: guid,
    serviceInfo: { guid, provider: source.provider ?? null },
  };

  return { document, facts, log };
};

const buildNotes = (
  row: ReportRowInput,
  byFileName: Map<string, string>,
  index: number,
  log: string[],
): DocumentData | undefined => {
  const photo = row.photoFixation;
  if (!row.comment && !photo) return undefined;
  // По схеме comment в блоке примечаний обязателен, поэтому фотофиксация без
  // примечания собраться не может. Говорим об этом прямо: иначе наружу уйдёт
  // «обязательный элемент не заполнен» с путём по XSD, из которого не понять,
  // что требуется от человека. Придумывать текст за пользователя нельзя —
  // примечание попадает в государственный отчёт.
  if (!row.comment)
    throw new InputError(
      `строка ${index}: к фотофиксации нужно примечание — по схеме элемент comment ` +
        `обязателен, если у строки есть примечания. Заполните поле comment: обычно там ` +
        `номер и дата документа о качестве семян или о происхождении посадочного материала.`,
    );
  const notes: DocumentData = { comment: row.comment };
  if (!photo) return notes;

  const ids: string[] = [];
  for (const name of photo.files ?? []) {
    const id = byFileName.get(path.basename(name));
    if (!id)
      throw new InputError(
        `строка ${index}: файл фотофиксации «${name}» не описан в разделе attachments`,
      );
    ids.push(id);
  }
  const content: DocumentData = {
    dateContent: photo.datetime ?? null,
    fileID: ids,
    nameContent: photo.name ?? 'Материалы фотофиксации',
  };
  if (photo.points && photo.points.length > 0)
    content.coordinateContent = {
      CsCode: photo.cs ?? 'wgs84Epsg4326',
      explication: {
        row: photo.points.map((p) => ({
          latitude: String(p.lat),
          longitude: String(p.lon),
          numberPoint: String(p.n),
        })),
      },
    };
  notes.content = content;
  log.push(
    `строка ${index}: фотофиксация — ${ids.length} файл(ов), ` +
      `${photo.points?.length ?? 0} поворотных точек`,
  );
  return notes;
};
