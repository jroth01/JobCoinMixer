#JobCoin Mixer
A JobCoin tumbler.

#What is JobCoin?
It's a simplified version of bitcoin used for sandboxing apps

#Specification
1. User must provide a list of withdrawal addresses via POST /register

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
4. Make the small incremental transactions from the mixer's deposit address to various house addresses in a randomized, staggered manner with a delay between each deposit
5. Make a final set of small incremental transactions from the house addresses back to each user's withdrawal addresses in a randomized, staggered manner with a delay between each deposit

This particular JobCoin mixer does not take a fee of any kind.

#Project Structure
server.js contains basic configuration, as well as the POST /register endpoint

mixer.js is a separate module that handles the business logic of the mixer

#Tradeoffs of NodeJS with Express

"Node.js uses an event-driven, non-blocking I/O model that makes it lightweight and efficient, perfect for data-intensive real-time applications that run across distributed devices"

Since this application was designed to be polling the P2P network and make many transactions in real-time, it is by definition event driven. NodeJS handles this kind of behavior well.

What are the drawbacks? With Node, you frequently run in to async "callback hell" and you get less out of the box. It doesn't abstract away the delay between request-response, so it helps me demonstrate understanding. 

If I were to implement this differently I might use Python with Flask, because it's lightweight
and the syntax is cleaner. Ultimately the code would probably be easier to read.  

#Tradeoffs of MongoDB

I am generally not a fan of noSQL and MongoDB for many reasons. However, for rapid prototyping and one-off assignments, it is incredibly quick to set up and use because it's just a collection of JSON documents. In my opinion the use cases for Mongo are very limited - basically for dumping data, typically in financial or pharmaceutical applications. 

In this case, I wanted a quick way to link and remember parent user addresses to their corresponding withdrawal addresses. JSON Key-value pairs and arrays were sufficient. 


Why not noSQL MongoDB? It is by definition, non-relational. If you start adding features and need to represent a relational model, SQL is the way to go to avoid duplicate data everywhere. Additionally, security is commonly an issue with Mongo. I'll explain below in the section where I talk about security and privacy vulnerabilities. 

# Security and Privacy Vulnerabilities
I'll discuss the typical vulnerabilities and my efforts to mitigate them. 

XSS - Cross site scripting 

I tried to use use RegExp to remove special chars and script tags from input received on POST /register.
However, for some reason I couldn't get it to work so I omitted it. You definitely always want to santize input on the server side.

XSRF - Cross site request forgery

XSRF attacks are considered useful if the attacker knows the target is authenticated to a web based system. But in this application, there's no login, so it doensn't really apply. 

CORS Config 

I set the response header to "Access-Control-Allow-Origin", "*" on the POST /register endpoint so that
anyone could use a client like POSTMAN to test regardless of domain. Normally
you would want to specifically whitelist specific domains and not use the wildcard character. 
An alternative approach might be to have a client side login form served by the app, and then
only accept post requests from the app itself. 

noSQL injection

Similarly to preventing noSQL injection, you want to sanitize input on the server side by removing
any special characters or malicious expressions that could be passed to the MongoDB client directly. 
I believe filtering out $where and a few other keywords would do the trick, but i'm not
familiar enough with regEx.  

MongoDB

To mitigate typical MongoDB security concerns i, I provisioned an mLab database with heroku. Connecting to the database via mLab's API is secured via HTTPS and an API key. You must create a username and password and authenticate to connect.  

When you connect to your mLab database from within the same datacenter/region (US), you communicate over heroku's internal network. Heroku provide a good deal of network security infrastructure to isolate tenants. The hypervisors used do not allow VMs to read network traffic addressed to other VMs and so no other tenant can “sniff” traffic.

# Client usage: POST /register

The body of the POST request to /register must contain the following JSON:

parentAddress - the address of the parent account

withdrawalAddresses - an array of withdrawal addresses


Example JSON:

<pre><code>
{
	"parentAddress": "Ben's Address",
	"withdrawalAddresses": ["B1","B2","B3", "B4", "B5"]
}
</code></pre>

The response to the POST request contains the mixer's public deposit address


# Future Improvements
One concern I have is what happens if a particular house address reserve gets too low.

Because deposits to and from the house are psuedo-randomly generated, there's the risk
that some accounts will be depleted faster than others. To mitigate this, I'd like
to write a function that evenly redistributes Jobcoins among all the house accounts
each time the mixer is run. 

# Running the server

To start the server, cd into the project's directory and execute the following
commands:

npm install

node server.js

The app will run on localhost:3000. As soon as the server is started, a setInterval function will
tell the mixer to poll the P2P network and tumble coins as necessary every n seconds.

