var util = require('util');
var app = require('./index');
var bleno = require('bleno');
const skky = require('./skky');
const sleep = require('sleep');
const zlib = require('zlib'); 

var BlenoPrimaryService = bleno.PrimaryService;
var BlenoCharacteristic = bleno.Characteristic;
var BlenoDescriptor = bleno.Descriptor;
var serverConnection = null;
var waitingForResponse = false;

const CONST_DataChunkSize = 512;
const CONST_GeroInitTimeoutInMs = 60000;

console.log('bleno-gero starting...');

var serviceInfo = {
	serviceName: 'Geroix',
	geroid: 0,
	
	geroServiceUuid: 'fffffffffffffffffffffffffffffff0',
	geroCommandCharacteristicUuid: 'fffffffffffffffffffffffffffffff1',
	
	geroInitCharacteristicUuid: 'fffffffffffffffffffffffffffffff2',
	gpioInitCharacteristicUuid: 'fffffffffffffffffffffffffffffff3',
	geroGetStateCharacteristicUuid: 'fffffffffffffffffffffffffffffff4',

	init: function() {
	  console.log('serviceInfo.init()');
	}
};

var GeroCommandCharacteristic = function() {
	GeroCommandCharacteristic.super_.call(this, {
		uuid: serviceInfo.geroCommandCharacteristicUuid,
		properties: ['write'],
		value: null
	});
	
	this._value = new Buffer('{"gpioid":45,"state":0}'); 
	this._updateValueCallback = null;
};

util.inherits(GeroCommandCharacteristic, BlenoCharacteristic);

GeroCommandCharacteristic.prototype.onReadRequest = function(offset, callback) {
	var fname = 'GeroCommandCharacteristic-onReadRequest: ';
 
	console.log(fname);
	var result = this.RESULT_SUCCESS;
	var json = JSON.stringify(app.gpioGetStateJsonFromAll());
	var data = new Buffer(json);
	
	if (offset > data.length) {
		result = this.RESULT_INVALID_OFFSET;
		data = null;
	}
	else {
		data = data.slice(offset);
	}
  
	console.log(fname + 'data value = ' + (skky.isNullOrUndefined(data) ? '' : data.toString()) + ".");
  
	callback(result, data);
};

GeroCommandCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
	var fname = 'GeroCommandCharacteristic-onWriteRequest: ';

	this._value = data;
	console.log(fname + 'value = ' + this._value.toString());
//	var iotret = app.processCommands(JSON.parse('{"geroid":13,"cmd":[{"obj":['+this._value+'],"code":2,"id":14051,"ts":1473400319339}],"id":14052,"ts":1473400319339}'));
	var iotret = app.gpioSetState(this._value.toString());

	if (this._updateValueCallback) {
		console.log(fname + 'notifying');
		this._updateValueCallback(this._value);
	}

	callback(this.RESULT_SUCCESS);
};


var GeroInitCharacteristic = function() {
	GeroInitCharacteristic.super_.call(this, {
		uuid: serviceInfo.geroInitCharacteristicUuid,
		properties: ['read', 'write'],
		value: null
	});

	this._value = new Buffer(0);

	this._updateValueCallback = null;
	
	this.curSequenceNumber = 0;
	this.initBuffer = new Buffer(0);
	this.initBufferLength = 0;
	this.lastSentTime = 0;
};

util.inherits(GeroInitCharacteristic, BlenoCharacteristic);

GeroInitCharacteristic.prototype.onReadRequest = function(offset, callback) {
	var fname = 'GeroInitCharacteristics-onReadRequest: ';
	
	try {
		console.log(fname + 'sequence: ' + this.curSequenceNumber + ', buffer length: ' + this.initBufferLength + ', offset: ' + offset + ', last rx time: ' + this.lastSentTime + '.');

		var result = this.RESULT_SUCCESS;
		var data = null;

		//var json = JSON.stringify(app.gpioGetAllIds());
		var prevTime = this.lastSentTime;
		this.lastSentTime = (new Date()).getTime();
		if (null == this.initBuffer
				|| ((this.lastSentTime - prevTime) > CONST_GeroInitTimeoutInMs)) {
			console.log(fname + 'Reinitializing GeroInit Buffer from the app.');
			
			this.curSequenceNumber = 0;
			this.initBufferLength = 0;
			this.initBuffer = new Buffer(app.geroGetInitString());
			if (null != this.initBuffer)
				this.initBufferLength = this.initBuffer.length;
		}
	
		if (!offset) {
			var startOffset = this.curSequenceNumber * CONST_DataChunkSize;
			if (startOffset >= this.initBufferLength) {
				this._value = new Buffer(0);
				this.initBuffer = null;
			}
			else {
				this._value = this.initBuffer.slice(startOffset);
				if (this._value.length > CONST_DataChunkSize) {
					this._value = this._value.slice(0, CONST_DataChunkSize);
				}
			}
			
			++this.curSequenceNumber;
		}
		
		if (offset > this._value.length) {
			result = this.RESULT_INVALID_OFFSET;
		}
		else {
			data = this._value.slice(offset);
		}
	}
	catch(err) {
		console.log(fname + 'sequence: ' + this.curSequenceNumber + ', offset: ' + offset + ', buffer length: ' + this.initBufferLength + '. ' + err.message);
	}

	console.log(fname + 'sequence: ' + this.curSequenceNumber + ', offset: ' + offset + ', buflen: ' + this.initBufferLength + ', data value = ' + (skky.isNullOrUndefined(data) ? '' : data.toString()) + ".");
	
	callback(result, data);
};

GeroInitCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
	var fname = 'GeroInitCharacteristics-onWriteRequest: ';

	this._value = data;
	console.log(fname + 'value = ' + this._value.toString());
//	var iotret = app.processCommands(JSON.parse('{"geroid":13,"cmd":[{"obj":['+this._value+'],"code":2,"id":14051,"ts":1473400319339}],"id":14052,"ts":1473400319339}'));
	var iotret = app.gpioSetState(this._value.toString());
   
	if (this._updateValueCallback) {
		console.log(fname + ' notifying');
		this._updateValueCallback(this._value);
	}

	callback(this.RESULT_SUCCESS);
};


var GeroGetStateCharacteristic = function() {
	GeroGetStateCharacteristic.super_.call(this, {
		uuid: serviceInfo.geroGetStateCharacteristicUuid,
		properties: ['read', 'write'],
		value: null
	});

	this._value = new Buffer(0);

	this._updateValueCallback = null;
	
	this.lastSentTime = 0;
};

util.inherits(GeroGetStateCharacteristic, BlenoCharacteristic);

GeroGetStateCharacteristic.prototype.onReadRequest = function(offset, callback) {
	var fname = 'GeroGetStateCharacteristics-onReadRequest: ';
	
	try {
		console.log(fname + 'offset: ' + offset + ', last rx time: ' + this.lastSentTime + '.');

		var result = this.RESULT_SUCCESS;
		var data = null;

		var prevTime = this.lastSentTime;
		this.lastSentTime = (new Date()).getTime();
	
		if (!offset) {
			this._value = new Buffer(app.gpioGetStateJsonFromAll());
		}
		
		if (offset > this._value.length) {
			result = this.RESULT_INVALID_OFFSET;
		}
		else {
			data = this._value.slice(offset);
		}
	}
	catch(err) {
		console.log(fname + 'offset: ' + offset + ', buffer length: ' + this._value.length + '. ' + err.message);
	}

	console.log(fname + 'offset: ' + offset + ', buflen: ' + this._value.length + ', data value = ' + (skky.isNullOrUndefined(data) ? '' : data.toString()) + ".");
	
	callback(result, data);
};

GeroGetStateCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
	var fname = 'GeroGetStateCharacteristics-onWriteRequest: ';

	this._value = data;
	console.log(fname + 'value = ' + this._value.toString());
//	var iotret = app.processCommands(JSON.parse('{"geroid":13,"cmd":[{"obj":['+this._value+'],"code":2,"id":14051,"ts":1473400319339}],"id":14052,"ts":1473400319339}'));
	var iotret = app.gpioGetStateJsonFromAll();
   
	if (this._updateValueCallback) {
		console.log(fname + ' notifying');
		this._updateValueCallback(this._value);
	}

	callback(this.RESULT_SUCCESS);
};



function GeroixService() {
    GeroixService.super_.call(this, {
        uuid: serviceInfo.geroServiceUuid,
        characteristics: [
			new GeroCommandCharacteristic(),
			new GeroInitCharacteristic(),
			new GeroGetStateCharacteristic()
        ]
    });
}

util.inherits(GeroixService, BlenoPrimaryService);

bleno.on('stateChange', function (state) {
	var fname = 'bleno-gero: ';
    console.log(fname + 'on -> stateChange: ' + state + ', address = ' + bleno.address);

    if (state === 'poweredOn') {
        bleno.startAdvertising(serviceInfo.serviceName, [serviceInfo.geroServiceUuid]);
    } else {
        bleno.stopAdvertising();
    }
});

// Linux only events /////////////////
bleno.on('accept', function (clientAddress) {
	var fname = 'bleno-gero: ';
    console.log(fname + 'on -> accept, client: ' + clientAddress);

    bleno.updateRssi();
});

bleno.on('disconnect', function (clientAddress) {
	var fname = 'bleno-gero: ';
    console.log(fname + 'on -> disconnect, client: ' + clientAddress);
});

bleno.on('rssiUpdate', function (rssi) {
	var fname = 'bleno-gero: ';
    console.log(fname + 'on -> rssiUpdate: ' + rssi);
});
//////////////////////////////////////

bleno.on('mtuChange', function (mtu) {
	var fname = 'bleno-gero: ';
    console.log(fname + 'on -> mtuChange: ' + mtu);
});

bleno.on('advertisingStart', function (error) {
	var fname = 'bleno-gero: ';
    console.log(fname + 'on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

    if (!error) {
        bleno.setServices([
            new GeroixService()
        ]);
    }
});

bleno.on('advertisingStop', function () {
	var fname = 'bleno-gero: ';
    console.log(fname + 'on -> advertisingStop');
});

bleno.on('servicesSet', function (error) {
	var fname = 'bleno-gero: ';
    console.log(fname + 'on -> servicesSet: ' + (error ? 'error ' + error : 'success'));
});

module.exports.serviceInfo = serviceInfo;
