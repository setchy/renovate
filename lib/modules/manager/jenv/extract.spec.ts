import { extractPackageFile } from './extract';

describe('modules/manager/jenv/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('11\n');
      expect(res.deps).toEqual([
        {
          currentValue: '11',
          datasource: 'java-version',
          depName: 'java',
        },
      ]);
    });
  });
});
