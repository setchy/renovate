import { JavaVersionDatasource } from '../../datasource/java-version';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: getPackageName(content),
    currentValue: getCurrentValue(content),
    datasource: JavaVersionDatasource.id,
  };
  return { deps: [dep] };
}

function getPackageName(content: string): string {
  if (content.includes('-')) {
    return content.split('-')[0].trim();
  }

  return 'java';
}

function getCurrentValue(content: string): string {
  if (content.includes('-')) {
    return content.split('-')[1].trim();
  }

  return content.trim();
}
