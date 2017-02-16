/* ----------------------------------------------------------------------------- *
 *
 *    JobCoin API Specific Setup
 *
 * ----------------------------------------------------------------------------- */

/* JobCoin API URLS */
var addressesURL= 'http://jobcoin.projecticeland.net/intransfusible/api/addresses/';
var transactionsURL = 'http://jobcoin.projecticeland.net/intransfusible/api/transactions';

/* Mixer Address to which coins will be sent */
var depositAddress = 'MixDeposit';
var houseAddresses = ["House1","House2","House3","House4","House5","House6",
           "House7", "House8","House9","House10"];

var axios = require('axios');
var CircularJSON = require('circular-json');

var moment = require('moment');
var jsonfile = require('jsonfile')
 
/* ----------------------------------------------------------------------------- *
 *
 *    MongoDB Config
 *
 * ----------------------------------------------------------------------------- */

var dbURL = 'mongodb://admin:funkyfresh@ds147799.mlab.com:47799/heroku_vm2rx1sr'
var mongoUri = process.env.MONGODB_URI || process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || dbURL;
var MongoClient = require('mongodb').MongoClient, format = require('util').format;
var db = MongoClient.connect(mongoUri, function(error, databaseConnection) {
  db = databaseConnection;
});

/* ----------------------------------------------------------------------------- *
 *
 *    MIXER MODULE
 *
 * ----------------------------------------------------------------------------- */

module.exports = function(app){
           
/* Each time server restarts is considered the time of last mix */
lastMixDate =  Date.now();

/* Set timer interval to poll the P2P network and mix as necessary every n seconds */
var seconds = 5; 
var milliseconds = seconds * 1000;
var timer = setInterval(function() {
  console.log("Timer elapsed. Starting mixer to poll P2P network & tumble coins");
  mixJobCoins();
}, milliseconds);

/* ----------------------------------------------------------------------------- *
 *
 *    Mixer function
 *
 *    1. Parses out user deposits to mixer's deposit address from the P2P network
 *    2. Moves BTC from deposit address to house addresses
 *    3. Moves BTC from house addresses back to each user's withdrawl addresses
 *
 * ----------------------------------------------------------------------------- */

function mixJobCoins() {

  console.log('Initializing mixer...');

 /* ----------------------------------------------------------------------------- *
  *
  *   1. Identify the number of deposits sent to our mixer that need to be tumbled
  *
  * ----------------------------------------------------------------------------- */

  /* Poll the P2P network for transactions */
  axios.get(transactionsURL)
    .then(function(res){

    var allHouseDeposits = [];
    var withdrawalAddresses = [];
    var returnDeposits = [];
    var mixDeposits, houseDeposits, from, to, str;

    /* Get response data containing transactions */
    str = CircularJSON.stringify(res.data);
    var now = moment().format('MMMM Do YYYY, h:mm:ss a');
    console.log('Transaction ledger as of ' + now + ': \n' + str);

    /* Parse out deposits sent to our mixer 
     * Only tumble if deposit has not already been mixed
     */
     mixDeposits = getMixDeposits(res.data, lastMixDate);
   
     console.log("here are mix deposits");
     console.log(JSON.stringify( mixDeposits));
  
     /* 
     * For each user's original amount sent to our deposit address,
     * generate small incremental transactions that sum to the original amount
     *
     * Prepare a batch of all the small transactions to be sent from the mixer's deposit 
     * address to house addresses
     */
    if (mixDeposits != undefined && mixDeposits.length > 0) {

      console.log('There are ' + mixDeposits.length + ' mix deposits to be tumbled:');
      console.log(JSON.stringify(mixDeposits));

      mixDeposits.map((deposit) => {

      console.log('Here is the deposit\n' + deposit);
      houseDeposits = generateDeposits(deposit["amount"], depositAddress, houseAddresses);

       console.log('The sum of the transactions is ' + sum(houseDeposits));
       console.log('Checking against original...');

       if (sum(houseDeposits) == deposit["amount"]) {
          console.log('VERIFIED: Matches original deposit amount of ' + deposit["amount"]);
       } else {
          console.log('DISCREPANCY: original deposit amount was ' + deposit["amount"]);
       }
      allHouseDeposits.push(houseDeposits);

      });

      allHouseDeposits = allHouseDeposits[0];
      console.log('All houseDeposits:');
      console.log(JSON.stringify(allHouseDeposits));
     
      /* ----------------------------------------------------------------------------- *
       *
       *   2. Make the small incremental transactions from the mixer's deposit                   
       *   address to various house addresses in a random manner  
       *
       * ----------------------------------------------------------------------------- */

      houseDeposits.map((transactions) => {
        console.log('Making incremental deposits to house addresses...');
        deposit(allHouseDeposits, 'house');
      });

      /* ----------------------------------------------------------------------------- *
       *
       *   3. Make a final set of small incremental transactions from the house addresses                   
       *   back to each user's withdrawal addresses in a random manner
       *
       * ----------------------------------------------------------------------------- */

      makeReturnDeposits(mixDeposits);

    }
    else {
      console.log('Nothing to mix!');
    }

    })
    .catch((err) => {
      console.log(err);
    });

}

/* ----------------------------------------------------------------------------- *
 *
 *    Helper functions
 *
 * ----------------------------------------------------------------------------- */

/* Makes return deposit transactions 
 * Sent from various house addresses to a user's withdrawal addresses
 */
function makeReturnDeposits(mixDeposits) {

  var withdrawalAddresses;
  var transactionInfo = [];

  // Get withdrawl addresses stored in db for each user
  db.collection('accounts', function(er, collection) {
    collection.find().toArray(function(err, docs) {
      if (err) {
          console.log(err);
      } else {
        accounts = docs;
        console.log('Mix deposits:')
        console.log(mixDeposits);
        console.log('accounts:');
        console.log(JSON.stringify(accounts));

        // For each user deposit
        mixDeposits.map((item) => {

          // search the accounts in our mixer's database
          accounts.map((account) => {
        
            /* If we match a user's address to a parent address in our db
             * Make note of how much total to give back, and
             * remember the user's array of withdrawal addresses
             */
            if (item.fromAddress === account.parentAddress) {
              var returnInfo = {
              "amount": item.amount,
              "fromAddress": item.fromAddress,
              "withdrawalAddresses": account.withdrawalAddresses
              }
              transactionInfo.push(returnInfo);
            }

          });
        });

        console.log('transactionInfo');
        console.log(JSON.stringify(transactionInfo));
        
        var returnTransactionInfo = transactionInfo;
        var returnDeposits = [];
        var transaction, houseIndex;

        returnTransactionInfo.map((info) => {
          houseIndex = randomInt (0, houseAddresses.length);
          transaction = generateDeposits(info.amount, houseAddresses[houseIndex], 
                        info.withdrawalAddresses)
          returnDeposits.push(transaction);
        });

        returnDeposits = returnDeposits[0];
        console.log('Return deposits:');
        console.log(JSON.stringify(returnDeposits) + '\n');

        // make incremental return deposits to the user's withdrawl accounts
        returnDeposits.map((transactions) => {
          console.log('Making incremental return deposits to user withdrawal addresses...');
          console.log('Sum of the return deposits is ' + sum(returnDeposits));
          deposit(returnDeposits, 'user');
        });

        console.log('Done mixing!');

      }
    });
  });   
}

/* Returns transactions with a toAddress matching the mixer's depositAddress */
function getMixDeposits(transactions, lastMixDate) {

  var match, newItem, fromSpecified;

  var mixDeposits = transactions.map((item) => {

    // true if transaction is sent to mixer
    match = (item.toAddress === depositAddress);

    var timestamp = new Date(item.timestamp);
    lastMixDate = new Date(lastMixDate);

    // true if deposit was made after last mix
    newItem = ( timestamp > lastMixDate);

    // true if the deposit has a fromAddress
    fromSpecified = (item.fromAddress != undefined);

      if ( match && newItem && fromSpecified) {
        return item;
      }
  });

  if (!isNull(mixDeposits))  {
    mixDeposits = removeNull(mixDeposits);
    return mixDeposits;
  }
  else {
    return [];
  }

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
  if (deposits === undefined) {

    msg = "Completed successfully!";
    console.log(msg); 
    
    /* If we finished returning deposits to a user, we're
     * done with the current tumble and can update 
     * the latest mix timestamp
     * 
     * Else we finished deposits from mixer to
     * house accounts
     */
     var now = Date.now();
     lastMixDate = now

    return;
  }

  var depositObj = deposits;
  console.log('Depositing: ' + JSON.stringify(depositObj)); 

  // Remove the first element of the array
  transactions.shift();  

  axios.post(transactionsURL, depositObj)
        .then(function(res){
          
              console.log('Successfully deposited: ' + JSON.stringify(depositObj)); 
              
              var seconds = randomInt(0, 10); 
              var milliseconds = seconds * 1000;
              /* Set timer interval to poll the P2P network and mix as necessary every n seconds */
              console.log('making deposit after delay of ' + seconds + ' seconds');

              var timer = setTimeout(function() {
                console.log("Timer elapsed. Starting mixer to poll P2P network & tumble coins");

                  // Recurse on the truncated array
                  return deposit(transactions);

              }, milliseconds);
            
        })
        .catch((err) => {
                console.log(err);
        });
}
           
/* ----------------------------------------------------------------------------- *
 *
 *    Utility functions
 *
 * ----------------------------------------------------------------------------- */

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

/* Returns true if every elem in an array is null, else false */
function isNull(arr) {
  for (var i = 0; i < arr.length; i++) {
      if (arr[i] != null)
        return false;
  }
  return true;
}

// Returns array with null elements removed
function removeNull(arr) {

  function rmNull(item) {
      return item != null && item != undefined;
  }
  return arr.filter(rmNull);
}

} /* end module.exports */
