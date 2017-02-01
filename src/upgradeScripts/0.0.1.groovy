// I am an example of a comment!
graph.addVertex(label, 'person').property('name', 'john').next();
person2 = graph.addVertex(label, 'person');
// NOTE: Don't forget to add the '.next()' else the step won't necessarily take effect!
res = person2.property('name', 'john').next();
if (!res) {
    // It didn't work!'
    graph.tx().rollback();
}
// DON'T put transactions in your upgrade scripts. The scripts are automatically wrapped in a transaction.
// graph.tx().commit();

// DON'T USE KEYWORDS EG 'ID', 'LABEL' etc