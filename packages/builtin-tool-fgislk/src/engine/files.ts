/** Работа с вложениями: контрольные суммы и проверка фотоматериалов. */
import { createHash } from 'node:crypto';
import { openSync, readFileSync, readSync, closeSync } from 'node:fs';

/** MD5 файла в base64 — именно в таком виде он указывается в описи пакета. */
export const md5Base64 = (file: string): string =>
  createHash('md5').update(readFileSync(file)).digest('base64');

/**
 * Размер JPEG в пикселях из маркера SOF.
 *
 * Нужен для проверки пункта 7 Порядка (приказ № 112): материалы фотофиксации
 * представляются в формате JPEG с разрешением не менее 5 Мпикс.
 */
export const jpegSize = (file: string): { height: number; width: number } | undefined => {
  const fd = openSync(file, 'r');
  try {
    const two = Buffer.alloc(2);
    if (readSync(fd, two, 0, 2, 0) !== 2 || two[0] !== 0xff || two[1] !== 0xd8) return undefined;
    let position = 2;
    const byte = Buffer.alloc(1);
    for (;;) {
      if (readSync(fd, byte, 0, 1, position) !== 1) return undefined;
      position += 1;
      if (byte[0] !== 0xff) continue;
      let marker = 0xff;
      while (marker === 0xff) {
        if (readSync(fd, byte, 0, 1, position) !== 1) return undefined;
        position += 1;
        marker = byte[0];
      }
      // маркеры без полезной нагрузки
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const lengthBuf = Buffer.alloc(2);
      if (readSync(fd, lengthBuf, 0, 2, position) !== 2) return undefined;
      const length = lengthBuf.readUInt16BE(0);
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        const sof = Buffer.alloc(5);
        if (readSync(fd, sof, 0, 5, position + 2) !== 5) return undefined;
        return { height: sof.readUInt16BE(1), width: sof.readUInt16BE(3) };
      }
      position += length;
    }
  } finally {
    closeSync(fd);
  }
};
