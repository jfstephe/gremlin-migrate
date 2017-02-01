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
  console.log('setupSuT2')
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

  describe('When upgradeToLatest is called twice in parallel with all upgrade scripts to v3', () => {
    beforeEach((done) => {
      scriptMetadata.getNewUpgradeFiles.and.returnValue(['1.0.0.groovy', '2.0.0.groovy', '3.0.0.groovy']);
      scriptMetadata.getFileContents.and.returnValues(
        "graph.addVertex(label, 'person').property('name', 'A');", 
        "graph.addVertex(label, 'person').property('name', 'B');", 
        "graph.addVertex(label, 'person').property('name', 'C');"
      );

      // Need to mock this next call as otherwise the version could be 3.0.0, and we are simulating 
      // these being run concurrently :-)
      dbMetadata2.getCurrentDbVersion.and.returnValue(Promise.resolve(undefined));
      scriptMetadata2.getNewUpgradeFiles.and.returnValue(['1.0.0.groovy', '2.0.0.groovy', '3.0.0.groovy']);
      scriptMetadata2.getFileContents.and.returnValues(
        "graph.addVertex(label, 'person').property('name', 'A');", 
        "graph.addVertex(label, 'person').property('name', 'B');", 
        "graph.addVertex(label, 'person').property('name', 'C');"
      );

      Promise.all([dbUpgrader.upgradeToLatest(1), dbUpgrader2.upgradeToLatest(2)].map(p=> p.catch(e => e)))
        .then(done, done);
    });

    for (var i = 0; i < 10; i++) {
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
              console.log("People:", people);
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
        }, (err) => {
          fail(err);
        });
      });
    }
  });
});