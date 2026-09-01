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
    ).rejects.toThrow(/не найдено: его нет ни на диске/);
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

describe('вложения из переписки', () => {
  /** Минимальный JPEG: только маркер SOF с нужным разрешением. */
  const jpeg = (width: number, height: number): Buffer => {
    const b = Buffer.alloc(200, 0);
    b[0] = 0xff;
    b[1] = 0xd8;
    b[2] = 0xff;
    b[3] = 0xc0;
    b.writeUInt16BE(17, 4);
    b[6] = 8;
    b.writeUInt16BE(height, 7);
    b.writeUInt16BE(width, 9);
    return b;
  };

  const withPhoto = (name: string): ReportInput => {
    const report = fixture();
    report.attachments = [{ desc: 'Фотофиксация', file: name }];
    report.rows[0].comment = 'Паспорт на посадочный материал № 45 от 12.05.2025';
    report.rows[0].photoFixation = {
      datetime: '2025-09-29T18:02:00',
      files: [name],
      name: 'Поворотная точка',
      points: [{ lat: '48.17667', lon: '136.15182', n: '1' }],
    };
    return report;
  };

  const chat = new Map([
    ['IMG_BIG.jpg', jpeg(2600, 2000)],
    ['IMG_SMALL.jpg', jpeg(640, 480)],
  ]);
  const attachmentSource = async (name: string) => chat.get(name);

  it('собирает отчёт с файлом, которого нет на диске', async () => {
    if (!xmllintAvailable) return;
    const result = await buildReport({
      attachmentSource,
      filesDir: workdir,
      report: withPhoto('IMG_BIG.jpg'),
    });
    expect(result.ready).toBe(true);
    // MD5 посчитан по байтам из переписки, а не по файлу на диске
    expect(result.xml).toContain('IMG_BIG.jpg');
    expect(result.attachmentFiles?.get('IMG_BIG.jpg')).toEqual(chat.get('IMG_BIG.jpg'));
  });

  it('отклоняет фото меньше 5 Мпикс', async () => {
    if (!xmllintAvailable) return;
    const result = await buildReport({
      attachmentSource,
      filesDir: workdir,
      report: withPhoto('IMG_SMALL.jpg'),
    });
    expect(result.ready).toBe(false);
    expect(result.findings.some((f) => f.level === ERROR && f.text.includes('Мпикс'))).toBe(true);
  });

  it('фотофиксация без примечания даёт понятную ошибку, а не путь по XSD', async () => {
    const report = withPhoto('IMG_BIG.jpg');
    delete report.rows[0].comment;
    await expect(
      buildReport({ attachmentSource, filesDir: workdir, report }),
    ).rejects.toThrow(/нужно примечание/);
  });
});

describe('отдача документа файлом', () => {
  it('валидный документ возвращается текстом для выгрузки', async () => {
    if (!xmllintAvailable) return;
    // без outputPath файл на диск не пишется, но текст доступен для отправки в хранилище
    const result = await buildReport({ filesDir: workdir, report: fixture() });
    expect(result.ready).toBe(true);
    expect(result.file).toBeUndefined();
    expect(result.xml?.codePointAt(0)).toBe(0xfe_ff);
    expect(result.xml).toContain('<codeLine>270</codeLine>');
  });

  it('невалидный документ наружу не отдаётся', async () => {
    if (!xmllintAvailable) return;
    const broken = fixture();
    broken.period = { begin: '', end: '' };
    const result = await buildReport({ filesDir: workdir, report: broken });
    expect(result.xsd.valid).toBe(false);
    expect(result.xml).toBeUndefined();
    expect(result.file).toBeUndefined();
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
