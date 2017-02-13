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


/* App Configuration */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/partials", express.static(__dirname + '/client/partials'));
app.set('views', __dirname + '/client'); // views is directory for html pages
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');


/* Listen on port 3000 */
app.set('port', (process.env.PORT || 3000));
app.listen(app.get('port'), function() {
        console.log('Node app is running on port', app.get('port'));
});


/* ----------------------------------------------------------------------------- *
 *
 * 		Database Config and Mixer Modules
 *
 * ----------------------------------------------------------------------------- */

/* Database Config */
require('./server/config')(app);

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
           
	var withdrawals = request.body.withdrawalAddresses; 
	var parent = request.body.parentAddress;
	 
	var toInsert = {
	  "parentAddress": parent,
	  "withdrawalAddresses": withdrawals
	};

	// Save information in a database
	db.collection('accounts', function(er, collection) {
	  collection.insert(toInsert, function(err, saved) {
	    if (err) {
	        response.sendStatus(500);
	    } else if (!saved) {
	        response.sendStatus(500);
	    } else {
	    	var res = 'Saved the following information: ' + JSON.stringify(toInsert);
	    	res += '\n This mixer\'s deposit address is \'' + depositAddress + '\'';
	        response.send(res);
	    }
	  });
	});   
});

/* Get the balance and list of transactions for an address
 * Query string parameter: address
 */
app.get('/addresses', function(request, response) {

    addressesURL += request.query.address;
    axios.get(addressesURL)
        .then(function(res){
          var obj, str;
          obj = res;
          obj = {
                  transactions: obj.data.transactions,
                  balance: obj.data.balance
          };
          str = CircularJSON.stringify(obj);
          console.log(str);
          response.send(str);

        })
        .catch((err) => {
          console.log(err);
        });

});

/* POST new transaction */
app.post('/transactions', function(request, response) {

    var obj = {
            fromAddress: request.query.from,
            toAddress: request.query.to,
            amount: request.query.amount
    }

	axios.post(transactionsURL, obj)
	  .then(function(res){
	        var obj, str;
	        obj = res;
	        str = CircularJSON.stringify(obj.data);
	        console.log(str);
	      response.send(str);
	      
	  })
	  .catch((err) => {
	          console.log(err);
	  });
});
