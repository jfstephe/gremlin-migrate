FROM maven:3.3.3-jdk-8
MAINTAINER John Stephenson "john.stephenson@cedus.co.uk"
ENV REFRESHED_AT 2017-01-05

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN apt-get update
RUN apt-get install zip gettext -y
RUN apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
# RUN rm -rf ~/.m2/repository
RUN git clone https://github.com/awslabs/dynamodb-janusgraph-storage-backend.git /usr/src/app
RUN chmod +x /usr/src/app/src/test/resources/*.sh

RUN /usr/src/app/src/test/resources/install-reqs.sh
RUN /usr/src/app/src/test/resources/install-gremlin-server.sh

ARG JANUSGRAPH_VERSION=1.1.1
ENV JANUSGRAPH_VERSION ${JANUSGRAPH_VERSION}

RUN [ "sh", "-c", "rm /usr/src/app/server/dynamodb-janusgraph-storage-backend-${JANUSGRAPH_VERSION}.zip" ]
# RUN rm /usr/src/app/server/dynamodb-janusgraph-storage-backend-${JANUSGRAPH_VERSION}.zip

ARG DYNAMODB_ENDPOINT=https://dynamodb.eu-west-1.amazonaws.com
ENV DYNAMODB_ENDPOINT ${DYNAMODB_ENDPOINT}
# ENV AWS_ACCESS_KEY_ID 
# ENV AWS_SECRET_ACCESS_KEY 
# ENV AWS_DEFAULT_REGION 

COPY dynamodb-local.properties.template ./

COPY run.sh ./
RUN chmod +x ./run.sh
COPY gremlin-server.yaml /usr/src/app/server/dynamodb-janusgraph-storage-backend-${JANUSGRAPH_VERSION}/conf/gremlin-server/gremlin-server.yaml
WORKDIR /usr/src/app/server/dynamodb-janusgraph-storage-backend-${JANUSGRAPH_VERSION}
EXPOSE 8182 8183 8184 8080

RUN curl -o /tmp/nvminstall.sh https://raw.githubusercontent.com/creationix/nvm/v0.30.2/install.sh
RUN chmod +x /tmp/nvminstall.sh

ENTRYPOINT ["/usr/src/app/run.sh"]