const sleep = require('sleep');
const util = require('util');
const fs = require('fs');
const skky = require('./skky');
const constants = require('./constants');
const iot = require('./iot');
const gpio = require('./gpio');
const app = require('./index');

this.id = 0;
this.name = 'name';
this.url = '';

this.gpios = [];
this.apps = [];

this.rgbBleState = 0;

this.findGpio = function(gpioid) {
	for(var gp in this.gpios) {
		var gpio = this.gpios[gp];
		if (gpio.id == gpioid)
			return gpio;
	}
	
	return null;
};

this.findGpioFromPin = function(pin) {
	for(var gp in this.gpios) {
		var gpio = this.gpios[gp];
		if (gpio.pin == pin)
			return gpio;
	}
	
	return null;
};

this.removeGpio = function(gpioid) {
	for(var i = this.gpios.length - 1; i >= 0; i--) {
		if(this.gpios[i].id === gpioid) {
		   array.splice(i, 1);
		}
	}
};

this.findAllLeds = function() {
	return this.findAllOfType('led');
};

this.findFirstLed = function() {
	return this.findFirstOfType('led');
};

this.findAllOfType = function(type) {
	var arr = [];
	for(var gp in this.gpios) {
		var gpio = this.gpios[gp];
		if (gpio.getTypeNameLower() == (type || '').toLowerCase())
			arr.push(gpio);
	}
	
	return arr;
};

this.findFirstOfType = function(type) {
	for(var gp in this.gpios) {
		var gpio = this.gpios[gp];
		if (gpio.getTypeNameLower() == (type || '').toLowerCase())
			return gpio;
	}
	
	return null;
};

this.reset = function() {
	this.gpios = [];
	this.apps = [];
};

//this.addNewGpio = function(id, name, type, pin, isActiveLow) {
//	var gp = gpio.getNew(id, name, type, pin, isActiveLow);
//	gp.init();
//	
//	this.gpios.push(gp);
//}
this.addNewApp = function(jo) {
	this.apps.push(jo);
	console.log('addNewApp: ' + util.inspect(jo, null, null));

	return jo;
};

this.addNewGpio = function(jo) {
	this.removeGpio(jo.id);
	var gp = gpio.getNew(jo);
	console.log('addNewGpio: ' + util.inspect(gp, null, null));
	gp.init();
		
	this.gpios.push(gp);

	return gp;
};

this.getAppStateJson = function(obj) {
	var fname = 'getAppStateJson: ';

	if (skky.isNullOrUndefined(obj))
		return fname + 'empty object passed in.';
	else if (skky.isNullOrUndefined(obj.appid))
		return fname + 'no application id.';
	else if (skky.isNullOrUndefined(obj.apptype))
		return fname + 'no application type.';

	for(var iter in (this.apps || [])) {
		try {
			var gp = this.apps[iter];
			if (obj.appid == gp.appinfo.appid) {
				switch (gp.appinfo.apptype) {
					case constants.APPID_ColorPickerRgb:
						console.log(fname + this.rgbBleState);
						return {
							appid: gp.appinfo.appid,
							apptype: gp.appinfo.apptype,
							state: this.rgbBleState
						};

					case constants.APPID_Thermometer:
						if (skky.hasData(gp.appinfo.fileid)) {
							var temp = readTemp(gp.appinfo.fileid);
							if (temp != -1) {
								return {
									appid: obj.appid,
									apptype: obj.apptype,
									state: temp
								};
							}
							else {
								return 'fileid: ' + gp.appinfo.fileid + ' could not read temperature.';
							}
						}
						else {
							return 'Invalid fileid: ' + skky.nonNull(gp.appinfo.fileid) + '.';
						}

						break;
				}
			}
		}
		catch(err) {
			return fname + 'Error adding App status. ' + err.message;
		}
	}

	return 'Could not find app with id ' + obj.appid + ' to retrieve state.';
};

this.getStateJsonFromAll = function() {
	var fname = 'getStateJsonFromAll: ';

	var jos = this.getStateJson(this.gpios);
	
	for(var iter in (this.apps || [])) {
		try {
			var gp = this.apps[iter];

			var jo = {
				appid: gp.appinfo.appid,
				apptype: gp.appinfo.apptype,
			};

			switch (gp.appinfo.apptype) {
				case constants.APPID_ColorPickerRgb:
					//console.log(fname + this.rgbBleState);
					jo.state = this.rgbBleState;
					jos.push(jo);

					break;
				case constants.APPID_Thermometer:
					if (skky.hasData(gp.appinfo.fileid)) {
						var temp = readTemp(gp.appinfo.fileid);
						if (temp != -1) {
							jo.state = temp;
							
							jos.push(jo);
						}
						else {
							console.log('fileid: ' + gp.appinfo.fileid + ' could not read temperature.');
						}
					}
					else {
						console.log('Invalid fileid: ' + skky.nonNull(gp.appinfo.fileid) + '.');
					}

					break;
			}
		}
		catch(err) {
			console.log(fname + 'Error adding App status. ' + err.message);
		}
	}

	return jos;
};

this.getStateJsonFromId = function(gpioid) {
	const fname = 'getStateJsonFromId: ';
	var gp = null;
	var objretarr = [];

	try {
		gp = this.findGpio(gpioid);
		if (null != gp)
			objretarr = this.getStateJson(gp);
	}
	catch(ex) {
		//console.log('getState error');
		var errret = iot.getWithError(fname + ex.message + '. getState Exception caught on GPIO pin ' + gpioid + '.');
		objretarr.push(errret);
	}

	if (!objretarr.length) {
		objretarr.push(iot.getWithError('No GPIO found for pin ' + gpioid + '.'));
		console.log('No iotret returned.');
	}

	return objretarr;
};

this.getStateJson = function(gpios) {
	const fname = 'getStateJson: ';
	var objretarr = [];

	try {
		if(Object.prototype.toString.call(gpios) === '[object Array]') {
			for (var i = 0, len = gpios.length; i < len; i++) {
				try {
					objretarr.push(gpios[i].getHwStateJson());
				}
				catch(exinner) {
					//console.log('getStateJson error');
					console.error(exinner);
					var errret = iot.getWithError(fname + ' Exception inner: ' + exinner.message);
					objretarr.push(errret);
				}
			}
		}
		else if (null != gpios) {	// We were just one object.
			objretarr.push(gpios.getHwStateJson());
		}
	}
	catch(ex) {
		console.log(ex);
		var errret = iot.getWithError(fname + ' Exception: ' + ex.message);
		objretarr.push(errret);
	}

	return objretarr;
};

this.sendEvent = function(rsarr) {
	const fname = 'sendEvent: ';
	
	app.sendEventsToServer(rsarr, function(iotmain, jsonret) {
		console.log(fname + 'server returned: ' + util.inspect(jsonret, null, null));
	},
	function(err) {
		console.log(fname + ' Exception: ' + err.message);
	});
};
this.sendEventsForGpios = function(gpios) {
	//var states = (this.getStateJson(gpios) || []);
	//var ret = [];
	//
	//for(var i = 0; i < states.length; ++i) {
	//	ret.push(iot.getWithObject(states[i]));
	//}
	//
	//this.sendEvent(ret);
	this.sendEvent(this.getStateJson(gpios) || []);
};
/*
0000000;      // space
   8'h 30 : abcdefg  =  7'b 0111111;      // 0   
   8'h 31 : abcdefg  =  7'b 0000110;      // 1   
   8'h 32 : abcdefg  =  7'b 1011011;      // 2   
   8'h 33 : abcdefg  =  7'b 1001111;      // 3   
   8'h 34 : abcdefg  =  7'b 1100110;      // 4   
   8'h 35 : abcdefg  =  7'b 1101101;      // 5   
   8'h 36 : abcdefg  =  7'b 1111101;      // 6   
   8'h 37 : abcdefg  =  7'b 0000111;      // 7   
   8'h 38 : abcdefg  =  7'b 1111111;      // 8   
   8'h 39 : abcdefg  =  7'b 1101111;      // 9   
   8'h 41 : abcdefg  =  7'b 1110111;      // A   
   8'h 42 : abcdefg  =  7'b 1111111;      // B   
   8'h 43 : abcdefg  =  7'b 0111001;      // C   
   8'h 44 : abcdefg  =  7'b 0111111;      // D   
   8'h 45 : abcdefg  =  7'b 1111001;      // E   
   8'h 46 : abcdefg  =  7'b 1110001;      // F   
   8'h 47 : abcdefg  =  7'b 0111101;      // G   
   8'h 48 : abcdefg  =  7'b 1110110;      // H   
   8'h 49 : abcdefg  =  7'b 0000110;      // I   
   8'h 4A : abcdefg  =  7'b 0011110;      // J   
   8'h 4B : abcdefg  =  7'b 1110101;      // K   
   8'h 4C : abcdefg  =  7'b 0111000;      // L   
   8'h 4D : abcdefg  =  7'b 0110111;      // M   
   8'h 4E : abcdefg  =  7'b 0110100;      // N   
   8'h 4F : abcdefg  =  7'b 0111111;      // O   
   8'h 50 : abcdefg  =  7'b 1110011;      // P     
   8'h 51 : abcdefg  =  7'b 1100111;      // Q     
   8'h 52 : abcdefg  =  7'b 1110111;      // R     
   8'h 53 : abcdefg  =  7'b 1101101;      // S     
   8'h 54 : abcdefg  =  7'b 0000111;      // T     
   8'h 55 : abcdefg  =  7'b 0111110;      // U     
   8'h 56 : abcdefg  =  7'b 1100010;      // V     
   8'h 57 : abcdefg  =  7'b 1111110;      // W     
   8'h 58 : abcdefg  =  7'b 1110110;      // X     
   8'h 59 : abcdefg  =  7'b 1101110;      // Y     
   8'h 5A : abcdefg  =  7'b 1011011;      // Z     
   8'h 61 : abcdefg  =  7'b 1011111;      // a   
   8'h 62 : abcdefg  =  7'b 1111100;      // b   
   8'h 63 : abcdefg  =  7'b 1011000;      // c   
   8'h 64 : abcdefg  =  7'b 1011110;      // d   
   8'h 65 : abcdefg  =  7'b 1111011;      // e   
   8'h 66 : abcdefg  =  7'b 1110001;      // f   
   8'h 67 : abcdefg  =  7'b 1101111;      // g   
   8'h 68 : abcdefg  =  7'b 1110100;      // h   
   8'h 69 : abcdefg  =  7'b 0000100;      // i   
   8'h 6A : abcdefg  =  7'b 0011110;      // j   
   8'h 6B : abcdefg  =  7'b 1111010;      // k   
   8'h 6C : abcdefg  =  7'b 0110000;      // l   
   8'h 6D : abcdefg  =  7'b 0110111;      // m   
   8'h 6E : abcdefg  =  7'b 1010100;      // n   
   8'h 6F : abcdefg  =  7'b 1011100;      // o   
   8'h 70 : abcdefg  =  7'b 1110011;      // p     
   8'h 71 : abcdefg  =  7'b 1100111;      // q     
   8'h 72 : abcdefg  =  7'b 1010000;      // r     
   8'h 73 : abcdefg  =  7'b 1101101;      // s     
   8'h 74 : abcdefg  =  7'b 1111000;      // t     
   8'h 75 : abcdefg  =  7'b 0011100;      // u     
   8'h 76 : abcdefg  =  7'b 1100010;      // v     
   8'h 77 : abcdefg  =  7'b 1111110;      // w     
   8'h 78 : abcdefg  =  7'b 1110110;      // x     
   8'h 79 : abcdefg  =  7'b 1101110;      // y     
   8'h 7A : abcdefg  =  7'b 1011011;      // z     
   default  abcdefg  =  7'b 1000000;      // -
   endcase
endfunction
 */
this.shift8_595 = function(sdi, rclk, srclk, str, byteShiftCount, ishex, delay) {
	var ret = iot.getBase();
	var s = '';
	if (!skky.hasData(str)) {
		ret.addError('No data.');
		return ret;
	}
	
	ishex = (ishex || false);
	if ((delay || 0) < 1)
		delay = 500000;
	else
		delay *= 1000;	// Convert from milliseconds to microseconds.
	console.log('Running Shift8_595 app with ' + str + ', ishex: ' + ishex + ', delay: ' + delay + ' milliseconds on SDI: ' + sdi + ', RCLK: ' + rclk + ', SRCLK: ' + srclk + ', byteShiftCount: ' + byteShiftCount + '.');

	var gsdi = this.findGpio(sdi);
	if (skky.isNullOrUndefined(gsdi)) {
		ret.addError('SDI is invalid.');
		return ret;
	}
	var grclk = this.findGpio(rclk);
	if (skky.isNullOrUndefined(grclk)) {
		ret.addError('RCLK is invalid.');
		return ret;
	}
	var gsrclk = this.findGpio(srclk);
	if (skky.isNullOrUndefined(gsrclk)) {
		ret.addError('SRCLK is invalid.');
		return ret;
	}
	
	byteShiftCount = (byteShiftCount || 1);
	
	var len = str.length;
	var i = 0, j = 0;
	//var s = '';
	var ch = [];
	ch.push(0); ch.push(0); ch.push(0); ch.push(0);
	this.shift8_595raw(gsdi, grclk, gsrclk, ch);
	// Hex is in two-byte increments.
	if (ishex) {
		for(i = 0; i < len; i += (2 * byteShiftCount)) {
			ch = [];
			
			for(j = 0; (j < (byteShiftCount * 2)) && (i + j < len); j += 2) {
				s = str.substring(i + j, i + j + 2);
				console.log(parseInt(s, 16));
				ch.push(parseInt(s, 16));
			}

			if (i > 0)
				sleep.usleep(delay);

			while (ch.length < byteShiftCount) {
				ch.push(0);
			}
			s = this.shift8_595raw(gsdi, grclk, gsrclk, ch);
			if (skky.hasData(s))
				ret.addError(s);
		}
	}
	else {
		for(i = 0; i < len; i += byteShiftCount) {
			if (byteShiftCount == 1) {
				s = this.shift8_595raw(gsdi, grclk, gsrclk, s.substring(i, i + 1));
				if (skky.hasData(s))
					ret.addError(s);
			}
			else {
				ch = [];
				for(j = 0; (j < byteShiftCount) && (i + j < len); ++j) {
					ch.push(str.substring(i + j, i + j + 1));
				}

				if (i > 0)
					sleep.usleep(delay);
						
				while (ch.length < byteShiftCount) {
					ch.push(0);
				}
				s = this.shift8_595raw(gsdi, grclk, gsrclk, ch);
				if (skky.hasData(s))
					ret.addError(s);
			}
		}
	}
	
	return ret;
};
this.shift8_595raw = function(gsdi, grclk, gsrclk, ch) {
	if (skky.isNullOrUndefined(ch)) {
		return 'shift8_595raw: received NaN. Not writing. No action taken.';
	}
	else if (null == gsdi || null == grclk || null == gsrclk) {
		return 'shift8_595raw: No GPIO.';
	}
	console.log('shift8_595raw: writing value of ' + ch + '.');

	const mask = [1, 2, 4, 8, 0x10, 0x20, 0x40, 0x80];
//	const mask = [0x80, 0x40, 0x20, 0x10, 8, 4, 2, 1];
	var ctr = 0;
	while(true) {
		var c = skky.getObject(ch, ctr);
		if (null == c)
			break;
console.log('writing: ' + c);
		for(var i = 0; i < 8; ++i) {
			var bit = c & mask[i];
	console.log('bit: ' + bit)
			gsdi.setHwState(bit ? 1 : 0);
			gsrclk.on();
			sleep.usleep(2);
			gsrclk.off();
		}
		
		++ctr;
	}

	grclk.on();
	sleep.usleep(1);
	grclk.off();
	
	gsdi.setHwState(0);
	return null;
};

this.appLightMeter = function(gpioid) {
	var ret = iot.getBase();

	var ggpio = this.findGpio(gpioid);
	if (skky.isNullOrUndefined(ggpio)) {
		ret.addError('Light Meter GPIO pin is invalid.');
		return ret;
	}
	
	var measurement = 0;
	ggpio.setAsOutput();
	ggpio.turnOff();
	sleep.usleep(1000000);
	ggpio.setAsInput();
	var dstart = new Date();
	while (1) {
		var read = ggpio.readRaw();
		if (read > 0 || ((Date.now() - dstart) < 600)) {
			break;
		}
		
		++measurement;
	}
	//console.log('measurement: ' + measurement);
	ret.code = measurement;	
	return ret;
};

function readTemp(fileid) {
	var fname = 'readTemp: ';

	var buffer = fs.readFileSync('/sys/bus/w1/devices/' + fileid + '/w1_slave');
	if (skky.hasData(buffer)) {
		// Example w1_slave file
		//6f 01 4b 46 7f ff 0c 10 ee : crc=ee YES
		//6f 01 4b 46 7f ff 0c 10 ee t=22937

		// Read data from file (using fast node ASCII encoding).
		var data = buffer.toString('ascii').split(" "); // Split by space
		if (skky.hasData(data, 1)) {
			// Extract temperature from string and divide by 1000 to give celsius
			return parseFloat(data[data.length-1].split("=")[1]);
			// temp /= 1000.0;
		}
	}

	return -1;
}
