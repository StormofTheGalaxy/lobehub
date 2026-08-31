/**
 * Перечень справочников ФГИС ЛК: короткое имя, файл и заголовок.
 *
 * Модуль намеренно не зависит ни от файловой системы, ни от чего-либо ещё:
 * его импортирует манифест инструмента, который попадает и в клиентскую сборку.
 * Чтение самих справочников живёт в nsi.ts и происходит только на сервере.
 */
export const DICTIONARIES = {
  authority: {
    file: 'dSubordinateAuthorityKindTypes-2.1.4.xsd',
    title: 'Органы государственной власти',
  },
  cs: { file: 'dCoordinateSystemKindTypes-2.2.1.xsd', title: 'Системы координат' },
  doc_type: { file: 'dDocumentTypeKindTypes-2.1.9.xsd', title: 'Виды документов' },
  forestry: { file: 'dForestryKindTypes-2.2.3.xsd', title: 'Лесничества' },
  land_category: { file: 'dCategoryLandForestryKindTypes-2.1.0.xsd', title: 'Категории земель' },
  measures: {
    file: 'dMeasuresOZVLKindTypes-2.1.2.xsd',
    title: 'Мероприятия по воспроизводству лесов (ОЗВЛ)',
  },
  subforestry: {
    file: 'dDistrictForestriesKindTypes-2.1.5.xsd',
    title: 'Участковые лесничества',
  },
  subject: {
    file: 'dConstituentEntityKindTypes-2.1.1.xsd',
    title: 'Субъекты Российской Федерации',
  },
  tree: { file: 'dTreeNewKindTypes-2.1.5.xsd', title: 'Породы древесины' },
  unit: { file: 'dUnitMeasurementKindTypes-2.1.1.xsd', title: 'Единицы измерения (ОКЕИ)' },
} as const;

export type DictionaryName = keyof typeof DICTIONARIES;

export const DICTIONARY_NAMES = Object.keys(DICTIONARIES) as DictionaryName[];
