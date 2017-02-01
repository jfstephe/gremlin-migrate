var projectRoot = './';
var srcRoot = 'src/';
var distRoot = 'dist/';
var exportRoot = 'export/';
var isExport = false;

function getIsExport() {
  return isExport;
}

function setIsExport(isExportParam) {
  isExport = isExportParam;
}

function getOutputRoot() {
  return isExport ? exportRoot : distRoot;
}


function getOutputUpgradeScripts() {
  return getOutputRoot() + 'upgradeScripts/';
}

module.exports = {
  projectRoot: projectRoot,
  testFilesToExclude: ['!' + srcRoot + '**/*.spec.ts', '!' + srcRoot + '**/*.step.ts'],
  getSourceAppOnlyTs: function getSourceTs() {
    return [srcRoot + '**/*.ts'].concat(this.testFilesToExclude);
  },
  getSourceTs: function getSourceTs() {
    var sourceTsArray;
    if (this.getIsExport()) {
      sourceTsArray = this.getSourceAppOnlyTs();
    }
    else {
      sourceTsArray = [srcRoot + '**/*.ts'];
    }
    return sourceTsArray;
  },
  upgradeScriptDirectory: srcRoot + 'upgradeScripts/**/*',
  jsonFiles: srcRoot + '**/*.json',
  packageJson: projectRoot + 'package.json',
  getOutputPackageJson: function getOutputPackageJson() { return getOutputRoot() + 'package.json'; },
  getOutputRoot: getOutputRoot,
  getOutputUpgradeScripts: getOutputUpgradeScripts,
  getOutputJs: function getOutputJs() { return getOutputRoot() + '**/*.js'; },
  getSpecFiles: function getSpecFiles() { return distRoot + '**/*.spec.js'; },
  typings: projectRoot + 'typings.json',
  dtsSrc: [
    './typings/**/*.d.ts',
    './custom_typings/**/*.d.ts'
  ], 
  getIsExport: getIsExport, 
  setIsExport: setIsExport
}