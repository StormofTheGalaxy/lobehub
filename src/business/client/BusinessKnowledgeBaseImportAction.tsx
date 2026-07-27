'use client';

import { Button } from '@lobehub/ui/base-ui';
import { useState } from 'react';

import { lambdaClient } from '@/libs/trpc/client';

import { runAction } from './components/runAction';

export interface BusinessKnowledgeBaseImportActionProps {
  knowledgeBaseId: string;
}

const BusinessKnowledgeBaseImportAction = ({
  knowledgeBaseId,
}: BusinessKnowledgeBaseImportActionProps) => {
  const [importing, setImporting] = useState(false);

  // The copy is a server round-trip with nothing on screen to show its result,
  // so it reports both outcomes instead of being fired and forgotten.
  const importToPersonal = async () => {
    setImporting(true);
    await runAction(
      () =>
        lambdaClient.knowledgeBase.copyKnowledgeBaseToWorkspace.mutate({
          id: knowledgeBaseId,
          targetWorkspaceId: null,
        }),
      {
        errorTitle: 'Не удалось импортировать базу знаний',
        successTitle: 'База знаний скопирована в личное пространство',
      },
    );
    setImporting(false);
  };

  return (
    <Button loading={importing} size={'small'} onClick={importToPersonal}>
      Импортировать в личное пространство
    </Button>
  );
};

export default BusinessKnowledgeBaseImportAction;
