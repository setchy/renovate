import { JavaVersionDatasource } from '../../datasource/java-version';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'eclipse-temurin',
    currentValue: content.trim(),
    datasource: JavaVersionDatasource.id,
  };
  return { deps: [dep] };
}
