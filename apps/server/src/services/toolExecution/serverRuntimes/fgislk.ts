import { FgisLkManifest } from '@lobechat/builtin-tool-fgislk/manifest';
import { FgisLkExecutionRuntime } from '@lobechat/builtin-tool-fgislk/executionRuntime';

import { type ServerRuntimeRegistration } from './types';

/**
 * ФГИС ЛК: формирование и проверка отчётности.
 * Контекст запроса не нужен — рантайм создаётся один раз.
 */
const runtime = new FgisLkExecutionRuntime();

export const fgisLkRuntime: ServerRuntimeRegistration = {
  factory: () => runtime,
  identifier: FgisLkManifest.identifier,
};
