const sleep = require('sleep');
var config = require('./config.all.json');
var vendorGpio = null;
if (config.osInfo.isArduino)
	vendorGpio = require('./gpio-arduino');
else if (config.osInfo.isRaspberryPi)
	vendorGpio = require('./gpio-raspbian');
else if (config.osInfo.isLinux)
	vendorGpio = require('./gpio-linux');
var iot = require('./iot');
var gero = require('./gero');
const skky = require('./skky');

const CONST_GpioTypeLed = 1;
const CONST_GpioTypeButton = 2;
const CONST_GpioTypeClock = 3;
const CONST_GpioTypePwm = 4;
const CONST_GpioTypeOnOff = 5;
const CONST_GpioTypeDigitalInput = 6;
const CONST_GpioTypeInOut = 10;
const CONST_GpioTypeAnalogInput = 11;
const CONST_GpioTypeUnavailable = 12;

//const CONST_DefaultPwmMaxValue = 1000;

function gpio(jo) {
    this.id = jo.id;
    this.name = jo.name;
    this.GpioType = (jo.GpioType || 0);
    this.isActiveLow = (jo.isActiveLow || false);
    this.pin = (jo.pin || 0);
	this.vendorHw = null;
    
    // Hardware interfacing vars.
    this.state = null;
    this.vstate = null;
	
	this.minValue = (jo.minValue || 0);
	this.maxValue = (jo.maxValue || 0);
}

gpio.prototype.init = function() {
	var fname = 'gpio.init: ';
	var self = this;
	switch(this.getTypeId()) {
		case CONST_GpioTypeButton:
			console.log(fname + 'Setting button interrupt handler for ' + this.name + ' on pin ' + this.pin + '.');
			this.vendorHw = vendorGpio.createButtonHandler(this.pin, function() {
				var gpiosToSend = [];
				gpiosToSend.push(self);
				
				var value = self.getHwState();
				console.log('GpioTypeButton: GPIO(' + self.id + ') ' + self.name + ': callback value: ' + value);

				gero.sendEventsForGpios(gpiosToSend);
			});

			break;
		
		case CONST_GpioTypeLed:
		case CONST_GpioTypeOnOff:
		case CONST_GpioTypeInOut:
			this.vendorHw = vendorGpio.createOutput(this.pin);
			break;

		case CONST_GpioTypePwm:
			this.vendorHw = vendorGpio.createOutputPwm(this.pin, this.maxValue);
			break;

		case CONST_GpioTypeDigitalInput:
			this.vendorHw = vendorGpio.createInput(this.pin);
			break;

		case CONST_GpioTypeAnalogInput:
			this.vendorHw = vendorGpio.createInput(this.pin, true);
			break;

		case CONST_GpioTypeUnavailable:
			break;

		default:
			break;
	}
};
gpio.prototype.getTypeId = function() {
    if (skky.isNullOrUndefined(this.GpioType))
        return 0;

    return (this.GpioType.id || 0);
};

gpio.prototype.getTypeName = function() {
    if (skky.isNullOrUndefined(this.GpioType))
        return '';

    return (this.GpioType.name || '').toLowerCase();
};
gpio.prototype.getTypeNameLower = function() {
    return this.getTypeName().toLowerCase();
};

gpio.prototype.isPwm = function() {
	return (this.getTypeId() == CONST_GpioTypePwm);
};

gpio.prototype.hasLogicalState = function() {
	switch(this.getTypeId()) {
		case CONST_GpioTypePwm:
		case CONST_GpioTypeAnalogInput:
			return false;
	}
	
	return true;
};

gpio.prototype.getHwStateJson = function() {
    this.getHwState();

	var state = (this.hasLogicalState() ? iot.getLogicalState(this.vstate, this.isActiveLow, this.minValue, this.maxValue) : this.state);
	//console.log('getHwStateJson: state: ' + state + ', this.state: ' + this.state + ', vstate: ' + this.vstate + ', minValue: ' + this.minValue + ', maxValue: ' + this.maxValue + ', isActiveLow: ' + this.isActiveLow);
	return {
		gpioid: this.id,
		activeLow: this.isActiveLow,
		vstate: this.vstate,
		state: state
	};

//    return iot.getWithEvent(this.id, this.isActiveLow, state, this.vstate);
};

gpio.prototype.getHwState = function() {
	var fname = 'getHwState: ';

	switch(this.getTypeId()) {
		case CONST_GpioTypeButton:
		case CONST_GpioTypeLed:
		case CONST_GpioTypeOnOff:
			this.vstate = this.vendorHw.read();
			this.state = iot.getLogicalState(this.vstate, this.isActiveLow);
			//console.log(fname + 'GPIO(' + this.id + '): ' + this.name + ' - ' + this.getTypeName() + ' at pin ' + this.pin + ' - vstate: ' + this.vstate + ', state: ' + this.state + ', isActiveLow: ' + this.isActiveLow);
			break;

		case CONST_GpioTypePwm:
			this.vstate = this.vendorHw.readPwm();
			this.state = iot.getLogicalState(this.vstate, this.isActiveLow, this.minValue, this.maxValue);
			//console.log(fname + 'PWM GPIO(' + this.id + '): ' + this.name + ' - ' + this.getTypeName() + ' at pin ' + this.pin + ' - vstate: ' + this.vstate + ', state: ' + this.state + ', isActiveLow: ' + this.isActiveLow);
			break;

		case CONST_GpioTypeDigitalInput:
		case CONST_GpioTypeAnalogInput:
			this.state = this.vstate = this.vendorHw.read();
			//console.log(fname + 'Digital/Analog Input GPIO ' + this.id + ' - ' + this.getTypeName() + ' at pin ' + this.pin + ' - vstate: ' + this.vstate + ', state: ' + this.state + ', isActiveLow: ' + this.isActiveLow);
			break;

		default:
			throw new Error(fname + 'GPIO ' + this.name + ' (' + this.id + ') on pin ' + this.pin + ' of type ' + this.getTypeName() + ' does not support reading the hardware state.');
	}

	return this.state;
};

gpio.prototype.setHwState = function(state, isVoltageState) {
	var fname = 'gpio.setHwState: ';

	var vstate = 0;
	
	switch(this.getTypeId()) {
		case CONST_GpioTypeLed:
		case CONST_GpioTypeOnOff:
		case CONST_GpioTypeInOut:
			// Always use voltage states.
			vstate = ((isVoltageState || 0) ? state : iot.getLogicalState(state, this.isActiveLow));
			//console.log(fname + this.id + ' pin ' + this.pin + ', vstate: ' + vstate + ', state: ' + state + ', isVoltageState: ' + (isVoltageState || 0) + ', isActiveLow: ' + this.isActiveLow);
			this.vendorHw.write(vstate);

			break;
		case CONST_GpioTypePwm:
			vstate = ((isVoltageState || 0) ? state : iot.getLogicalState(state, this.isActiveLow, this.minValue, this.maxValue));
			//console.log(fname + this.id + ' pin ' + this.pin + ', vstate: ' + vstate + ', state: ' + state + ', isVoltageState: ' + (isVoltageState || 0) + ', isActiveLow: ' + this.isActiveLow);
			this.vendorHw.writePwm(vstate);
			break;

		default:
			throw fname + 'This GPIO ' + this.name + ' (' + this.id + ') on pin ' + this.pin + ' of type ' + this.getTypeName() + ' does not support setting the hardware state.';
	}
};

gpio.prototype.off = function() {
	this.setHwState(0);
};
gpio.prototype.on = function() {
	this.setHwState(1);
};

gpio.prototype.setAsInput = function() {
	this.vendorHw.setAsInput();
};
gpio.prototype.setAsOutput = function() {
	this.vendorHw.setAsOutput();
};
gpio.prototype.readRaw = function() {
	this.vendorHw.read();
};
gpio.prototype.turnOff = function() {
	this.vendorHw.write(0);
};
gpio.prototype.turnOn = function() {
	this.vendorHw.write(1);
};

gpio.prototype.morseCode = function(mcstr) {
    var _baseTime = 128000, //micro seconds
    sleepTime = _baseTime, 
    btwCodes = _baseTime * 2,
    btwLetters = _baseTime * 4,
    btwWords = _baseTime * 8;
	//console.log('morse code: ' + mcstr);
    var text = (mcstr ? mcstr : '').toLowerCase();
     
    var MorseCode = {
       pattern: {
          'a': '._',
          'b': '_...',
          'c': '_._.',
          'd': '_..',
          'e': '.',
          'f': '.._.',
          'g': '__.',
          'h': '....',
          'i': '..',
          'j': '.___',
          'k': '_._',
          'l': '._..',
          'm': '__',
          'n': '_.',
          'o': '___',
          'p': '.__.',
          'q': '__._',
          'r': '._.',
          's': '...',
          't': '_',
          'u': '.._',
          'v': '..._',
          'w': '.__',
          'x': '_.._',
          'y': '_.__',
          'z': '__..',
          '1': '.____',
          '2': '..___',
          '3': '...__',
          '4': '...._',
          '5': '.....',
          '6': '_....',
          '7': '__...',
          '8': '___..',
          '9': '____.',
          '0': '_____'
       },
       active: function() {
          this.setHwState(1);
       },
       inactive: function() {
          this.setHwState(0);
       }
    };
     
    var _t = text.split('');
     
    for(var i = 0; i < _t.length; i++) {
       var _l = _t[i];
     
       if(_l == ' ') { // if the char is a space 
          sleep.usleep(btwWords);
       }
       else {
          var _c = MorseCode.pattern[_l].split('');
          sleep.usleep(btwLetters);
          console.log('Letter Starts >> ', _l, ' is ');
          for(var j = 0; j < _c.length; j++) {
             console.log(_c[j]);
             this.on();
             if(_c[j] == '.') {
                sleep.usleep(sleepTime);
                this.off();
                sleep.usleep(btwCodes);
             }
             else {
                sleep.usleep(sleepTime * 3);
                this.off();
                sleep.usleep(btwCodes);
             }
          }
          console.log();
       }
    }
};

this.getNew = function(jo) {
	return new gpio(jo);
};
