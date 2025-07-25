exports.up = function(knex) {
  return knex.schema.table('epics', function(table) {
    table.string('color');
  }).table('tickets', function(table) {
    table.string('priority_color');
  });
};

exports.down = function(knex) {
  return knex.schema.table('epics', function(table) {
    table.dropColumn('color');
  }).table('tickets', function(table) {
    table.dropColumn('priority_color');
  });
};