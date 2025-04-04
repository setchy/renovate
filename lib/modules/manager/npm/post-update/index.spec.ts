// TODO: add tests
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import type { FileChange } from '../../../../util/git/types';
import type { PostUpdateConfig } from '../../types';
import * as npm from './npm';
import * as pnpm from './pnpm';
import * as rules from './rules';
import type { AdditionalPackageFiles } from './types';
import * as yarn from './yarn';
import {
  determineLockFileDirs,
  getAdditionalFiles,
  updateYarnBinary,
  writeExistingFiles,
  writeUpdatedPackageFiles,
} from './';
import { Fixtures } from '~test/fixtures';
import { fs, git, logger, partial, scm } from '~test/util';

vi.mock('../../../../util/fs');
vi.mock('./npm');
vi.mock('./yarn');
vi.mock('./pnpm');

describe('modules/manager/npm/post-update/index', () => {
  let baseConfig: PostUpdateConfig;
  let updateConfig: PostUpdateConfig;
  const additionalFiles: AdditionalPackageFiles = {
    npm: [
      { packageFile: 'dummy.txt' },
      {
        packageFile: 'packages/core/package.json',
        managerData: {
          npmLock: 'package-lock.json',
        },
        npmrc: '#dummy',
      },
      {
        packageFile: 'packages/cli/package.json',
        managerData: {
          yarnLock: 'yarn.lock',
        },
      },
      {
        packageFile: 'packages/test/package.json',
        managerData: {
          yarnLock: 'yarn.lock',
        },
      },
      {
        packageFile: 'packages/pnpm/package.json',
        managerData: {
          pnpmShrinkwrap: 'packages/pnpm/pnpm-lock.yaml',
        },
      },
    ],
  };

  beforeEach(() => {
    GlobalConfig.set({ localDir: '' });
    baseConfig = partial<PostUpdateConfig>({
      upgrades: [],
    });
    updateConfig = {
      ...baseConfig,
      upgrades: [
        {
          isRemediation: true,
        },
        {
          depName: 'postcss',
          isRemediation: true,
          managerData: {
            npmLock: 'package-lock.json',
          },
          rangeStrategy: 'widen',
        },
        {
          depName: 'core-js',
          isRemediation: true,
          managerData: {
            npmLock: 'randomFolder/package-lock.json',
          },
          lockFiles: ['randomFolder/package-lock.json'],
          rangeStrategy: 'pin',
        },
        {
          isLockfileUpdate: true,
          managerData: {
            npmLock: 'package-lock.json',
          },
        },
        {
          managerData: {
            yarnLock: 'yarn.lock',
          },
          isLockfileUpdate: true,
        },
      ],
      updatedPackageFiles: [
        {
          type: 'addition',
          path: 'dummy.txt',
          contents: '',
        },
        {
          type: 'deletion',
          path: 'some.txt',
        },
        {
          type: 'addition',
          path: 'package-lock.json',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'yarn.lock',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'packages/pnpm/pnpm-lock.yaml',
          contents: '',
        },
        {
          type: 'addition',
          path: 'packages/core/package.json',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'packages/cli/package.json',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'packages/pnpm/package.json',
          contents: '{}',
        },
        {
          type: 'addition',
          path: 'package.json',
          contents: '{}',
        },
      ],
    };

    // reset mocked version
    fs.getParentDir.mockImplementation((p) => upath.parse(p).dir);
  });

  describe('determineLockFileDirs()', () => {
    it('works', () => {
      expect(
        determineLockFileDirs(
          updateConfig,

          additionalFiles,
        ),
      ).toStrictEqual({
        npmLockDirs: ['package-lock.json', 'randomFolder/package-lock.json'],
        pnpmShrinkwrapDirs: ['packages/pnpm/pnpm-lock.yaml'],
        yarnLockDirs: ['yarn.lock'],
      });
    });

    it('lockfile maintenance', () => {
      expect(
        determineLockFileDirs(
          {
            ...baseConfig,
            upgrades: [
              {
                isLockfileUpdate: true,
                managerData: {
                  yarnLock: 'yarn.lock',
                },
              },
            ],
          },
          {},
        ),
      ).toStrictEqual({
        npmLockDirs: [],
        pnpmShrinkwrapDirs: [],
        yarnLockDirs: ['yarn.lock'],
      });
    });
  });

  describe('writeExistingFiles()', () => {
    it('works', async () => {
      git.getFile.mockResolvedValueOnce(
        Fixtures.get('update-lockfile-massage-1/package-lock.json'),
      );
      await expect(
        writeExistingFiles(updateConfig, additionalFiles),
      ).resolves.toBeUndefined();

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      expect(fs.deleteLocalFile).not.toHaveBeenCalled();
      expect(git.getFile).toHaveBeenCalledOnce();
    });

    it('writes .npmrc files', async () => {
      await writeExistingFiles(updateConfig, {
        npm: [
          // This package's npmrc should be written verbatim.
          {
            packageFile: 'packages/core/package.json',
            npmrc: '#dummy',
            managerData: {},
          },
          // No npmrc content should be written for this package.
          { packageFile: 'packages/core/package.json', managerData: {} },
        ],
      });

      expect(fs.writeLocalFile).toHaveBeenCalledOnce();
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'packages/core/.npmrc',
        '#dummy\n',
      );
    });

    it('only sources npmrc content from package config', async () => {
      await writeExistingFiles(
        { ...updateConfig, npmrc: '#foobar' },
        {
          npm: [
            // This package's npmrc should be written verbatim.
            {
              packageFile: 'packages/core/package.json',
              npmrc: '#dummy',
              managerData: {},
            },
            // No npmrc content should be written for this package.
            { packageFile: 'packages/core/package.json', managerData: {} },
          ],
        },
      );

      expect(fs.writeLocalFile).toHaveBeenCalledOnce();
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'packages/core/.npmrc',
        '#dummy\n',
      );
    });

    it('works only on relevant folders', async () => {
      git.getFile.mockResolvedValueOnce(
        Fixtures.get('update-lockfile-massage-1/package-lock.json'),
      );
      await expect(
        writeExistingFiles(updateConfig, additionalFiles),
      ).resolves.toBeUndefined();

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      expect(fs.deleteLocalFile).not.toHaveBeenCalled();
      expect(git.getFile).toHaveBeenCalledOnce();
    });

    it('has no npm files', async () => {
      await expect(writeExistingFiles(baseConfig, {})).toResolve();
    });
  });

  describe('writeUpdatedPackageFiles()', () => {
    it('works', async () => {
      await writeUpdatedPackageFiles({
        ...updateConfig,
        upgrades: [{ gitRef: true }],
      });
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(6);
    });

    it('missing updated packages files', async () => {
      await expect(
        writeUpdatedPackageFiles(baseConfig),
      ).resolves.toBeUndefined();
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
    });
  });

  describe('updateYarnBinary()', () => {
    const lockFileDir = `path/to/lockfile`;
    const oldYarnrcYml = `yarnPath: .yarn/releases/yarn-3.0.1.cjs\na: b\n`;
    const newYarnrcYml = `yarnPath: .yarn/releases/yarn-3.0.2.cjs\nc: d\n`;
    const newYarn = `new yarn\n`;

    it('should update the Yarn binary', async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined,
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toMatchSnapshot();
    });

    it('should return .yarnrc.yml content if it has been overwritten', async () => {
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      const updatedArtifacts: FileChange[] = [];
      const existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        oldYarnrcYml,
      );
      expect(git.getFile).not.toHaveBeenCalled();
      expect(existingYarnrcYmlContent).toMatchSnapshot();
      expect(updatedArtifacts).toMatchSnapshot();
    });

    it("should not update the Yarn binary if the old .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined,
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should not update the Yarn binary if the new .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined,
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should return existing .yarnrc.yml if the new one doesn't exist", async () => {
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      const updatedArtifacts: FileChange[] = [];
      const existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        oldYarnrcYml,
      );
      expect(existingYarnrcYmlContent).toMatch(oldYarnrcYml);
      expect(updatedArtifacts).toBeEmpty();
    });

    it('should support Yarn with corepack', async () => {
      git.getFile.mockResolvedValueOnce('');
      fs.readLocalFile.mockResolvedValueOnce('');
      fs.readLocalFile.mockResolvedValueOnce('');
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        '',
      );
      expect(yarnrcYmlContent).toBe('');
      expect(updatedArtifacts).toEqual([]);
      expect(logger.logger.debug).not.toHaveBeenCalled();
      expect(logger.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('getAdditionalFiles()', () => {
    const spyNpm = vi.spyOn(npm, 'generateLockFile');
    const spyYarn = vi.spyOn(yarn, 'generateLockFile');
    const spyPnpm = vi.spyOn(pnpm, 'generateLockFile');
    const spyProcessHostRules = vi.spyOn(rules, 'processHostRules');

    beforeEach(() => {
      spyNpm.mockResolvedValue({});
      spyPnpm.mockResolvedValue({});
      spyYarn.mockResolvedValue({});
      spyProcessHostRules.mockReturnValue({
        additionalNpmrcContent: [],
        additionalYarnRcYml: undefined,
      });
    });

    it('works', async () => {
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('works for npm', async () => {
      spyNpm.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      fs.readLocalFile.mockImplementation((f): Promise<string> => {
        if (f === '.npmrc') {
          return Promise.resolve('# dummy');
        }
        return Promise.resolve('');
      });
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true, reuseExistingBranch: true },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'package-lock.json',
            contents: '{}',
          },
        ],
      });

      expect(fs.readLocalFile).toHaveBeenCalledWith('.npmrc', 'utf8');
      expect(fs.writeLocalFile).toHaveBeenCalledWith('.npmrc', '# dummy');
      expect(fs.deleteLocalFile.mock.calls).toMatchObject([
        ['randomFolder/.npmrc'],
        ['packages/pnpm/.npmrc'],
      ]);
    });

    it('detects if lock file contents are unchanged(reuseExistingBranch=true)', async () => {
      spyNpm.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      fs.readLocalFile.mockImplementation((f): Promise<any> => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      git.getFile.mockImplementation((f) => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      expect(
        (
          await getAdditionalFiles(
            {
              ...updateConfig,
              updateLockFiles: true,
              reuseExistingBranch: true,
            },
            additionalFiles,
          )
        ).updatedArtifacts.find((a) => a.path === 'package-lock.json'),
      ).toBeUndefined();
    });

    // for coverage run once when not reusing the branch
    it('detects if lock file contents are unchanged(reuseExistingBranch=false)', async () => {
      spyNpm.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      fs.readLocalFile.mockImplementation((f): Promise<any> => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      git.getFile.mockImplementation((f) => {
        if (f === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      expect(
        (
          await getAdditionalFiles(
            {
              ...updateConfig,
              updateLockFiles: true,
              reuseExistingBranch: false,
              baseBranch: 'base',
            },
            additionalFiles,
          )
        ).updatedArtifacts.find((a) => a.path === 'package-lock.json'),
      ).toBeUndefined();
    });

    it('works for yarn', async () => {
      spyYarn.mockResolvedValueOnce({ error: false, lockFile: '{}' });
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true, reuseExistingBranch: true },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: '{}',
          },
        ],
      });
      expect(fs.deleteLocalFile).toHaveBeenCalled();
    });

    it('works for pnpm', async () => {
      spyPnpm.mockResolvedValueOnce({
        error: false,
        lockFile: 'some-contents:',
      });
      expect(
        await getAdditionalFiles(
          {
            ...updateConfig,
            updateLockFiles: true,
            reuseExistingBranch: true,
            upgrades: [
              {
                isRemediation: true,
                packageFile: 'packages/pnpm/package.json',
              },
            ],
          },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'packages/pnpm/pnpm-lock.yaml',
            contents: 'some-contents:',
          },
        ],
      });
      expect(fs.deleteLocalFile).toHaveBeenCalled();
    });

    it('no npm files', async () => {
      expect(await getAdditionalFiles(baseConfig, {})).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('no lockfiles updates', async () => {
      expect(
        await getAdditionalFiles(baseConfig, additionalFiles),
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('reuse existing up-to-date', async () => {
      expect(
        await getAdditionalFiles(
          {
            ...baseConfig,
            reuseExistingBranch: true,
            upgrades: [{ isLockfileUpdate: true }],
            updateLockFiles: true,
          },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('lockfile maintenance branch exists', async () => {
      // TODO: can this really happen?
      scm.branchExists.mockResolvedValueOnce(true);
      expect(
        await getAdditionalFiles(
          {
            ...baseConfig,
            upgrades: [{ isLockfileUpdate: false }],
            reuseExistingBranch: true,
            isLockFileMaintenance: true,
            updateLockFiles: true,
          },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [],
        updatedArtifacts: [],
      });
    });

    it('fails for npm', async () => {
      spyNpm.mockResolvedValueOnce({ error: true, stderr: 'some-error' });
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [
          { lockFile: 'package-lock.json', stderr: 'some-error' },
        ],
        updatedArtifacts: [],
      });
    });

    it('fails for yarn', async () => {
      spyYarn.mockResolvedValueOnce({ error: true, stdout: 'some-error' });
      expect(
        await getAdditionalFiles(
          { ...updateConfig, updateLockFiles: true, reuseExistingBranch: true },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [{ lockFile: 'yarn.lock', stderr: 'some-error' }],
        updatedArtifacts: [],
      });
    });

    it('fails for pnpm', async () => {
      spyPnpm.mockResolvedValueOnce({ error: true, stdout: 'some-error' });
      expect(
        await getAdditionalFiles(
          {
            ...updateConfig,
            updateLockFiles: true,
            upgrades: [
              {
                isRemediation: true,
                packageFile: 'packages/pnpm/package.json',
              },
            ],
          },
          additionalFiles,
        ),
      ).toStrictEqual({
        artifactErrors: [
          { lockFile: 'packages/pnpm/pnpm-lock.yaml', stderr: 'some-error' },
        ],
        updatedArtifacts: [],
      });
    });

    describe('should fuzzy merge yarn npmRegistries', () => {
      beforeEach(() => {
        spyProcessHostRules.mockReturnValue({
          additionalNpmrcContent: [],
          additionalYarnRcYml: {
            npmRegistries: {
              '//my-private-registry': {
                npmAuthToken: 'xxxxxx',
              },
            },
          },
        });
        fs.getSiblingFileName.mockReturnValue('.yarnrc.yml');
      });

      it('should fuzzy merge the yarnrc Files', async () => {
        vi.mocked(yarn.fuzzyMatchAdditionalYarnrcYml).mockReturnValue({
          npmRegistries: {
            'https://my-private-registry': { npmAuthToken: 'xxxxxx' },
          },
        });
        fs.readLocalFile.mockImplementation((f): Promise<any> => {
          if (f === '.yarnrc.yml') {
            return Promise.resolve(
              'npmRegistries:\n' +
                '  https://my-private-registry:\n' +
                '    npmAlwaysAuth: true\n',
            );
          }
          return Promise.resolve(null);
        });

        spyYarn.mockResolvedValueOnce({ error: false, lockFile: '{}' });
        await getAdditionalFiles(
          {
            ...updateConfig,
            updateLockFiles: true,
            reuseExistingBranch: true,
          },
          additionalFiles,
        );
        expect(fs.writeLocalFile).toHaveBeenCalledWith(
          '.yarnrc.yml',
          'npmRegistries:\n' +
            '  https://my-private-registry:\n' +
            '    npmAlwaysAuth: true\n' +
            '    npmAuthToken: xxxxxx\n',
        );
      });

      it('should warn if there is an error writing the yarnrc.yml', async () => {
        fs.readLocalFile.mockImplementation((f): Promise<any> => {
          if (f === '.yarnrc.yml') {
            return Promise.resolve(
              `yarnPath: .yarn/releases/yarn-3.0.1.cjs\na: b\n`,
            );
          }
          return Promise.resolve(null);
        });

        fs.writeLocalFile.mockImplementation((f): Promise<any> => {
          if (f === '.yarnrc.yml') {
            throw new Error();
          }
          return Promise.resolve(null);
        });

        spyYarn.mockResolvedValueOnce({ error: false, lockFile: '{}' });

        await expect(
          getAdditionalFiles(
            {
              ...updateConfig,
              updateLockFiles: true,
              reuseExistingBranch: true,
            },
            additionalFiles,
          ),
        ).rejects.toThrow();

        expect(logger.logger.warn).toHaveBeenCalledWith(
          expect.anything(),
          'Error appending .yarnrc.yml content',
        );
      });
    });
  });
});
