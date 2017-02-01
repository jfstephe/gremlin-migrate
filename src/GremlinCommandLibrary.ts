export default class GremlinCommandLibrary {
  public static getRollbackTransactions() {
    // instead of graph.tx().rollback(); because http://stackoverflow.com/questions/34643409/titandb-index-not-changing-state
    return 'graph.tx().rollback();' +
      'int size = graph.getOpenTransactions().size();' +
      'for (i = 0; i < size; i++) { ' +
        'graph.getOpenTransactions().getAt(0).rollback();' +
      '}; ';
  }

  public static getCreateUniquePropertyIndexForLabel(labelName, propertyName, rollbackTransactions) {
    let graphIndexName = 'by' + labelName + propertyName;
    // Taken from
    // http://s3.thinkaurelius.com/docs/titan/1.0.0/indexes.html
    // and
    // http://s3.thinkaurelius.com/docs/titan/1.0.0/eventual-consistency.html
    return 'mgmt = graph.openManagement();' +
    'if (!mgmt.getGraphIndex("' + graphIndexName + '")) {' +
         (rollbackTransactions ? this.getRollbackTransactions() : ' ') +
        'mgmt = graph.openManagement();' +
        'propertyKey = (!mgmt.containsPropertyKey("' + propertyName + '")) ? ' +
          'mgmt.makePropertyKey("' + propertyName + '").dataType(String.class).cardinality(Cardinality.SINGLE).make():' +
          'mgmt.getPropertyKey("' + propertyName + '");' +
        'labelObj = (!mgmt.containsVertexLabel("' + labelName + '")) ? ' +
          'mgmt.makeVertexLabel("' + labelName + '").make():' +
          'mgmt.getVertexLabel("' + labelName + '");' +
        'index = mgmt.buildIndex("' + graphIndexName + '", Vertex.class).addKey(propertyKey).unique().indexOnly(labelObj)' +
          '.buildCompositeIndex();' +
        'mgmt.setConsistency(propertyKey, ConsistencyModifier.LOCK);' + // Ensures only one property with that key per vertex
        'mgmt.setConsistency(index, ConsistencyModifier.LOCK);' + // Ensures key uniqueness in the graph
        'mgmt.commit();' +
   //     mgmt.awaitGraphIndexStatus(graph, "' + graphIndexName + '").call(); <-Some docs do this WAIT UNTIL 'REGISTERED' step, but we do this:
        'mgmt = graph.openManagement();' +
        'index = mgmt.getGraphIndex("' + graphIndexName + '");' +
        'propertyKey = mgmt.getPropertyKey("' + propertyName + '");' +
        'if (index.getIndexStatus(propertyKey) == SchemaStatus.INSTALLED) {' +
          'mgmt.awaitGraphIndexStatus(graph, "' + graphIndexName + '").status(SchemaStatus.REGISTERED).' +
            'timeout(10, java.time.temporal.ChronoUnit.MINUTES).call();' +
        '}; ' +
        'mgmt.commit();' +
        'mgmt = graph.openManagement();' +
        'index = mgmt.getGraphIndex("' + graphIndexName + '");' +
        'propertyKey = mgmt.getPropertyKey("' + propertyName + '");' +
        'if (index.getIndexStatus(propertyKey) != SchemaStatus.ENABLED) {' +
          'mgmt.commit();' +
          'mgmt = graph.openManagement();' +
          'mgmt.updateIndex(mgmt.getGraphIndex("' + graphIndexName + '"), SchemaAction.ENABLE_INDEX).get();' +
          'mgmt.commit();' +
          'mgmt = graph.openManagement();' +
          'mgmt.awaitGraphIndexStatus(graph, "' + graphIndexName + '").status(SchemaStatus.ENABLED).' +
            'timeout(10, java.time.temporal.ChronoUnit.MINUTES).call();' +
        '}; ' +
        'mgmt.commit();' +

    '} else {' +
      'index = mgmt.getGraphIndex("' + graphIndexName + '");' +
      'propertyKey = mgmt.getPropertyKey("' + propertyName + '");' +
      'if (index.getIndexStatus(propertyKey) != SchemaStatus.ENABLED) {' +
        'mgmt.awaitGraphIndexStatus(graph, "' + graphIndexName + '").status(SchemaStatus.ENABLED).' +
          'timeout(10, java.time.temporal.ChronoUnit.MINUTES).call();' +
      '}; ' +
      'mgmt.commit();' +
    '};';
  }
}