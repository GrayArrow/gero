const util = require('util');
const skky = require('./skky');
const noble = require('noble');

console.log('bluegiga noble starting...');

function CharPerph(characteristic, peripheral) {
	this.c = characteristic;
	this.p = peripheral;
	this.isActive = true;
	this.missedData = null;
}

var gerobg = {
	charper: [],
	peripheralIds: [],
	serviceUuids: ['1802'],
	allowDups: true,

	addCharacteristic: function(characteristic, peripheral) {
		var cp = this.findCharacteristic(peripheral.id);
		if (null == cp) {
			cp = new CharPerph(characteristic, peripheral);
			this.charper.push(cp);
		}
		else {
			cp.c = characteristic;
			cp.isActive = true;
		}

		return cp;
	},
	findCharacteristic: function(pid) {
		for(var i = 0; i < this.charper.length; ++i) {
			if (this.charper[i].p.id == pid)
				return this.charper[i];
		}

		return null;
	},
	removeCharacteristic: function(pid) {
		var found = false;
		
		for(var i = 0; i < this.charper.length; ++i) {
			if (this.charper[i].p.id == pid) {
				console.log('bluegiga:  removing characteristic with peripheral id: ' + pid + '.');
				this.charper.splice(i, 1);
				found = true;
			}
		}

		return found;
	},
	writeData: function(red, green, blue) {
		var fname = 'writeData: ';

		console.log(fname + 'red: ' + red + ', green: ' + green + ', blue: ' + blue + ' to ' + this.charper.length + ' devices.');
		
		var numSent = 0;
		var data = new Buffer([red, green, blue]);
		for(var i = 0, cp = null; i < this.charper.length; ++i) {
			cp = this.charper[i];
			if (cp.isActive) {
				++numSent;
				cp.c.write(data, true);
				cp.missedData = null;
			}
			else {
				cp.missedData = data;
			}
		}
		
		return numSent;
	},

	printPeripherals: function() {
		var s = '';
		for(var i = 0; i < this.charper.length; ++i) {
			if (i > 0)
				s += ', ';
			s += this.charper[i].p.id;
		}
		
		console.log('bluegiga: peripheral ids: ' + s + '.');
	}
};

noble.on('stateChange', function(state) {
	var fname = 'bluegiga: ';
	console.log(fname + 'on -> stateChange: ' + state);
	
	if (state === 'poweredOn') {
		noble.startScanning(gerobg.serviceUuids, gerobg.allowDups);
	} else {
		noble.stopScanning();
	}
});

noble.on('scanStart', function() {
	var fname = 'bluegiga: ';
	console.log(fname + 'on -> scanStart');
	
	gerobg.printPeripherals();
});

noble.on('warning', function(message) {
	var fname = 'bluegiga: ';
	console.log(fname + 'on -> warning: ' + skky.nonNull(message));
	
	gerobg.printPeripherals();
});

noble.on('scanStop', function() {
	var fname = 'bluegiga: ';
	console.log(fname + 'on -> scanStop');
});

function discoverServices(peripheral) {
	var fname = 'bluegiga: ';
	
	peripheral.discoverServices(gerobg.serviceUuids, function(errsvc, services) {
		services.forEach(function(service) {
			console.log(fname + 'discover service: ' + service.uuid + ' on peripheral id: ' + peripheral.id);
			if(gerobg.serviceUuids.indexOf(service.uuid) != -1) {
				console.log(fname + 'found service: ' + service.uuid + ' on peripheral id: ' + peripheral.id);
				service.discoverCharacteristics(null, function(error, characteristics) {
					if (skky.isNullOrUndefined(error)) {
						//console.log('discovered Characteristics' + characteristics[0]);
						var cp = gerobg.addCharacteristic(characteristics[0], peripheral);
						if (!skky.isNullOrUndefined(cp.missedData)) {
							setTimeout(function() {
								cp.c.write(cp.missedData, true);
							}, 250);
						}
						console.log(fname + 'characteristics assigned for peripheral id: ' + peripheral.id);
					}
					else {
						console.log(fname + 'discoverServices error: ' + error);
					}
				});
			}
		});
	});
}

function connectPeripheral(peripheral) {
	peripheral.connect(function(error) {
		console.log('bluegiga: connected to peripheral: ' + peripheral.id + ' with ' + (skky.isNullOrUndefined(error) ? 'no errors.' : ' error: ' + error));

		discoverServices(peripheral);
	});
}

noble.on('discover', function(peripheral) {
	noble.stopScanning();
	
	if (gerobg.peripheralIds.indexOf(peripheral.id) == -1) {
		gerobg.peripheralIds.push(peripheral.id);

		//peripheral.on('connect', function() {
		//	console.log('on -> connect to peripheral: ' + peripheral.id + ', address: ' + peripheral.address + '.');
		//	this.discoverServices();
		//});

		connectPeripheral(peripheral);
		
		peripheral.on('disconnect', function() {
			var cp = gerobg.findCharacteristic(peripheral.id);
			if (null != cp)
				cp.isActive = false;

			noble.stopScanning();
			console.log('bluegiga: on -> disconnect from peripheral: ' + peripheral.id + ', address: ' + peripheral.address + '.');
		});
	}
	else {
		connectPeripheral(peripheral);
	}
});

exports.sendled = function(red, green, blue) {
	var fname = 'bluegiga: sendled: ';

	var numFound = 0;
	try {
		numFound = gerobg.writeData(red, green, blue);
	}
	catch(err) {
		console.log(fname + 'exception: ' + err.message);
	}

	if (!numFound)
		noble.startScanning(gerobg.serviceUuids, gerobg.allowDups);
};
