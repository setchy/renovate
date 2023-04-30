import type { ProgrammingLanguage } from '../../../constants';
import { JavaVersionDatasource } from '../../datasource/java-version';
import * as semverCoercedVersioning from '../../versioning/semver-coerced';

export { extractPackageFile } from './extract';

export const displayName = 'jEnv';
export const url = 'https://github.com/jenv/jenv';

export const language: ProgrammingLanguage = 'java';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.java-version$'],
  versioning: semverCoercedVersioning.id,
};

export const supportedDatasources = [JavaVersionDatasource.id];
