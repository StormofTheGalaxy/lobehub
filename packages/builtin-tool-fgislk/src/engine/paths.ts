/**
 * Расположение официальных данных: XSD-схемы Рослесхоза и карта строк формы.
 *
 * Каталог данных не «зашит» намертво, и это осознанно: схемы ФГИС ЛК обновляются
 * (3.0.5 -> 3.0.6 -> 3.0.7 ...), и организация должна иметь возможность положить
 * новый комплект, не пересобирая приложение. Порядок поиска:
 *
 *   1. переменная окружения FGISLK_DATA_DIR — явное указание каталога
 *      (так задано в Docker-образе: /app/fgislk-data);
 *   2. каталог data/ рядом с исходниками пакета;
 *   3. пути относительно рабочего каталога — корень монорепозитория при
 *      `pnpm dev` и каталог самого пакета при запуске тестов в CI.
 *
 * Если каталог не найден, инструмент отказывается работать с внятным
 * сообщением — молча собирать отчёт «по памяти» он не станет.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

const RELATIVE_FALLBACKS = [
  // dist/engine -> dist -> корень пакета
  ['..', '..', 'data'],
  // src/engine -> src -> корень пакета
  ['..', '..', 'data'],
];

const moduleDir = (): string | undefined => {
  try {
    // eslint-disable-next-line unicorn/prefer-module
    return typeof __dirname === 'string' ? __dirname : undefined;
  } catch {
    return undefined;
  }
};

const candidates = (): string[] => {
  const out: string[] = [];
  if (process.env.FGISLK_DATA_DIR) out.push(path.resolve(process.env.FGISLK_DATA_DIR));
  const dir = moduleDir();
  if (dir) for (const parts of RELATIVE_FALLBACKS) out.push(path.resolve(dir, ...parts));
  out.push(
    // запуск из корня монорепозитория (pnpm dev, next build)
    path.resolve(process.cwd(), 'packages/builtin-tool-fgislk/data'),
    // запуск из каталога самого пакета (vitest --filter в CI)
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), '../../packages/builtin-tool-fgislk/data'),
  );
  return out;
};

let cached: string | undefined;

/** Каталог с официальными данными. Бросает исключение, если данных нет. */
export const dataDir = (): string => {
  if (cached) return cached;
  for (const candidate of candidates())
    if (existsSync(path.join(candidate, 'schemas'))) {
      cached = candidate;
      return candidate;
    }
  throw new Error(
    'Не найден каталог с XSD-схемами ФГИС ЛК. Укажите его в переменной окружения ' +
      'FGISLK_DATA_DIR (внутри должны быть подкаталоги schemas/ и nsi/). ' +
      'Проверены пути: ' +
      candidates().join(', '),
  );
};

export const schemaDir = (): string => path.join(dataDir(), 'schemas');

export const commonDir = (): string => path.join(schemaDir(), 'common3.4');

export const nsiDir = (): string => path.join(dataDir(), 'nsi');

/**
 * Действующая схема отчёта о воспроизводстве лесов и лесоразведении.
 * Версия 3.0.7 действует с 05.05.2026 (таблица версий на сайте Рослесхоза).
 */
export const mainXsd = (): string => path.join(schemaDir(), 'forestReproduction_v3.0.7.xsd');

export const measuresCsv = (): string => path.join(nsiDir(), 'measures_1vl.csv');

/** Версия комплекта общих подсхем, на которые ссылается основная XSD. */
export const COMMON_VERSION = '3.4';

/** Версия схемы документа, поставляемой в комплекте. */
export const SCHEMA_VERSION = '3.0.7';
