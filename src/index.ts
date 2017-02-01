import DbUpgrader from './DbUpgrader';
import { createClient } from 'gremlin';
import GremlinProvider from './GremlinProvider';
import DbMetadata from './DbMetadata';
import ScriptMetadata from './ScriptMetadata';
import * as bunyan from 'bunyan';
let log = bunyan.createLogger({name: 'index'});

export default function upgradeDbToLatest(serverAddress: string, port: number, upgradeScriptDirectory?: string)  {
    log.info('DB upgrade starting for ' + serverAddress + ':' + port + '...');
    let clientProvider = new GremlinProvider(serverAddress, port);
    let dbMetadata = new DbMetadata(clientProvider);
    let scriptMetadata = new ScriptMetadata(upgradeScriptDirectory);
    let dbUpgrader = new DbUpgrader(clientProvider, dbMetadata, scriptMetadata);
    return dbUpgrader.upgradeToLatest().then(() => {
        log.info('DB upgrade finished.');
    });
}