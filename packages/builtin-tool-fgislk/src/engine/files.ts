/**
 * Работа с вложениями: контрольные суммы и проверка фотоматериалов.
 *
 * Все проверки работают с байтами, а не с путями. Так вложение может приехать
 * откуда угодно — с диска сервера, из хранилища чата, из песочницы, — а правила
 * приказа применяются к нему одинаково.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Сведения о вложении, которых достаточно для всех проверок отчёта. */
export interface AttachmentFacts {
  /** Разрешение JPEG; отсутствует, если файл не JPEG или повреждён. */
  image?: { height: number; width: number };
  /** Признак того, что файл должен быть JPEG по расширению. */
  isJpeg: boolean;
  /** MD5 в base64 — именно в таком виде он указывается в описи пакета. */
  md5: string;
  size: number;
}

/** MD5 в base64 по байтам. */
export const md5Base64 = (content: Buffer): string =>
  createHash('md5').update(content).digest('base64');

/** MD5 в base64 по файлу на диске. */
export const md5Base64OfFile = (file: string): string => md5Base64(readFileSync(file));

/**
 * Размер JPEG в пикселях из маркера SOF.
 *
 * Нужен для проверки пункта 7 Порядка (приказ № 112): материалы фотофиксации
 * представляются в формате JPEG с разрешением не менее 5 Мпикс.
 */
export const jpegSize = (data: Buffer): { height: number; width: number } | undefined => {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return undefined;
  let position = 2;
  while (position < data.length) {
    if (data[position] !== 0xff) {
      position += 1;
      continue;
    }
    let marker = 0xff;
    while (position < data.length && marker === 0xff) {
      position += 1;
      marker = data[position];
    }
    // маркеры без полезной нагрузки
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      position += 1;
      continue;
    }
    position += 1;
    if (position + 2 > data.length) return undefined;
    const length = data.readUInt16BE(position);
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (position + 7 > data.length) return undefined;
      return { height: data.readUInt16BE(position + 3), width: data.readUInt16BE(position + 5) };
    }
    position += length;
  }
  return undefined;
};

export const JPEG_EXTENSION = /\.jpe?g$/i;

/** Собирает по байтам всё, что нужно проверкам отчёта. */
export const factsOf = (name: string, content: Buffer): AttachmentFacts => {
  const isJpeg = JPEG_EXTENSION.test(name);
  return {
    image: isJpeg ? jpegSize(content) : undefined,
    isJpeg,
    md5: md5Base64(content),
    size: content.length,
  };
};
