/**
 * Карта «показатель отчёта ↔ строка формы 1-ВЛ».
 *
 * Кода строки отчёта в XSD нет — он живёт только в форме из приказа Минприроды
 * России от 18.03.2025 № 112 (приложение № 2). Карта связывает мнемонику
 * справочника ОЗВЛ (reportRate) с номером строки, номером пункта формы,
 * единицей измерения и сносками. Благодаря ей код строки и единица измерения
 * не вводятся человеком и не выдумываются моделью, а берутся из приказа.
 *
 * Колонка `match` фиксирует, как именно показатель НСИ сопоставлен со строкой
 * формы: «точное» — по наименованию, иначе указан способ и мера сходства.
 * Это сделано специально: сопоставление проверяемо, а не принимается на веру.
 */
import { readFileSync } from 'node:fs';

import { norm } from './nsi';
import { measuresCsv } from './paths';

export interface MeasureRow {
  /** Код строки формы отчёта, например «270». */
  codeLine: string;
  /** Сноски формы, влияющие на заполнение примечания. */
  footnotes: string;
  /** Номер пункта формы, например «20.1.1.» — задаёт иерархию «всего/в том числе». */
  itemNo: string;
  /** Как показатель сопоставлен со строкой формы. */
  match: string;
  name: string;
  /** Графа «Примечание» помечена в форме знаком «x» (не заполняется). */
  noteX: boolean;
  /** Мнемоника справочника мероприятий ОЗВЛ. */
  reportRate: string;
  rowNo: number;
  /** Единица измерения формы, как написано в приказе: га, кг, м3, шт., тыс.шт. */
  unitForm: string;
  /** Код единицы измерения по ОКЕИ, например «059» — гектар. */
  unitOkei: string;
}

/** Разбор CSV с поддержкой полей в кавычках (наименования содержат запятые). */
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

/** Родительский номер пункта формы: «20.1.1.» -> «20.1.». */
export const parentItem = (itemNo: string): string | undefined => {
  const parts = itemNo.replaceAll(/^\.|\.$/g, '').split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') + '.' : undefined;
};

export class Measures {
  readonly rows: MeasureRow[] = [];
  private readonly byRate = new Map<string, MeasureRow>();
  private readonly byCode = new Map<string, MeasureRow[]>();
  private readonly byItem = new Map<string, MeasureRow>();

  constructor(file: string = measuresCsv()) {
    const table = parseCsv(readFileSync(file, 'utf8'));
    const header = table.shift();
    if (!header) throw new Error(`Карта строк формы пуста: ${file}`);
    const at = (name: string): number => header.indexOf(name);
    for (const cells of table) {
      if (cells.length < header.length) continue;
      const row: MeasureRow = {
        codeLine: cells[at('code_line')],
        footnotes: cells[at('footnotes')],
        itemNo: cells[at('item_no')],
        match: cells[at('match')],
        name: cells[at('name_nsi')],
        noteX: cells[at('note_x')].trim().length > 0,
        reportRate: cells[at('report_rate')],
        rowNo: Number.parseInt(cells[at('row_no')], 10),
        unitForm: cells[at('unit_form')],
        unitOkei: cells[at('unit_okei')],
      };
      this.rows.push(row);
      if (!this.byRate.has(row.reportRate)) this.byRate.set(row.reportRate, row);
      if (row.codeLine) {
        const bucket = this.byCode.get(row.codeLine);
        if (bucket) bucket.push(row);
        else this.byCode.set(row.codeLine, [row]);
      }
      if (row.itemNo && !this.byItem.has(row.itemNo)) this.byItem.set(row.itemNo, row);
    }
  }

  get size(): number {
    return this.rows.length;
  }

  byReportRate(rate: string): MeasureRow | undefined {
    return this.byRate.get(rate);
  }

  /**
   * Строгий подбор строки формы: мнемоника показателя, код строки, номер пункта
   * или **точное** наименование. Возвращает все подходящие варианты — решение о
   * неоднозначности принимает вызывающий код, чтобы ошибка была явной.
   *
   * Поиска по вхождению подстроки здесь нет намеренно: наименования строк формы
   * различаются одним словом («в том числе…», «из него…»), и мягкое совпадение
   * увело бы объём не в ту строку отчёта.
   */
  find(text: string): MeasureRow[] {
    const raw = text.trim();
    const exactRate = this.byRate.get(raw);
    if (exactRate) return [exactRate];
    const byCode = this.byCode.get(raw);
    if (byCode) return [...byCode];
    const byItem = this.byItem.get(raw);
    if (byItem) return [byItem];
    const q = norm(raw);
    return this.rows.filter((r) => norm(r.name) === q);
  }

  /** Похожие строки формы — для подсказки в тексте ошибки. */
  similar(text: string, limit = 5): MeasureRow[] {
    const q = norm(text.trim());
    return this.rows.filter((r) => norm(r.name).includes(q)).slice(0, limit);
  }
}

let cached: Measures | undefined;

export const measures = (): Measures => {
  cached ??= new Measures();
  return cached;
};
