import { FgisLkManifest } from '@lobechat/builtin-tool-fgislk/manifest';
import { FgisLkExecutionRuntime } from '@lobechat/builtin-tool-fgislk/executionRuntime';
import { type ReportFileSink } from '@lobechat/builtin-tool-fgislk';

import { FileModel } from '@/database/models/file';
import { FileService } from '@/server/services/file';

import { type ServerRuntimeRegistration } from './types';

/**
 * ФГИС ЛК: формирование и проверка отчётности.
 *
 * Рантайм создаётся под запрос: готовый XML отдаётся пользователю файлом на
 * скачивание, а для этого нужен доступ к хранилищу от имени текущего
 * пользователя. Без пользователя и БД инструмент продолжает работать — просто
 * без выгрузки файла, о чём он сообщает в ответе явно.
 */
export const fgisLkRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.userId || !context.serverDB) return new FgisLkExecutionRuntime();

    const fileService = new FileService(context.serverDB, context.userId, context.workspaceId);

    const fileModel = new FileModel(context.serverDB, context.userId);

    const sink: ReportFileSink = {
      /**
       * Файл, загруженный пользователем в переписку.
       *
       * Ищем по имени, а не по идентификатору: модель видит в диалоге имя файла
       * («IMG_2465.jpg»), а внутренний id ей неизвестен. Поиск ограничен файлами
       * этого пользователя. При нескольких совпадениях берём последний
       * загруженный — это тот файл, который человек только что приложил.
       */
      read: async (filename) => {
        const found = await fileModel.findByNames([filename]);
        const exact = found.filter((item) => item.name === filename);
        const candidates = exact.length > 0 ? exact : found;
        if (candidates.length === 0) return undefined;

        const newest = candidates.reduce((a, b) =>
          new Date(a.createdAt) >= new Date(b.createdAt) ? a : b,
        );
        if (!newest.url) return undefined;

        const bytes = await fileService.getFileByteArray(newest.url);
        return Buffer.from(bytes);
      },

      upload: async ({ content, filename, mimeType }) => {
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
        const day = new Date().toISOString().slice(0, 10);
        // Ключ уникален по операции, а отображаемое имя остаётся неизменным:
        // техническая опись пакета ФГИС ЛК ссылается на вложение по имени.
        const pathname = `fgislk-reports/${day}/${context.topicId ?? 'no-topic'}/${Date.now()}-${filename}`;
        const { fileId, url } = await fileService.uploadFromBuffer(buffer, mimeType, pathname);

        return { fileId, filename, size: buffer.length, url };
      },
    };

    return new FgisLkExecutionRuntime({ sink });
  },
  identifier: FgisLkManifest.identifier,
};
