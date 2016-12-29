'use strict';
var spawn = require('child_process').spawn;
import DbMetadata from './DbMetadata';
import DbUpgrader from './DbUpgrader';
import { createClient } from 'gremlin';

let upChild;
let downChild;
let gremlinClient;
let dbMetadata;
let dbUpgrader;
let scriptMetadata = jasmine.createSpyObj('dbMetadata', ['getNewUpgradeFiles', 'getFileContents']);
let originalTimout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

function setupSuT() {
  gremlinClient = createClient(8182, '192.168.99.100');
  dbMetadata = new DbMetadata(gremlinClient);
  dbUpgrader = new DbUpgrader(gremlinClient, dbMetadata, scriptMetadata);
}

describe("Given a database", function () {
  beforeAll((done) => {
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

  afterAll((done) => {
    console.log('Terminating DB, please wait...');
    downChild = spawn('docker-compose', ['down'], { cwd: '.'});
    downChild.stderr.on('data', function(data) {
      console.log('' + data);
      if (data.indexOf('Removing gremlinmigrate_dynamodb_1 ... done') !== -1) {
        console.log('DB terminated.');
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimout;
        done();
      }
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
    describe('When upgradeToLatest is called with all update scripts to v3', () => {
      beforeEach((done) => {
        scriptMetadata.getNewUpgradeFiles.and.returnValue(['1.0.0.groovy', '2.0.0.groovy', '3.0.0.groovy']);
        scriptMetadata.getFileContents.and.returnValues(
          "graph.addVertex(label, 'person').property('name', 'John');graph.tx().commit();", 
          "graph.addVertex(label, 'person').property('name', 'James');graph.tx().commit();", 
          "graph.addVertex(label, 'person').property('name', 'Alex');graph.tx().commit();"
        );
        dbUpgrader.upgradeToLatest().then(done, done);
      });

      it('Then there should be 3 vertices', (done) => {
        gremlinClient.execute('g.V().hasLabel(\'person\')', (err, results) => {
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
  });
});