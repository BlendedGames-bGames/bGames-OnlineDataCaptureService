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

var CronJob = require('cron').CronJob;

//production redis url
let redis_url = process.env.REDIS_URL;
if (process.env.ENVIRONMENT === 'development') {  
  require('dotenv').config();  
  redis_url = "redis://127.0.0.1"; 
}  
//redis setup
let client = require('redis').createClient(redis_url);
let Redis = require('ioredis');
let redis = new Redis(redis_url);

// 2020-11-20T17:35:00.000Z
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

const mysqlConnection = require('../database');
const { Console } = require('console');
var getAPIArray = []


var id = 1;
try {mysqlConnection.query('SELECT `playerss`.`id_players` FROM `playerss`', function(err,rows,fields){
    if(!err){
        console.log(rows)
        var thisaux = "";
        for (let index = 0; index < rows.length-1; index++) {
            thisaux += rows[index].id_players+",";
        }
        thisaux += rows[rows.length-1].id_players;
        console.log(thisaux)
        var select = 'SELECT DISTINCT `playerss`.`id_players`, `online_sensor`.`id_online_sensor`,`sensor_endpoint`.`id_sensor_endpoint`, `playerss_online_sensor`.`tokens`, `online_sensor`.`base_url`, `sensor_endpoint`.`url_endpoint`, `sensor_endpoint`.`token_parameters`, `sensor_endpoint`.`specific_parameters`, `sensor_endpoint`.`watch_parameters`,`sensor_endpoint`.`schedule_time` '
        var from = 'FROM `playerss` '
        var join = 'JOIN `playerss_online_sensor` ON `playerss`.`id_players` = `playerss_online_sensor`.`id_players`     JOIN `online_sensor` ON `online_sensor`.`id_online_sensor` = `playerss_online_sensor`.`id_online_sensor` JOIN `sensor_endpoint` ON `sensor_endpoint`.`sensor_endpoint_id_online_sensor` = `online_sensor`.`id_online_sensor` '
        var where = 'WHERE `playerss`.`id_players` IN('+thisaux+') ' 
        var and = 'AND `online_sensor`.`activated` = 1 AND`sensor_endpoint`.`activated` = 1'
        var query = select+from+join+where+and
        mysqlConnection.query(query, function(err2,rows2,fields2){
            if (!err2){
                console.log(rows2);
                var apiGetArray = []
                var individualEndpoint;
                for (const row of rows2){
                    individualEndpoint = createFullEndpoint(row)
                    apiGetArray.push(individualEndpoint)
                }
                schedulingOnlineData(apiGetArray)
            } else {
                console.log(err);
            }
        });
        
    } else {
        console.log(err);
    }
    
});
} catch(ex) {
    console.log(ex)
}

function getUniqueSensorID(sensor){    
    console.log(sensor.id_online_sensor.toString())
    console.log(sensor.id_sensor_endpoint.toString())
    //Cuando se crea un sensor_point en el front
    if(sensor.id_player === undefined){
        return sensor.id_players.toString()+sensor.id_online_sensor.toString()+sensor.id_sensor_endpoint.toString()

    }
    else{
        return sensor.id_player.toString()+sensor.id_online_sensor.toString()+sensor.id_sensor_endpoint.toString()

    }
    
}

function createFinalEndpoint(row){
  
    var finalEndpoint = row.base_url
    var extensionEndpoint = row.url_endpoint   
    
    if(row.tokens !== null && row.token_parameters !== null){
        var tokens;
        var token_parameters;
        //Si no es un json (cuando se saca de la db es un string)
        if(typeof(row.tokens) !== "object" && typeof(row.token_parameters) !== "object"){

            tokens = JSON.parse(row.tokens)
            token_parameters = JSON.parse(row.token_parameters)
        }
        else{
            //Si ya es un json (pasa en peticiones desde el front)
            tokens = row.tokens
            token_parameters = row.token_parameters
        }
        var tokensKeys = Object.keys(tokens)
        var parametersKeys = Object.keys(token_parameters)
        for(const tkey of tokensKeys){
            for(const pkey of parametersKeys){
                console.log(tkey)
                console.log(pkey)
                if(tkey == pkey){
                  tokenValue = tokens[tkey]
                  parameterValue = token_parameters[tkey]
                  extensionEndpoint = extensionEndpoint.replace(parameterValue, tokenValue)
                  
                }
            }	
        
        }


    }                 
 
    finalEndpoint += extensionEndpoint
    console.log(finalEndpoint)
    return finalEndpoint
}
function createFullEndpoint(row){
        
      
    individualEndpoint ={  
        "id_player": row.id_players,   
        "id_online_sensor": row.id_online_sensor,
        "id_sensor_endpoint": row.id_sensor_endpoint,
        "endpoint": createFinalEndpoint(row),
        "watch_parameters":row.watch_parameters,                                             
        "schedule_time": row.schedule_time
    }
    return individualEndpoint

    
    
 
}
async function getDataEndpoint(getJob){
    const response = await fetch(getJob.endpoint, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            "Accept": "application/json",
            "Accept-Charset": "utf-8"
        },
    })
    const json = await response.json();
    return json
}

async function getData(getJob){
    console.log('esto es lo quie entra en la funcion del cron')
    console.log(JSON.stringify(getJob))
    var uniqueSensorID = getUniqueSensorID(getJob)
    const json = await getDataEndpoint(getJob)
 
    //Revisar si el dato esta en la cache
    client.get(uniqueSensorID, (error, rep)=> {         
        console.log('este es el rep')
        console.log(rep)       
        if(error){                                                 
            console.log('nope', error)                      
            return;                
        }  
        console.log(typeof(rep))    
        console.log(rep)   
        console.log(rep !== '{}')             
        if(rep && rep !== '{}'){  
            //Lo que esta en el cache       
            console.log('se encontro en el cache lo siguiente: ')
            console.log(rep)                   
            var repJsonFormat = JSON.parse(rep)               
            //Tipo de operaciones de comparacion existentes: < > <= >= === !== 
            //Tipo de operaciones aritmeticas existentes: + - / *
            // El operando de la izquierda es el que se obtiene de la api y el de la derecha es el existente
            /* Formato ej
                {   
                    "comparisons":['>',','...], Alberga la comparacion que se quiere hacer (ej, 200(obtenido)>198(existente) si el dato que saco es mayor que el existente)
                    "operations": ['-', '+'], Alberga la operacion que se quiere hacer con el dato obtenido y el que existe actualmente
                    "parameters":['win','chess_daily,record,win','...] Alberga los campos que se quieren comparar (si estan mas adentro, se separan con comas)
                }

                Por ejemplo: 
                 {   
                    "comparisons":['>'], 
                    "operations": ['-'], 
                    "parameters":['chess_blitz,record,win'] 
                }
                Se quiere ver las partidas ganadas del dia en ajedrez (win)
                Se tiene como dato actualmente un win:19
                La ubicacion en el json obtenido es 
                {
                    chess_daily:{
                        record: {win: 20, lose:1, draw:5},
                        puzzles: {},
                        lessons:{}
                    }
                }

                1)Comparar 20 con 19 usando > => true
                  Eso quiere decir que hubo un cambio con respecto a la ves anterior (en este contexto, se recompenza haber ganado una partida mas)

                2)Operacion 20-19 = 1 (se gano una partida) y ese 1 es el dato a posteriormente convertir en algun equivalente de atributos
            */
           console.log('hay watch parameters?')
           console.log(getJob.watch_parameters)
           console.log('estoy adentro de getData')
           console.log(typeof(getJob.watch_parameters))

           if(getJob.watch_parameters !== null){
            var watch_parameters_json;
            console.log(getJob.watch_parameters !== "object")
            if(typeof(getJob.watch_parameters) !== "object"){
                 watch_parameters_json = JSON.parse(getJob.watch_parameters) 
            }
            else{
                watch_parameters_json = getJob.watch_parameters
            }
               
               
            var comparisons = watch_parameters_json.comparisons
            var operations = watch_parameters_json.operations
            var parameters = watch_parameters_json.parameters
            //En repJsonFormat esta lo del cache
            //En json esta lo obtenido desde la api
            console.log("vamos a ver las comparasions, operations y parameters: ")
            console.log(comparisons)
            console.log(operations)
            console.log(parameters)
            var repValues = []
            var jsonValues = []
            for (const parameter of parameters){
                //Si es esta anidado, es decir, si tiene comas
                console.log('este es el parametro a ver ', parameter)
                if(/(,)/.test(parameter)){
                    console.log('el ', parameter)
                    console.log('esta anidado')

                    //
                    var res = parameter.split(","); // Ej: ['chess_daily','record','win']
                    var actualData = json
                    var cacheData = repJsonFormat
                    for(let i = 0; i<res.length; i++){
                        actualData = actualData[res[i]]
                        cacheData = cacheData[res[i]]

                    }
                    jsonValues.push(actualData)
                    repValues.push(cacheData)
                }
                else{
                    //El dato no esta anidado, es decir, esta en una llave al inicio
                    jsonValues.push(json[parameter])
                    repValues.push(repJsonFormat[parameter])

                }
            }
            console.log(repValues)
            console.log(jsonValues)
            var arrayChanges = []
            for (let j= 0; j<parameters.length; j++){
                /* Ej 
                    comparasions = ['>']
                    operations =  ['-'] 
                    jsonValues = [202]
                    repValues = [200]
                    
                */
               var boolResult;
               switch (comparisons[j]) {
                    case '>':
                        if(jsonValues[j] > repValues[j] ){
                            boolResult = true
                        }
                        else{
                            boolResult = false
                        }
                       
                       
                    break;
                    case '<':
                        if(jsonValues[j] < repValues[j] ){
                            boolResult = true
                        }
                        else{
                            boolResult = false
                        }
                    
                    break;
                    case '>=':
                        if(jsonValues[j] >= repValues[j] ){
                            boolResult = true
                        }
                        else{
                            boolResult = false
                        }
                    
                    break;
                    case '<=':
                        if(jsonValues[j] <= repValues[j] ){
                            boolResult = true
                        }
                        else{
                            boolResult = false
                        }
                    
                    break;
                    case '===':
                        if(jsonValues[j] === repValues[j] ){
                            boolResult = true
                        }
                        else{
                            boolResult = false
                        }
                    
                    break;
                    case '!==':
                        if(jsonValues[j] !== repValues[j] ){
                            boolResult = true
                        }
                        else{
                            boolResult = false
                        }
                    
                    break;
               }
               //Existe un cambio
               if(boolResult){
                    var changed;
                    switch (operations[j]) {
                        case '+':
                            changed = jsonValues[j] + repValues[j]                      
                        break;
                        case '-':
                            changed = jsonValues[j] - repValues[j]
                        break;
                        case '*':
                            changed = jsonValues[j] * repValues[j]
                        break;
                        case '/':
                            if(repValues[j]>0){
                                changed = jsonValues[j] / repValues[j]
                            }
                        break;
                    }
                    arrayChanges.push(changed)
                    client.set(uniqueSensorID, JSON.stringify(json),(error, result)=> { 
                        if(error){                                                
                            console.log('nope', error)                           
                        }
                        else{
                            console.log('after client.set result is', result);
                            console.log('He guardado en el cache lo siguiente ', uniqueSensorID, JSON.stringify(json) );
                        }
                    }) 

               }
            }
            
            console.log('algun cambio?')
            console.log(arrayChanges.length)

            
           }
           console.log('terminep')
           //Actualizar el cache con la nueva informacion
           
           

        }                  
        else{
            //Si no se encuentra entonces almacenar en la cache usando su identificador
            client.set(uniqueSensorID, JSON.stringify(json),(error, result)=> { 
                if(error){                                                
                    console.log('nope', error)                           
                }
                else{
                    console.log('after client.set result is', result);
                    console.log('He guardado en el cache lo siguiente ', uniqueSensorID, JSON.stringify(json) );
                }
            })   
        }   //end of outer else
    })  //end of clinet.get 

    console.log(json);

    
}

function runningJobs(getJob) {

    var job = new CronJob('*/'+ getJob.schedule_time.toString()+' * * * * *', function(){
        getData(getJob)       
    }, true, 'America/Santiago');
    var uniqueSensorID  = getUniqueSensorID(getJob)

    getAPIArray.push({"job":job, "id":uniqueSensorID })
    return job;    
}
function schedulingOnlineData(apiGetArray) {
    console.log(apiGetArray)
    for (let i=0; i<apiGetArray.length; i++) runningJobs(apiGetArray[i])
    
}

function deleteSensorEndpoint(uniqueSensorID){

    var indexApiToDelete;
    getAPIArray.forEach((api,index) => {
        if(api.id === uniqueSensorID){
            api.job.stop()
            indexApiToDelete = index
        }        
    });
    getAPIArray.splice(indexApiToDelete)
}
/*
Input:  Json of sensor data
  individualEndpoint ={  
        "id_player": id_players,   
        "id_online_sensor": id_online_sensor,
        "id_sensor_endpoint": id_sensor_endpoint,
        "tokens":tokens,
        "base_url": base_url,
        "url_endpoint":url_endpoint,
        "token_parameters": token_parameters,
        "watch_parameters":watch_parameters,                                             
        "schedule_time": schedule_time
   }
*/
function createSensorEndpoint(fullSensorBody){
    console.log('esto entro:')
    console.log(JSON.stringify(fullSensorBody))
    var finalEndpoint = createFullEndpoint(fullSensorBody)
    console.log('Este es el endpoint final:')
    console.log(JSON.stringify(finalEndpoint))
    var job = new CronJob('*/'+ finalEndpoint.schedule_time.toString()+' * * * * *', function(){
        getData(finalEndpoint)       
    }, true, 'America/Santiago');
    var uniqueSensorID = getUniqueSensorID(fullSensorBody)
    console.log('este es el id')
    console.log(uniqueSensorID)
    getAPIArray.push({"job":job, "id":uniqueSensorID })

}

/*
Input:  Json of sensor data
  individualEndpoint ={  
        "id_player": id_players,   
        "id_online_sensor": id_online_sensor,
        "tokens":tokens,
        "base_url": base_url,
        "url_endpoint":url_endpoint,
        "token_parameters": token_parameters,
        "watch_parameters":watch_parameters,                                             
        "schedule_time": schedule_time
   }
Output: Void (stores the data in the db)
Description: Calls the b-Games-ApirestPostAtt service 
This function is used by devices that can post directly to the cloud service like mobile phones
*/
const wrap = fn => (...args) => fn(...args).catch(args[2])

router.put('/editSensorEndpoint/', jsonParser, wrap(async(req,res,next) => {    
    var uniqueSensorID = getUniqueSensorID(req.body)
    deleteSensorEndpoint(uniqueSensorID)
    var endpoint = {endpoint: createFinalEndpoint(req.body)}
    var recievedJson = null
    try {
        recievedJson = await getDataEndpoint(endpoint)
        console.log('Estoy editando el sensor')
        console.log('Este es el json que me dio')
        console.log(recievedJson)
        console.log('Este es el ID (deberia ser 113)')
        console.log(uniqueSensorID)
        client.set(uniqueSensorID, JSON.stringify(recievedJson),(error, result)=> { 
            if(error){                                                
                console.log('nope', error)                           
            }
            else{
                console.log('after client.set result is', result);
                console.log('He guardado en el cache lo siguiente ', uniqueSensorID, JSON.stringify(recievedJson) );
            }
        }) 
    
        createSensorEndpoint(req.body)
        
    
        res.status(200).json({
            status: `Sensor endpoint ${req.body} edition succesful!`
          });
    }
    catch (e){
        next(e)
        res.status(500).json({
            status: `Sensor endpoint ${req.body} nope`
          });
    }
  
    

}))
/*
Input:  Json of sensor id
Output: Void (stores the data in the db)
Description: Calls the b-Games-ApirestPostAtt service 
This function is used by devices that can post directly to the cloud service like mobile phones
*/
router.put('/stopSensorEndpoint/', jsonParser, function(req,res,next){
    var uniqueSensorID = getUniqueSensorID(req.body)
    
    getAPIArray.forEach(api => {
        if(api.id === uniqueSensorID){
            api.job.stop()
        }
        
    });
    res.status(200).json({
        Status: `The sensor endpoint ${req.body} has stopped`
      });

})
/*
Input:  Json of sensor id
Output: Void (stores the data in the db)
Description: Calls the b-Games-ApirestPostAtt service 
This function is used by devices that can post directly to the cloud service like mobile phones
*/
router.put('/startSensorEndpoint/', jsonParser, function(req,res,next){    
    var uniqueSensorID = getUniqueSensorID(req.body)

    getAPIArray.forEach(api => {
        if(api.id === uniqueSensorID){
            api.job.start()
        }
        
    });
    res.status(200).json({
        status: `The sensor endpoint ${req.body} has started`
    });

})
/*
Input:  Json of sensor data 
  individualEndpoint ={  
        "id_player": id_players,   
        "id_online_sensor": id_online_sensor,
        "id_sensor_endpoint": id_sensor_endpoint,
        "tokens":tokens,
        "base_url": base_url,
        "url_endpoint":url_endpoint,
        "token_parameters": token_parameters,
        "watch_parameters":watch_parameters,                                             
        "schedule_time": schedule_time
   }
  individualEndpointProcceced ={  
            "id_player": row.id_players,   
            "id_online_sensor": row.id_online_sensor,
            "id_sensor_endpoint": id_sensor_endpoint,
            "endpoint": finalEndpoint,
            "watch_parameters":row.watch_parameters,                                             
            "schedule_time": row.schedule_time
   }
Output: Void (stores the data in the db)
Description: Calls the b-Games-ApirestPostAtt service 
This function is used by devices that can post directly to the cloud service like mobile phones
*/
router.post('/createSensorEndpoint/', jsonParser, function(req,res,next){
    createSensorEndpoint(req.body)
    res.status(200).json({
        status: `Sensor endpoint ${req.body} creation succesful!`
      });
})
/*
Input:  Json of sensor data
  individualEndpoint ={  
        "id_player": id_players,   
        "id_online_sensor": id_online_sensor,
        "id_sensor_endpoint": id_sensor_endpoint,
        "tokens":tokens,
        "base_url": base_url,
        "url_endpoint":url_endpoint,
        "token_parameters": token_parameters,
        "watch_parameters":watch_parameters,                                             
        "schedule_time": schedule_time
   }
Output: Void (stores the data in the db)
Description: Calls the b-Games-ApirestPostAtt service 
This function is used by devices that can post directly to the cloud service like mobile phones
*/
router.delete('/deleteSensorEndpoint/', jsonParser, function(req,res,next){
    var uniqueSensorID = getUniqueSensorID(req.body)

    deleteSensorEndpoint(uniqueSensorID)
    res.status(200).json({
        status: `Sensor endpoint ${req.body} deletion succesful!`
      });    
    

})



/*
Input:  Json of sensor data
Output: Void (stores the data in the db)
Description: Calls the b-Games-ApirestPostAtt service 
This function is used by devices that can post directly to the cloud service like mobile phones
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

