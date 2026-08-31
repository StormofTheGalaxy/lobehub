/**
 * Смысловые проверки отчёта, которых нет в XSD.
 *
 * XSD проверяет форму: состав, порядок, типы, принадлежность значений
 * справочникам. Она не знает ни формы отчёта из приказа, ни арифметики
 * «всего / в том числе», ни требований к фотофиксации, ни того, что учётные
 * номера ГЛР вложены иерархически. Всё это — здесь.
 *
 * Источники правил:
 *   приказ Минприроды России от 18.03.2025 № 112:
 *     — приложение № 2 (форма): коды строк, единицы измерения, сноски;
 *     — сноска <3>: площадь — 4 знака после запятой, масса и количество — 1 знак;
 *     — сноски <4>, <5>: в примечании указываются номер и дата документа
 *       о качестве семян / о происхождении посадочного материала;
 *     — приложение № 3 (порядок), п. 6: не более 12 точек фотофиксации;
 *     — приложение № 3 (порядок), п. 7: JPEG не менее 5 Мпикс.
 *   структура учётных номеров ГЛР:
 *     27 -> 27:19 -> 27:19:4 -> 27:19:4:19 -> 27:19:4:19:17.
 */
import { existsSync } from 'node:fs';

import {
  addDecimal,
  compareDecimal,
  type Decimal,
  formatDecimal,
  parseDecimal,
  ZERO,
} from './decimal';
import { jpegSize, md5Base64 } from './files';
import { type Measures, parentItem } from './measures';
import { child, children, findAll, textOf, type XmlNode } from './xml';

export const ERROR = 'ОШИБКА';
export const WARN = 'ПРЕДУПРЕЖДЕНИЕ';
export const INFO = 'СПРАВОЧНО';

export type FindingLevel = typeof ERROR | typeof INFO | typeof WARN;

export interface Finding {
  level: FindingLevel;
  text: string;
  where: string;
}

const MIN_MEGAPIXELS = 5;
const MAX_PHOTO_POINTS = 12;

/** Допустимое число знаков после запятой по сноске <3> формы. */
const DECIMALS: Record<string, number> = {
  'га': 4,
  'кг': 1,
  'м3': 1,
  'тыс.шт.': 1,
  'шт.': 1,
};

/**
 * Как найти файл вложения по его имени в документе.
 *
 * При сборке отчёта карта строится из фактически прочитанных путей, поэтому
 * проверяются ровно те файлы, по которым посчитан MD5. При проверке чужого XML
 * функция ищет файл в указанном каталоге. Если файлов нет — проверка вложений
 * не выполняется и об этом честно сообщается, а не «молча проходит».
 */
export type FileResolver = (fileUri: string) => string | undefined;

interface RowFacts {
  code?: string;
  item?: string;
  key?: string;
  value?: Decimal;
  where: string;
}

export class Linter {
  private readonly measures: Measures;
  private readonly resolveFile: FileResolver | undefined;
  private out: Finding[] = [];

  constructor(measures: Measures, resolveFile?: FileResolver) {
    this.measures = measures;
    this.resolveFile = resolveFile;
  }

  private add(level: FindingLevel, where: string, text: string): void {
    this.out.push({ level, text, where });
  }

  check(root: XmlNode): Finding[] {
    this.out = [];
    const header = child(root, 'header');
    const rows = findAll(root, 'row').filter((r) => child(r, 'reportRate') !== undefined);
    const attachments = this.checkAttachments(root);
    this.checkDates(root, header, rows);
    this.checkRegistryNumbers(root, header);
    const facts = rows.map((row, index) => this.checkRow(row, index + 1));
    this.checkHierarchy(facts);
    this.checkFiles(root, attachments);
    return this.sorted();
  }

  private sorted(): Finding[] {
    const order: Record<FindingLevel, number> = { [ERROR]: 0, [INFO]: 2, [WARN]: 1 };
    return [...this.out].sort(
      (a, b) => order[a.level] - order[b.level] || a.where.localeCompare(b.where, 'ru'),
    );
  }

  // ── вложения ───────────────────────────────────────────────────────────────

  private checkAttachments(root: XmlNode): Map<string, string> {
    const out = new Map<string, string>();
    for (const attachment of findAll(root, 'attachment')) {
      const id = textOf(attachment, 'id');
      const uri = textOf(child(attachment, 'file'), 'fileURI');
      if (out.has(id))
        this.add(ERROR, 'attachments', `повторяющийся идентификатор вложения ${id}`);
      out.set(id, uri);
    }
    const used = new Set(findAll(root, 'fileID').map((n) => n.text.trim()));
    for (const ref of [...used].filter((r) => !out.has(r)).sort())
      this.add(ERROR, 'notes/fileID', `ссылка на несуществующее вложение ${ref}`);
    for (const unused of [...out.keys()].filter((id) => !used.has(id)).sort())
      this.add(INFO, 'attachments', `вложение ${out.get(unused)} не привязано ни к одной строке`);
    return out;
  }

  private checkFiles(root: XmlNode, _attachments: Map<string, string>): void {
    if (this.resolveFile) {
      for (const attachment of findAll(root, 'attachment')) {
        const fileNode = child(attachment, 'file');
        if (!fileNode) continue;
        const uri = textOf(fileNode, 'fileURI');
        const declared = textOf(fileNode, 'md5sum');
        const file = this.resolveFile(uri);
        if (!file || !existsSync(file)) {
          this.add(ERROR, 'attachments', `файл не найден: ${uri}`);
          continue;
        }
        const actual = md5Base64(file);
        if (declared && actual !== declared)
          this.add(
            ERROR,
            'attachments',
            `${uri}: MD5 в описи ${declared}, фактический ${actual}`,
          );
        if (/\.jpe?g$/i.test(uri)) {
          const size = jpegSize(file);
          if (!size) this.add(ERROR, 'attachments', `${uri}: файл не является JPEG`);
          else {
            const megapixels = (size.width * size.height) / 1e6;
            if (megapixels < MIN_MEGAPIXELS)
              this.add(
                ERROR,
                'attachments',
                `${uri}: ${size.width}x${size.height} = ${megapixels.toFixed(1)} Мпикс, ` +
                  `требуется не менее ${MIN_MEGAPIXELS} (п. 7 Порядка, приказ № 112)`,
              );
          }
        }
      }
    }
    for (const content of findAll(root, 'content'))
      for (const explication of findAll(content, 'explication')) {
        const points = children(explication, 'row').length;
        if (points > MAX_PHOTO_POINTS)
          this.add(
            ERROR,
            'notes/content',
            `${points} точек фотофиксации, допускается не более ${MAX_PHOTO_POINTS} ` +
              `(п. 6 Порядка, приказ № 112)`,
          );
      }
  }

  // ── строка отчёта ──────────────────────────────────────────────────────────

  private checkRow(row: XmlNode, index: number): RowFacts {
    const where = `строка ${index}`;
    const rate = textOf(row, 'reportRate');
    const code = textOf(row, 'codeLine');
    const unit = textOf(row, 'unitType');
    const rawValue = textOf(row, 'value');
    const measure = this.measures.byReportRate(rate);
    if (!measure) {
      this.add(
        WARN,
        where,
        `показатель ${rate} отсутствует в карте строк формы — проверьте версию приказа`,
      );
      return { where };
    }
    if (code !== measure.codeLine)
      this.add(
        ERROR,
        where,
        `код строки ${code} не соответствует показателю «${measure.name}» — ` +
          `по форме это ${measure.codeLine}`,
      );
    if (unit && measure.unitOkei && unit !== measure.unitOkei)
      this.add(
        ERROR,
        where,
        `единица измерения ${unit} не соответствует форме: для строки ` +
          `${measure.codeLine} это ${measure.unitOkei} (${measure.unitForm})`,
      );
    this.checkPrecision(where, rawValue, measure.unitForm);

    const notes = child(row, 'notes');
    const comment = notes ? textOf(notes, 'comment') : '';
    const needDoc = [...new Set(measure.footnotes)].filter((f) => f === '4' || f === '5');
    if (needDoc.length > 0 && !comment) {
      const what = needDoc.includes('4')
        ? 'о качестве семян'
        : 'о происхождении посадочного материала';
      this.add(
        WARN,
        where,
        `по сноске <${needDoc.sort().join('')}> формы в примечании указываются номер и дата ` +
          `документа ${what} — примечание пустое`,
      );
    }
    if (measure.noteX && comment)
      this.add(
        INFO,
        where,
        `в форме по строке ${measure.codeLine} графа «Примечание» помечена «x» ` +
          `(не заполняется), но примечание заполнено`,
      );

    const location = child(row, 'typeLocation');
    const choice = child(location, 'choice');
    const key = location
      ? [
          textOf(location, 'subforestry'),
          textOf(location, 'quarter'),
          choice ? textOf(choice, 'taxationUnit') : '',
          textOf(row, 'year'),
        ].join('|')
      : undefined;

    const value = parseDecimal(rawValue);
    if (!value) this.add(ERROR, where, `значение «${rawValue}» не является числом`);

    return { code: measure.codeLine, item: measure.itemNo, key, value, where };
  }

  private checkPrecision(where: string, value: string, unitForm: string): void {
    const limit = DECIMALS[unitForm];
    if (limit === undefined || !value.includes('.')) return;
    const fraction = value.split('.')[1] ?? '';
    const digits = fraction.replace(/0+$/, '').length || fraction.length;
    if (digits > limit)
      this.add(
        ERROR,
        where,
        `значение ${value}: для «${unitForm}» допускается ${limit} знак(ов) после запятой ` +
          `(сноска <3> формы)`,
      );
  }

  // ── арифметика «всего / в том числе» ───────────────────────────────────────

  private checkHierarchy(facts: RowFacts[]): void {
    const groups = new Map<string, Map<string, RowFacts>>();
    for (const fact of facts) {
      if (!fact.item || !fact.value || fact.key === undefined) continue;
      const group = groups.get(fact.key) ?? new Map<string, RowFacts>();
      group.set(fact.item, fact);
      groups.set(fact.key, group);
    }
    for (const group of groups.values()) {
      for (const [item, fact] of group) {
        const parentKey = parentItem(item);
        if (!parentKey) continue;
        const parent = group.get(parentKey);
        if (!parent) {
          this.add(
            WARN,
            fact.where,
            `строка ${fact.code} (пункт ${item}) указана без родительской строки формы ` +
              `(пункт ${parentKey}) по тому же выделу`,
          );
          continue;
        }
        if (fact.value && parent.value && compareDecimal(fact.value, parent.value) > 0)
          this.add(
            ERROR,
            fact.where,
            `${formatDecimal(fact.value)} больше значения родительской строки ` +
              `${parent.code} (${formatDecimal(parent.value)}) по тому же выделу`,
          );
      }
      for (const [parentKey, parent] of group) {
        const depth = parentKey.replaceAll(/^\.|\.$/g, '').split('.').length;
        const kids = [...group.entries()].filter(
          ([item]) =>
            item !== parentKey &&
            item.startsWith(parentKey) &&
            item.replaceAll(/^\.|\.$/g, '').split('.').length === depth + 1,
        );
        if (kids.length === 0 || !parent.value) continue;
        let total = ZERO;
        for (const [, kid] of kids) if (kid.value) total = addDecimal(total, kid.value);
        if (compareDecimal(total, parent.value) > 0)
          this.add(
            ERROR,
            parent.where,
            `сумма подчинённых строк (${formatDecimal(total)}) превышает значение строки ` +
              `${parent.code} (${formatDecimal(parent.value)}) по тому же выделу`,
          );
      }
    }
  }

  // ── даты и учётные номера ──────────────────────────────────────────────────

  private checkDates(root: XmlNode, header: XmlNode | undefined, rows: XmlNode[]): void {
    if (!header) return;
    const period = child(header, 'period');
    const begin = period ? textOf(period, 'begin') : '';
    const end = period ? textOf(period, 'end') : '';
    const documentDate = textOf(root, 'date');
    if (begin && end && begin > end)
      this.add(ERROR, 'header/period', `начало периода ${begin} позже окончания ${end}`);
    if (documentDate && end && documentDate < end)
      this.add(
        WARN,
        'date',
        `дата документа ${documentDate} раньше окончания отчётного периода ${end}`,
      );
    for (const [index, row] of rows.entries()) {
      const year = textOf(row, 'year');
      if (year && begin && !(begin.slice(0, 4) <= year && year <= end.slice(0, 4)))
        this.add(
          WARN,
          `строка ${index + 1}`,
          `год выполнения ${year} вне отчётного периода ${begin}…${end}`,
        );
    }
  }

  private checkRegistryNumbers(root: XmlNode, header: XmlNode | undefined): void {
    const subject = header ? textOf(header, 'subject') : '';
    const forest = child(root, 'forest');
    if (!forest) return;
    const forestry = textOf(forest, 'forestry');
    if (subject && forestry && !forestry.startsWith(`${subject}:`))
      this.add(
        ERROR,
        'forest/forestry',
        `учётный номер лесничества ${forestry} не относится к субъекту ${subject}`,
      );
    for (const [index, location] of findAll(forest, 'typeLocation').entries()) {
      const subforestry = textOf(location, 'subforestry');
      const quarter = textOf(location, 'quarter');
      const choice = child(location, 'choice');
      const unit = choice ? textOf(choice, 'taxationUnit') : '';
      const chain: [string, string, string][] = [
        [subforestry, forestry, 'участковое лесничество'],
        [quarter, subforestry, 'квартал'],
        [unit, quarter, 'выдел'],
      ];
      for (const [value, parent, what] of chain)
        if (value && parent && !value.startsWith(`${parent}:`))
          this.add(
            ERROR,
            `строка ${index + 1}`,
            `${what} ${value} не входит в ${parent} ` +
              `(учётные номера ГЛР вложены иерархически)`,
          );
    }
  }
}
