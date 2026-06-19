import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { Navigate, Outlet } from 'react-router';

import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import Sidebar from './Sidebar';
import { styles } from './style';

const Layout: FC = () => {
  const showMarket = useServerConfigStore((s) => featureFlagsSelectors(s).showMarket);

  // Acensus B2B build: market is disabled — redirect /community* to /agent-presets
  if (!showMarket) return <Navigate replace to="/agent-presets" />;

  return (
    <>
      <Sidebar />
      <Flexbox className={styles.mainContainer} flex={1} height={'100%'}>
        <Outlet />
      </Flexbox>
    </>
  );
};

export default Layout;
