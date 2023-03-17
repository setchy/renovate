import type { ProgrammingLanguage } from '../../../constants';
import { JavaVersionDatasource } from '../../datasource/java-version';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const displayName = 'jenv';
export const url = 'https://github.com/jenv/jenv';

export const language: ProgrammingLanguage = 'java';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.java-version$'],
  versioning: semverVersioning.id,
};

export const supportedDatasources = [JavaVersionDatasource.id];
