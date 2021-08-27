import { createClient } from 'gremlin';
import * as bunyan from 'bunyan';
let log = bunyan.createLogger({name: 'GremlinMigrate: GremlinProvider'});

export default class GremlinProvider {
    private config: any = {};
    private gremlinClient: any;
    private resurrect = true;
    private host;
    private port;

    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.resurrectConnection();
    }

    public getGremlinClient() {
        return this.gremlinClient;
    }

    public dispose() {
        this.resurrect = false;
        this.gremlinClient.connection.ws.close();
        this.gremlinClient = null;
    }

    private resurrectConnection() {
        log.info('Creating gremlin client on ', this.host, this.port);
        this.gremlinClient = createClient(this.port, this.host);
        this.gremlinClient.on('connect', () => {
            log.debug('Connection to Gremlin Server established!');
            log.debug('Connected: ', this.gremlinClient.connected);
            this.gremlinClient.connection.on('open', () => log.debug('OPEN'));
            this.gremlinClient.connection.on('error', (error) => log.debug('ERROR', error));
            this.gremlinClient.connection.on('message', (message) => { log.debug('MESSAGE', message); });
            this.gremlinClient.connection.on('close', (event) => {
                log.debug('CLOSE', event);
                if (this.resurrect) {
                    this.resurrectConnection();
                }
                else {
                    log.debug('Not resurrecting.');
                }
            });
        });

        this.gremlinClient.on('error', (err) => {
            log.error('ERROR! ', err);
            this.gremlinClient.connection.ws.close();
        });

        log.debug('Initially connected: ', this.gremlinClient.connected);
    }
}
