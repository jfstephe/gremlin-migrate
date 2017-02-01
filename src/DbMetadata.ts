import GremlinProvider from './GremlinProvider';
import * as bunyan from 'bunyan';
let log = bunyan.createLogger({name: 'DbMetadata'});

export default class DBMetadata {
  private gremlinProvider;
  constructor(gremlinProvider: GremlinProvider) {
    this.gremlinProvider = gremlinProvider;
  }

  public getCurrentDbVersion() {
    log.info('getCurrentDbVersion...');
    let promise = new Promise((resolve, reject) => {
      this.gremlinProvider.getGremlinClient().execute('g=graph.traversal();g.V().has(label, \'databaseMetadata\');', (err, results) => {
        if (err) {
          log.error(err);
          reject(err);
        }
        else {
          log.info('Results: ' + JSON.stringify(results));
          if (results.length > 1) {
            throw new Error('Multiple database metadata exist!');
          }
          let result = results[0] ? results[0].properties.version[0].value : undefined;
          resolve(result);
        }
      });
    });

    return promise;
  }
}