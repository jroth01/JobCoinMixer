/* -------------------------------------------------------------------------- *
 *
 *    JobCoin API Specific Setup
 *
 * ------------------------------------------------------------------------- */

/* JobCoin API URLS */
var base = 'http://jobcoin.projecticeland.net/intransfusible';
var addressesURL = base + '/api/addresses/';
var transactionsURL = base + '/api/transactions';

/* Mixer Address to which users send their coins */
var depositAddress = 'MixDeposit';
var houseAddresses = ["House1","House2","House3","House4","House5","House6",
           "House7", "House8","House9","House10"];

var axios = require('axios');
var CircularJSON = require('circular-json');
var moment = require('moment');
var jsonfile = require('jsonfile')
 
/* -------------------------------------------------------------------------- *
 *
 *    MongoDB Config
 *
 * ------------------------------------------------------------------------- */

var dbURL = 'mongodb://admin:funkyfresh@ds147799.mlab.com:47799/heroku_vm2rx1sr'
var mongoUri = process.env.MONGODB_URI || process.env.MONGOLAB_URI 
               || process.env.MONGOHQ_URL || dbURL;
var MongoClient = require('mongodb').MongoClient, 
                  format = require('util').format;
var db = MongoClient.connect(mongoUri, function(error, databaseConnection) {
  db = databaseConnection;
});

/* -------------------------------------------------------------------------- *
 *
 *    MIXER MODULE
 *
 * ------------------------------------------------------------------------- */

module.exports = function(app){
      
/* Each time server restarts is considered the time of last mix */
lastMixDate =  Date.now();

/* Set timer interval to poll the P2P network
 *  mix as necessary every n seconds 
 */
var seconds = 10;
var msg = 'Mixer will poll the P2P network every ' + seconds + ' seconds...\n';
console.log(msg);
var milliseconds = seconds * 1000;
var timer = setInterval(function() {
  mixJobCoins();
}, milliseconds);

/* -------------------------------------------------------------------------- *
 *
 *  Mixer function
 *
 *  1. Parses out user deposits to mixer's deposit address from the P2P network
 *  2. Moves BTC from deposit address to house addresses
 *  3. Moves BTC from house addresses back to each user's withdrawl addresses
 *
 * ------------------------------------------------------------------------- */

function mixJobCoins() {

  console.log('Looking for deposits to mix...\n');

  // Poll the P2P network for transactions 
  axios.get(transactionsURL)
    .then(function(res){

    var allHouseDeposits = [];
    var withdrawalAddresses = [];
    var returnDeposits = [];
    var mixDeposits, houseDeposits, from, to, str;

    // Get response data containing transactions
    str = CircularJSON.stringify(res.data);

    //Identify the number of deposits sent to our mixer that need to be tumbled
     mixDeposits = getMixDeposits(res.data, lastMixDate);
  
    /* 
     * For each user's original amount sent to our deposit address,
     * generate small incremental transactions that sum to the original amount
     */
    if (mixDeposits != undefined && mixDeposits.length > 0) {

      console.log('Mixing...\n');

      mixDeposits.map((deposit) => {

        console.log('Original deposit to mixer:');
        console.log(JSON.stringify(deposit) + '\n');

        houseDeposits = generateDeposits(deposit["amount"], 
                                            depositAddress, houseAddresses);

        console.log('Here are the corresponding house deposits:');
        console.log(JSON.stringify(houseDeposits) + '\n');

        validate(houseDeposits, deposit["amount"]);

        allHouseDeposits.push(houseDeposits);

      });

      allHouseDeposits = allHouseDeposits[0];
     
      /*
       * Make the small incremental transactions from the mixer's deposit                   
       * address to various house addresses in a random manner  
       */
      houseDeposits.map((transactions) => {
        deposit(allHouseDeposits, 'house');
      });

      console.log('Done making house deposits.\n');
      console.log('Making return deposits...\n');

      /* 
       * Make a final set of small incremental transactions from the house 
       * addresses back to each user's withdrawal addresses in a random manner
       */
      makeReturnDeposits(mixDeposits);

    }
    else {
      console.log('Nothing to mix!\n');
    }

    })
    .catch((err) => {
      console.log(err);
    });

}

/* -------------------------------------------------------------------------- *
 *
 *    Helper functions
 *
 * ------------------------------------------------------------------------- */

/* Makes return deposit transactions 
 * Sent from various house addresses to a user's withdrawal addresses
 */
function makeReturnDeposits(mixDeposits) {

  var withdrawalAddresses;
  var transactionInfo = [];

  // For each user deposit
  mixDeposits.map((item) => {

    // Get withdrawl addresses stored in db for that user
    db.collection('accounts', function(er, collection) {
      collection.find({"parentAddress": item.fromAddress}).toArray(
        function(err, docs) {
        if (err) {
            //console.log(err);
        } else {
          
          account = docs[0];
          
          /* 
           * Make note of how much total to give back, and
           * remember the user's array of withdrawal addresses
           */
          var returnInfo = {
            "amount": item.amount,
            "fromAddress": item.fromAddress,
            "withdrawalAddresses": account.withdrawalAddresses
          }

          transactionInfo.push(returnInfo);
          
          var returnTransactionInfo = transactionInfo;
          var returnDeposits = [];
          var transaction, houseIndex;

          // Generate return deposits 
          returnTransactionInfo.map((info) => {
            houseIndex = randomInt (0, houseAddresses.length);
            transaction = generateDeposits(info.amount,
                                houseAddresses[houseIndex], 
                                info.withdrawalAddresses)
            returnDeposits.push(transaction);

          });

          returnDeposits = returnDeposits[0];

          console.log('Return deposits to user:');
          console.log(JSON.stringify(returnDeposits) + '\n');

          validate(returnDeposits, item.amount);

          /* Make the incremental return deposits to the user's withdrawl 
           * accounts
           */
          returnDeposits.map((transactions) => {
            deposit(returnDeposits, 'user');
          });
        }
      });
    });   /* end database query */
  });

}

/* 
 * Returns transactions with a toAddress matching the mixer's depositAddress 
 */
function getMixDeposits(transactions, lastMixDate) {

  var match, newItem, fromSpecified;


  function notYetMixed(item) {
    // true if transaction is sent to mixer
    match = (item.toAddress === depositAddress);

      var timestamp = new Date(item.timestamp);
     lastMixDate = new Date(lastMixDate);
    // true if deposit was made after last mix
    newItem = ( timestamp > lastMixDate);

    // true if the deposit has a fromAddress
    fromSpecified = (item.fromAddress != undefined);

    return match && newItem && fromSpecified;
  }

  var mixDeposits = transactions.filter(notYetMixed);

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
  var upperBound =  Math.floor(originalAmount / 4);
  var transactions = [];
  from = fromAddress;

  // While we haven't transferred the full value of the originalAmount -1 
  while (sum < originalAmount - 1) {

    // generate a random int amount to deposit between 1 
    // and quarter of the original 
    depositAmount = randomInt(1,upperBound);

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

    destinationIndex = randomInt(0, destinationList.length);

    to = destinationList[destinationIndex];

    deposit = createDepositObj(from, to, difference);

    transactions.push(deposit);
  }

    return transactions;
}

/* Recursively makes all deposits in a list of transactions 
 *
 * Parameters: list of transactions
 */
function deposit(transactions)
{
  // Begin with a list of transactions
  var deposits = transactions[0];

  // Base case - list is empty 
  if (deposits === undefined ) {
    
    /* If we finished returning deposits to a user, 
     * update the latest mix timestamp
     */
     var now = Date.now();
     lastMixDate = now

    return;
  }

  var depositObj = deposits;

  // Remove the first element of the array
  transactions.shift();  

  axios.post(transactionsURL, depositObj)
        .then(function(res){

              /* Set timer delay for each deposit */
              var seconds = randomInt(0, 10); 
              var milliseconds = seconds * 1000;
              var timer = setTimeout(function() {
                  // Recurse on the truncated array
                  return deposit(transactions);
              }, milliseconds);
            
        })
        .catch((err) => {
                console.log(err);
        });
}
 
 /* 
  * Redistributes the sum of house addresses among those addresses 
  */
 function redistribute() {

    // TODO
 }        

/* -------------------------------------------------------------------------- *
 *
 *    Utility functions
 *
 * ------------------------------------------------------------------------- */

function validate(depositArray, originalAmount) {
  var str;
  if (sum(depositArray) == originalAmount) {
    str = 'Sum of return deposits matches original deposit amount of';
    console.log(str + ' ' + originalAmount + '\n');
  } else {
    str = 'Uh oh. Original deposit amount was ' + originalAmount;
    str += ' but the return deposits sum to ' + sum(depositArray);
    str += '\n';
    console.log(str);
  }
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

} /* end module.exports */
