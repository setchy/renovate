import { extractPackageFile } from './extract';

describe('modules/manager/jenv/extract', () => {
  describe('extractPackageFile()', () => {
    it('handles version only (major.minor)', () => {
      const res = extractPackageFile('11.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '11.0',
          datasource: 'java-version',
          depName: 'java',
        },
      ]);
    });

    it('handles variety and version', () => {
      const res = extractPackageFile('temurin64-11.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '11.0',
          datasource: 'java-version',
          depName: 'temurin64',
        },
      ]);
    });
  });
});
