'use client';

import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { Outlet } from 'react-router';

import SideBar from '@/routes/(main)/settings/_layout/SideBar';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import SettingsContextProvider from './ContextProvider';
import { styles } from './style';

const Layout: FC = () => {
  const { showOpenAIApiKey, showOpenAIProxyUrl } = useServerConfigStore(featureFlagsSelectors);

  return (
    <SettingsContextProvider
      value={{
        showOpenAIApiKey,
        showOpenAIProxyUrl,
      }}
    >
      <SideBar />
      <Flexbox className={styles.mainContainer} flex={1} height={'100%'}>
        <Outlet />
      </Flexbox>
    </SettingsContextProvider>
  );
};

export default Layout;
