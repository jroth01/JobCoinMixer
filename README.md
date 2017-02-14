#JobCoin Mixer
A JobCoin tumbler for Gemini 

#Specification
1. User must provide a list of withdrawl addresses via POST /mix

2. Response from the post request includes the mixer's deposit address

3. User transfers bitcoins to the mixer's deposit address.

4. The mixer will detect user's transfer to the deposit address by watching or polling the P2P Bitcoin network.

5.	The mixer will transfer the user's bitcoins from the deposit address into a big “house account” along with all the other bitcoins currently being mixed. 

6.	Then, over some time the mixer will use the house account to dole out the user's bitcoins in smaller increments to the withdrawal addresses that the user provided, possibly after deducting a fee.

#Diagram of Solution

![alt tag](flowchart.png)


#High Level Algorithm of Solution

The following steps are triggered by a timer every n seconds:

1. Poll the P2P network for transactions
2. Parse out deposits sent to the mixer's deposit address
3. For each user's original amount sent to our deposit address,
     * Generate small incremental transactions that sum to the original amount
     * Prepare a batch of all the small transactions to be sent from the mixer's deposit address to various house addresses
4. Make the small incremental transactions from the mixer's deposit address to various house addresses in a randomized, staggered manner  
5. Make a final set of small incremental transactions from the house addresses back to each user's withdrawal addresses in a randomized, staggered manner

#Project Structure
server.js contains basic configuration, as well as the POST /register endpoint

mixer.js is a separate module that handles the business logic of the mixer

# Client usage: POST /register

The body of the POST request to /register must contain the following JSON
withdrawalAddresses : an array of withdrawl addresses
parentAddress: the address of the parent account

Example JSON:

<pre><code>
{
	"parentAddress": "Ben's Address",
	"withdrawlAddresses": ["B1","B2","B3", "B4", "B5"]
}
</code></pre>

The response to the POST request contains the mixer's public deposit address

# Running the server

To start the server, cd into the project's directory and execute the following
commands:

npm install

node server.js

The app will run on localhost:3000. As soon as the server is started, a setInterval function will
tell the mixer to poll the P2P network and tumble coins as necessary every n seconds.

