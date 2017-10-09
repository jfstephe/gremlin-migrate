import GremlinProvider from './GremlinProvider';
import DbMetadata from './DbMetadata';
import ScriptMetadata from './ScriptMetadata';
import GremlinCommandLibrary from './GremlinCommandLibrary';
import * as _ from 'lodash';
import * as bunyan from 'bunyan';

export default class DBUpgrader {
  private gremlinProvider: GremlinProvider;
  private dbMetadata;
  private scriptMetadata;
  private log = bunyan.createLogger({name: 'DBUpgrader'});
  private commonScriptContents;

  constructor(gremlinProvider: GremlinProvider, dbMetadata, scriptMetadata) {
    this.gremlinProvider = gremlinProvider;
    this.dbMetadata = dbMetadata;
    this.scriptMetadata = scriptMetadata;
    this.commonScriptContents = '\r\n' + this.scriptMetadata.getFileContents('common.groovy') + '\r\n';
  }

  public upgradeToLatest(context?) {
    this.log = bunyan.createLogger({name: 'DBUpgrader' + (context || '')});
    let promise = new Promise((resolve, reject) => {
      let delayedResolve = () => {
        // TODO: Remove this. This shouldn't be needed but is!
        setTimeout(resolve, 5000);
      };
      this.dbMetadata.getCurrentDbVersion().then(currentVersion => {
        let upgradeFilenames = this.scriptMetadata.getNewUpgradeFiles(currentVersion);
        this.upgradeUsingFiles(currentVersion, upgradeFilenames, delayedResolve, reject, context);
      });
    });
    return promise;
  }

  private upgradeUsingFiles(currentVersion, upgradeFilenames, resolve, reject, context) {
    if (upgradeFilenames.length > 0) {
      let filename = upgradeFilenames.shift();
      let newVersionNumber = filename.substr(0, filename.lastIndexOf('.'));
      this.log.info('Running upgrade script (' + filename + ': v' + currentVersion + ' -> v' + newVersionNumber + ')...');
      let contents = this.scriptMetadata.getFileContents(filename);
      contents = this.wrapWithVersionUpdateToContents(contents, currentVersion, newVersionNumber);
      contents = this.startTransactionExplicitly(contents);
      contents = this.commonScriptContents + contents;
      let constraintsExecutor;
      constraintsExecutor = () => { return Promise.resolve(); };
      if (_.isUndefined(currentVersion)) {
        let constraints = GremlinCommandLibrary.getCreateUniquePropertyIndexForLabel('databaseMetadata', 'version', true);
        this.log.info('Constraints: ' + constraints);
        constraintsExecutor = () => {
          let constraintsPromise = new Promise((constraintsResolve, constraintsReject) => {
            return this.gremlinProvider.getGremlinClient().execute(constraints, (err3, results) => {
              if (err3) {
                this.log.info('CONSTRAINTS FAILED!', err3);
                constraintsReject(err3);
              }
              else {
                this.log.info('CONSTRAINTS SUCCEEDED!');
                constraintsResolve();
              }
            });
          });
          return constraintsPromise;
        };
      }
      constraintsExecutor().then(() => {
          this.log.info('Contents: ' + contents);
          this.gremlinProvider.getGremlinClient().execute(contents, (err2, results) => {
            if (err2) {
              this.log.error('ATTEMPT FAILED!', err2);
              reject(err2);
            }
            else {
              this.log.info('SUCCESS - SCRIPT RESULTS:');
              _.forEach(results, (result) => { this.log.info(result.properties ? result.properties.name : result); } );
              this.upgradeUsingFiles(newVersionNumber, upgradeFilenames, resolve, reject, context);
            }
          });
        },
        () => { reject(); });
    }
    else {
      this.log.info('Update(s) complete - no further work required.');
      resolve();
    }
  }

  private startTransactionExplicitly(contents) {
    contents = 'g=graph.traversal();graph.tx().open();' + contents;
    return contents;
  }

  private wrapWithVersionUpdateToContents(upgradeScriptContents, currentVersion, newVersionNumber) {
    let selector;
    let contents = 'try { ';
    if (_.isUndefined(currentVersion)) {
      contents += 'metadata = g.V().hasLabel("databaseMetadata");';
      contents += 'if (!metadata.hasNext()) { ';
      contents +=    upgradeScriptContents;
      contents +=   ';metadata = graph.addVertex(label, "databaseMetadata").property("version", "';
      contents +=      newVersionNumber + '");';
      contents += '} else { ';
      contents += '  graph.tx().rollback();';
      contents += '  throw new Exception("Database was not in the expected state and therefore the upgrade has been rolled back. (1)"); ';
      contents += '};';
    }
    else {
      contents += 'metadata = g.V().hasLabel("databaseMetadata").has("version", "' + currentVersion + '");';
      contents += 'if (metadata.hasNext()) { ' + upgradeScriptContents + ';';
      contents +=   'result = g.V().hasLabel("databaseMetadata").has("version", "' + currentVersion + '")';
      contents +=     '.property("version", "' + newVersionNumber + '").next();';
      contents += '  if (!result) { ';
      contents += '    graph.tx().rollback();';
      contents += '    throw new Exception("Database upgrade has not been fully applied, and therefore has been rolled back. (2)"); ';
      contents += '  };';
      contents += '} else { ';
      contents += '  graph.tx().rollback();';
      contents += '  throw new Exception("Database was not in the expected state and therefore the upgrade has been rolled back. (3)"); ';
      contents += '};';
    }
    contents +=   'metadata = g.V().hasLabel("databaseMetadata").has("version", "' + newVersionNumber + '");';
    contents +=   'if (!metadata.hasNext()) { ';
    contents +=   '  graph.tx().rollback();';
    contents +=   '  throw new Exception("Database upgrade has not been fully applied, and therefore has been rolled back. (4)"); ';
    contents +=   '};';
    contents +=   'graph.tx().commit();'; // COMMIT THE UPDATE SCRIPT CONTENTS
    contents += '} catch (JanusGraphException dbUpgraderException2) {';
    contents +=   'graph.tx().rollback();';
    contents += '}; ';
    contents += 'graph.tx().rollback();';
    contents += 'g.V().hasLabel("databaseMetadata").valueMap()';
    return contents;
  }
}