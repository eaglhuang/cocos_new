const path = require('path');
const tsconfigPaths = require('tsconfig-paths');
const ts = require('typescript');

const configPath = path.resolve(__dirname, '..', 'tsconfig.test.json');
const readResult = ts.readConfigFile(configPath, ts.sys.readFile);
if (readResult.error) {
  throw new Error(ts.flattenDiagnosticMessageText(readResult.error.messageText, '\n'));
}
const tsconfig = readResult.config;

tsconfigPaths.register({
  baseUrl: path.resolve(__dirname, '..'),
  paths: tsconfig.compilerOptions.paths || {},
});
