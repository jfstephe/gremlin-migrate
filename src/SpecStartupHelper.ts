'use strict';
var spawn = require('child_process').spawn;
import GremlinCommandLibrary from './GremlinCommandLibrary';

export default class SpecStartupHelper {
  public static startDb(doneCallback) {

    SpecStartupHelper.terminateDb(true, () => {
      let upChild;
      console.log('Starting DB, please wait...')
      upChild = spawn('docker-compose', ['up'], { cwd: '.'});
      upChild.stderr.on('data', function(data) {
        console.log('' + data);
      });
      upChild.stdout.on('data', function(data) {
        console.log('' + data);
        if (data.indexOf('GremlinServer  - Channel started at port 8182.') !== -1) {
          console.log('DB initialised! Continuing...');
          upChild.stderr.removeAllListeners('data');
          upChild.stdout.removeAllListeners('data');
          upChild = null;
          console.log('Ok to start! Continuing in 1 second...');
          setTimeout(doneCallback, 1000);
        }
      });
    });
  }

  public static terminateDbAndRestoreTimeout(doneCallback) {
    SpecStartupHelper.terminateDb(false, () => {
      doneCallback();
    });
  }

  public static cleanUpVertices(clientProvider, doneCallback) {
    let cleanup = GremlinCommandLibrary.getRollbackTransactions() +
      ';g.V().drop().iterate(); g.tx().commit();';
    console.log('Cleaning vertices (not indexes) before next test (1/2)...: ' + cleanup);
    clientProvider.getGremlinClient().execute(cleanup, (err, results) => {
      if (err) {
        console.log('ERROR REMOVING VERTICES! (1/2)', err);
        /* Try again after the lock timeout period (in the dynamo-db properties file) */
        setTimeout(() => {
          console.log('Cleaning vertices (not indexes) before next test (2/2)...: ' + cleanup);
          clientProvider.getGremlinClient().execute(cleanup, (err, results) => {
            if (err) {
              console.log('ERROR REMOVING VERTICES! (2/2). Failing test...', err);
              fail(err);
            } else {
              console.log('Removed vertices for a \'clean\' db', results);
              doneCallback();
            }
          });
        }, 5000);
      } else {
        console.log('Removed vertices for a \'clean\' db', results);
        doneCallback();
      }
    });
  }

  private static terminateDb(waitForDockerToDieRequest, callback) {
    let downChild;
    console.log('Stopping DB (if running), please wait...');
    downChild = spawn('docker-compose', ['down'], { cwd: '.'});
    downChild.stderr.on('data', function(data) {
      console.log(data + '');
      let dbWasNeverRunning = data.indexOf('Network gremlinmigrate_default not found.') !== -1;
      let dbWasStopped = data.indexOf('Removing gremlinmigrate_dynamodb_1 ... done') !== -1;
      if (dbWasStopped || dbWasNeverRunning) {
        let waitForDockerToDie = waitForDockerToDieRequest && dbWasStopped;
        if (waitForDockerToDie) {
          console.log('DB was running. Continuing in 5 seconds (to give the docker instances a chance to exit)...');
        }
        if (dbWasNeverRunning) {
          console.log('DB was not running. Continuing...');
        }
        downChild.stderr.removeAllListeners('data');
        downChild = null;
        // TODO - Make this deterministic.
        setTimeout(callback, waitForDockerToDie ? 5000 : 0);
      }
    });
  }
}