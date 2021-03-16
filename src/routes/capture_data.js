const express = require('express');
const capture_data = express.Router();
const Twitter = require('twitter-v2');
const fetch = require('node-fetch');
const axios = require('axios').default;
import { testEnvironmentVariable } from '../settings';

import {sensorHost,standardHost} from '../urls'


var bodyParser =require('body-parser');

// create application/json parser
var jsonParser = bodyParser.json()

const client_twitter = new Twitter({
    bearer_token: process.env.BEARER_TOKEN,
});

var CronJob = require('cron').CronJob;

//production redis url
let redis_url = process.env.REDIS_URL;
if (process.env.ENVIRONMENT === 'development') {  
  require('dotenv').config();  
  redis_url = "redis://127.0.0.1"; 
}  
//redis setup
let client = require('redis').createClient({
    port: 6379, // Redis port
    host: "redis-server", // Redis host
    
});
client.on("error", function(err) {
    console.log("Bonk. The worker framework cannot connect to redis, which might be ok on a dev server!");
    console.log("Resque error : "+err);
    client.quit();
});


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
capture_data.get("/", (req,res) =>{
    res.status(200).json({ message: testEnvironmentVariable})

});

var getAPIArray = []
var state = false;
capture_data.post('/start_capture', jsonParser, function(req,res,next){    
    if(!state){
        sensorInitialization()
        res.status(200).json({
            status: `Data capture has started succesfully`
        });
    }
    else{
        state = true
        res.status(200).json({
            status: `Data capture has already started`
        });
    }

  

})

async function sensorInitialization(){
    var options = {
        host :sensorHost,
        path: ('/sensor_endpoints_activated')       
    };
    var url = "http://"+options.host + options.path;
    console.log("URL "+url);
    // construct the URL to post to a publication
    const MEDIUM_POST_URL = url;
    try {
        const response = await axios.get(MEDIUM_POST_URL);
        const data = response.data
        console.log(data)
        var apiGetArray = []
        var individualEndpoint;
        for (const row of data){
            //Si es un endpoint basado en software (se saca de una api y no de una app externa)
            if(row.base_url !== null){

                individualEndpoint = createFullEndpoint(row)
                apiGetArray.push(individualEndpoint)
            }
        }
        schedulingOnlineData(apiGetArray)
        
    } 
    catch (error) {
        console.error(error);
    }
    

}
  //id_players_sensor_endpoint


function createFinalEndpoint(row){
  
    var finalEndpoint = row.base_url
    var extensionEndpoint 
    console.log('Estos son los datos para crear la url')
    console.log(row)

    if(finalEndpoint === 'https://api.twitter.com/2/'){
        //CASO ESPECIAL: TWITTER
        console.log(row.header_parameters)
        let specific_parameters, specific_parameters_template
        const data = {
            header_parameters: JSON.parse(row.header_parameters),
            url: row.url_endpoint
        }
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
            var tokenValue, parameterValue
            for(const tkey of tokensKeys){
                for(const pkey of parametersKeys){
                    console.log(tkey)
                    console.log(pkey)
                    if(tkey == pkey){
                      tokenValue = tokens[tkey]
                      data.header_parameters[tkey] = tokenValue
                      
                    }
                }	
            
            }

        }

        if(row.specific_parameters_template !== null && row.specific_parameters !== null){
            if(typeof(row.specific_parameters_template) !== "object" && typeof(row.specific_parameters) !== "object"){
    
                specific_parameters = JSON.parse(row.specific_parameters)
                specific_parameters_template = JSON.parse(row.specific_parameters_template)
            }
            else{
                //Si ya es un json (pasa en peticiones desde el front)
                specific_parameters = row.specific_parameters
                specific_parameters_template = row.specific_parameters_template
            }
            var tokensKeys = Object.keys(specific_parameters)

      
            for (const identificator of tokensKeys) {
                if(identificator !== 'actual_data'){
                    data.header_parameters[identificator] = specific_parameters[identificator]
                }
                
            }


        }
       
      
        console.log('este el el json que voy a mandar para obtener los datos en twitter')
        console.log(data)
        

        return data


    }
    else{
        extensionEndpoint = row.url_endpoint   
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
            var tokenValue, parameterValue
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
        console.log("\n este es el specific template y de parameters \n")
        console.log(row.specific_parameters_template)
        console.log(row.specific_parameters)
        if(row.specific_parameters_template !== null && row.specific_parameters !== null){
            var specific_parameters;
            var specific_parameters_template;
            //Si no es un json (cuando se saca de la db es un string)
            if(typeof(row.specific_parameters_template) !== "object" && typeof(row.specific_parameters) !== "object"){
    
                specific_parameters = JSON.parse(row.specific_parameters)
                specific_parameters_template = JSON.parse(row.specific_parameters_template)
            }
            else{
                //Si ya es un json (pasa en peticiones desde el front)
                specific_parameters = row.specific_parameters
                specific_parameters_template = row.specific_parameters_template
            }
            var tokensKeys = Object.keys(specific_parameters)
            var parameters = specific_parameters_template.parameters
            var tokenValue, parameterValue
            for(const tkey of tokensKeys){
                for (const parameter of parameters) {
                        if(parameter.search_data.hasOwnProperty('specific_param')){
                          parameterValue = parameter.search_data.specific_param
                          if(tkey == parameterValue){
                            tokenValue = specific_parameters[tkey]
                            
                            extensionEndpoint = extensionEndpoint.replace('{'+parameterValue+'}', tokenValue)                  
                        }
                    }
                }
            }
    
        }
        console.log('the final endpoint is')
     
        finalEndpoint += extensionEndpoint
    
        console.log(finalEndpoint)
    
        console.log(finalEndpoint)
        return finalEndpoint
    }
    
   
}
function createFullEndpoint(row){
    let aux_player
    if(row.hasOwnProperty('id_players')){
        aux_player = row.id_players
    }
    else{
        aux_player = row.id_player
    }  
    var individualEndpoint ={  
        "id_player": aux_player,   
        "id_players_sensor_endpoint": row.id_players_sensor_endpoint,
        "id_online_sensor": row.id_online_sensor,
        "id_sensor_endpoint": row.id_sensor_endpoint,
        "endpoint": createFinalEndpoint(row),
        "watch_parameters":row.watch_parameters,                                             
        "schedule_time": row.schedule_time
    }
    return individualEndpoint

    
    
 
}
async function getDataEndpoint(getJob){

    if(!isString(getJob.endpoint)){
        //CASO ESPECIAL: TWITTER
        const reply = await client_twitter.get(getJob.endpoint.url, getJob.endpoint.header_parameters);
        return reply

    }
    else{

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
}

async function getData(getJob){
    console.log('esto es lo quie entra en la funcion del cron')
    console.log(JSON.stringify(getJob))
    const json = await getDataEndpoint(getJob)
 
    //Revisar si el dato esta en la cache
    client.get(getJob.id_players_sensor_endpoint, (error, rep)=> {         
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
                var repValues;
                var jsonValues;
                const results = access_parameters(parameters,json,repJsonFormat)
                repValues = results.repValues
                jsonValues = results.jsonValues
        
                var arrayChanges;
                console.log(`El largo de las comparaciones es ${parameters.length}`)
                arrayChanges = values_comparisons(repValues,jsonValues,comparisons,operations,parameters.length)
                
                for(let i = 0 ; i<arrayChanges.length; i++) console.log(arrayChanges[i])
                //Si hubo algun cambio en las variables
                if(checkChanges(arrayChanges)){
                    client.set(getJob.id_players_sensor_endpoint, JSON.stringify(json),(error, result)=> { 
                        if(error){                                                
                            console.log('nope', error)                           
                        }
                        else{
                            console.log('after client.set result is', result);
                            console.log('He guardado en el cache lo siguiente ', getJob.id_players_sensor_endpoint, JSON.stringify(json) );
                        }
                    })
                    var options = {
                        host : standardHost,
                        path: ('/standard_attributes_apis')       
                    };
                    console.log('---------------------------------------------------------------------------------- \n \n')
                    console.log('                   SE HIZO UN CAMBIO                                                \n \n')
                    console.log('---------------------------------------------------------------------------------- \n \n')

                    var url = "http://"+options.host + options.path;
                    console.log("URL "+url);
                    // construct the URL to post to a publication
                    // EJ: arrayChanges = [0,3,2,0,2] 
                    const MEDIUM_POST_URL = url;
                    console.log(watch_parameters_json)
                    console.log(watch_parameters_json.operations)
                    console.log(watch_parameters_json.parameters)
                    console.log(watch_parameters_json.descriptions)
                    console.log(watch_parameters_json.comparisons)

                    var dataChanges ={  
                        "id_player": getJob.id_player,   
                        "id_sensor_endpoint": getJob.id_sensor_endpoint,
                        "watch_parameters":watch_parameters_json.parameters,                                             
                        "data_changes": arrayChanges
                    }
                    console.log(dataChanges)
                    try {
                        const response = axios.post(MEDIUM_POST_URL,dataChanges);
                        console.log(response)
                        
                    } 
                    catch (error) {
                        console.error(error);
                    } 

                }
                

            
           }
           

        }                  
        else{
            //Si no se encuentra entonces almacenar en la cache usando su identificador
            client.set(getJob.id_players_sensor_endpoint, JSON.stringify(json),(error, result)=> { 
                if(error){                                                
                    console.log('nope', error)                           
                }
                else{
                    console.log('after client.set result is', result);
                    console.log('He guardado en el cache lo siguiente ', getJob.id_players_sensor_endpoint, JSON.stringify(json) );
                }
            })   
        }   //end of outer else
    })  //end of clinet.get 

    console.log(json);

    
}

function access_parameters(parameters,newInfo,cacheInfo){
    //En repJsonFormat esta lo del cache
    //En json esta lo obtenido desde la api
    console.log(parameters)
    console.log("Esto es lo que saque de informacion nueva ", newInfo)
    console.log("Esto es lo que estaba en el cache", cacheInfo)
    var repValues = []
    var jsonValues = []
    for (const parameter of parameters){
        var actualData = newInfo
        var cacheData = cacheInfo
        if(parameter.length === 1){
            //Se accede automaticamente al parametro O se saca el largo de un arreglo de resultados sin entrar a uno de ellos 
            console.log('este es el parametro a ver: ', parameter[0])
            console.log('Estoy en ', actualData)
            if(actualData !== undefined && cacheData !== undefined){

                if(Number.isInteger(parameter[0]) || isString(parameter[0])){
                    //Se accede a una llave
                    actualData = actualData[parameter[0]]
                    cacheData = cacheData[parameter[0]]
                }
                else{
                    //Se hizo un length
                    actualData = actualData.length
                    cacheData = cacheData.length
                }
            }
            else{
                actualData = 0
                cacheData = 0
            }
            jsonValues.push(actualData)
            repValues.push(cacheData)
        }
        else{
            for(const access_element of parameter){
            
                //Si es esta anidado, es decir, si tiene comas
                console.log('este es el parametro a ver: ', access_element)
                console.log('Estoy en ', actualData)
                if(actualData !== undefined && cacheData !== undefined){
                    console.log('El parametro a ver dentro del objecto es: linea 477 ')
                    console.log(access_element)
    
                    if(Number.isInteger(access_element) || isString(access_element)){
                        //IS NOT ARRAY BUT JUST AN OBJECT
                        if(Number.isInteger(access_element) && isObject(actualData)){
                            //No se puede acceder a un numero en un objeto por ende hay que pasar al siguiente parametro
                            continue;
                        }
                        else{
                            //Se accede a una llave
                            console.log('Entre!')
                            console.log('estoy en (x2): linea 482')
                            console.log(actualData)
                            console.log('este es el dato que voy a asignar')
                            console.log(actualData[access_element])
                            actualData = actualData[access_element]
                            console.log('Al final este es dato: linea 487')
                            console.log(actualData)

                            cacheData = cacheData[access_element]
                        }
                    }
                    else{
                        //Se hizo un length
                        actualData = actualData.length
                        cacheData = cacheData.length
                    }
                }
                else{
                    actualData = 0
                    cacheData = 0
                    break;
                }
                console.log('Al final el dato que voy a comparar es: ')
                console.log(actualData)
                console.log('Con: ')
                console.log(cacheData)

            }
            
            jsonValues.push(actualData)
            repValues.push(cacheData)
        }
        
        
       

    }
    

    const result = {
        "jsonValues": jsonValues,
        "repValues": repValues
    }
    return result
}


function isString(x) {
    return Object.prototype.toString.call(x) === "[object String]"
}
function checkChanges(arrayChanges){
    let bool = false
    arrayChanges.forEach((change) => {
            if(change !== 0){
                bool = true
            }
        }
    );
    return bool
}
function isObject(val) {
    if (val === null) { return false;}
    return ( (typeof val === 'function') || (typeof val === 'object') && !Array.isArray(val));
}
function values_comparisons(repValues,jsonValues,comparisons,operations,length){
    console.log(repValues)
    console.log(jsonValues)
    var arrayChanges = []
    console.log(`El largo de las comparaciones es ${length}`)
    for (let j= 0; j<length; j++){
        /* Ej 
            comparasions = ['>']
            operations =  ['-'] 
            jsonValues = [202]
            repValues = [200]
            
        */
        var boolResult;
        console.log(`La comparacion que se realizara ahora es: ${comparisons[j]}`)
        console.log(`Entre el valor: `)
        console.log(jsonValues[j])
        console.log(`y el valor: `)
        console.log(repValues[j])

        if(isObject(jsonValues[j])){
            Object.keys(jsonValues[j]).forEach((prop)=> console.log(prop));
        }
        if(isObject(repValues[j])){
            Object.keys(repValues[j]).forEach((prop)=> console.log(prop));
        }

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
        console.log(`Hubo un cambio? ${boolResult}`)
        var changed;
        if(boolResult){            
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
        }
        else{
            arrayChanges.push(0)

        }
    }
    console.log('algun cambio?')
    return arrayChanges
}




function runningJobs(getJob) {

    var job = new CronJob('*/'+ getJob.schedule_time.toString()+' * * * * *', function(){
        getData(getJob)       
    }, true, 'America/Santiago');
    getAPIArray.push({"job":job, "id":getJob.id_players_sensor_endpoint })
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
    getAPIArray.splice(indexApiToDelete,1)
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
function createSensorEndpoint(fullSensorBody, id_players_sensor_endpoint){
    console.log('esto entro:')
    console.log(JSON.stringify(fullSensorBody))
    var finalEndpoint = createFullEndpoint(fullSensorBody)
    console.log('Este es el endpoint final:')
    console.log(JSON.stringify(finalEndpoint))
    var job = new CronJob('*/'+ finalEndpoint.schedule_time.toString()+' * * * * *', function(){
        getData(finalEndpoint)       
    }, true, 'America/Santiago');
    console.log('este es el id')
    console.log(id_players_sensor_endpoint)
    getAPIArray.push({"job":job, "id":id_players_sensor_endpoint })

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

capture_data.put('/edit_sensor_endpoint', jsonParser, wrap(async(req,res,next) => {    
    var id_players_sensor_endpoint = req.body.id_players_sensor_endpoint
    deleteSensorEndpoint(id_players_sensor_endpoint)
    var endpoint = {endpoint: createFinalEndpoint(req.body)}
    var recievedJson = null
    try {
        recievedJson = await getDataEndpoint(endpoint)
        console.log('Estoy editando el sensor')
        console.log('Este es el json que me dio')
        console.log(recievedJson)
        console.log('Este es el ID (deberia ser 113)')
        console.log(id_players_sensor_endpoint)
        client.set(id_players_sensor_endpoint, JSON.stringify(recievedJson),(error, result)=> { 
            if(error){                                                
                console.log('nope', error)                           
            }
            else{
                console.log('after client.set result is', result);
                console.log('He guardado en el cache lo siguiente ', id_players_sensor_endpoint, JSON.stringify(recievedJson) );
            }
        }) 
    
        createSensorEndpoint(req.body, id_players_sensor_endpoint)
        
    
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
capture_data.put('/stop_sensor_endpoint', jsonParser, function(req,res,next){
    var uniqueSensorID = req.body.id_players_sensor_endpoint
    
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
capture_data.put('/startSensorEndpoint/', jsonParser, function(req,res,next){    
    var uniqueSensorID = req.body.id_players_sensor_endpoint

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
capture_data.post('/createSensorEndpoint/', jsonParser, function(req,res,next){
    createSensorEndpoint(req.body, req.body.id_players_sensor_endpoint)
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
capture_data.delete('/deleteSensorEndpoint/', jsonParser, function(req,res,next){
    var uniqueSensorID = req.body.id_players_sensor_endpoint

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
capture_data.post('/capture_external_data', jsonParser,  wrap(async(req,res,next) =>{
    
        var post_data = req.body;
        /*
            var id_player = req.body.id_player
            var id_sensor_endpoint = req.body.id_sensor_endpoint
            // [2,20,4,0,0]
            var data_changes = req.body.data_changes
            // Ej: [['chess_blitz','records',win'], ['elo'],['puzzle_challenge','record'],['puzzle_rush'],['chess_rapid','record','win']]
            var watch_parameters = req.body.watch_parameters
        
        */
       //FORCED PUSH 2
        console.log(post_data)

        var id_player = post_data.id_player;
        var id_sensor_endpoint = post_data.id_sensor_endpoint;
        var data_changes = post_data.data_changes;
        var watch_parameters = post_data.watch_parameters;
        console.log(id_player)
        console.log(id_sensor_endpoint)
        console.log(data_changes)
        console.log(watch_parameters)

        
        if(!id_player || !id_sensor_endpoint|| !data_changes|| !watch_parameters){
            res.status(400).json({
                status: `Error en enviar los datos, porfavor intentelo nuevamente`
            });  
        }
        let int_id_player = parseInt(post_data.id_player)
        let int_id_sensor_endpoint = parseInt(post_data.id_sensor_endpoint)

        let data_changes_array = []
        var data_changes_process = data_changes.split('.')
        var datas;
        var single_parameter_array;
        for (const single_parameter of data_changes_process) {
            datas = single_parameter.split(',')    
            single_parameter_array = []
            for (const data of datas){
                single_parameter_array.push(parseInt(data))
            }   
            data_changes_array.push(single_parameter_array)
        }

        var watch_parameters_array = []
        var watch_parameters_elements = watch_parameters.split('.')
       
        for (const single_parameter of watch_parameters_elements) {
            datas = single_parameter.split(',')    
            single_parameter_array = []
            for (const data of datas){
                single_parameter_array.push(data)
            }   
            watch_parameters_array.push(single_parameter_array)
        }

        console.log(watch_parameters_array)
       
        var options = {
            host :  standardHost,
            path: ('/standard_attributes_apis')       
        };
        var url = "http://"+options.host + options.path;
        console.log("URL "+url);
        var dataChanges = {  
            "id_player": int_id_player,   
            "id_sensor_endpoint": int_id_sensor_endpoint,
            "watch_parameters":watch_parameters_array,                                             
            "data_changes": data_changes_array
        }
        console.log(dataChanges)

        try {
            const response =  await axios.post(url,dataChanges);
            console.log(response)
            res.status(200).json({
                status: `Dato enviado correctamente`
            });   
            
        } 
        catch (error) {
            console.error(error);
            res.status(400).json({
                status: `Error en enviar los datos, porfavor intentelo nuevamente`
            });  
        } 
        
   
    

}))



export default capture_data;

