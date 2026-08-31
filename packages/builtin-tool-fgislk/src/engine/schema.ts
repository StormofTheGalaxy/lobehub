/**
 * Модель XSD-схемы: порядок элементов, обязательность, пространства имён.
 *
 * Ключевая идея решения: структура XML не «зашита» в код генератора, а читается
 * из официальных XSD-схем Рослесхоза. Отсюда три следствия:
 *
 *   * порядок элементов в XML всегда соответствует xs:sequence схемы
 *     (в XSD порядок значим — перестановка делает документ невалидным);
 *   * пространство имён каждого элемента берётся из targetNamespace той схемы,
 *     где элемент объявлен (во всех схемах ФГИС ЛК elementFormDefault="qualified");
 *   * при переходе на новую версию схемы достаточно положить новые XSD —
 *     генератор перестроится сам, править код не нужно.
 *
 * Разбор ограничен конструкциями, которые реально встречаются в схемах ФГИС ЛК:
 * xs:sequence, xs:choice, ссылки на типы, простые типы с перечислениями.
 * Ни xs:extension, ни атрибутов в этих схемах нет.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { parseXml, type XmlNode } from './xml';

const execFileAsync = promisify(execFile);

const XSD_NS = 'http://www.w3.org/2001/XMLSchema';

/** Элемент внутри составного типа. */
export interface Particle {
  /** Элементы одной группы xs:choice взаимоисключающие. */
  choiceGroup: number | undefined;
  maxUnbounded: boolean;
  minOccurs: number;
  name: string;
  /** Пространство имён самого элемента. */
  ns: string;
  typeName: string | undefined;
  /** Пространство имён типа элемента. */
  typeNs: string | undefined;
}

export interface ComplexType {
  name: string | undefined;
  ns: string;
  particles: Particle[];
}

export type TypeRef = readonly [ns: string, name: string];

const refKey = (ref: TypeRef | undefined): string => (ref ? `${ref[0]}|${ref[1]}` : '');

/** Реестр типов всех схем, на которые ссылается основная XSD. */
export class Schema {
  readonly mainXsd: string;
  readonly targetNs: string;
  /** ns -> путь к файлу схемы. */
  readonly files = new Map<string, string>();
  /** элемент -> ссылка на тип. */
  private readonly elements = new Map<string, TypeRef>();
  private readonly enums = new Map<string, Set<string>>();
  private readonly types = new Map<string, ComplexType>();
  private anon = 0;

  constructor(mainXsd: string) {
    this.mainXsd = path.resolve(mainXsd);
    this.load(this.mainXsd, new Set());
    this.targetNs = parseXml(readFileSync(this.mainXsd, 'utf8')).attrs.targetNamespace ?? '';
  }

  // ── разбор XSD ─────────────────────────────────────────────────────────────

  private load(file: string, seen: Set<string>): void {
    const resolved = path.resolve(file);
    if (seen.has(resolved) || !existsSync(resolved)) return;
    seen.add(resolved);

    const root = parseXml(readFileSync(resolved, 'utf8'));
    const ns = root.attrs.targetNamespace ?? '';
    if (!this.files.has(ns)) this.files.set(ns, resolved);

    const prefixes: Record<string, string> = { '': ns };
    for (const [key, value] of Object.entries(root.attrs))
      if (key.startsWith('xmlns:')) prefixes[key.slice(6)] = value;

    for (const node of root.children) {
      if (node.ns !== XSD_NS) continue;
      switch (node.local) {
        case 'complexType': {
          const name = node.attrs.name;
          if (name) this.types.set(refKey([ns, name]), this.complexType(node, ns, prefixes));
          break;
        }
        case 'element': {
          const name = node.attrs.name;
          const ref = this.typeRef(node, ns, prefixes) ?? this.inlineType(node, ns, prefixes);
          if (name && ref) this.elements.set(refKey([ns, name]), ref);
          break;
        }
        case 'import':
        case 'include': {
          const location = node.attrs.schemaLocation;
          if (location) this.load(path.join(path.dirname(resolved), location), seen);
          break;
        }
        case 'simpleType': {
          const name = node.attrs.name;
          if (!name) break;
          const values = new Set<string>();
          for (const enumeration of this.descendants(node, 'enumeration'))
            if (enumeration.attrs.value !== undefined) values.add(enumeration.attrs.value);
          if (values.size > 0) this.enums.set(refKey([ns, name]), values);
          break;
        }
      }
    }
  }

  private *descendants(node: XmlNode, local: string): Generator<XmlNode> {
    for (const c of node.children) {
      if (c.ns === XSD_NS && c.local === local) yield c;
      yield* this.descendants(c, local);
    }
  }

  private qname(
    value: string | undefined,
    ns: string,
    prefixes: Record<string, string>,
  ): TypeRef | undefined {
    if (!value) return undefined;
    const at = value.lastIndexOf(':');
    const prefix = at === -1 ? '' : value.slice(0, at);
    const local = at === -1 ? value : value.slice(at + 1);
    return [prefixes[prefix] ?? ns, local] as const;
  }

  private typeRef(
    node: XmlNode,
    ns: string,
    prefixes: Record<string, string>,
  ): TypeRef | undefined {
    return this.qname(node.attrs.type, ns, prefixes);
  }

  /** Анонимный (вложенный) complexType — регистрируем под служебным именем. */
  private inlineType(
    node: XmlNode,
    ns: string,
    prefixes: Record<string, string>,
  ): TypeRef | undefined {
    const ct = node.children.find((c) => c.ns === XSD_NS && c.local === 'complexType');
    if (!ct) return undefined;
    this.anon += 1;
    const name = `#anon${this.anon}:${node.attrs.name ?? ''}`;
    this.types.set(refKey([ns, name]), this.complexType(ct, ns, prefixes));
    return [ns, name] as const;
  }

  private complexType(ct: XmlNode, ns: string, prefixes: Record<string, string>): ComplexType {
    const out: ComplexType = { name: ct.attrs.name, ns, particles: [] };
    this.walkParticles(ct, ns, prefixes, out, undefined);
    return out;
  }

  private walkParticles(
    node: XmlNode,
    ns: string,
    prefixes: Record<string, string>,
    out: ComplexType,
    choice: number | undefined,
  ): void {
    for (const c of node.children) {
      if (c.ns !== XSD_NS) continue;
      if (c.local === 'sequence') {
        this.walkParticles(c, ns, prefixes, out, choice);
      } else if (c.local === 'choice') {
        this.anon += 1;
        this.walkParticles(c, ns, prefixes, out, this.anon);
      } else if (c.local === 'element') {
        const ref = this.typeRef(c, ns, prefixes) ?? this.inlineType(c, ns, prefixes);
        const name = c.attrs.name ?? (c.attrs.ref ?? '').split(':').pop() ?? '';
        out.particles.push({
          choiceGroup: choice,
          maxUnbounded: c.attrs.maxOccurs === 'unbounded',
          minOccurs: Number.parseInt(c.attrs.minOccurs ?? '1', 10),
          name,
          ns,
          typeName: ref?.[1],
          typeNs: ref?.[0],
        });
      }
    }
  }

  // ── публичный интерфейс ────────────────────────────────────────────────────

  elementType(ns: string, name: string): ComplexType | undefined {
    const ref = this.elements.get(refKey([ns, name]));
    return ref ? this.types.get(refKey(ref)) : undefined;
  }

  complexOf(ref: TypeRef | undefined): ComplexType | undefined {
    return ref ? this.types.get(refKey(ref)) : undefined;
  }

  isComplex(ref: TypeRef | undefined): boolean {
    return Boolean(ref) && this.types.has(refKey(ref));
  }

  enumValues(ref: TypeRef | undefined): Set<string> | undefined {
    return ref ? this.enums.get(refKey(ref)) : undefined;
  }

  /** Короткая версия схемы, например `3.0.7`. */
  get version(): string {
    return this.targetNs.split('/').pop() ?? '';
  }

  // ── валидация по XSD ───────────────────────────────────────────────────────

  /**
   * Проверка документа штатным xmllint (libxml2). Отдельный, независимый от
   * генератора контур: даже если в сборщике ошибка, невалидный документ не
   * пройдёт эту проверку.
   */
  async validate(
    xmlPath: string,
  ): Promise<{ available: boolean; errors: string[]; valid: boolean }> {
    try {
      await execFileAsync('xmllint', ['--noout', '--schema', this.mainXsd, xmlPath], {
        maxBuffer: 8 * 1024 * 1024,
      });
      return { available: true, errors: [], valid: true };
    } catch (error) {
      const err = error as { code?: number | string; stderr?: string };
      if (err.code === 'ENOENT')
        return {
          available: false,
          errors: [
            'xmllint не найден в системе. Установите libxml2 (Linux: apt-get install libxml2-utils; в macOS входит в состав системы) — без него внешняя проверка по XSD не выполняется.',
          ],
          valid: false,
        };
      const lines = (err.stderr ?? '')
        .trim()
        .split('\n')
        .filter((line) => line.trim().length > 0);
      return { available: true, errors: lines, valid: false };
    }
  }

  // ── миграция версий ────────────────────────────────────────────────────────

  /**
   * База URI (без версии) -> актуальный URI из текущего комплекта схем.
   * Пространства имён ФГИС ЛК версионируются в самом URI, поэтому переход между
   * версиями схемы для многих документов сводится к замене URI.
   */
  namespaceMap(): Map<string, string> {
    const out = new Map<string, string>();
    for (const uri of this.files.keys())
      if (uri.includes('/types/')) out.set(uri.slice(0, uri.lastIndexOf('/types/')), uri);
    return out;
  }

  /**
   * Заменяет URI пространств имён на актуальные. Структуру документа не трогает:
   * если между версиями менялся состав элементов, это покажет валидация.
   */
  migrate(xmlText: string): { log: string[]; text: string } {
    const current = this.namespaceMap();
    const log: string[] = [];
    const text = xmlText.replaceAll(
      /xmlns(:[\w.-]+)?="([^"]+)"/g,
      (match, _prefix, uri: string) => {
        if (!uri.includes('/types/')) return match;
        const next = current.get(uri.slice(0, uri.lastIndexOf('/types/')));
        if (!next || next === uri) return match;
        log.push(`${uri} → ${next}`);
        return match.replace(uri, next);
      },
    );
    return { log, text };
  }
}
