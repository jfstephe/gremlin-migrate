'use strict';
var spawn = require('child_process').spawn;
import DbMetadata from './DbMetadata';
import DbUpgrader from './DbUpgrader';
import { createClient } from 'gremlin';
import * as _ from 'lodash';

let upChild;
let downChild;
let gremlinClient;
let dbMetadata;
let dbUpgrader;
let dbUpgrader2;
let scriptMetadata = jasmine.createSpyObj('scriptMetadata', ['getNewUpgradeFiles', 'getFileContents']);
let dbMetadata2 = jasmine.createSpyObj('dbMetadata2', ['getCurrentDbVersion']);
let scriptMetadata2;
let originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

function setupSuT() {
  gremlinClient = createClient(8182, '192.168.99.100');
  dbMetadata = new DbMetadata(gremlinClient);
  dbUpgrader = new DbUpgrader(gremlinClient, dbMetadata, scriptMetadata);
  scriptMetadata2 = jasmine.createSpyObj('scriptMetadata2', ['getNewUpgradeFiles', 'getFileContents']);
  dbUpgrader2 = new DbUpgrader(createClient(8182, '192.168.99.100'), dbMetadata2, scriptMetadata2);
}

function terminateDb(callback) {
  console.log('Terminating DB, please wait...');
  downChild = spawn('docker-compose', ['down'], { cwd: '.'});
  downChild.stderr.on('data', function(data) {
    if (data.indexOf('Removing gremlinmigrate_dynamodb_1 ... done') || data.indexOf('Network gremlinmigrate_default not found.') !== -1) {
      console.log('DB terminated.');
      downChild = null;
      callback();
    }
  });
}

describe("Given a database", function () {
  beforeAll((done) => {
    terminateDb(() => {
      console.log('Starting DB, please wait...')
      upChild = spawn('docker-compose', ['up'], { cwd: '.'});
      upChild.stderr.on('data', function(data) {
        console.log('' + data);
      });
      upChild.stdout.on('data', function(data) {
        if (data.indexOf('GremlinServer  - Channel started at port 8182.') !== -1) {
          console.log('DB initialised! Continuing...');
          setupSuT();
          done();
        }
      });
    });
  });

  afterAll((done) => {
    terminateDb(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      done();
    });
  });


  beforeEach((done) => {
    gremlinClient.execute('g.V().drop().iterate();g.tx().commit();g.V().valueMap();', (err, results) => {
      console.log('Removed vertices for a \'clean\' db', results);
      done();
    });
  });

  describe('When there is no current version', () => {
    beforeEach(() => {
    });

    it("Then the version is undefined", function (done) {
      dbMetadata.getCurrentDbVersion().then(currentVersion => {
        console.log('CV: ' + currentVersion);
        expect(currentVersion).toEqual(undefined);
        done();
      }, done);
    });
    describe('When upgradeToLatest is called with a single update script to v0.0.1', () => {
      beforeEach((done) => {
        scriptMetadata.getNewUpgradeFiles.and.returnValue(['0.0.1.groovy']);
        scriptMetadata.getFileContents.and.returnValue('');
        dbUpgrader.upgradeToLatest().then(done, done);
      });
      it("Then the version is 0.0.1", function(done) {
        dbMetadata.getCurrentDbVersion().then(currentVersion => {
          expect(currentVersion).toEqual('0.0.1');
          done();
        }, done);
      });
      describe('When upgradeToLatest is called with a single update script to v0.0.2', () => {
        beforeEach((done) => {
          scriptMetadata.getNewUpgradeFiles.and.returnValue(['0.0.2.groovy']);
          scriptMetadata.getFileContents.and.returnValue('');
          dbUpgrader.upgradeToLatest().then(done, done);
        });
        it("Then the version is 0.0.2", function(done) {
          dbMetadata.getCurrentDbVersion().then(currentVersion => {
            expect(currentVersion).toEqual('0.0.2');
            done();
          }, done);
        });
      });
    });
    
    describe('When upgradeToLatest is called twice in parallel with all update scripts to v3', () => {
      beforeEach((done) => {
        scriptMetadata.getNewUpgradeFiles.and.returnValue(['1.0.0.groovy', '2.0.0.groovy', '3.0.0.groovy']);
        scriptMetadata.getFileContents.and.returnValues(
          "graph.addVertex(label, 'person').property('name', 'John');", 
          "graph.addVertex(label, 'person').property('name', 'James');", 
          "graph.addVertex(label, 'person').property('name', 'Alex');"
        );

        // Need to mock this next call as otherwise the version could be 3.0.0, and we are simulating 
        // these being run concurrently :-)
        dbMetadata2.getCurrentDbVersion.and.returnValue(Promise.resolve(undefined));
        scriptMetadata2.getNewUpgradeFiles.and.returnValue(['1.0.0.groovy', '2.0.0.groovy', '3.0.0.groovy']);
        scriptMetadata2.getFileContents.and.returnValues(
          "graph.addVertex(label, 'person').property('name', 'John');", 
          "graph.addVertex(label, 'person').property('name', 'James');", 
          "graph.addVertex(label, 'person').property('name', 'Alex');"
        );

        Promise.all([dbUpgrader.upgradeToLatest(), dbUpgrader2.upgradeToLatest()])
          .then(done, done);
      });

      it('Then there should be 3 people vertices', (done) => {
        gremlinClient.execute('g.V().hasLabel(\'person\')', (err, results) => {
          console.info('TEST RESULTS:');
          _.forEach(results, (result) => { console.info(result.properties.name); } );
          expect(results.length).toEqual(3);
          done();
        });
      });
      it("Then the version is 3.0.0", function(done) {
        dbMetadata.getCurrentDbVersion().then(currentVersion => {
          expect(currentVersion).toEqual('3.0.0');
          done();
        }, done);
    });
  });

    describe('When upgradeToLatest is called but the updated fails', () => {
      beforeEach((done) => {
        scriptMetadata.getNewUpgradeFiles.and.returnValue(['1.1.0.groovy', '2.1.0.groovy', '3.1.0.groovy']);
        scriptMetadata.getFileContents.and.returnValues(
          "graph.addVertex(label, 'person').property('name', 'John');", 
          "Generate an error!;", 
          "graph.addVertex(label, 'person').property('name', 'Alex');"
        );
        dbUpgrader.upgradeToLatest().then(done, done);
      });

      it('Then there should be 1 person vertex', (done) => {
        gremlinClient.execute('g.V().hasLabel(\'person\')', (err, results) => {
          expect(results.length).toEqual(1);
          done();
        });
      });
      it("Then the version is 1.1.0", function(done) {
        dbMetadata.getCurrentDbVersion().then(currentVersion => {
          expect(currentVersion).toEqual('1.1.0');
          done();
        }, done);
      });
    });
  });
});