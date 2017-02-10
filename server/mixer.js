
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

}
