const skky = require('./skky');
const iot = require('./iot');
const wpi = require('wiring-pi');

wpi.wiringPiSetup();    // Setup WiringPi once.

var gpio = function(pin) {
	this.pin = pin;
	this.lastValue = 0;
	
	this.setAsInput = function() {
		//console.log('set as input');
		wpi.pinMode(this.pin, wpi.INPUT);
	}
	
	this.setAsOutput = function(pin) {
		//console.log('set as output');
		wpi.pinMode(this.pin, wpi.OUTPUT);
	}
	
	this.setAsOutputPwm = function(pwmRange) {
		wpi.pinMode(this.pin, wpi.PWM_OUTPUT);
		var rc = wpi.softPwmCreate(this.pin, 0, pwmRange);
		console.log('Setting pin ' + this.pin + ' to PWM with range: ' + pwmRange + '. Return value: ' + rc + '.');
	}
	
	this.setAsButtonHandler = function(callback) {
		var fname = 'setAsButtonHandler: ';
		
		var self = this;
		wpi.pinMode(this.pin, wpi.INPUT);
		
		console.log(fname + 'Setting button interrupt handler on pin ' + this.pin + '.');
		wpi.wiringPiISR(this.pin, wpi.INT_EDGE_BOTH, function(delta) {
			if (skky.isFunction(callback)) {
				callback(self.pin);
			}
			else {
				console.log(fname + 'No callback for wiring Pi PWM on pin ' + self.pin + '.');
			}
		});
	}
	
	this.read = function() {
		//console.log('read ' + this.pin + ', val: ' + wpi.digitalRead(this.pin));
		return wpi.digitalRead(this.pin);
	}
	
	this.write = function(state) {
		//console.log('write: ' + state);
		wpi.digitalWrite(this.pin, state);
		this.lastValue = state;
	}
	
	this.readPwm = function() {
		return this.lastValue;
	}
	this.writePwm = function(state) {
		wpi.softPwmWrite(this.pin, state);
		this.lastValue = state;
	}
}

this.createInput = function(pin) {
	var g = new gpio(pin);
	g.setAsInput();
	
	return g;
}

this.createOutput = function(pin) {
	var g = new gpio(pin);
	g.setAsOutput();
	
	return g;
}

this.createOutputPwm = function(pin, pwmRange) {
	var g = new gpio(pin);
	g.setAsOutputPwm(pwmRange);
	
	return g;
}

this.createButtonHandler = function(pin, callback) {
	var g = new gpio(pin);
	g.setAsButtonHandler(callback);
	
	return g;
}
