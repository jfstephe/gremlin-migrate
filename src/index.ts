import * as bunyan from 'bunyan';
import DbMetadata from './DbMetadata';
import DbUpgrader from './DbUpgrader';
import GremlinProvider from './GremlinProvider';
import ScriptMetadata from './ScriptMetadata';
let log = bunyan.createLogger({name: 'GremlinMigrate: index'});

export default function upgradeDbToLatest(serverAddress: string, port: number, upgradeScriptDirectory?: string)  {
    log.info('DB upgrade starting for ' + serverAddress + ':' + port + '...');
    let clientProvider = new GremlinProvider(serverAddress, port);
    let dbMetadata = new DbMetadata(clientProvider);
    let scriptMetadata = new ScriptMetadata(upgradeScriptDirectory);
    let dbUpgrader = new DbUpgrader(clientProvider, dbMetadata, scriptMetadata);
    return dbUpgrader.upgradeToLatest().then(() => {
        dbUpgrader.dispose();
        log.info('DB upgrade finished.');
    });
}