import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: getDepName(content),
    currentValue: getCurrentValue(content),
    datasource: DockerDatasource.id,
  };
  return { deps: [dep] };
}

function getDepName(content: string): string {
  if (content.startsWith('temurin')) {
    return 'eclipse-temurin';
  } else if (content.startsWith('corretto')) {
    return 'amazoncorretto';
  }

  return 'openjdk';
}

function getCurrentValue(content: string): string {
  if (content.includes('-')) {
    return content.split('-')[1].trim();
  }

  return content.trim();
}
