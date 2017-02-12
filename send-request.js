//var sleep = require('sleep');
var http = require('http');
var state = 1;

//This is the data we are posting, it needs to be a string or a buffer
var turnOn = '{"id":203,"ts":1479442995438,"c":[{"id":204,"ts":1479442995438,"code":26,"o":[{"state": 27}]}]}';
turnOn = '{"state": 1}';
var turnOff = '{"state": 0}';

//The url we want is `www.nodejitsu.com:1337/`
var options = {
  host: 'localhost',
  path: '/',
  //since we are listening on a custom port, we need to specify it by hand
  port: '8031',
  //This is what changes the request to a POST request
  method: 'POST'
};

callback = function(response) {
  var str = ''
  response.on('data', function (chunk) {
    str += chunk;
  });

  response.on('end', function () {
    console.log(str);

  });
}

var req = http.request(options, callback);
req.write(turnOn);

req.end();
setTimeout(function() {
	var req = http.request(options, callback);
	req.write(turnOff);

	req.end();

}, 6000);

