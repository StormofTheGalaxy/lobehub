import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { createReportPackage } from '.';

describe('createReportPackage', () => {
  it('кладёт готовый XML и исходные вложения в один ZIP-архив', () => {
    const photo = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const archive = unzipSync(
      createReportPackage('\ufeff<forestReproduction />', new Map([['IMG_2465.PNG', photo]])),
    );

    expect(Object.keys(archive).sort()).toEqual(['IMG_2465.PNG', 'forestReproduction.xml']);
    expect(Buffer.from(archive['forestReproduction.xml']!)).toEqual(
      Buffer.from('\ufeff<forestReproduction />'),
    );
    expect(Buffer.from(archive['IMG_2465.PNG']!)).toEqual(photo);
  });
});
