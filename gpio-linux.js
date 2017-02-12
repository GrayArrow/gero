var iot = require('./iot');

var gpio = function(pin) {
	this.pin = pin;
	
	this.setAsInput = function(pin) {
	}
	
	this.setAsOutput = function(pin) {
	}
	
	this.read = function() {
		return -1;
	}
	
	this.write = function(state) {
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