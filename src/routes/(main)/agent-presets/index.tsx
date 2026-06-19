import { Flexbox } from '@lobehub/ui';

import AgentPresets from '@/features/AgentPresets';
import NavHeader from '@/features/NavHeader';

const AgentPresetsPage = () => {
  return (
    <>
      <NavHeader />
      <Flexbox align="center" height="100%" style={{ overflowY: 'auto' }} width="100%">
        <AgentPresets />
      </Flexbox>
    </>
  );
};

export default AgentPresetsPage;
