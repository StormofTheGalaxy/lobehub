/**
 * Серверная реализация инструмента ФГИС ЛК.
 *
 * Текст, который возвращается модели (`content`), составлен так, чтобы вывод
 * невозможно было прочитать оптимистичнее, чем он есть: вердикт о готовности
 * стоит первой строкой, ошибки идут раньше предупреждений, а если файл не
 * записан — об этом сказано прямо.
 */
import { type BuiltinServerRuntimeOutput } from '@lobechat/types';

import {
  buildReport,
  checkReport,
  ERROR,
  environment,
  type Finding,
  findReportLine,
  isBuildError,
  isInputError,
  migrateReport,
  searchDictionary,
  type Verification,
  WARN,
} from '../engine';
import {
  type BuildReportParams,
  type BuildReportState,
  type CheckReportParams,
  type CheckReportState,
  type DescribeEnvironmentState,
  type FindReportLineParams,
  type FindReportLineState,
  type MigrateReportParams,
  type MigrateReportState,
  type SearchDictionaryParams,
  type SearchDictionaryState,
  type VerificationState,
} from '../types';

const failure = (error: unknown): BuiltinServerRuntimeOutput => {
  const message = error instanceof Error ? error.message : String(error);
  // ошибки ввода и сборки — это сообщение пользователю, а не сбой инструмента
  const prefix =
    isInputError(error) || isBuildError(error) ? 'Отчёт не собран. ' : 'Ошибка выполнения. ';
  return { content: prefix + message, error, success: false };
};

const formatFindings = (findings: Finding[]): string => {
  if (findings.length === 0) return 'Смысловых замечаний нет.';
  return findings.map((f) => `  ${f.level} · ${f.where} · ${f.text}`).join('\n');
};

const verificationState = (result: Verification): VerificationState => ({
  findings: result.findings,
  ready: result.ready,
  schemaVersion: result.schemaVersion,
  xsdAvailable: result.xsd.available,
  xsdErrors: result.xsd.errors,
  xsdValid: result.xsd.valid,
});

/** Единый блок вердикта — одинаковый для сборки, проверки и миграции. */
const verdict = (result: Verification, file: string | undefined): string => {
  const lines: string[] = [];
  const errors = result.findings.filter((f) => f.level === ERROR).length;
  const warnings = result.findings.filter((f) => f.level === WARN).length;

  if (!result.xsd.available)
    lines.push(
      'ВНЕШНЯЯ ПРОВЕРКА ПО XSD НЕ ВЫПОЛНЕНА — в системе нет xmllint. ' +
        'Документ нельзя считать проверенным.',
    );
  else if (!result.xsd.valid)
    lines.push(
      `ДОКУМЕНТ НЕ ВАЛИДЕН по схеме ${result.schemaVersion}. Файл не записан — ` +
        `невалидный документ не должен попасть в подачу.`,
    );
  else if (result.ready)
    lines.push(
      `ГОТОВ К ПОДПИСАНИЮ И ПОДАЧЕ: валиден по схеме ${result.schemaVersion}, ` +
        `ошибок нет${warnings > 0 ? `, предупреждений: ${warnings}` : ''}.`,
    );
  else
    lines.push(
      `НЕ ГОТОВ К ПОДАЧЕ: валиден по схеме ${result.schemaVersion}, ` +
        `но найдено ошибок: ${errors}. Их нужно устранить и собрать заново.`,
    );

  if (result.xsd.errors.length > 0)
    lines.push('Ошибки валидации:', ...result.xsd.errors.map((e) => `  ${e}`));
  if (result.xsd.valid) lines.push('', formatFindings(result.findings));
  if (file) lines.push('', `Файл: ${file}`);
  return lines.join('\n');
};

const HUMAN_CHECKLIST = [
  '',
  'Проверить перед подписанием (инструмент этого проверить не может):',
  '  — учётные номера лесничества, квартала и выдела совпадают с выпиской из ГЛР;',
  '  — документ-основание есть во ФГИС ЛК и принадлежит вашей организации;',
  '  — отчётный период и объёмы соответствуют фактически выполненным работам;',
  '  — реквизиты подписанта и доверенности действительны на дату подписания.',
  'Подпись ставит человек своим сертификатом. Подпись открепленная: после подписания',
  'файл нельзя пересохранять — иначе она станет недействительной.',
].join('\n');

export class FgisLkExecutionRuntime {
  async buildReport(params: BuildReportParams): Promise<BuiltinServerRuntimeOutput> {
    try {
      const result = await buildReport({
        filesDir: params.filesDir,
        outputPath: params.outputPath,
        report: params.report,
      });
      const state: BuildReportState = {
        ...verificationState(result),
        file: result.file,
        log: result.log,
        rows: params.report?.rows?.length ?? 0,
        size: result.size,
      };
      const content = [
        verdict(result, result.file),
        result.size ? `Размер: ${result.size} байт, UTF-8 с BOM.` : '',
        '',
        'Как собран документ:',
        ...result.log.map((line) => `  ${line}`),
        result.ready ? HUMAN_CHECKLIST : '',
      ]
        .filter(Boolean)
        .join('\n');
      return { content, state, success: true };
    } catch (error) {
      return failure(error);
    }
  }

  async checkReport(params: CheckReportParams): Promise<BuiltinServerRuntimeOutput> {
    try {
      const result = await checkReport({
        filesDir: params.filesDir,
        xmlPath: params.xmlPath,
      });
      const state: CheckReportState = {
        ...verificationState(result),
        documentNamespace: result.documentNamespace,
        file: result.file,
      };
      const outdated =
        result.documentNamespace &&
        !result.documentNamespace.endsWith(`/${result.schemaVersion}`) &&
        !result.xsd.valid;
      const content = [
        verdict(result, result.file),
        '',
        `Пространство имён документа: ${result.documentNamespace || 'не определено'}`,
        outdated
          ? 'Документ составлен по другой версии схемы. Попробуйте migrateReport — ' +
            'часто достаточно замены пространств имён.'
          : '',
        params.filesDir ? '' : 'Каталог вложений не указан: MD5 и фотоматериалы не проверялись.',
      ]
        .filter(Boolean)
        .join('\n');
      return { content, state, success: true };
    } catch (error) {
      return failure(error);
    }
  }

  async migrateReport(params: MigrateReportParams): Promise<BuiltinServerRuntimeOutput> {
    try {
      const result = await migrateReport({
        filesDir: params.filesDir,
        outputPath: params.outputPath,
        xmlPath: params.xmlPath,
      });
      const state: MigrateReportState = {
        ...verificationState(result),
        documentNamespace: result.documentNamespace,
        file: result.file,
        log: result.log,
      };
      const content = [
        verdict(result, result.file),
        '',
        'Замены пространств имён:',
        ...result.log.map((line) => `  ${line}`),
        result.ready ? HUMAN_CHECKLIST : '',
      ]
        .filter(Boolean)
        .join('\n');
      return { content, state, success: true };
    } catch (error) {
      return failure(error);
    }
  }

  async searchDictionary(params: SearchDictionaryParams): Promise<BuiltinServerRuntimeOutput> {
    try {
      const result = searchDictionary({
        dictionary: params.dictionary,
        limit: params.limit,
        query: params.query,
      });
      const state: SearchDictionaryState = {
        dictionary: params.dictionary,
        hits: result.hits.map(({ code, name }) => ({ code, name })),
        query: params.query,
        size: result.size,
        title: result.title,
      };
      const content =
        result.hits.length === 0
          ? `Справочник «${result.title}» (${result.size} значений): по запросу «${params.query}» ничего не найдено. Уточните формулировку — подставлять произвольный код нельзя.`
          : [
              `Справочник «${result.title}» (${result.size} значений), запрос «${params.query}»:`,
              ...result.hits.map((hit) => `  ${hit.code} — ${hit.name}`),
              result.hits.length > 1
                ? 'Найдено несколько значений — выбор должен подтвердить пользователь.'
                : '',
            ]
              .filter(Boolean)
              .join('\n');
      return { content, state, success: true };
    } catch (error) {
      return failure(error);
    }
  }

  async findReportLine(params: FindReportLineParams): Promise<BuiltinServerRuntimeOutput> {
    try {
      const lines = findReportLine(params.query, params.limit ?? 5);
      const state: FindReportLineState = { lines, query: params.query };
      const content =
        lines.length === 0
          ? `Строка формы по запросу «${params.query}» не найдена ни по мнемонике, ни по коду строки, ни по номеру пункта, ни по наименованию.`
          : [
              `Строки формы 1-ВЛ по запросу «${params.query}»:`,
              ...lines.map((line) =>
                [
                  `  код строки ${line.codeLine || '— (в приказе не указан)'}`,
                  `пункт ${line.itemNo || '—'}`,
                  `${line.unitOkei} (${line.unitForm})`,
                  line.name,
                  line.footnotes ? `сноски <${line.footnotes}>` : '',
                  `показатель ${line.reportRate}`,
                  `сверка с приказом: ${line.match}`,
                ]
                  .filter(Boolean)
                  .join(' · '),
              ),
              lines.length > 1
                ? 'Вариантов несколько — уточните у пользователя, какая строка нужна.'
                : '',
            ]
              .filter(Boolean)
              .join('\n');
      return { content, state, success: true };
    } catch (error) {
      return failure(error);
    }
  }

  async describeEnvironment(): Promise<BuiltinServerRuntimeOutput> {
    try {
      const info = environment();
      const state: DescribeEnvironmentState = {
        commonVersion: info.commonVersion,
        dictionaries: info.dictionaries,
        reportLines: info.reportLines,
        schemaVersion: info.schemaVersion,
      };
      const content = [
        `Схема документа: forestReproduction ${info.schemaVersion} (действует с 05.05.2026).`,
        `Комплект общих подсхем: common ${info.commonVersion}.`,
        `Строк формы 1-ВЛ в карте приказа № 112: ${info.reportLines}.`,
        'Справочники:',
        ...info.dictionaries.map((d) => `  ${d.title}: ${d.size} значений`),
        '',
        'ФГИС ЛК принимает действующую версию схемы и две предыдущие.',
      ].join('\n');
      return { content, state, success: true };
    } catch (error) {
      return failure(error);
    }
  }
}
