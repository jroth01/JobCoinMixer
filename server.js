/* Dependencies */
var express = require('express');
var bodyParser = require('body-parser');
var validator = require('validator');
var axios = require('axios');
var app = express();
var CircularJSON = require('circular-json');

/* Require Additional Module (if necessary later) */
require('./server/mixer')(app);

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

var addressesURL= 'http://jobcoin.projecticeland.net/intransfusible/api/addresses/';
var transactionsURL = 'http://jobcoin.projecticeland.net/intransfusible/api/transactions';

/* Endpoints */
app.get('/', function(request, response) {
        response.render('partials/index.html');
});

app.get('/app.js', function(request, response) {
        response.sendFile(__dirname + '/client/js/app.js');
});
app.get('/mainCtrl.js', function(request, response) {
        response.sendFile(__dirname + '/client/js/mainCtrl.js');
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

// Client sends a POST request in which the body contaiins a JSON array called "withdrawlAddresses"
// along with a "parent address", or the original bitcoin address
app.post('/mix', function(request, response) {
	   
	   
	   var withdrawls = request.body.withdrawlAddresses; // used for laundering 
	   var parent = request.body.parentAddress;

	   response.send(JSON.stringify(withdrawl));

});

/* GET list of transactions */
app.get('/transactions', function(request, response) {
       axios.get(transactionsURL )
                  .then(function(res){
                  	var obj, str;
                  	obj = res;
					str = CircularJSON.stringify(obj.data.transactions);
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


/* Listen on port 3000 */
app.set('port', (process.env.PORT || 3000));
app.listen(app.get('port'), function() {
        console.log('Node app is running on port', app.get('port'));
});
