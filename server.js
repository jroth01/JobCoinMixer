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
var depositAddress = 'MixDeposit';
var houseAddresses = ["House1","House2","House3","House4","House5","House6", "House7", "House8","House9","House10"];

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
                	var res = 'Saved the following information: ' + JSON.stringify(toInsert);
                	res += '\n This mixer\'s deposit address is \'' + depositAddress + '\'';
                    response.send(res);
                }
              });
            });   
});

	// db.collection('accounts', function(er, collection) {
          //   collection.find().toArray(function(err, docs) {
          //     if (!err) {
          //        return docs;
          //     } else {
          //        return {};
          //     }
          //   	});
          // 	});


/* GET list of transactions
 * Parse out deposits to mixer's deposit address
 * Moves BTC from deposit address to house account
 */
app.get('/pollTransactions', function(request, response) {
       axios.get(transactionsURL)
        	.then(function(res){

        	var  str;
        	var allHouseDeposits = [];
       	 	var houseDeposits,from, to;
        	str = CircularJSON.stringify(res.data);
       	 	
       	 	// identify transactions sent to deposit address
       	 	var mixDeposits = getMixDeposits(obj.data);

       	 	// for each amount sent to deposit address,
       	 	// feed increments of the original amount to various house addresses
       	 	mixDeposits.map((deposit) => {
				houseDeposits = generateDeposits(deposit.amount, depositAddress, houseAddresses);
				allHouseDeposits.push(houseDeposits);
			});

       
       	 


        	response.send(str);

        })
        .catch((err) => {
          console.log(err);
        });

});

/* Returns a list of small deposit transactions that sum to
 * an original amount
 *
 * Parameters: original amount, from address, an array of destination addresses
 */
function generateDeposits(originalAmount, fromAddress, destinationList) {
	var sum = 0;
	var deposit, depositAmount, destinationIndex, difference, from, to;
	var upperBound =  originalAmount / 4;
	var transactions = [];
	from = fromAddress;

	// While we haven't transferred the full value of the originalAmount -1 
	while (sum < originalAmount - 1) {

		// generate a random int amount to deposit between 1 
		// and quarter of the original 
		depositAmount = randomNum(1,upperBound);

		// pick a random destination address to deposit to
		destinationIndex = randomInt(0, destinationList.length);

		// specify the destination address
		to = destinationList[destinationIndex];

		// create the deposit object
		deposit = createDepositObj(from, to, depositAmount);

		// remember it in an array of transactions
        transactions.push(deposit);

		sum+= depositAmount
	}

	// compute the remaining difference
	difference = originalAmount - sum;

	// if there's a difference, add it to the list of deposits
	if (difference > 0) {
		destinationIndex = randomNum(0, destinationList.length);
		to = destinationList[destinationIndex];
		deposit = createDepositObj(from, to, difference);
	    transactions.push(deposit);
    }

    return transactions;
}


function sum(transactions) {
	var sum = 0;
	transactions.map((item) => {
		sum += item.amount;
	});
	return sum;
}

/* Returns JSON deposit object */
function createDepositObj(from, to, amt) {
		var deposit = {
                fromAddress: from,
                toAddress: to,
                amount: amt
        }
        return deposit;
}

/* Returns a random number between a lower and upper bound */
function randomNum (low, high) {
    return Math.random() * (high - low) + low;
}

/* Returns a random int between a lower and upper bound */
function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

/* Returns transactions with a toAddress matching the mixer's depositAddress */
function getMixDeposits(transactions) {

	var mixDeposits = transactions.map((item) => {
  		if (item.toAddress === depositAddress)
   			return item;
	});

	return mixDeposits;
}

/* Recursiv 
*/
function depositToHouse(transactions)
{
	axios.post(transactionsURL, obj)
	      .then(function(res){
	            var str;
	            str = CircularJSON.stringify(res.data);
	            
	            depositToHouse(transactions.shift());

	            if (transactions.length == 0) {
	        		response.send(res);
	        	}
	          
	      })
	      .catch((err) => {
	              console.log(err);
	      });
}


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
