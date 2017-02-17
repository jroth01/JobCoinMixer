/* ----------------------------------------------------------------------------- *
 *
 * 		App Configuration
 *
 * ----------------------------------------------------------------------------- */

/* Dependencies */
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var validator = require('validator');
var axios = require('axios');
var CircularJSON = require('circular-json');

/* MongoDB Configuration */
var dbURL = 'mongodb://admin:funkyfresh@ds147799.mlab.com:47799/heroku_vm2rx1sr';
var mongoUri = process.env.MONGODB_URI || process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || dbURL;
var MongoClient = require('mongodb').MongoClient, format = require('util').format;
var db = MongoClient.connect(mongoUri, function(error, databaseConnection) {
  db = databaseConnection;
});


/* Basic Settings */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/partials", express.static(__dirname + '/client/partials'));
app.set('views', __dirname + '/client'); // views is directory for html pages
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

/* Listen on port 3000 */
app.set('port', (process.env.PORT || 3000));
app.listen(app.get('port'), function() {
        console.log('Node app is running on port', app.get('port') + '\n');
});

/* ----------------------------------------------------------------------------- *
 *
 * 		Mixer Module
 *
 * ----------------------------------------------------------------------------- */

var depositAddress = 'MixDeposit';

/* Mixer Module */
require('./server/mixer')(app);

/* ----------------------------------------------------------------------------- *
 *
 * 		Endpoints 
 *
 * ----------------------------------------------------------------------------- */

app.get('/', function(request, response) {
        response.render('partials/index.html');
});

app.get('/app.js', function(request, response) {
        response.sendFile(__dirname + '/client/js/app.js');
});
app.get('/mainCtrl.js', function(request, response) {
        response.sendFile(__dirname + '/client/js/mainCtrl.js');
});

/* 
 * POST /register
 *
 * The body of the POST request to /register must contain the following JSON
 * withdrawalAddresses : an array of withdrawl addresses
 * parentAddress: the address of the parent account
 */
app.post('/register', function(request, response) {

  // Configure CORS in the response header
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "X-Requested-With");

	var withdrawals = request.body.withdrawalAddresses; 
	var parent = request.body.parentAddress;
  	
	var toInsert = {
	  "parentAddress": parent,
	  "withdrawalAddresses": withdrawals
	};

  // Ensures only one of each parent address listed in our database
  db.collection('accounts').createIndex({parentAddress:1},{unique:true});

	// Save information in a database
	db.collection('accounts', function(er, collection) {
	  collection.insert(toInsert, function(err, saved) {
	    if (err) {
	        response.sendStatus(500);
	    } else if (!saved) {
	        response.sendStatus(500);
	    } else {

        if (saved.ops != undefined) {
          res = 'ERR: This parent address is already on file.\n';
          res += 'Please contact the application administrator to verify your identity if you wish to ';
          res += 'update your information.\n';
        } else {
          res = 'Saved the following information: ' + JSON.stringify(toInsert);
        }
	    	res += '\nThis mixer\'s deposit address is \'' + depositAddress + '\'';
	      response.send(res);
	    }
	  });
	});   
});