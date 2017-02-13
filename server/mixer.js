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


/* ----------------------------------------------------------------------------- *
 *
 *    MIXER MODULE
 *
 * ----------------------------------------------------------------------------- */

module.exports = function(app){


/* Require Database Config */
require('./config.js')(app);


/* ----------------------------------------------------------------------------- *
 *
 *    Timer Function - calls mixer function every n seconds
 *
 * ----------------------------------------------------------------------------- */

// set timer interval to poll the P2P network and mix every minute
var seconds = 5; 
var milliseconds = seconds * 1000;

var timer = setInterval(function() {
  console.log("Timer elapsed. Starting mixer to poll P2P network & tumble coins");
  mixJobCoins();
}, milliseconds);

//clearInterval(timer);

/* ----------------------------------------------------------------------------- *
 *
 *    Mixer function
 *
 * ----------------------------------------------------------------------------- */


/* 
 * Parse out deposits to mixer's deposit address from the P2P network
 * Moves BTC from deposit address to house addresses
 * Moves BTC from house addresses back to user's withdrawl addresses
 *
 * Parameter: lastMixDate, the timestamp of when the mixer last tumbled JobCoins
 */
function mixJobCoins() {
  console.log('Mixing...');
  axios.get(transactionsURL)
    .then(function(res){

    var allHouseDeposits = [];
    var withdrawalAddresses = [];
    var returnDeposits = [];
    var lastMixDate, mixDeposits, houseDeposits, from, to, str;
    str = CircularJSON.stringify(res.data);
    
    var now = moment().format('MMMM Do YYYY, h:mm:ss a');
    console.log('Transaction ledger as of ' + now + ': \n' + str);

    lastMixDate = getLastMixDate();

    // identify transactions sent to deposit address
    mixDeposits = getMixDeposits(res.data, lastMixDate);

    console.log('Mix deposits:');
    console.log(JSON.stringify(mixDeposits));

    if (mixDeposits.length > 0) {

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

      console.log('Done mixing!');

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

/* Stores the timestamp of when the mixer most recently
 * tumbled JobCoins
 *
 * Saves the timestamp to a file on the server-side
 */
function setLastMixDate() {


}

/* Stores the timestamp of when the mixer most recently
 * tumbled JobCoins
 *
 * Saves the timestamp to a file on the server-side
 */
function getLastMixDate() {


}

function verifyMix() {

}

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
          "withdrawalAddresses": withdrawl.withdrawalAddresses
        }

        transactionInfo.push(returnInfo);
      }
    });
  });

  return transactionInfo;
}


/* Returns transactions with a toAddress matching the mixer's depositAddress */
function getMixDeposits(transactions, lastMixDate) {

  var match, newItem, fromSpecified;

  var mixDeposits = transactions.map((item) => {
    match = (item.toAddress === depositAddress);
    newItem = (item.timestamp > lastMixDate);
    fromSpecified = (item.fromAddress != undefined);

      if ( match && newItem && fromSpecified) {
        return item;
      }
  });

  if (!isNull(mixDeposits))  {
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
    destinationIndex = randomNum(0, destinationList.length);
    to = destinationList[destinationIndex];
    deposit = createDepositObj(from, to, difference);
      transactions.push(deposit);
    }

    return transactions;
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


} /* end module.exports */
