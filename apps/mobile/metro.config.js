const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const reactQueryLegacyPath = path.join(
  path.dirname(require.resolve('@tanstack/react-query/package.json')),
  'build/legacy'
);

function resolveOptionalPackage(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    return null;
  }
}

const queryCorePackageRoot = resolveOptionalPackage('@tanstack/query-core');
const queryCoreLegacyPath = queryCorePackageRoot
  ? path.join(queryCorePackageRoot, 'build/legacy')
  : null;

const config = getDefaultConfig(projectRoot);

// SDK 51 still needs the workspace folders listed explicitly in a monorepo,
// but Expo's resolver should otherwise stay in control.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@tanstack/react-query': reactQueryLegacyPath,
  ...(queryCoreLegacyPath ? { '@tanstack/query-core': queryCoreLegacyPath } : {})
};

module.exports = config;
