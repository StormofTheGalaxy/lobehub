import { type PropsWithChildren } from 'react';
import { memo } from 'react';

import { useModelHasContextWindowToken } from '@/hooks/useModelHasContextWindowToken';
import dynamic from '@/libs/next/dynamic';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

const LargeTokenContent = dynamic(() => import('./TokenTag'), { ssr: false });

const Token = memo<PropsWithChildren>(({ children }) => {
  const { enableTokenCounter } = useServerConfigStore(featureFlagsSelectors);
  const showTag = useModelHasContextWindowToken();

  return enableTokenCounter !== false && showTag && children;
});

const ContextWindow = memo(() => {
  return (
    <Token>
      <LargeTokenContent />
    </Token>
  );
});

ContextWindow.displayName = 'ContextWindow';

export default ContextWindow;
