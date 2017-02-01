'use strict';
var spawn = require('child_process').spawn;
import DbMetadata from './DbMetadata';
import DbUpgrader from './DbUpgrader';
import GremlinProvider from './GremlinProvider';
import GremlinCommandLibrary from './GremlinCommandLibrary';
import SpecStartupHelper from './SpecStartupHelper';
import * as _ from 'lodash';
let originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

let failCalled;
let dbMetadata;
let dbUpgrader;
let dbUpgrader2;
let clientProvider;
let scriptMetadata = jasmine.createSpyObj('scriptMetadata', ['getNewUpgradeFiles', 'getFileContents']);
let dbMetadata2 = jasmine.createSpyObj('dbMetadata2', ['getCurrentDbVersion']);
let scriptMetadata2;

function setupSuT() {
  console.log('setupSuT1')
  clientProvider = new GremlinProvider('192.168.99.100', 8182);
  let clientProvider2 = new GremlinProvider('192.168.99.100', 8182);
  dbMetadata = new DbMetadata(clientProvider);
  dbUpgrader = new DbUpgrader(clientProvider, dbMetadata, scriptMetadata);
  scriptMetadata2 = jasmine.createSpyObj('scriptMetadata2', ['getNewUpgradeFiles', 'getFileContents']);
  dbUpgrader2 = new DbUpgrader(clientProvider2, dbMetadata2, scriptMetadata2);
}

describe("Given a database", function() {
  beforeAll((done) => {
    SpecStartupHelper.startDb(() => {
      setupSuT();
      done();
    });
  });

  afterAll((done) => {
    SpecStartupHelper.terminateDbAndRestoreTimeout(()=> {
      // jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      done();
    });
  });

  beforeEach((done) => {
    SpecStartupHelper.cleanUpVertices(clientProvider, done);
  });

  describe('When there is no current version', () => {
    beforeEach(() => {
    });

    it("Then the version is undefined", function (done) {
      dbMetadata.getCurrentDbVersion().then(currentVersion => {
        expect(currentVersion).toEqual(undefined);
        done();
      }, fail);
    });
    fdescribe('When upgradeToLatest is called with a single upgrade script to v0.0.1', () => {
      beforeEach((done) => {
        scriptMetadata.getNewUpgradeFiles.and.returnValue(['0.0.1.groovy']);
        scriptMetadata.getFileContents.and.returnValue('');
        dbUpgrader.upgradeToLatest().then(done, fail);
      });
      // Repeat this to see intermittant errors.
      for (var i = 0; i < 100; i++) {
        it("Then the version is 0.0.1", function(done) {
          dbMetadata.getCurrentDbVersion().then(currentVersion => {
            expect(currentVersion).toEqual('0.0.1');
            done();
          }, fail);
        });
      }
      describe('When upgradeToLatest is called with a single upgrade script to v0.0.2', () => {
        beforeEach((done) => {
          scriptMetadata.getNewUpgradeFiles.and.returnValue(['0.0.2.groovy']);
          scriptMetadata.getFileContents.and.returnValue('');
          dbUpgrader.upgradeToLatest().then(done, fail);
        });
        it("Then the version is 0.0.2", function(done) {
          dbMetadata.getCurrentDbVersion().then(currentVersion => {
            expect(currentVersion).toEqual('0.0.2');
            done();
          }, fail);
        });
      });
    });
  });

  describe('When upgradeToLatest is called twice in parallel with all upgrade scripts to v3', () => {
    beforeEach((done) => {
      scriptMetadata.getNewUpgradeFiles.and.returnValue(['1.0.0.groovy', '2.0.0.groovy', '3.0.0.groovy']);
      scriptMetadata.getFileContents.and.returnValues(
        GremlinCommandLibrary.getCreateUniquePropertyIndexForLabel('person', 'name', true) + ";graph.addVertex(label, 'person').property('name', 'A');", 
        "graph.addVertex(label, 'person').property('name', 'B');", 
        "graph.addVertex(label, 'person').property('name', 'C');"
      );

      // Need to mock this next call as otherwise the version could be 3.0.0, and we are simulating 
      // these being run concurrently :-)
      dbMetadata2.getCurrentDbVersion.and.returnValue(Promise.resolve(undefined));
      scriptMetadata2.getNewUpgradeFiles.and.returnValue(['1.0.0.groovy', '2.0.0.groovy', '3.0.0.groovy']);
      scriptMetadata2.getFileContents.and.returnValues(
        GremlinCommandLibrary.getCreateUniquePropertyIndexForLabel('person', 'name', true) + ";graph.addVertex(label, 'person').property('name', 'A');", 
        "graph.addVertex(label, 'person').property('name', 'B');", 
        "graph.addVertex(label, 'person').property('name', 'C');"
      );

      Promise.all([dbUpgrader.upgradeToLatest(1), dbUpgrader2.upgradeToLatest(2)].map(p=> p.catch(e => e)))
        .then(done, done);
    });

    it('Then there should be the correct number of vertices for the number of successful upgrades', (done) => {
      let expectations = {
        '1.0.0': { name:'A', count:1 },
        '2.0.0': { name:'B', count:2, previousVersion: '1.0.0' },
        '3.0.0': { name:'C', count:3, previousVersion: '2.0.0' }
      };
      dbMetadata.getCurrentDbVersion().then(currentVersion => {
        clientProvider.getGremlinClient().execute('g.V().hasLabel(\'person\').valueMap()', (err, people) => {
          if (err) {
            fail(err);
          }
          else {
            console.log(people);
            if (currentVersion) {
              expect(people.length).toEqual(expectations[currentVersion].count);
              do {
                console.log('Verifying ' + currentVersion);
                expect(_.map(people, (person: any) => { return person.name[0]; })).toContain(expectations[currentVersion].name);
                currentVersion = expectations[currentVersion].previousVersion;
              } while (currentVersion);
            }
            else {
              expect(people.length).toEqual(0);
            }
            console.log('Done!');
            done();
          }
        });
      }, fail);
    });
  });

  describe('When upgradeToLatest is called but the upgrade fails in the second out of 3 upgrades', () => {
    beforeEach((done) => {
      failCalled = false;
      scriptMetadata.getNewUpgradeFiles.and.returnValue(['1.1.0.groovy', '2.1.0.groovy', '3.1.0.groovy']);
      scriptMetadata.getFileContents.and.returnValues(
        "graph.addVertex(label, 'person').property('name', 'A2');", 
        "Generate an error!;", 
        "graph.addVertex(label, 'person').property('name', 'B2');"
      );
      dbUpgrader.upgradeToLatest().then(done, () => { failCalled = true; done(); } );
    });

    it('Then there should be 1 person vertex', (done) => {
      clientProvider.getGremlinClient().execute('g.V().hasLabel(\'person\')', (err, results) => {
        if (err) {
          fail(err);
        }
        else {
          expect(results.length).toEqual(1);
          done();
        }
      });
    });

    it("Then the failed handler should have been called", function() {
      expect(failCalled).toEqual(true);
    });

    it("Then the version is 1.1.0", function(done) {
      dbMetadata.getCurrentDbVersion().then(currentVersion => {
        expect(currentVersion).toEqual('1.1.0');
        done();
      }, fail);
    });
  });
});