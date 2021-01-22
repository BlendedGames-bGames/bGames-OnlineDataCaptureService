const mysql = require('mysql');
var mysqlConnection  = mysql.createPool({
    connectionLimit : 100,
    host:'db4free.net',
    user:'grybyus',
    password:'interaction1',
    database: 'testbg',
    multipleStatements:true
});
module.exports = mysqlConnection;