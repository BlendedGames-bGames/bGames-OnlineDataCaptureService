const express = require('express');
const router = express.Router();

var http = require('http');
const qs = require('querystring');
const fetch = require('node-fetch');

var bodyParser =require('body-parser');

// create application/json parser
var jsonParser = bodyParser.json()
 
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

// PARA ESTE MICROSERVICIO SE NECESITA INGRESAR LOS DATOS DE LA SIGUIENTE MANERA:
/* Ejemplo de Json del Body para el POST
    {
    "id_player": 2,
    "nameat": "Resistencia",
    "namecategory": "Físico",
    "data": 1,
    "data_type": "in.off",
    "input_source": "xlr8_podometer",
    "date_time": "2019-05-16 13:17:17"
    }
*/

/*
Input:  Json of sensor data
Output: Void (stores the data in the db)
Description: Calls the b-Games-ApirestPostAtt service 
*/
router.post('/CaptureData/', jsonParser, function(req,res,next){
    try {
        var post_data = req.body;
        console.log(req.body.id_player)
        if(!req.body.id_player || !req.body.nameat|| !req.body.namecategory|| !req.body.data|| !req.body.data_type|| !req.body.input_source|| !req.body.date_time){
        console.log('nope')
        }

        var options = {
            host : 'bgames-standardattributes.herokuapp.com',
            path: ('/StandardAttributes/')       
        };
        var url = "http://"+options.host + options.path;
        console.log("URL "+url);
        // construct the URL to post to a publication
        const MEDIUM_POST_URL = url;
        console.log(post_data.id_player)
        console.log(post_data.nameat)
        console.log(post_data.namecategory)
        console.log(post_data.data)
        console.log(post_data.data_type)
        console.log(post_data.input_source)
        console.log(post_data.date_time)

        const response = fetch(MEDIUM_POST_URL, {
            method: "post",
            headers: {
                "Content-type": "application/json",
                "Accept": "application/json",
                "Accept-Charset": "utf-8"
                },
                body: JSON.stringify({
                    id_player: post_data.id_player,
                    nameat: post_data.nameat,
                    namecategory:post_data.namecategory,
                    data:post_data.data,
                    data_type:post_data.data_type,
                    input_source:post_data.input_source,
                    date_time:post_data.date_time
                })
        })
        .then(res => {
            if (res.resultCode == "200") return res.json('Success');
            return Promise.reject(`Bad call: ${res.resultCode}`);
      })
        .then(console.log);
    } catch (error) {
        next(error);
    }
    

})



module.exports = router;

