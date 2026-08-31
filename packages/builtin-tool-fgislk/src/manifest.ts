import { type BuiltinToolManifest } from '@lobechat/types';

import { DICTIONARIES, DICTIONARY_NAMES } from './engine/dictionaries';
import { systemPrompt } from './systemRole';
import { FgisLkApiName, FgisLkIdentifier } from './types';

const dictionaryDescription = DICTIONARY_NAMES.map(
  (name) => `${name} — ${DICTIONARIES[name].title}`,
).join('; ');

/** Схема местоположения по учётным номерам ГЛР. */
const locationSchema = {
  additionalProperties: false,
  description:
    'Местоположение участка учётными номерами ГЛР. Номера вложены иерархически: ' +
    'лесничество 27:19 -> участковое 27:19:4 -> квартал 27:19:4:19 -> выдел 27:19:4:19:17.',
  properties: {
    quarter: { description: 'Учётный номер лесного квартала, например 27:19:4:19', type: 'string' },
    subforestry: {
      description: 'Учётный номер участкового лесничества, например 27:19:4',
      type: 'string',
    },
    taxationUnit: {
      description: 'Учётный номер лесотаксационного выдела, например 27:19:4:19:17',
      type: 'string',
    },
    tract: { description: 'Наименование урочища (при наличии)', type: 'string' },
  },
  required: ['taxationUnit'],
  type: 'object',
} as const;

const photoSchema = {
  additionalProperties: false,
  description:
    'Материалы фото-видео фиксации по строке. Требования приказа № 112: JPEG не менее ' +
    '5 Мпикс (п. 7 Порядка), не более 12 поворотных точек (п. 6 Порядка).',
  properties: {
    cs: {
      description: 'Код системы координат; по умолчанию wgs84Epsg4326 (WGS 84, EPSG:4326)',
      type: 'string',
    },
    datetime: {
      description: 'Дата и время съёмки в формате 2025-09-29T18:02:00',
      type: 'string',
    },
    files: {
      description:
        'Имена файлов фотофиксации. Каждое имя обязано присутствовать в разделе attachments.',
      items: { type: 'string' },
      type: 'array',
    },
    name: { description: 'Наименование фиксации, например «Поворотная точка»', type: 'string' },
    points: {
      description: 'Поворотные точки участка',
      items: {
        additionalProperties: false,
        properties: {
          lat: { description: 'Широта', type: ['number', 'string'] },
          lon: { description: 'Долгота', type: ['number', 'string'] },
          n: { description: 'Номер точки', type: ['number', 'string'] },
        },
        required: ['n', 'lon', 'lat'],
        type: 'object',
      },
      type: 'array',
    },
  },
  required: ['files'],
  type: 'object',
} as const;

const rowSchema = {
  additionalProperties: false,
  properties: {
    comment: {
      description:
        'Примечание к строке. По сноскам <4> и <5> формы здесь указываются номер и дата ' +
        'документа о качестве семян и о происхождении посадочного материала.',
      type: 'string',
    },
    location: locationSchema,
    measure: {
      description:
        'Мероприятие: наименование показателя из формы («Лесоразведение, всего»), код строки ' +
        '(«270»), номер пункта формы («20.1.1.») или мнемоника справочника ОЗВЛ. Код строки ' +
        'и единицу измерения подставит инструмент — их указывать не нужно.',
      type: 'string',
    },
    photoFixation: photoSchema,
    tree: {
      description: 'Порода: наименование («Лиственница даурская») или код справочника (100405)',
      type: 'string',
    },
    treeAbbr: { description: 'Сокращение породы, например ЛД', type: 'string' },
    unit: {
      description:
        'Код единицы измерения по ОКЕИ. Указывается только чтобы развести строки формы ' +
        'с одинаковым кодом, но разными единицами (например 180: кг и га).',
      type: 'string',
    },
    value: {
      description: 'Объём выполненного мероприятия. Площадь — до 4 знаков после запятой.',
      type: ['number', 'string'],
    },
    year: { description: 'Год выполнения мероприятия', type: ['number', 'string'] },
  },
  required: ['measure', 'location', 'value'],
  type: 'object',
} as const;

const reportSchema = {
  additionalProperties: false,
  description: 'Исходные данные отчёта в прикладном виде.',
  properties: {
    attachments: {
      description:
        'Вложения отчёта. Идентификаторы и контрольные суммы MD5 инструмент проставит сам.',
      items: {
        additionalProperties: false,
        properties: {
          desc: { description: 'Описание вложения; по умолчанию — имя файла', type: 'string' },
          file: {
            description: 'Имя файла в каталоге filesDir либо абсолютный путь',
            type: 'string',
          },
        },
        required: ['file'],
        type: 'object',
      },
      type: 'array',
    },
    authority: {
      description:
        'Орган государственной власти: наименование или код (например rov27). ' +
        'Проверяется по справочнику.',
      type: 'string',
    },
    contract: {
      additionalProperties: false,
      description: 'Документ-основание. Должен существовать во ФГИС ЛК и принадлежать заявителю.',
      properties: {
        date: { description: 'Дата документа, ГГГГ-ММ-ДД', type: 'string' },
        number: { description: 'Номер документа', type: 'string' },
        registrationDate: { description: 'Дата регистрации в ГЛР, ГГГГ-ММ-ДД', type: 'string' },
        registrationNumber: {
          description: 'Регистрационный номер в ГЛР, например 00:00:0000000-00.0',
          type: 'string',
        },
        type: { description: 'Код вида документа по справочнику', type: 'string' },
      },
      required: ['type', 'number', 'date'],
      type: 'object',
    },
    date: { description: 'Дата составления документа, ГГГГ-ММ-ДД', type: 'string' },
    forestry: {
      description: 'Лесничество: учётный номер (27:19) или наименование',
      type: 'string',
    },
    landCategory: {
      description: 'Категория земель, например «Земли лесного фонда»',
      type: 'string',
    },
    organization: {
      description:
        'Реквизиты лесопользователя: nameFull, ogrn, inn, address, email, phone. ' +
        'Заполняется по данным пользователя, не по памяти.',
      type: 'object',
    },
    period: {
      additionalProperties: false,
      description: 'Отчётный период',
      properties: {
        begin: { description: 'Начало периода, ГГГГ-ММ-ДД', type: 'string' },
        end: { description: 'Окончание периода, ГГГГ-ММ-ДД', type: 'string' },
      },
      required: ['begin', 'end'],
      type: 'object',
    },
    provider: {
      description: 'Идентификатор информационной системы-поставщика (необязательно)',
      type: 'string',
    },
    rows: {
      description: 'Строки выполненных мероприятий',
      items: rowSchema,
      type: 'array',
    },
    signer: {
      description:
        'Подписант: { employee: { fullName: { last, first, middle }, post, basisAuthority, ' +
        'number, date, phone }, date }',
      type: 'object',
    },
    subject: { description: 'Код субъекта РФ, например 27, или его наименование', type: 'string' },
  },
  required: [
    'date',
    'period',
    'subject',
    'authority',
    'organization',
    'signer',
    'contract',
    'forestry',
    'rows',
  ],
  type: 'object',
} as const;

export const FgisLkManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'Поиск кода в официальном справочнике ФГИС ЛК по наименованию или коду. ' +
        'Единственный допустимый способ получить код: коды по памяти использовать нельзя.',
      name: FgisLkApiName.searchDictionary,
      parameters: {
        additionalProperties: false,
        properties: {
          dictionary: {
            description: `Справочник: ${dictionaryDescription}`,
            enum: [...DICTIONARY_NAMES],
            type: 'string',
          },
          limit: { description: 'Сколько значений вернуть, по умолчанию 10', type: 'number' },
          query: { description: 'Наименование или код для поиска', type: 'string' },
        },
        required: ['dictionary', 'query'],
        type: 'object',
      },
    },
    {
      description:
        'Строка формы отчёта 1-ВЛ по наименованию мероприятия, коду строки, номеру пункта ' +
        'или мнемонике: показатель, код строки, единица измерения, сноски. Нужен, чтобы ' +
        'показать пользователю, какая именно строка формы получится.',
      name: FgisLkApiName.findReportLine,
      parameters: {
        additionalProperties: false,
        properties: {
          limit: { description: 'Сколько вариантов вернуть, по умолчанию 5', type: 'number' },
          query: { description: 'Наименование, код строки, номер пункта или мнемоника', type: 'string' },
        },
        required: ['query'],
        type: 'object',
      },
    },
    {
      description:
        'Собрать XML отчёта о воспроизводстве лесов и лесоразведении и проверить его. ' +
        'XML формируется по официальной XSD-схеме Рослесхоза; файл записывается на диск ' +
        'только если он прошёл валидацию. Коды строк и единицы измерения подставляются ' +
        'из формы приказа № 112, контрольные суммы вложений считаются по файлам.',
      humanIntervention: 'always',
      name: FgisLkApiName.buildReport,
      parameters: {
        additionalProperties: false,
        properties: {
          filesDir: {
            description: 'Каталог с файлами вложений; по умолчанию — каталог итогового файла',
            type: 'string',
          },
          outputPath: { description: 'Путь для записи XML-файла отчёта', type: 'string' },
          report: reportSchema,
        },
        required: ['report', 'outputPath'],
        type: 'object',
      },
      renderDisplayControl: 'expand',
    },
    {
      description:
        'Проверить готовый XML: валидация по действующей XSD-схеме плюс смысловые проверки ' +
        '(коды строк, единицы измерения, арифметика «всего/в том числе», вложенность учётных ' +
        'номеров ГЛР, контрольные суммы и требования к фотоматериалам). Подходит и для файлов, ' +
        'выгруженных с портала.',
      name: FgisLkApiName.checkReport,
      parameters: {
        additionalProperties: false,
        properties: {
          filesDir: {
            description: 'Каталог с вложениями для сверки MD5 и проверки фотоматериалов',
            type: 'string',
          },
          xmlPath: { description: 'Путь к проверяемому XML-файлу', type: 'string' },
        },
        required: ['xmlPath'],
        type: 'object',
      },
      renderDisplayControl: 'expand',
    },
    {
      description:
        'Перевести XML на действующую версию схемы: пространства имён заменяются на актуальные, ' +
        'после чего документ проверяется. Нужно для отчётов, сделанных по устаревшей схеме.',
      humanIntervention: 'always',
      name: FgisLkApiName.migrateReport,
      parameters: {
        additionalProperties: false,
        properties: {
          filesDir: { description: 'Каталог с вложениями для проверки', type: 'string' },
          outputPath: { description: 'Путь для записи переведённого файла', type: 'string' },
          xmlPath: { description: 'Путь к исходному XML-файлу', type: 'string' },
        },
        required: ['xmlPath', 'outputPath'],
        type: 'object',
      },
    },
    {
      description:
        'Состав комплекта: версия схемы документа, версия общих подсхем, объём справочников ' +
        'и число строк формы. Нужен, чтобы показать пользователю, по какой именно редакции ' +
        'формата готовится отчёт.',
      name: FgisLkApiName.describeEnvironment,
      parameters: { additionalProperties: false, properties: {}, type: 'object' },
    },
  ],
  identifier: FgisLkIdentifier,
  meta: {
    avatar: '🌲',
    description:
      'Формирование и проверка XML-отчётности для ФГИС ЛК по официальным схемам Рослесхоза',
    tags: ['фгис лк', 'рослесхоз', 'отчётность', 'xml', 'лес'],
    title: 'ФГИС ЛК: отчётность',
  },
  systemRole: systemPrompt,
  type: 'builtin',
};
