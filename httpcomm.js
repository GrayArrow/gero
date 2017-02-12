const sleep = require('sleep');
const util = require('util');
const http = require('http');
const url = require('url');
const constants = require('./constants');
const skky = require('./skky');
const iot = require('./iot');
const netcomm = require('./netcomm');
const app = require('./index');

this.servers = {};

this.createServer = function(endpoint, appid, apptype) {
	const fname = 'createServer: ';

	var urlParsed = new url.parse(endpoint);
	var state = 0;
	
	console.log(fname + 'Attempting to create server at ' + endpoint + '.');
	console.log(fname + 'URL parsed hostname: ' + urlParsed.hostname + ', port: ' + urlParsed.port + ', path: ' + urlParsed.pathname + ', appid: ' + appid + ', apptype: ' + apptype + '.');

	for(var key in this.servers) {
		if (key == port) {
			console.log(fname + key + ' already listening. Not creating a new server');
			return this.servers[key];
		}
	}

	try {
		// Start the server now that we've received good configuration data.
		this.servers[endpoint] = http.createServer(function (req, res) {
			switch (req.method) {
				case 'POST':
					netcomm.getBody(req, res, function(jo) {
						console.log(fname + 'POST rx on ' + endpoint + ': ' + util.inspect(jo, null, null));
	
						if (apptype == constants.APPID_EegDetector) {
							if (skky.isNullOrUndefined(jo.state)) {
								// Get the state.
								jo.state = state;
								return jo;
							}
							else {
								state = jo.state;
								// Just pass the data on for now.
								jo.apptype = apptype;
								jo.appid = appid;
								
								return app.sendEegData(jo);
							}
						}
						else {
							return app.processCommands(jo);
						}
					},
					function(err) {
						console.log(fname + 'POST error on ' + endpoint + ': ' + err.message);
					});
	
					break;
				case 'GET':
					console.log(fname + 'HTTP GET on endpoint: ' + endpoint + '.');
					res.writeHead(200, {'Content-Type': 'text/plain'});
					res.end(fname + 'HTTP server is listening on ' + endpoint + '. Please use HTTP POST for sending commands.');
					break;
				default:
					req.connection.destroy();
					break;
			}
		}).listen(urlParsed.port, urlParsed.hostname);
	
		console.log(fname + 'HTTP server started on ' + endpoint + '. There are currently ' + Object.keys(this.servers).length + ' HTTP servers actively listening for commands.');
		return this.servers[endpoint];
	}
	catch(err) {
		console.log(fname + 'CreateServer error: ' + err.message);
	}
	
	return null;
};

this.closeAll = function() {
	for(var key in this.servers) {
		this.servers[key].close(function() {
			console.log('Server at ' + key + ' closed.');
		});
		
		delete this.servers[key];
	}
}
