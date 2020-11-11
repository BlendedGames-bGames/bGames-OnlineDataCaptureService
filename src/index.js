const express = require("express");
const app = express();


//Settings
const port = process.env.PORT || 3032;

//Middlewares
app.use(express.json());

//Routes
app.use(require('./routes/CaptureData'))

//Starting the server
app.listen(port, () => {
 console.log(`listening on port ${port} ...... `);
});