'use strict';
import ScriptMetadata from './ScriptMetadata';
const scriptTestDir = './test/scriptTestDir';

let currentVersion;
let scriptMetadata;
describe("Given a ScriptMetadata and the test directory", function() {
  beforeEach(() => {
    scriptMetadata = new ScriptMetadata(scriptTestDir);
  });
  describe('When there is no current version', () => {
    beforeEach(() => {
      currentVersion = undefined;
    });

    it("Then all the upgrade files are returned", function() {
      expect(scriptMetadata.getNewUpgradeFiles(currentVersion)).toEqual(['0.0.1.groovy', '0.0.2.groovy', '1.0.1.groovy', '1.0.101.groovy', '1.1.10.groovy']);
    });
  });
  describe('When the current version is 1.0.1', () => {
    beforeEach(() => {
      currentVersion = '1.0.1';
    });

    it("Then all the upgrade files with a version number after than number are returned", function() {
      expect(scriptMetadata.getNewUpgradeFiles(currentVersion)).toEqual(['1.0.101.groovy', '1.1.10.groovy']);
    });
    
    it("Then all the upgrade files with a version number after than number are returned", function() {
      expect(scriptMetadata.getFileContents('1.0.1.groovy')).toEqual('// I am empty!');
    });
  });
});