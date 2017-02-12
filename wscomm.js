const constants = require('./constants');
const skky = require('./skky');
const WebSocketClient = require('websocket').client;
const app = require('./index');

const iot = require('./iot');

function hasCommandCode(jo, code) {
	for(var cmd = null, index = 0; cmd = skky.getObject(jo.c, index); ++index) {
		if (code == cmd.code)
			return true;
	}
	
	return false;
}

function hasResponseCommand(jo, code) {
	for(var cmd = null, index = 0; cmd = skky.getObject(jo.c, index); ++index) {
		if (code == cmd.code)
			return true;
	}
	
	return false;
}

var webSocketManager = function(funcServerUrl, funcGetConfig, funcOnConnect, funcGetKeepAliveData) {
	var fname = 'WS: ';
	var self = this;

	var _WebSocketClient = new WebSocketClient();
	var _wsServerUrl = funcServerUrl();

	var keepAliveTimerId = 0;
	var keepAliveTimerInterval = 60000;	// 1 minute
	var serverLastReceive = 0;
	var lastConnectAttempt = new Date().getTime();
	var lastConnectClosed = new Date().getTime();
	var lastConnectError = 0;
	var lastConnectFailure = new Date().getTime();
	var lastConnectSuccess = 0;

	var _wsServerConnection = null;
	
	this.sentCommandIds = [];
	
	this.isCommandFound = function(jo) {
		var removed = 0;
		for(var cmd = null, index = 0; cmd = skky.getObject(jo.c, index); ++index) {
			for(var i = 0; i < this.sentCommandIds.length; ++i) {
				var id = this.sentCommandIds[i];
				if (id == cmd.id) {
					this.sentCommandIds.splice(i, 1);
					++removed;
					break;
				}
			}
		}

		console.log('Number of sentCommandIds: ' + this.sentCommandIds.length + ', ' + removed + ' found and removed.');

		return removed;
	};

	this.init = function() {
		try {
			console.log(fname + 'init with ' + _wsServerUrl + ' at ' + new Date().toLocaleString() + '.');
			keepAliveTimerId = setInterval(function() {
				self.timerMethod();
			}, keepAliveTimerInterval);
			
			_WebSocketClient.on('connectFailed', function(error) {
				console.log(fname + 'Connect Failed to ' + _wsServerUrl + ' at ' + new Date().toLocaleString() + ': ' + error.toString());
				
				lastConnectFailure = new Date().getTime();
			});
			
			_WebSocketClient.on('connect', function(connection) {
				console.log(fname + 'Client Connected to ' + _wsServerUrl + ' at ' + new Date().toLocaleString() + ' .');
				lastConnectSuccess = new Date().getTime();
				
				connection.on('error', function(error) {
					lastConnectError = new Date().getTime();

					console.log(fname + 'Connection Error to ' + _wsServerUrl + ' at ' + new Date().toLocaleString() + ' : ' + error.toString());
				});
				connection.on('close', function() {
					_wsServerConnection = null;
					lastConnectClosed = new Date().getTime();

					console.log(fname + 'Connection Closed by ' + _wsServerUrl + ' at ' + new Date().toLocaleString() + '.');
				});
				connection.on('message', function(message) {
					try {
						if (message.type === 'utf8') {
							var jo = JSON.parse(message.utf8Data);
							
							if (self.isCommandFound(jo)) {
								if (!hasCommandCode(jo, constants.CMDCODE_KeepAlive))
									console.log(fname + 'Received response at ' + new Date().toLocaleString() + ': ' + message.utf8Data);
			
								app.processResponse(jo);
							}
							else {
								console.log(fname + 'Received message at ' + new Date().toLocaleString() + ': ' + message.utf8Data);
								var iotret = app.processCommands(jo);
								if (skky.isNullOrUndefined(iotret))
									console.log(fname + 'No need to respond to message.');
								else
									connection.send(JSON.stringify(iotret));
							}
						}
					}
					catch(ex) {
						console.log(fname + 'onMessage exception at ' + new Date().toLocaleString() + ' : ' + ex.message);
					}
	
					serverLastReceive = new Date();
				});
	
				_wsServerConnection = connection;
			
				if (skky.isFunction(funcOnConnect))
					funcOnConnect();
			});
			
			this.connect();
		}
		catch(errinit) {
			console.log(fname + 'init master wrapper exception at ' + new Date().toLocaleString() + ' : ' + errinit.message);
		}
	};

	this.getConnectRetryInMillis = function() {
		var timeoutInMillis = 10000;
		try {
			if(timeoutInMillis < funcGetConfig().configRequestRetryInMillis)
				timeoutInMillis = funcGetConfig().configRequestRetryInMillis;
		}
		catch(err) {
			console.log(fname + 'Connection lost at ' + new Date().toLocaleString() + ' exception: ' + err.message);
		}
		
		return timeoutInMillis;
	};
	this.connect = function() {
		try {
			if (!this.isConnected()) {
				_wsServerUrl = funcServerUrl();
	
				var d = new Date();
				console.log(fname + 'Attempting to connect to ' + _wsServerUrl + ' at ' + d.toLocaleString() + '.');

				var gerokey = funcGetConfig().gerokey;
				if (!skky.hasData(gerokey))
					gerokey = funcGetConfig().nodeId;

				lastConnectAttempt = d.getTime();
				_WebSocketClient.connect(_wsServerUrl, null, null, { gerokey: gerokey });
			}
		}
		catch(err) {
			console.log(fname + 'Exception at ' + new Date().toLocaleString() + ' when attempting to connect to ' + _wsServerUrl + '. ' + err.message);
		}
	};

	this.keepAlive = function() {
		try {
			if (skky.isFunction(funcGetKeepAliveData) && this.isConnected())
				this.send(funcGetKeepAliveData());
		}
		catch(err) {
			console.log(fname + 'Error sending keepalive at ' + new Date().toLocaleString() + ': ' + err.message);
		}
	};

	this.isConnected = function() {
		return (!skky.isNullOrUndefined(_wsServerConnection) && _wsServerConnection.connected);
	};
	this.send = function(jo) {
		var iotstr = '';
		
		try {
			if (this.isConnected()) {
				for(var cmd = null, index = 0; cmd = skky.getObject(jo.c, index); ++index) {
					if (!skky.isNullOrUndefined(cmd.id))
						this.sentCommandIds.push(cmd.id);
				}
	
				iotstr = JSON.stringify(jo);
				_wsServerConnection.send(iotstr);
				if (!iot.isKeepAlive(jo))
					console.log(fname + 'send: ' + iotstr);
				else
					console.log(fname + 'Keep-Alive sent to: ' + _wsServerUrl);
			}
			else {
				//this.sentCommandIds.push(jo);
				console.log(fname + 'No server connection currently to send msg at ' + new Date().toLocaleString() + ' :' + skky.nonNull(iotstr));
			}
		}
		catch(err) {
			console.log(fname + 'Exception sending message at ' + new Date().toLocaleString() + ' : ' + err.message);
		}
	};

	this.timerMethod = function() {
		if(this.isConnected()) {
			this.keepAlive();
		}
		else {
			var lastErrTime = lastConnectClosed;
			if (lastConnectError > lastErrTime)
				lastErrTime = lastConnectError;
			if (lastConnectFailure > lastErrTime)
				lastErrTime = lastConnectFailure;

			var d = new Date();
			d = new Date(d.getTime() + this.getConnectRetryInMillis());

			if (lastErrTime <= d.getTime()) {
				this.connect();
			}
			else {
				console.log(fname + 'Waiting to connect to ' + _wsServerUrl + '. Autoconnect will retry in ' + this.getConnectRetryInMillis() + 'ms at ' + d.toLocaleString() + '.');
			}
		}
	};
	
	this.init();
};

module.exports = webSocketManager;
