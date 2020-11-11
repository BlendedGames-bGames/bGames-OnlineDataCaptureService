const mysql = require('mysql');
const mysqlConnection = mysql.createConnection({
    host:'db4free.net',
    user:'grybyus',
    password:'interaction1',
    database: 'testbg',
    multipleStatements:true
})


mysqlConnection.connect(function(err){
    if(!!err){
        console.log(err);
        return;
    } else{
        console.log('Db is connectedddd');
    }
});

module.exports = mysqlConnection;