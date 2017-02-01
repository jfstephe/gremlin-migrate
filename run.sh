#!/usr/bin/env bash
SERVER_DIR=/usr/src/app/server/dynamodb-janusgraph-storage-backend-${JANUSGRAPH_VERSION}
envsubst < /usr/src/app/dynamodb-local.properties.template > $SERVER_DIR/conf/gremlin-server/dynamodb-local.properties
#envsubst < /usr/src/app/dynamodb.properties.template > $SERVER_DIR/conf/gremlin-server/dynamodb.properties

# install node
# + Install and start a dummy web server to respond to the load balancer health checks.
# TODO - actually make this a small app to ping gremlin on the web server port.
/tmp/nvminstall.sh
source ~/.bashrc
nvm install v7.4.0
nvm use v7.4.0
npm install http-server -g
http-server &

# sed s/INFO/TRACE/g $SERVER_DIR/conf/gremlin-server/log4j-server.properties > $SERVER_DIR/conf/gremlin-server/log4j-server.properties2
# mv -f $SERVER_DIR/conf/gremlin-server/log4j-server.properties2 $SERVER_DIR/conf/gremlin-server/log4j-server.properties

if [ -z "$1" ]
then
  exec $SERVER_DIR/bin/gremlin-server.sh $SERVER_DIR/conf/gremlin-server/gremlin-server.yaml
elif [ "$1" == "console" ]
then
  exec $SERVER_DIR/bin/gremlin.sh
else
  exec $SERVER_DIR/$1
fi
