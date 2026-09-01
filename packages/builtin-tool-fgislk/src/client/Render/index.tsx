'use client';

import { DownloadOutlined, FileZipOutlined } from '@ant-design/icons';
import type { BuiltinRenderProps } from '@lobechat/types';
import { Button, Flexbox, Text } from '@lobehub/ui';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { FgisLkApiName, type BuildReportState, type MigrateReportState } from '../../types';

type DownloadableState = BuildReportState | MigrateReportState;

const DownloadPackage = memo<BuiltinRenderProps<Record<string, unknown>, DownloadableState>>(
  ({ pluginState }) => {
    const { t } = useTranslation('plugin');

    const handleDownload = useCallback(async () => {
      if (!pluginState?.downloadUrl || !pluginState.filename) return;

      try {
        const response = await fetch(pluginState.downloadUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blobUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = pluginState.filename;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(pluginState.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    }, [pluginState?.downloadUrl, pluginState?.filename]);

    if (!pluginState?.ready || !pluginState.downloadUrl || !pluginState.filename) return null;

    return (
      <Flexbox horizontal align={'center'} gap={12} justify={'space-between'}>
        <Flexbox horizontal align={'center'} gap={8}>
          <FileZipOutlined />
          <Text code>{pluginState.filename}</Text>
        </Flexbox>
        <Button icon={DownloadOutlined} size={'small'} type={'primary'} onClick={handleDownload}>
          {t('builtins.lobe-fgislk.download')}
        </Button>
      </Flexbox>
    );
  },
);

DownloadPackage.displayName = 'FgisLkDownloadPackage';

export const FgisLkRenders = {
  [FgisLkApiName.buildReport]: DownloadPackage,
  [FgisLkApiName.migrateReport]: DownloadPackage,
};
