import { extractPackageFile } from './extract';

describe('modules/manager/jenv/extract', () => {
  describe('extractPackageFile()', () => {
    it('defaults to openjdk if no java variety specified', () => {
      const res = extractPackageFile('11.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '11.0',
          datasource: 'docker',
          depName: 'openjdk',
        },
      ]);
    });

    it('will return eclipse-temurin is temurin variety specified', () => {
      const res = extractPackageFile('temurin64-11.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '11.0',
          datasource: 'docker',
          depName: 'eclipse-temurin',
        },
      ]);
    });

    it('will return amazoncorretto if corretto variety specified', () => {
      const res = extractPackageFile('corretto64-11.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '11.0',
          datasource: 'docker',
          depName: 'amazoncorretto',
        },
      ]);
    });
  });
});
