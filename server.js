/* ----------------------------------------------------------------------------- *
 *
 * 		Configuration
 *
 * ----------------------------------------------------------------------------- */

/* Dependencies */
var express = require('express');
var bodyParser = require('body-parser');
var validator = require('validator');
var app = express();
var axios = require('axios');
var CircularJSON = require('circular-json');

/* Require Additional Module (if necessary later) */
require('./server/mixer')(app);

/* JobCoin API URLS */
var addressesURL= 'http://jobcoin.projecticeland.net/intransfusible/api/addresses/';
var transactionsURL = 'http://jobcoin.projecticeland.net/intransfusible/api/transactions';

/* MongDB Config */
var dbURL = 'mongodb://admin:funkyfresh@ds147799.mlab.com:47799/heroku_vm2rx1sr'
var mongoUri = process.env.MONGODB_URI || process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || dbURL;
var MongoClient = require('mongodb').MongoClient, format = require('util').format;
var db = MongoClient.connect(mongoUri, function(error, databaseConnection) {
  db = databaseConnection;
});

/* Mixer Address to which coins will be sent */
var mixerAddress = 'laundry';
var depositAddress = 'deposit';
var houseAddress = 'house';

/* App Configuration */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/partials", express.static(__dirname + '/client/partials'));
app.set('views', __dirname + '/client'); // views is directory for html pages
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');


/* ----------------------------------------------------------------------------- *
 *
 * 		Endpoints 
 *
 * ----------------------------------------------------------------------------- */
 
app.get('/', function(request, response) {
        response.render('partials/index.html');
});

// Client sends a POST request in which the body contaiins a JSON array called "withdrawalAddresses"
// along with a "parent address", or the original bitcoin address
app.post('/mix', function(request, response) {
           
			// used for laundering 
           var withdrawals = request.body.withdrawalAddresses; 
           var parent = request.body.parentAddress;
             
           var toInsert = {
              "parent": parent,
              "withdrawals": withdrawals
            };

            // Save information in a database
            db.collection('accounts', function(er, collection) {
              collection.insert(toInsert, function(err, saved) {
                if (err) {
                    response.sendStatus(500);
                } else if (!saved) {
                    response.sendStatus(500);
                } else {
                    response.send('Saved the following information: ' + JSON.stringify(toInsert));
                }
              });
            });   
});

/* GET withdrawal accounts 
 * (for dev purposes only - remove for production)
 */
app.get('/accounts', function(request, response) {
 db.collection('accounts', function(er, collection) {
            collection.find().toArray(function(err, docs) {
              if (!err) {
                 response.send('Saved the following information: ' + JSON.stringify(docs));
              } else {
                 response.send(JSON.stringify({}));
              }
            });
          });
});

/* GET list of transactions
 * Parse out deposits to mixer's deposit address
 * Moves BTC from deposit address to house account
 */
app.get('/pollTransactions', function(request, response) {
       axios.get(transactionsURL)
        	.then(function(res){

        	// handle circular JSON
        	var obj, str;
        	obj = res;
        	str = CircularJSON.stringify(obj.data);
       	 	
       	 	// identify transactions sent to deposit address
       	 	var mixDeposits = getMixDeposits(obj.data);

        	response.send(str);

        })
        .catch((err) => {
          console.log(err);
        });

});

/* Parses transactions and looks for those with a toAddress matching
 * the mixer's depositAddress
 */
function getMixDeposits(transactions) {

	var mixDeposits = transactions.map((item) => {
  		if (item.toAddress === depositAddress)
   			return item;
	});

	return mixDeposits;
}

/* Takes all deposits from depositAddress and moves them to house
 * the mixer's depositAddress
 */
function depositToHouse(transactions)
{}


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


app.get('/app.js', function(request, response) {
        response.sendFile(__dirname + '/client/js/app.js');
});
app.get('/mainCtrl.js', function(request, response) {
        response.sendFile(__dirname + '/client/js/mainCtrl.js');
});

/* Listen on port 3000 */
app.set('port', (process.env.PORT || 3000));
app.listen(app.get('port'), function() {
        console.log('Node app is running on port', app.get('port'));
});
