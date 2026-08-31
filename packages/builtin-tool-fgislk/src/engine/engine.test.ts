/**
 * Проверки движка отчётности.
 *
 * Данные фикстуры вымышленные, но структура и коды — настоящие: лесничество,
 * участковое лесничество, квартал и выдел взяты из справочников Рослесхоза,
 * строки формы — из приказа № 112. Реальные отчёты с персональными данными
 * в репозиторий не кладутся; сверка с принятым отчётом описана в README.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildReport,
  checkReport,
  environment,
  ERROR,
  findReportLine,
  type ReportInput,
  schema,
  searchDictionary,
} from './index';

let workdir: string;
let xmllintAvailable = true;

const fixture = (): ReportInput => ({
  attachments: [{ desc: 'акт выполненных работ', file: 'akt.pdf' }],
  authority: 'rov27',
  contract: {
    date: '2024-04-09',
    number: '321',
    registrationDate: '2024-06-17',
    registrationNumber: '27:00:0000000-00.0',
    type: '46602034',
  },
  date: '2025-10-08',
  forestry: '27:19',
  landCategory: 'Земли лесного фонда',
  organization: {
    address: 'г. Хабаровск, ул. Примерная, д. 1',
    email: 'test@example.org',
    inn: '2700000000',
    nameFull: 'ООО «Тестовый лесопользователь»',
    ogrn: '1020000000000',
    phone: '+7-000-000-00-00',
  },
  period: { begin: '2025-01-01', end: '2025-09-30' },
  rows: [
    {
      location: { quarter: '27:19:4:19', subforestry: '27:19:4', taxationUnit: '27:19:4:19:17' },
      measure: 'Лесоразведение, всего',
      tree: 'Лиственница даурская',
      treeAbbr: 'ЛД',
      value: '0.0228',
      year: 2025,
    },
    {
      location: { quarter: '27:19:4:19', subforestry: '27:19:4', taxationUnit: '27:19:4:19:17' },
      measure: '271',
      tree: 'Лиственница даурская',
      treeAbbr: 'ЛД',
      value: '0.0228',
      year: 2025,
    },
  ],
  signer: {
    date: '2025-10-08',
    employee: {
      basisAuthority: 'доверенность',
      date: '2024-02-13',
      fullName: { first: 'Иван', last: 'Иванов', middle: 'Иванович' },
      number: '1-23',
      phone: '+7-000-000-00-00',
      post: 'Представитель по доверенности',
    },
  },
  subject: '27',
});

beforeAll(async () => {
  workdir = mkdtempSync(path.join(tmpdir(), 'fgislk-test-'));
  writeFileSync(path.join(workdir, 'akt.pdf'), 'фиктивное вложение для контрольной суммы');
  const probe = await schema().validate(path.join(workdir, 'akt.pdf'));
  xmllintAvailable = probe.available;
});

describe('справочники', () => {
  it('находит код породы по наименованию', () => {
    const { hits } = searchDictionary({ dictionary: 'tree', query: 'Лиственница даурская' });
    expect(hits[0]).toMatchObject({ code: '100405', name: 'Лиственница даурская' });
  });

  it('находит лесничество по учётному номеру', () => {
    const { hits } = searchDictionary({ dictionary: 'forestry', query: '27:19' });
    expect(hits[0].code).toBe('27:19');
  });

  it('комплект схем и справочников на месте', () => {
    const info = environment();
    expect(info.schemaVersion).toBe('3.0.7');
    expect(info.reportLines).toBeGreaterThan(80);
    expect(info.dictionaries.every((d) => d.size > 0)).toBe(true);
  });
});

describe('строки формы 1-ВЛ', () => {
  it('код строки и единица измерения берутся из приказа', () => {
    const [line] = findReportLine('270');
    expect(line).toMatchObject({ codeLine: '270', unitForm: 'га', unitOkei: '059' });
    expect(line.reportRate).toBe('afforestationTotal80Ga');
  });

  it('одно наименование может относиться к нескольким строкам формы', () => {
    const lines = findReportLine('из него - посадка лесных культур, всего');
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe('сборка отчёта', () => {
  it('собирает валидный документ и проставляет коды строк сама', async () => {
    if (!xmllintAvailable) return;
    const output = path.join(workdir, 'ok.xml');
    const result = await buildReport({ filesDir: workdir, outputPath: output, report: fixture() });

    expect(result.xsd.valid).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.file).toBe(output);

    const xml = readFileSync(output, 'utf8');
    // BOM обязателен: так документ выгружает портал и так он подписывается
    expect(xml.codePointAt(0)).toBe(0xfe_ff);
    // коды строк и единицы измерения подставлены из формы, а не из ввода
    expect(xml).toContain('<codeLine>270</codeLine>');
    expect(xml).toContain('<codeLine>271</codeLine>');
    expect(xml).toContain('<unitType>059</unitType>');
    // наименование породы разрешено в код справочника
    expect(xml).toContain('100405');
    // кавычки в наименовании организации не экранируются лишний раз
    expect(xml).toContain('ООО «Тестовый лесопользователь»');
  });

  it('невалидный документ не появляется на диске', async () => {
    if (!xmllintAvailable) return;
    const output = path.join(workdir, 'never.xml');
    const broken = fixture();
    // пустой период даёт невалидную дату — документ не должен быть записан
    broken.period = { begin: '', end: '' };
    const result = await buildReport({ filesDir: workdir, outputPath: output, report: broken });
    expect(result.xsd.valid).toBe(false);
    expect(result.file).toBeUndefined();
    expect(() => readFileSync(output)).toThrow();
  });

  it('неизвестное поле — ошибка, а не молчаливая потеря данных', async () => {
    const withTypo = fixture() as unknown as Record<string, unknown>;
    withTypo.organisation = withTypo.organization;
    await expect(
      buildReport({
        filesDir: workdir,
        outputPath: path.join(workdir, 'typo.xml'),
        report: withTypo as unknown as ReportInput,
      }),
    ).rejects.toThrow(/неизвестные поля/);
  });

  it('неоднозначное мероприятие останавливает сборку', async () => {
    const ambiguous = fixture();
    ambiguous.rows[0].measure = 'из него - посадка лесных культур, всего';
    await expect(
      buildReport({
        filesDir: workdir,
        outputPath: path.join(workdir, 'ambiguous.xml'),
        report: ambiguous,
      }),
    ).rejects.toThrow(/подходит нескольким показателям/);
  });

  it('несуществующая порода останавливает сборку', async () => {
    const wrong = fixture();
    wrong.rows[0].tree = 'Дерево обыкновенное';
    await expect(
      buildReport({
        filesDir: workdir,
        outputPath: path.join(workdir, 'wrong-tree.xml'),
        report: wrong,
      }),
    ).rejects.toThrow(/точного совпадения/);
  });

  it('отсутствующее вложение останавливает сборку', async () => {
    const missing = fixture();
    missing.attachments = [{ file: 'нет-такого-файла.pdf' }];
    await expect(
      buildReport({
        filesDir: workdir,
        outputPath: path.join(workdir, 'missing.xml'),
        report: missing,
      }),
    ).rejects.toThrow(/вложение не найдено/);
  });
});

describe('смысловые проверки готового документа', () => {
  it('ловит чужой выдел, лишние знаки и превышение над родительской строкой', async () => {
    if (!xmllintAvailable) return;
    const output = path.join(workdir, 'lint.xml');
    await buildReport({ filesDir: workdir, outputPath: output, report: fixture() });

    const spoiled = readFileSync(output, 'utf8')
      // выдел из другого квартала
      .replace('27:19:4:19:17', '27:19:4:20:17')
      // пять знаков после запятой при допустимых четырёх (сноска <3>)
      .replace('<value>0.0228</value>', '<value>0.02285</value>');
    const spoiledPath = path.join(workdir, 'lint-broken.xml');
    writeFileSync(spoiledPath, spoiled, 'utf8');

    const result = await checkReport({ filesDir: workdir, xmlPath: spoiledPath });
    expect(result.xsd.valid).toBe(true);
    expect(result.ready).toBe(false);
    const errors = result.findings.filter((f) => f.level === ERROR).map((f) => f.text);
    expect(errors.some((t) => t.includes('не входит в'))).toBe(true);
    expect(errors.some((t) => t.includes('знак(ов) после запятой'))).toBe(true);
  });

  it('сверяет контрольную сумму вложения с файлом', async () => {
    if (!xmllintAvailable) return;
    const output = path.join(workdir, 'md5.xml');
    await buildReport({ filesDir: workdir, outputPath: output, report: fixture() });
    writeFileSync(path.join(workdir, 'akt.pdf'), 'файл подменили после сборки');
    const result = await checkReport({ filesDir: workdir, xmlPath: output });
    expect(result.findings.some((f) => f.level === ERROR && f.text.includes('MD5'))).toBe(true);
  });
});

describe('версии схем', () => {
  it('документ по устаревшей схеме не проходит валидацию и чинится миграцией', async () => {
    if (!xmllintAvailable) return;
    const output = path.join(workdir, 'current.xml');
    await buildReport({ filesDir: workdir, outputPath: output, report: fixture() });
    const outdated = readFileSync(output, 'utf8')
      .replaceAll('forestReproduction/types/3.0.7', 'forestReproduction/types/3.0.5')
      .replaceAll('commonReport/types/2.1.6', 'commonReport/types/2.1.4');
    const outdatedPath = path.join(workdir, 'outdated.xml');
    writeFileSync(outdatedPath, outdated, 'utf8');

    const before = await checkReport({ xmlPath: outdatedPath });
    expect(before.xsd.valid).toBe(false);

    const { log, text } = schema().migrate(outdated);
    expect(log.length).toBeGreaterThan(0);
    expect(text).toContain('forestReproduction/types/3.0.7');
  });
});

afterAll(() => {
  if (workdir) rmSync(workdir, { force: true, recursive: true });
});
