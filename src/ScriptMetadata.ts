import { createClient } from 'gremlin';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as semver from 'semver';
import * as path from 'path';

const FILE_EXTENSION = '.groovy';

export default class ScriptMetadata {
  private scriptFolder;

  constructor(scriptFolder?: string) {
    this.scriptFolder = scriptFolder || './upgradeScripts/';
  }

  public getNewUpgradeFiles(currentVersionNumber) {
    let filenamesWithCorrectExtension = _.filter(fs.readdirSync(this.scriptFolder), (filename) => {
      return filename.endsWith(FILE_EXTENSION);
    });
    let filenamesAsVersionNumbers = _.map(filenamesWithCorrectExtension, (filename) => {
      return filename.replace(FILE_EXTENSION, '');
    });
    let filteredVersionNumbers = _.filter(filenamesAsVersionNumbers, (versionNumber) => {
      return _.isUndefined(currentVersionNumber) || semver.gt(versionNumber, currentVersionNumber);
    });

    return _.map(filteredVersionNumbers.sort(semver.compare), (versionNumber) => {
      return versionNumber + FILE_EXTENSION;
    });
  }

  public getFileContents(filename) {
    return fs.readFileSync(path.join(this.scriptFolder, filename)) + '';
  }
}