import { Flexbox } from '@lobehub/ui';

import AgentPresetsAdmin from '@/features/AgentPresets/Admin';
import NavHeader from '@/features/NavHeader';

const AgentPresetsAdminPage = () => {
  return (
    <>
      <NavHeader />
      <Flexbox align="center" height="100%" style={{ overflowY: 'auto' }} width="100%">
        <AgentPresetsAdmin />
      </Flexbox>
    </>
  );
};

export default AgentPresetsAdminPage;
