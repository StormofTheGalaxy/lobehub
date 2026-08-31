/**
 * Отдача готового документа пользователю файлом.
 *
 * Пакет не знает ничего про хранилище приложения: сервер передаёт сюда
 * реализацию, а инструмент лишь просит «сохрани эти байты и дай ссылку».
 * Так пакет остаётся без серверных зависимостей и тестируется без них же.
 */
export interface UploadedFile {
  /** Идентификатор записи файла в приложении. */
  fileId: string;
  /** Имя файла для пользователя. */
  filename: string;
  size: number;
  /** Постоянная ссылка вида /f/:id. */
  url: string;
}

export interface ReportFileSink {
  /**
   * Прочитать файл, загруженный пользователем в переписку, по его имени.
   * Возвращает undefined, если такого файла нет.
   */
  read?(filename: string): Promise<Buffer | undefined>;

  upload(params: {
    content: Buffer | string;
    filename: string;
    mimeType: string;
  }): Promise<UploadedFile>;
}
