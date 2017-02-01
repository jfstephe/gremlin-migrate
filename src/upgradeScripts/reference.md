:remote connect tinkerpop.server conf/remote.yaml

// indexes
graph.tx().rollback() //Never create new indexes while a transaction is active
mgmt = graph.openManagement()
name = mgmt.getPropertyKey('name')
age = mgmt.getPropertyKey('age')
mgmt.buildIndex('byNameComposite', Vertex.class).addKey(name).buildCompositeIndex()
mgmt.buildIndex('byNameAndAgeComposite', Vertex.class).addKey(name).addKey(age).buildCompositeIndex()
mgmt.commit()
//Wait for the index to become available
mgmt.awaitGraphIndexStatus(graph, 'byNameComposite').call()
mgmt.awaitGraphIndexStatus(graph, 'byNameAndAgeComposite').call()
//Reindex the existing data
mgmt = graph.openManagement()
mgmt.updateIndex(mgmt.getGraphIndex("byNameComposite"), SchemaAction.REINDEX).get()
mgmt.updateIndex(mgmt.getGraphIndex("byNameAndAgeComposite"), SchemaAction.REINDEX).get()
mgmt.commit()


mgmt = g.getManagementSystem()
name = mgmt.makePropertyKey('name').dataType(String.class).make()
mgmt.buildIndex('byName',Vertex.class).addKey(name).unique().buildCompositeIndex()
mgmt.commit()

mgmt = graph.openManagement()
name = mgmt.makePropertyKey('consistentName').dataType(String.class).make()
index = mgmt.buildIndex('byConsistentName', Vertex.class).addKey(name).unique().buildCompositeIndex()
mgmt.setConsistency(name, ConsistencyModifier.LOCK) // Ensures only one name per vertex
mgmt.setConsistency(index, ConsistencyModifier.LOCK) // Ensures name uniqueness in the graph
mgmt.commit()


// edge label multiplicity
mgmt = graph.openManagement()
follow = mgmt.makeEdgeLabel('follow').multiplicity(MULTI).make()
mother = mgmt.makeEdgeLabel('mother').multiplicity(MANY2ONE).make()
mgmt.commit()

// Property Key Cardinality

mgmt = graph.openManagement()
birthDate = mgmt.makePropertyKey('birthDate').dataType(Long.class).cardinality(Cardinality.SINGLE).make()
name = mgmt.makePropertyKey('name').dataType(String.class).cardinality(Cardinality.SET).make()
sensorReading = mgmt.makePropertyKey('sensorReading').dataType(Double.class).cardinality(Cardinality.LIST).make()
mgmt.commit()


// Concerned that Titan could have read cache in that last query, instead of relying on the index?
// Start a new instance to rule out cache hits.  Now we're definitely using the index.
graph.close()
graph = TitanFactory.open("conf/titan-cassandra-es.properties")
g.V().has("desc", containsText("baz"))
