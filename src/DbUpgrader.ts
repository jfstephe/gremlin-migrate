import { createClient } from 'gremlin';
import DbMetadata from './DbMetadata';
import ScriptMetadata from './ScriptMetadata';
import * as _ from 'lodash';
import * as bunyan from 'bunyan';
let log = bunyan.createLogger({name: 'DBUpgrader'});

export default class DBUpgrader {
  private client;
  private dbMetadata;
  private scriptMetadata;

  constructor(client, dbMetadata, scriptMetadata) {
    this.client = client;
    this.dbMetadata = dbMetadata;
    this.scriptMetadata = scriptMetadata;
  }

  public upgradeToLatest() {
    let promise = new Promise((resolve, reject) => {
      this.dbMetadata.getCurrentDbVersion().then(currentVersion => {
        let upgradeFilenames = this.scriptMetadata.getNewUpgradeFiles(currentVersion);
        this.upgradeUsingFiles(currentVersion, upgradeFilenames, resolve, reject);
      });
    });
    return promise;
  }

  private upgradeUsingFiles(currentVersion, upgradeFilenames, resolve, reject) {
    if (upgradeFilenames.length > 0) {
      let filename = upgradeFilenames.shift();
      let newVersionNumber = filename.substr(0, filename.lastIndexOf('.'));
      log.info('Running upgrade script (' + filename + ': v' + currentVersion + ' -> v' + newVersionNumber + ')...');
      let contents = this.scriptMetadata.getFileContents(filename);

      contents = this.appendVersionUpdateToContents(contents, currentVersion, newVersionNumber);
      log.debug('Contents: ' + contents);

      this.client.execute(contents, (err, results) => {
        if (err) {
          log.error(err);
          reject(err);
        }
        else {
          log.debug(results);
          this.upgradeUsingFiles(newVersionNumber, upgradeFilenames, resolve, reject);
        }
      });
    }
    else {
      log.info('Update complete');
      resolve();
    }
  }

  private appendVersionUpdateToContents(contents, currentVersion, newVersionNumber) {
    if (_.isUndefined(currentVersion)) {
      contents += ';metaData = graph.addVertex(label, "databaseMetadata");metaData.property("version", "' +
        newVersionNumber + '");graph.tx().commit();';
    }
    else {
      contents += ';g.V().has(label, "databaseMetadata").property("version", "' + newVersionNumber + '");';
    }
    return contents;
  }
}