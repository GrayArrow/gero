const util = require('util');
const constants = require('./constants');
const skky = require('./skky');

var transactionId = 0;

function getTicks() {
    return (new Date()).getTime();
}

function nextTxId() {
	return ++transactionId;
}

/*
 *	The base IoT object every IoT object is derived from.
 *
 *		These are the general objects to be found in any IoT message
 *
 *					-- Required --
 *	id		The identifier of the transaction.
 *	ts		The timestamp of the transaction. In UNIX milliseconds.
 *
 *					-- Not required --
 *	code	Error code. 0 is success, > 0 success with message, < 0 error.
 *	cmd 	Command objects: { cmd: [[Command Number]], obj: [] }. Usually an array of IoT command objects
 *	ret		Object/Array of return objects. Usually an array returning IoT object states.
 *	msg		Object/Array of messages. Can be anything, usually a string array.
 *	err		Object/Array of error messages. Can be anything, usually a string array.
 *	obj		Any additional data. Usually an array of object containers.
 *
 *	You can any additional data to this object to customize for your application.
 *	Geroix does recommend that you encapsulate data in the obj object/array.
 * */
function iot(code, ret, cmd, msg, err) {
	this.id = nextTxId();
	this.ts = getTicks();

	if('undefined' !== typeof code)
		this.code = code;
	
	this.addReturn(ret);
	this.addCommand(cmd);
	this.addMessage(msg);
	this.addError(err);
}

iot.prototype.allGood = function(hasObject) {
	var good = (skky.isNullOrUndefined(this.code) || (this.code >= 0));
	if (good && (this.err || []).length > 0)
		good = false;
	if(good && (hasObject || false))
		good = skky.isObject(this.o) || skky.isArray(this.o);

	return good;
}

iot.prototype.addError = function(err) {
	if (skky.isNullOrUndefined(err))
		return;

	this.err = skky.addObjectToList(this.err, err);
}

iot.prototype.addMessage = function(msg) {
	if (skky.isNullOrUndefined(msg))
		return;

	this.msg = skky.addObjectToList(this.msg, msg);
}

iot.prototype.addCommand = function(cmd, obj) {
	if ('undefined' !== typeof(cmd)) {
		if (skky.isNumber(cmd)) {
			//console.log('adding command # ' + cmd + '.');
			
			var newcmd = new iot();
			newcmd.code = cmd;
			this.c = this.addCommand(newcmd, obj);
			//console.log('iot.addCommand: ' + util.inspect(this.c, null, null));
		}
		else {
			this.c = skky.addObjectToList(this.c, cmd);
			//console.log('this.c (' + this.c.length + '): ' + util.inspect(this.c, null, null));
			if ('undefined' !== typeof(this.c) && 'undefined' !== typeof(obj)) {
				//console.log('obj: ' + util.inspect(obj, null, null) + '\nobj: END\n');
				this.c[this.c.length - 1].o = skky.addObjectToList(this.c[this.c.length - 1].o, obj);
				//console.log('this.o (' + this.c[this.c.length - 1].o.length	 + '): ' + util.inspect(this.c[this.c.length - 1].o, null, null));
			}
		}
	}
	
	return this.c;
}

iot.prototype.addObject = function(obj) {
	if ('undefined' !== typeof(obj)) {
		this.o = skky.addObjectToList(this.o, obj);
	}
}

iot.prototype.addReturn = function(ret, obj) {
	if ('undefined' !== typeof(ret)) {
		this.r = skky.addObjectToList(this.r, ret);

		if ('undefined' !== typeof(this.r)) {
			skky.addObjectToList(this.r.o, obj);
		}
	}
}

this.getBase = function(errcode) {
	return new iot(errcode);
}

this.getTopWrapper = function(code, ret, cmd, msg, err) {
	return new iot(code, ret, cmd, msg, err);
}

this.getWithError = function(err) {
	var i = this.getBase();
	i.addError(err);
	
	return i;
}

this.getWithEvent = function(gpioid, activeLow, state, vstate) {
	var i = this.getBase();
	i.addObject({
		gpioid: gpioid,
		activeLow: activeLow,
		vstate: vstate,
		state: state
	});
	
	return i;
}

this.getWithCommand = function(cmd, obj) {
	var i = new iot();
	i.addCommand(cmd, obj);
	
	return i;
}

this.getWithObject = function(obj) {
	var i = new iot();
	i.addObject(obj);
	
	return i;
}

this.getWithReturn = function(ret, obj) {
	var i = new iot();
	i.addReturn(ret, obj);
	
	return i;
}

this.getLogicalState = function(vstate, isActiveLow, minValue, maxValue) {
	vstate = vstate || 0;
	isActiveLow = isActiveLow || 0;
	minValue = minValue || 0;
	maxValue = maxValue || 0;
	
	if (minValue == maxValue
		|| (minValue <= 1 && maxValue <= 1)) {
		if (vstate)
			return isActiveLow ? 0 : 1;
		
		return isActiveLow ? 1 : 0;
	}
	
	if (isActiveLow) {
		if (vstate <= minValue)
			return maxValue;
		else if (vstate >= maxValue)
			return minValue;
		else
			return maxValue - vstate;
	}
	
	return vstate;
}

iot.prototype.isEmpty = function() {
	return (('undefined' === typeof(this.code) || this.code == 0)
		&& (this.c || []).length == 0
		&& (this.err || []).length == 0
		&& (this.msg || []).length == 0
		&& (this.r || []).length == 0);
}

iot.prototype.getCommand = function(number) {
	return skky.getObject(this.c, number);
}
iot.prototype.getError = function(number) {
	return skky.getObject(this.err, number);
}
iot.prototype.getMessage = function(number) {
	return skky.getObject(this.msg, number);
}
iot.prototype.getObject = function(number) {
	return skky.getObject(this.o, number);
}
iot.prototype.getReturn = function(number) {
	return skky.getObject(this.r, number);
}

this.hasCommandCode = function(jo, code) {
	if (code === jo.code)
		return true;
	
	for(var cmd = null, i = 0; cmd = skky.getObject(jo.c, i); ++i) {
		if (code === cmd.code)
			return true;
	}

	return false;
}
this.isKeepAlive = function(jo) {
	return this.hasCommandCode(jo, constants.CMDCODE_KeepAlive);
}