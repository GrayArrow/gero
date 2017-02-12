const util = require('util');
const iot = require('./iot');
const sleep = require('sleep');
//try {
const mraa = require('mraa'); //require mraa
//}
//catch(ex) {
//	console.log(ex);
//}
const skky = require('./skky');
//console.log('MRAA Version: ' + mraa.getVersion()); //write the mraa version to the Intel XDK console

var gpio = function(pin, isAnalog) {
	this.pin = pin;
	this.mraaGpio = null;
	this.pwmMax = 0;
	this.pwmCurrentValue = 0;
	this.isAnalog = (isAnalog || false);
	
	this.setAsInput = function() {
		if (this.isAnalog || false) {
			this.mraaGpio = new mraa.Aio(this.pin);
			console.log('Setting pin ' + this.pin + ' to analog input.');
		}
		else {
			this.mraaGpio = new mraa.Gpio(this.pin);
			this.mraaGpio.dir(mraa.DIR_IN);
			console.log('Setting pin ' + this.pin + ' to digital input.');
		}
	}
	
	this.setAsOutput = function() {
		this.mraaGpio = new mraa.Gpio(this.pin);
		this.mraaGpio.dir(mraa.DIR_OUT);
			console.log('Setting pin ' + this.pin + ' to output.');
	}

	this.setAsOutputPwm = function(maxValue) {
		var fname = 'setAsOutputPwm: ';
		console.log(fname + 'PWM on pin ' + this.pin + '.');
		this.mraaGpio = new mraa.Pwm(this.pin);
	
		this.pwmMax = maxValue;
		//console.log('setAsOutputPwm pwm on pin ' + pin + ' with maxValue of ' + (maxValue || 0) + '.');
		this.mraaGpio.enable(true);
		//this.mraaGpio.period_us(2000);
		console.log(fname + 'Successfully created pwm on pin (' + this.pin + ') with maxValue of ' + (maxValue || 0) + '.');
	}
	
	this.setAsButtonHandler = function(callback) {
		var fname = 'setAsButtonHandler: ';
		var pinid = this.pin;
		this.setAsInput();
		
		console.log(fname + 'Setting button interrupt handler on pin ' + pinid + '.');
		this.mraaGpio.isr(mraa.EDGE_BOTH, function() {
			if (skky.isFunction(callback)) {
				callback(pinid);
			}
			else {
				console.log(fname + 'No callback for wiring Pi PWM on pin ' + pinid + '.');
			}
		});
	}
	
	this.read = function() {
		return this.mraaGpio.read();
	}
	this.write = function(state) {
		return this.mraaGpio.write(state);
	}
	
	this.readPwm = function() {
		//console.log('readPwm is ' + this.pwmCurrentValue);
		// Arduino does not care about Active Low with PWM.
		return this.pwmMax - this.pwmCurrentValue;
	}
	this.writePwm = function(state) {
		var fname = 'writePwm: ';
		// Arduino does not care about Active Low with PWM.
		state = this.pwmMax - state;
		//console.log(fname + ' is ' + this.pwmCurrentValue + ', pwmMax: ' + this.pwmMax);
		if ((this.pwmMax || 0) && state !== 0) {
			console.log(fname + 'state: ' + state + ', write: ' + (state / this.pwmMax) + ', pwmMax: ' + this.pwmMax);
			this.mraaGpio.write(state / this.pwmMax);
		}
		else {
			console.log(fname + 'state: ' + state + '.');
			this.mraaGpio.write(state);
		}

		this.pwmCurrentValue = state;
	}
}

this.createInput = function(pin, isAnalog) {
	var g = new gpio(pin, isAnalog);
	g.setAsInput();
	
	return g;
}

this.createOutput = function(pin) {
	var g = new gpio(pin);
	g.setAsOutput();
	
	return g;
}

this.createOutputPwm = function(pin, maxValue) {
	//console.log('creating pwm on pin ' + pin + '.');
	var g = new gpio(pin);
	g.setAsOutputPwm(maxValue);
	
	//console.log('created pwm on pin ' + pin + '.');
	return g;
}

this.createButtonHandler = function(pin, callback) {
	var g = new gpio(pin);
	g.setAsButtonHandler(callback);
	
	return g;
}
