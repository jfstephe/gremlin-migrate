# gremlin-migrate
Runs gremlin-groovy scripts in-order to upgrade the DB schema

This library can be used to run a sequence of groovy scripts, which are submitted to [gremlin-javascript](https://github.com/jbmusso/gremlin-javascript), 
to perform changes on the target database. Most likely these will be schema changes.

The files are ordered based on [semver](https://github.com/npm/node-semver) naming conventions.

## Installation

```bash
npm install gremlin-migrate --save
```

## Usage
The library exports a function taking configuration parameters and returning an ES6 promise.

```typescript
import upgradeDbToLatest from 'gremlin-migrate';
...
upgradeDbToLatest(titanDbAddress, portNumber, pathToUpgradeScriptDirectory).then(() => {
    console.log('SUCCESS!');
});
```

## Example

### 0.0.1.groovy (in 'upgradeScripts' subdir)
```groovy
// I am an example of a comment!
graph.addVertex(label, 'person').property('name', 'john').iterate();
person2 = graph.addVertex(label, 'person');
// NOTE: Don't forget to add the '.iterate()' else the step won't necessarily take effect!
person2.property('name', 'john').iterate();
// DON'T put transactions in your upgrade scripts. The scripts are automatically wrapped in a transaction.
// graph.tx().commit();
```

### Example.ts

```typescript
import { createClient } from 'gremlin';
import upgradeDbToLatest from 'gremlin-migrate';
const client = createClient(8182, '192.168.99.100');

export default class Example {
  public test() {
    client.execute('g.V().hasLabel(\'person\').has(\'name\', \'john\')', (err, results) => {
      console.log('BEFORE UPGRADE: ' + JSON.stringify(results)); // []
      upgradeDbToLatest('192.168.99.100', 8182, __dirname + '/upgradeScripts/').then(() => {
        client.execute('g.V().hasLabel(\'person\').has(\'name\', \'john\')', (err, results) => {
          console.log('AFTER UPGRADE: ' + JSON.stringify(results)); // [ {vertex with person 'john'} ]
        });
      });
    });
  }
}
```


## Tests

Run 'gulp test' to run the tests. These spin up docker containers using [docker-compose](https://docs.docker.com/compose/install/) with an empty DB so you will need docker set up on your system.

## About
My specific use-case was for [flyway](https://flywaydb.org/)-like migrations for TitanDB, but I couldn't find a tool that did that.

## Contributions
Pull requests will be gratefully received. Please ensure you have a test around the change/improvement you are proposing.