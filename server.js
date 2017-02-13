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

/* MongDB Config */
var dbURL = 'mongodb://admin:funkyfresh@ds147799.mlab.com:47799/heroku_vm2rx1sr'
var mongoUri = process.env.MONGODB_URI || process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || dbURL;
var MongoClient = require('mongodb').MongoClient, format = require('util').format;
var db = MongoClient.connect(mongoUri, function(error, databaseConnection) {
  db = databaseConnection;
});

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
 * 		JobCoin API Specific Setup
 *
 * ----------------------------------------------------------------------------- */

/* JobCoin API URLS */
var addressesURL= 'http://jobcoin.projecticeland.net/intransfusible/api/addresses/';
var transactionsURL = 'http://jobcoin.projecticeland.net/intransfusible/api/transactions';

/* Mixer Address to which coins will be sent */
var depositAddress = 'MixDeposit';
var houseAddresses = ["House1","House2","House3","House4","House5","House6",
 					 "House7", "House8","House9","House10"];

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
           
			// used for laundering 
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

/* ----------------------------------------------------------------------------- *
 *
 * 		Mixer function
 *
 * ----------------------------------------------------------------------------- */


/* 
 * Parse out deposits to mixer's deposit address
 * Moves BTC from deposit address to house addresses
 * Moves BTC from house addresses back to user's withdrawl addresses
 *
 * Parameter: lastMixDate, the timestamp of when the mixer last tumbled JobCoins
 */
function mixJobCoins(lastMixDate) {
       axios.get(transactionsURL)
        	.then(function(res){
 
        	var allHouseDeposits = [];
        	var withdrawalAddresses = [];
        	var returnDeposits = [];
       	 	var houseDeposits, from, to, str;
        	str = CircularJSON.stringify(res.data);
        	console.log(str);
       	 	
       	 	// identify transactions sent to deposit address
       	 	var mixDeposits = getMixDeposits(obj.data, lastMixDate);

       	 	// for each amount sent to deposit address,
       	 	// generate incremental portions of that amount
       	 	mixDeposits.map((deposit) => {
				houseDeposits = generateDeposits(deposit.amount, depositAddress, houseAddresses);
				allHouseDeposits.push(houseDeposits);
			});

       	 	// make all incremental deposits to the house account
			houseDeposits.map((transactions) => {
				deposit(transactions);
			});

			// get return deposit transactions 
			returnDeposits = getReturnDeposits(mixDeposits);

			// make incremental return deposits to the user's withdrawl accounts
			returnDeposits.map((transactions) => {
				deposit(transactions);
			});

			if (mixDeposits.length === 0) 
				response.send('Nothing to mix!');
			else 
				response.send('Done mixing!');

        })
        .catch((err) => {
          console.log(err);
        });

}

/* ----------------------------------------------------------------------------- *
 *
 * 		Helper functions
 *
 * ----------------------------------------------------------------------------- */

/* Returns an array of return deposit transactions 
 * to be sent from various house addresses to a user's withdrawal addresses
 */
function getReturnDeposits(mixDeposits) {
	    var returnTransactionInfo = [];
		var returnDeposits = [];
		var deposit, houseIndex;
		returnTransactionInfo = getReturnTransactionInfo(mixDeposits);

		returnTransactionInfo.map((info) => {
			houseIndex = randomInt (0, houseAddresses.length);
			deposit = generateDeposits(info.amount, houseAddresses[houseIndex], 
										info.withdrawalAddresses)
			returnDeposits.push(deposit);
		});

		return returnDeposits;
}

/* Returns an array of objects that map parent addresses to their 
 * corresponding withdrawal addresses
 */
function getReturnTransactionInfo(mixDeposits) {

	var withdrawalAddresses;
	var transactionInfo = []

	// Get withdrawl addresses stored in db for each user
	db.collection('accounts', function(er, collection) {
	    collection.find().toArray(function(err, docs) {
	      if (!err) {
	         withdrawalAddresses = docs;
	      } else {
	         return {};
	      }
	    });
		});

	// Match the user with their withdrawal addresses
	mixDepositsAddresses.map((item) => {
		withdrawalAddresses.map((withdrawl) => {

			if (item.fromAddress === withdrawl.parentAddress) {

				var returnInfo = {
					"amount": item.amount,
					"fromAddress": item.fromAddress,
					"withdrawalAddresses": withdrawl.withdrawalAddresses;
				}

				transactionInfo.push(returnInfo);
			}
		});
	});

	return transactionInfo;
}

/* Returns transactions with a toAddress matching the mixer's depositAddress */
function getMixDeposits(transactions, lastMixDate) {

	var mixDeposits = transactions.map((item) => {
  		if ( (item.toAddress === depositAddress) && (item.timestamp > lastMixDate)) {
   			return item;
  		}
	});

	return mixDeposits;
}

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

/* Returns the sum of a series of transactions */
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

/* Recursively makes all deposits in a list of transactions */
function deposit(transactions)
{
	var depositObj = transactions[0];

	axios.post(transactionsURL, depositObj)
	      .then(function(res){
	            var str, msg;
	            str = CircularJSON.stringify(res.data);

	            // Base case - list is empty
	            if (transactions.length == 0) {
	            	msg = transactions.length + " completed successfully.";
	        		console.log(msg); 
	        	}
	            
	            console.log('Depositing: ' + JSON.stringify(depositObj)); 
	            
	            // Recurse on the rest of the list items
	            deposit(transactions.shift());
	          
	      })
	      .catch((err) => {
	              console.log(err);
	      });
}
