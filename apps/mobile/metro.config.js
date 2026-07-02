const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const reactQueryLegacyPath = path.join(
  path.dirname(require.resolve('@tanstack/react-query/package.json')),
  'build/legacy'
);
const queryCoreLegacyPath = path.join(
  path.dirname(require.resolve('@tanstack/query-core/package.json')),
  'build/legacy'
);

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
  '@tanstack/query-core': queryCoreLegacyPath
};

module.exports = config;
