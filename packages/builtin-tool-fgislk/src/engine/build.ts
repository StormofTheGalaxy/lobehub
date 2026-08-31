/**
 * Сборка XML отчёта из структуры данных, управляемая XSD-схемой.
 *
 * Генератор не знает наизусть ни одного элемента отчёта: он идёт по типам из
 * XSD и для каждого элемента берёт значение из входных данных. Отсюда три
 * гарантии, важные именно для отчётности:
 *
 *   * порядок элементов = порядок xs:sequence в схеме;
 *   * обязательные элементы (minOccurs > 0) не могут «потеряться» — будет ошибка;
 *   * незнакомый ключ во входных данных — тоже ошибка, а не молчаливое
 *     игнорирование: опечатка в имени поля не превратится в пропущенные данные.
 *
 * Значения элементов-справочников можно писать наименованием: «Лиственница
 * даурская» превратится в 100405, «Гектар» — в 059. Если наименование подходит
 * нескольким кодам, сборка останавливается.
 */
import { AmbiguousError, type DictionaryName, dictionary, NotFoundError, resolveCode } from './nsi';
import { type ComplexType, type Particle, type Schema, type TypeRef } from './schema';
import { escapeXml } from './xml';

/** Тип-перечисление из XSD -> короткое имя справочника. */
const ENUM_ALIAS: Record<string, DictionaryName> = {
  CategoryLandForestryKindEType: 'land_category',
  ConstituentEntityKindEType: 'subject',
  CoordinateSystemKindEType: 'cs',
  DistrictForestriesKindEType: 'subforestry',
  DocumentTypeKindEType: 'doc_type',
  ForestryKindEType: 'forestry',
  MeasuresOZVLKindEType: 'measures',
  SubordinateAuthorityKindEType: 'authority',
  TreeNewKindEType: 'tree',
  UnitMeasurementKindEType: 'unit',
};

/** Читаемые префиксы пространств имён в готовом XML (вместо d2p1/d3p1). */
const PREFIXES: Record<string, string> = {
  address: 'addr',
  attachment: 'att',
  commonReport: 'rep',
  complex: 'fio',
  document: 'doc',
  subject: 'subj',
};

export class BuildError extends Error {}

export type DocumentValue = string | number | DocumentData | DocumentValue[] | null | undefined;
export interface DocumentData {
  [key: string]: DocumentValue;
}

interface Node {
  children?: Node[];
  name: string;
  ns: string;
  text?: string;
}

export class Builder {
  readonly log: string[] = [];
  private readonly schema: Schema;
  private readonly usedNs = new Set<string>();

  constructor(schema: Schema) {
    this.schema = schema;
  }

  build(rootElement: string, data: DocumentData): string {
    const type = this.schema.elementType(this.schema.targetNs, rootElement);
    if (!type)
      throw new BuildError(
        `в схеме ${this.schema.version} нет корневого элемента «${rootElement}»`,
      );
    const node: Node = {
      children: this.childrenOf(type, data, rootElement),
      name: rootElement,
      ns: this.schema.targetNs,
    };
    return this.render(node);
  }

  // ── обход схемы ────────────────────────────────────────────────────────────

  private childrenOf(type: ComplexType, data: DocumentValue, pathText: string): Node[] {
    if (typeof data !== 'object' || data === null || Array.isArray(data))
      throw new BuildError(`${pathText}: ожидался объект с полями`);
    const allowed = new Set(type.particles.map((p) => p.name));
    const unknown = Object.keys(data).filter((key) => !allowed.has(key));
    if (unknown.length > 0)
      throw new BuildError(
        `${pathText}: неизвестные поля ${JSON.stringify(unknown.sort())}; ` +
          `по схеме допустимы ${JSON.stringify([...allowed])}`,
      );

    const out: Node[] = [];
    for (const particle of type.particles) {
      const value = data[particle.name];
      if (value === undefined || value === null) {
        if (particle.minOccurs > 0 && particle.choiceGroup === undefined)
          throw new BuildError(`${pathText}/${particle.name}: обязательный элемент не заполнен`);
        continue;
      }
      if (particle.maxUnbounded && !Array.isArray(value))
        throw new BuildError(`${pathText}/${particle.name}: ожидался список значений`);
      const items = particle.maxUnbounded ? (value as DocumentValue[]) : [value];
      for (const [index, item] of items.entries()) {
        const sub = `${pathText}/${particle.name}${particle.maxUnbounded ? `[${index + 1}]` : ''}`;
        out.push(this.nodeOf(particle, item, sub));
      }
    }
    this.checkChoice(type, data, pathText);
    return out;
  }

  private nodeOf(particle: Particle, value: DocumentValue, pathText: string): Node {
    const ref =
      particle.typeNs === undefined || particle.typeName === undefined
        ? undefined
        : ([particle.typeNs, particle.typeName] as TypeRef);
    this.usedNs.add(particle.ns);
    if (this.schema.isComplex(ref)) {
      const type = this.schema.complexOf(ref)!;
      return { children: this.childrenOf(type, value, pathText), name: particle.name, ns: particle.ns };
    }
    return { name: particle.name, ns: particle.ns, text: this.scalarOf(particle, value, pathText) };
  }

  private scalarOf(particle: Particle, value: DocumentValue, pathText: string): string {
    if (typeof value === 'object')
      throw new BuildError(`${pathText}: ожидалось простое значение, получен объект`);
    const text = String(value).trim();
    const ref =
      particle.typeNs === undefined || particle.typeName === undefined
        ? undefined
        : ([particle.typeNs, particle.typeName] as TypeRef);
    const allowed = this.schema.enumValues(ref);
    if (!allowed || allowed.has(text)) return text;

    const alias = ENUM_ALIAS[particle.typeName ?? ''];
    if (!alias)
      throw new BuildError(
        `${pathText}: значение «${text}» отсутствует в перечислении ${particle.typeName} ` +
          `(справочник не подключён)`,
      );
    try {
      const code = resolveCode(alias, text);
      if (code !== text)
        this.log.push(`${pathText}: «${text}» → ${code} (${dictionary(alias).nameOf(code) ?? ''})`);
      return code;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AmbiguousError)
        throw new BuildError(`${pathText}: ${error.message}`);
      throw error;
    }
  }

  private checkChoice(type: ComplexType, data: DocumentData, pathText: string): void {
    const groups = new Map<number, string[]>();
    for (const particle of type.particles)
      if (particle.choiceGroup !== undefined) {
        const bucket = groups.get(particle.choiceGroup);
        if (bucket) bucket.push(particle.name);
        else groups.set(particle.choiceGroup, [particle.name]);
      }
    for (const names of groups.values()) {
      const filled = names.filter((name) => data[name] !== undefined && data[name] !== null);
      if (filled.length > 1)
        throw new BuildError(
          `${pathText}: элементы ${JSON.stringify(names)} взаимоисключающие (xs:choice), ` +
            `заполнены сразу ${JSON.stringify(filled)}`,
        );
      const required = type.particles
        .filter((p) => names.includes(p.name))
        .every((p) => p.minOccurs > 0);
      if (filled.length === 0 && required)
        throw new BuildError(
          `${pathText}: нужно заполнить один из элементов ${JSON.stringify(names)}`,
        );
    }
  }

  // ── сериализация ───────────────────────────────────────────────────────────

  private prefixMap(): Map<string, string> {
    const out = new Map<string, string>([[this.schema.targetNs, '']]);
    const rest = [...this.usedNs].filter((ns) => ns !== this.schema.targetNs).sort();
    for (const ns of rest) {
      const key = ns.includes('/common/') ? ns.split('/common/').pop()!.split('/')[0] : ns;
      out.set(ns, PREFIXES[key] ?? key.slice(0, 6));
    }
    return out;
  }

  private render(root: Node): string {
    const prefixes = this.prefixMap();
    const declarations = [`xmlns="${root.ns}"`];
    for (const [ns, prefix] of prefixes) if (prefix) declarations.push(`xmlns:${prefix}="${ns}"`);
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
    this.write(root, prefixes, 0, lines, declarations);
    return lines.join('\n') + '\n';
  }

  private write(
    node: Node,
    prefixes: Map<string, string>,
    depth: number,
    out: string[],
    declarations?: string[],
  ): void {
    const prefix = prefixes.get(node.ns) ?? '';
    const tag = prefix ? `${prefix}:${node.name}` : node.name;
    const head = declarations ? `${tag} ${declarations.join(' ')}` : tag;
    const pad = '\t'.repeat(depth);
    if (node.children) {
      out.push(`${pad}<${head}>`);
      for (const c of node.children) this.write(c, prefixes, depth + 1, out);
      out.push(`${pad}</${tag}>`);
    } else {
      out.push(`${pad}<${head}>${escapeXml(node.text ?? '')}</${tag}>`);
    }
  }
}
