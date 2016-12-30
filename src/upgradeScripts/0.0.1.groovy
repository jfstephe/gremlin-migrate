// I am an example of a comment!
graph.addVertex(label, 'person').property('name', 'john').iterate();
person2 = graph.addVertex(label, 'person');
// NOTE: Don't forget to add the '.iterate()' else the step won't necessarily take effect!
person2.property('name', 'john').iterate();
// DON'T put transactions in your upgrade scripts. The scripts are automatically wrapped in a transaction.
// graph.tx().commit();