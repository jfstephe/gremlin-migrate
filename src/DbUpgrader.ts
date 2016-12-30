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
      let constraints = '1+1';
      if (_.isUndefined(currentVersion)) {
        constraints = this.ensureVersionUniqueness();
      }
      log.debug('Constraints: ' + constraints);
      this.client.execute(constraints, (err3, results) => {
        if (err3) {
          log.warn('CONSTRAINTS FAILED! (continuing anyway)', err3);
        }
        else {
          log.warn('CONSTRAINTS SUCCEEDED!');
        }
        contents = this.wrapWithVersionUpdateToContents(contents, currentVersion, newVersionNumber);
        contents = this.startTransactionExplicitly(contents);
        contents = this.wrapInRetry(contents);
        log.debug('Contents: ' + contents);

        this.client.execute(contents, (err2, results) => {
          if (err2) {
            log.error('FIRST ATTEMPT FAILED', err2);
            log.debug('RETRYING...');
            this.client.execute(contents, (err, results) => {
              if (err) {
            log.error('SECOND ATTEMPT FAILED', err);
                reject(err);
              }
              else {
                log.debug('RETRY SUCCESS - SCRIPT RESULTS:');
                _.forEach(results, (result) => { log.info(result.properties ? result.properties.name : result); } );
                this.upgradeUsingFiles(newVersionNumber, upgradeFilenames, resolve, reject);
              }
            });
          }
          else {
            log.debug('SUCCESS - SCRIPT RESULTS:');
            _.forEach(results, (result) => { log.info(result.properties ? result.properties.name : result); } );
            this.upgradeUsingFiles(newVersionNumber, upgradeFilenames, resolve, reject);
          }
        });
      });
    }
    else {
      log.info('Update complete - no further work required.');
      resolve();
    }
  }

  private ensureVersionUniqueness() {
    // instead of graph.tx().rollback(); because http://stackoverflow.com/questions/34643409/titandb-index-not-changing-state
    return 'graph.tx().rollback();int size = graph.getOpenTransactions().size();' +
      'for(i=0;i<size;i++) {graph.getOpenTransactions().getAt(0).rollback()};' +
      'mgmt = graph.openManagement();' +
      'if (!mgmt.getGraphIndex("byDatabaseMetaDataVersion")) {' +
        'version = (!mgmt.containsPropertyKey("version")) ? ' +
          'mgmt.makePropertyKey("version").dataType(String.class).cardinality(Cardinality.SINGLE).make():' +
          'mgmt.getPropertyKey("version");' +
        'databaseMetadataLabel = (!mgmt.containsVertexLabel("databaseMetadata")) ? ' +
          'mgmt.makeVertexLabel("databaseMetadata").make():' +
          'mgmt.getVertexLabel("databaseMetadata");' +
        'index = mgmt.buildIndex("byDatabaseMetaDataVersion", Vertex.class).addKey(version).unique().indexOnly(databaseMetadataLabel)' +
          '.buildCompositeIndex();' +
        'mgmt.setConsistency(version, ConsistencyModifier.LOCK);' +
        'mgmt.commit();' +
        'graph.tx().rollback();' +
        'mgmt.awaitGraphIndexStatus(graph, "byDatabaseMetaDataVersion").' +
          'timeout(10, java.time.temporal.ChronoUnit.MINUTES).call();' +
        'mgmt = graph.openManagement();' +
        'mr = new MapReduceIndexManagement(graph);' +
        'mr.updateIndex(mgmt.getGraphIndex("byDatabaseMetaDataVersion"), SchemaAction.REINDEX).get();' +
        'mgmt = graph.openManagement();' +
        'mgmt.updateIndex(mgmt.getGraphIndex("byDatabaseMetaDataVersion"), SchemaAction.ENABLE_INDEX).get();' +
        'mgmt.commit();' +
        'mgmt = graph.openManagement();' +
        'mgmt.awaitGraphIndexStatus(graph, "byDatabaseMetaDataVersion").' +
          'timeout(10, java.time.temporal.ChronoUnit.MINUTES).call();' +
        'mgmt.rollback();' +
      '} else {' +
      '  mgmt.commit();' +
      '  mgmt.awaitGraphIndexStatus(graph, "byDatabaseMetaDataVersion").' +
          'timeout(10, java.time.temporal.ChronoUnit.MINUTES).call();' +
      '};';
  }

  private wrapInRetry(query) {
    let wrappedQuery = 'try {' +
        query +
      '} catch (TitanException e) {' +
        query +
      '}';
    return wrappedQuery;
  }

  private startTransactionExplicitly(contents) {
    contents = 'graph.tx().open();' + contents;
    return contents;
  }

  private wrapWithVersionUpdateToContents(contents, currentVersion, newVersionNumber) {
    let selector;
    if (_.isUndefined(currentVersion)) {
      contents = 'metaData = g.V().hasLabel("databaseMetadata");if (!metaData.hasNext()) { ' + contents;
      contents += ';metaData = graph.addVertex(label, "databaseMetadata").property("version", "' +
        newVersionNumber + '");';
    }
    else {
      contents = 'metaData = g.V().hasLabel("databaseMetadata").has("version", "' + currentVersion + '");' +
        'if (metaData.hasNext()) { ' + contents;
      contents += ';g.V().hasLabel("databaseMetadata").has("version", "' + currentVersion + '")' +
        '.property("version", "' + newVersionNumber + '").iterate();';
    }
    contents += '}; graph.tx().commit(); g.V().hasLabel("databaseMetadata").valueMap()';
    return contents;
  }
}