'use client';

import { memo } from 'react';
import { Outlet } from 'react-router';

import MobileContentLayout from '@/components/server/MobileNavLayout';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import SettingsContextProvider from '../../../(main)/settings/_layout/ContextProvider';
import Header from './Header';

const MobileSettingsWrapper = memo(() => {
  const { showOpenAIApiKey, showOpenAIProxyUrl } = useServerConfigStore(featureFlagsSelectors);

  return (
    <SettingsContextProvider
      value={{
        showOpenAIApiKey,
        showOpenAIProxyUrl,
      }}
    >
      <MobileContentLayout header={<Header />}>
        <Outlet />
      </MobileContentLayout>
    </SettingsContextProvider>
  );
});

MobileSettingsWrapper.displayName = 'MobileSettingsWrapper';

export default MobileSettingsWrapper;
