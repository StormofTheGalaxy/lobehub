/**
 * Минимальный разбор XML без внешних зависимостей.
 *
 * Используется в двух местах: чтение официальных XSD-схем Рослесхоза и чтение
 * готового XML при проверке. Оба класса файлов машинно-сгенерированы и просты:
 * элементы, атрибуты, текст, комментарии, объявление и BOM. Ничего сверх этого
 * (CDATA, DTD, сущности кроме пяти предопределённых) в схемах ФГИС ЛК нет.
 *
 * Разбор намеренно строгий: любая неожиданная конструкция — исключение, а не
 * «как-нибудь разберём». Для отчётности молчаливая деградация опаснее отказа.
 */

export interface XmlNode {
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Локальное имя без префикса. */
  local: string;
  /** Имя тега как в файле, вместе с префиксом. */
  name: string;
  /** URI пространства имён, разрешённый по объявлениям xmlns в предках. */
  ns: string;
  text: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

export const decodeEntities = (input: string): string =>
  input.replaceAll(/&(#x?[\da-f]+|\w+);/gi, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X'))
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    const value = ENTITIES[code.toLowerCase()];
    return value === undefined ? match : value;
  });

/**
 * Экранирование текста элемента: только `&`, `<` и `>`.
 *
 * Кавычки внутри текста экранировать не нужно, и делать этого не следует:
 * наименования организаций сплошь содержат кавычки (ООО "Пример"), а документ
 * должен побайтово совпадать с тем, что выгружает портал — иначе диффы с
 * эталонными выгрузками становятся нечитаемыми.
 */
export const escapeXml = (input: string): string =>
  input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Экранирование значения атрибута: дополнительно кавычки. */
export const escapeAttribute = (input: string): string =>
  escapeXml(input).replaceAll('"', '&quot;').replaceAll("'", '&apos;');

/** Убирает BOM: файлы ФГИС ЛК выгружаются в UTF-8 именно с ним. */
export const stripBom = (input: string): string =>
  input.codePointAt(0) === 0xfe_ff ? input.slice(1) : input;

const parseAttributes = (source: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const re = /([\w.:-]+)\s*=\s*"([^"]*)"|([\w.:-]+)\s*=\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const key = match[1] ?? match[3];
    const value = match[2] ?? match[4] ?? '';
    attrs[key] = decodeEntities(value);
  }
  return attrs;
};

const splitName = (name: string): { local: string; prefix: string } => {
  const at = name.indexOf(':');
  return at === -1
    ? { local: name, prefix: '' }
    : { local: name.slice(at + 1), prefix: name.slice(0, at) };
};

/**
 * Разбирает документ в дерево. Пространства имён разрешаются на месте, поэтому
 * потребителю не нужно знать про префиксы — только про URI и локальные имена.
 */
export const parseXml = (source: string): XmlNode => {
  const text = stripBom(source);
  const stack: { node: XmlNode; nsMap: Record<string, string> }[] = [];
  let root: XmlNode | undefined;
  let index = 0;

  const currentNsMap = (): Record<string, string> =>
    stack.length > 0 ? stack.at(-1)!.nsMap : { '': '' };

  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open === -1) break;

    if (open > index && stack.length > 0) {
      const chunk = text.slice(index, open);
      if (chunk.trim().length > 0) stack.at(-1)!.node.text += decodeEntities(chunk);
    }

    // комментарии / объявления / инструкции обработки — пропускаем целиком
    if (text.startsWith('<!--', open)) {
      const end = text.indexOf('-->', open);
      if (end === -1) throw new Error('XML: незакрытый комментарий');
      index = end + 3;
      continue;
    }
    if (text.startsWith('<?', open)) {
      const end = text.indexOf('?>', open);
      if (end === -1) throw new Error('XML: незакрытая инструкция обработки');
      index = end + 2;
      continue;
    }
    if (text.startsWith('<![CDATA[', open)) {
      const end = text.indexOf(']]>', open);
      if (end === -1) throw new Error('XML: незакрытая секция CDATA');
      if (stack.length > 0) stack.at(-1)!.node.text += text.slice(open + 9, end);
      index = end + 3;
      continue;
    }
    if (text.startsWith('<!', open)) {
      const end = text.indexOf('>', open);
      if (end === -1) throw new Error('XML: незакрытое объявление');
      index = end + 1;
      continue;
    }

    const close = text.indexOf('>', open);
    if (close === -1) throw new Error('XML: незакрытый тег');
    const raw = text.slice(open + 1, close);

    // закрывающий тег
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const top = stack.pop();
      if (!top) throw new Error(`XML: лишний закрывающий тег </${name}>`);
      if (top.node.name !== name)
        throw new Error(`XML: ожидался </${top.node.name}>, встречен </${name}>`);
      index = close + 1;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const space = body.search(/\s/);
    const name = (space === -1 ? body : body.slice(0, space)).trim();
    const attrs = space === -1 ? {} : parseAttributes(body.slice(space));

    const nsMap: Record<string, string> = { ...currentNsMap() };
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'xmlns') nsMap[''] = value;
      else if (key.startsWith('xmlns:')) nsMap[key.slice(6)] = value;
    }

    const { local, prefix } = splitName(name);
    const node: XmlNode = {
      attrs,
      children: [],
      local,
      name,
      ns: nsMap[prefix] ?? '',
      text: '',
    };

    if (stack.length > 0) stack.at(-1)!.node.children.push(node);
    else if (root) throw new Error('XML: в документе более одного корневого элемента');
    else root = node;

    if (!selfClosing) stack.push({ node, nsMap });
    index = close + 1;
  }

  if (stack.length > 0) throw new Error(`XML: не закрыт элемент <${stack.at(-1)!.node.name}>`);
  if (!root) throw new Error('XML: корневой элемент не найден');
  return root;
};

/** Первый прямой потомок с указанным локальным именем. */
export const child = (node: XmlNode | undefined, local: string): XmlNode | undefined =>
  node?.children.find((c) => c.local === local);

/** Все прямые потомки с указанным локальным именем. */
export const children = (node: XmlNode | undefined, local: string): XmlNode[] =>
  node ? node.children.filter((c) => c.local === local) : [];

/** Текст прямого потомка (обрезанный) или значение по умолчанию. */
export const textOf = (node: XmlNode | undefined, local: string, fallback = ''): string =>
  child(node, local)?.text.trim() ?? fallback;

/** Обход всего поддерева, включая сам узел. */
export function* walk(node: XmlNode): Generator<XmlNode> {
  yield node;
  for (const c of node.children) yield* walk(c);
}

/** Все узлы поддерева с указанным локальным именем. */
export const findAll = (node: XmlNode, local: string): XmlNode[] =>
  [...walk(node)].filter((n) => n.local === local);
