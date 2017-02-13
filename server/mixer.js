/* Dependencies */
var axios = require('axios');
var CircularJSON = require('circular-json');

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

/* Mixer */
module.exports = function(app){


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


}
