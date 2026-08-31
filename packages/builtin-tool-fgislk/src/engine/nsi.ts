/**
 * Справочники (НСИ) ФГИС ЛК.
 *
 * Все справочники Рослесхоз распространяет прямо в XSD — как перечисления
 * с человекочитаемым описанием:
 *
 *     <xs:enumeration value="100405">
 *       <xs:annotation><xs:documentation>Лиственница даурская</xs:documentation></xs:annotation>
 *     </xs:enumeration>
 *
 * Отсюда два следствия, на которых держится вся работа модели с отчётом:
 *   1) множество допустимых значений известно заранее и проверяется офлайн;
 *   2) код можно искать по наименованию — модель пишет «Лиственница даурская»,
 *      а в XML уходит 100405.
 *
 * Главное правило: если наименование подходит нескольким кодам, поиск не
 * возвращает «самый похожий», а сообщает о неоднозначности. В отчётности
 * угадывать нельзя.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { DICTIONARIES, type DictionaryName } from './dictionaries';
import { commonDir } from './paths';

export { DICTIONARIES, DICTIONARY_NAMES, type DictionaryName } from './dictionaries';

const ENUM_RE =
  /<xs:enumeration value="([^"]+)"\s*>\s*<xs:annotation>\s*<xs:documentation>([\S\s]*?)<\/xs:documentation>/g;

/** Нормализация наименования для поиска: регистр, ё/е, пробелы, кавычки. */
export const norm = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replaceAll(/[«»"'`]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

export interface Entry {
  code: string;
  name: string;
}

export class Dictionary {
  readonly entries: Entry[] = [];
  readonly file: string;
  readonly title: string;
  private readonly byCode = new Map<string, Entry>();
  private readonly byName = new Map<string, Entry[]>();

  constructor(file: string, title: string) {
    this.file = file;
    this.title = title;
    const raw = readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    ENUM_RE.lastIndex = 0;
    while ((match = ENUM_RE.exec(raw)) !== null) {
      // часть справочников хранит наименование как JSON-массив синонимов
      const name = match[2]
        .replaceAll(/\s+/g, ' ')
        .trim()
        .replace(/^\["/, '')
        .replace(/"]$/, '')
        .replaceAll('","', ' / ');
      const entry: Entry = { code: match[1], name };
      this.entries.push(entry);
      if (!this.byCode.has(entry.code)) this.byCode.set(entry.code, entry);
      const key = norm(name);
      const bucket = this.byName.get(key);
      if (bucket) bucket.push(entry);
      else this.byName.set(key, [entry]);
    }
  }

  get size(): number {
    return this.entries.length;
  }

  hasCode(code: string): boolean {
    return this.byCode.has(code);
  }

  nameOf(code: string): string | undefined {
    return this.byCode.get(code)?.name;
  }

  /** Поиск для человека: сначала точные совпадения, затем вхождения подстроки. */
  lookup(query: string, limit = 10): Entry[] {
    const q = norm(query);
    const exact = this.byName.get(q) ?? [];
    const exactSet = new Set(exact);
    const rest = this.entries.filter((e) => !exactSet.has(e) && norm(e.name).includes(q));
    const byCode = this.byCode.get(query.trim());
    const head = byCode && !exactSet.has(byCode) ? [byCode] : [];
    return [...head, ...exact, ...rest].slice(0, limit);
  }

  /**
   * Точное совпадение наименования. Только этот способ допустим при
   * автоматическом подборе кода — см. комментарий к resolveCode.
   */
  exact(query: string): Entry[] {
    return [...(this.byName.get(norm(query)) ?? [])];
  }

  /** Похожие значения — для подсказки человеку, не для подстановки. */
  similar(query: string, limit = 5): Entry[] {
    const q = norm(query);
    return this.entries.filter((e) => norm(e.name).includes(q)).slice(0, limit);
  }
}

export class NsiError extends Error {}
export class AmbiguousError extends NsiError {}
export class NotFoundError extends NsiError {}

const cache = new Map<DictionaryName, Dictionary>();

export const dictionary = (name: DictionaryName): Dictionary => {
  const cached = cache.get(name);
  if (cached) return cached;
  const meta = DICTIONARIES[name];
  const dict = new Dictionary(path.join(commonDir(), meta.file), meta.title);
  cache.set(name, dict);
  return dict;
};

/**
 * Значение справочника: код пропускается как есть, наименование — резолвится.
 *
 * Совпадение только точное. Поиск по вхождению подстроки здесь запрещён
 * сознательно: «Дерево обыкновенное» находится внутри «Земляничное дерево
 * обыкновенное (крупноплодное)», и мягкий поиск молча подставил бы в отчёт
 * совершенно другую породу. Похожие значения показываются в тексте ошибки —
 * выбрать из них должен человек, а не алгоритм.
 */
export const resolveCode = (name: DictionaryName, value: string): string => {
  const dict = dictionary(name);
  const raw = value.trim();
  if (dict.hasCode(raw)) return raw;
  const found = dict.exact(raw);
  if (found.length === 0) {
    const similar = dict.similar(raw);
    const hint =
      similar.length > 0
        ? ` Похожие значения: ${similar.map((e) => `${e.code} — ${e.name}`).join('; ')}. ` +
          `Если нужно одно из них, укажите его код.`
        : '';
    throw new NotFoundError(
      `справочник «${dict.title}»: точного совпадения для «${raw}» нет.${hint}`,
    );
  }
  const codes = new Set(found.map((e) => e.code));
  if (codes.size > 1) {
    const variants = found
      .slice(0, 5)
      .map((e) => `${e.code} — ${e.name}`)
      .join('; ');
    throw new AmbiguousError(
      `справочник «${dict.title}»: «${raw}» подходит нескольким значениям: ${variants}. ` +
        `Укажите код вместо наименования.`,
    );
  }
  return found[0].code;
};
