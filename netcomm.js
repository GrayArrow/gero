const http = require('http');
const util = require('util');
const url = require('url');
const skky = require('./skky.js');
const iot = require('./iot.js');

const CONST_HeaderApplicationJson = 'application/json';
const CONST_HeaderApplicationFormEncoded = 'application/x-www-form-urlencoded';

//var fs = require('fs');
//var logfile = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});

sendResponse = function(res, jo) {
	const fname = 'netcomm sendResponse: ';
	try {
		console.log(fname + util.inspect(jo, null, null));

		res.setHeader('Content-Type', CONST_HeaderApplicationJson);
		res.end(JSON.stringify(jo));
		
		return 0;
	}
	catch(ex) {
		console.log(fname + 'Exception: ' + ex.message);
	}
	
	return -1;
}

this.getBody = function(req, res, callbackGood, callbackError) {
	var fullBody = '';
	var iotmain = iot.getTopWrapper();
	
	req.on('data', function(chunk) {
		var fname = 'netcomm req.data: ';

		try {
			if (fullBody.length > 1e6)
				req.connection.destroy();
					
			// append the current chunk of data to the fullBody variable
			fullBody += chunk.toString();
		}
		catch(ex) {
			console.log(fname + 'Exception: ' + ex.message);
			iotmain.addError(fname + 'Exception: ' + ex.message);
		}
	});
	
	req.on('end', function() {
		var fname = 'netcomm req.end: ';

		try {
			// parse the received body data
			if (skky.isFunction(callbackGood)) {
				try {
					iotmain = callbackGood(JSON.parse(fullBody));
					
					if (!skky.isNullOrUndefined(iotmain))
						console.log(fname + 'iotmain: ' + util.inspect(iotmain, null, null));
				}
				catch(excbgood) {
					console.log(fname + 'CallbackGood exception.' + skky.nonNull(fullBody));
					console.error(excbgood);
					
					iotmain.addError(fname + excbgood.message);
				}
			}

			if (skky.isNullOrUndefined(iotmain)) {
				if (null != res)
					sendResponse(res, '{}');
			}
			else {
				//if (iotmain.isEmpty())
				//	iotmain.addError(fname + 'Empty iotmain returned from handler.');
				
				if (null != res)
					sendResponse(res, iotmain);
			}
		}
		catch(ex) {
			console.log(fname + 'Exception: ' + ex.message);
			iotmain.addError(fname + 'Exception: ' + ex.message);
		}
	});

	req.on('error', function(e) {
		var fname = 'netcomm req.error: ';

		try {
			console.log(fname + e.message);
			if (skky.isFunction(callbackError)) {
				try {
					callbackError(e);

					iotmain.addError(fname + err.message);
				}
				catch(excberr) {
					console.log(fname + 'CallbackError exception.');
					console.error(excberr);
					
					iotmain.addError(fname + excberr.message);
				}
			}

			if (iotmain.isEmpty())
				iotmain.addError(fname + 'Empty return from request.on error handler.');
			
			if(null != res)	
				sendResponse(res, iotmain);
		}
		catch(ex) {
			console.log(fname + 'Exception: ' + ex.message);
			iotmain.addError(fname + 'Exception: ' + ex.message);
		}
	});
}

this.responseHeaderValid = function(res) {
	return (skky.nonNull(res.headers['content-type']).indexOf(CONST_HeaderApplicationJson) >= 0
			|| skky.nonNull(res.headers['content-length'], '0') != '0');
}

this.postJson = function(host, jreq, callbackGood, callbackError) {
	this.postJsonWithPath(host, null, jreq, callbackGood, callbackError);
}
this.postJsonWithPath = function(host, path, jreq, callbackGood, callbackError) {
	this.postWithPath(host, path, jreq, CONST_HeaderApplicationJson, callbackGood, callbackError);
}
this.postWithPath = function(host, path, jreq, contentType, callbackGood, callbackError) {
	var urlCracked = new url.parse(host);
	//console.log('urlCracked: ' + util.inspect(urlCracked, null, null));
	var dataString = skky.isObject(jreq) ? JSON.stringify(jreq) : skky.nonNull(jreq);

	var options = {
		host: urlCracked.hostname,
		path: skky.nonNull(path, urlCracked.pathname),
		port: urlCracked.port,
		method: 'POST',
		headers: {
			'Content-Type': skky.nonNull(contentType, CONST_HeaderApplicationJson),
			'Content-Length': Buffer.byteLength(dataString)
		}
	};
	//console.log('postWithPath: options: ' + util.inspect(options, null, null));
	
	this.postStringData(options, dataString, callbackGood, callbackError);
}
this.postStringData = function(options, dataString, callbackGood, callbackError) {
	try {
		var self = this;
		//console.log('netcomm.post to ' + options.host + options.path + ': ' + (skky.hasData(dataString) ? dataString : '[empty]') + '.');
		var req = http.request(options, function(res) {
			//console.log('StatusCode: ' + res.statusCode + ' from ' + options.host + '.');
			//console.log('Headers: ' + JSON.stringify(res.headers));
			//console.log('netcomm.post to ' + options.host + options.path + ': ' + (skky.hasData(dataString) ? dataString : '[empty]') + '.');
			
			if (self.responseHeaderValid(res)) {
				res.setEncoding('utf-8');
				//console.log('getting body');
				self.getBody(res, null, callbackGood, callbackError);
			}
			else {
				//console.log(res.headers);
				var myerr = {};
				myerr.message = 'Invalid Content type of ' + skky.nonNull(res.headers['content-type'], '[[empty]]') + '.';
				if (skky.isFunction(callbackError)) {
					try {
						callbackError(iot.getBase(), myerr);
					}
					catch(excberr) {
						console.log('netcomm.post callbackError exception.');
						console.error(excberr);
					}
				}
			}
		});
		req.on('error', function(e) {
			console.log('netcomm.post error: ' + skky.nonNull(e.message) + '.');
			console.log(e);
			if (skky.isFunction(callbackError)) {
				try {
					callbackError(iot.getBase(), e);
				}
				catch(excberr) {
					console.log('netcomm.post.req.on(error) callbackError exception.');
					console.error(excberr);
				}
			}
		});
	
		// write data to request body
		req.write(dataString);
	
		req.end();
		//console.log('options: ' + util.inspect(options, null, null));
		//console.log(dataString);
	}
	catch(ex) {
		console.log('netcomm.post exception: ' + ex.message + '.');
		console.log('netcomm.post exception: host: ' + options.host + ' path: ' + options.path + ' port: ' + options.port + ' data: ' + dataString + '.');
		if (skky.isFunction(callbackError)) {
			try {
				callbackError(iot.getBase(), ex);
			}
			catch(excberr) {
				console.log('netcomm.post.catchall callbackError exception.');
				console.error(excberr);
			}
		}
	}
}
