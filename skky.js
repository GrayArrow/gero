this.allGood = function(iot, hasObject) {
	if (this.isNullOrUndefined(iot))
		return false;

	var good = (this.isNullOrUndefined(iot.code) || (iot.code >= 0));
	if (good && (iot.err || []).length > 0)
		good = false;
	if(good && (hasObject || false))
		good = this.isObject(iot.o) || this.isArray(iot.o);

	return good;
};
this.getObject = function(o, number) {
	if (!this.isNullOrUndefined(o)) {
		number = (number || 0);
		
		if(this.isArray(o)) {
			if (o.length > number)
				return o[number];
		}
		else if (number == 0) {
			return o;
		}
	}

	return null;
};
this.addObjectToList = function(objarr, obj) {
	if (this.isNullOrUndefined(obj))
		return;

	objarr = (objarr || []);

	var i = 0;
	while(true) {
		var geto = this.getObject(obj, i);
		if (this.isNullOrUndefined(geto))
			break;

		objarr.push(geto);
		++i;
	}

	return objarr;
};
this.isEmptyObject = function(o) {
	// typeof null === 'object'; JS standard.
	return (('undefined' === typeof (o)) || (null == o));
};
this.isObject = function(obj) {
	return null != obj && 'object' === typeof (obj);
};
this.isEmptyString = function(s) {
	return !this.hasData(s);
};

this.isNullOrUndefined = function(o) {
	// typeof null returns 'object'
	return (('undefined' === typeof (o)) || (null == o));
};

this.hasData = function(o, minlength) {
	//console.log('minlength: ' + minlength + ', o: ' + o);
	if (this.isNullOrUndefined(o))
		return false;

	if(this.isNullOrUndefined(minlength))
		minlength = 1;

	if (this.isString(o))
		return (o.length >=	 minlength);

	if (this.isArray(o))
		return this.isArray(o, minlength);

	// Objects and primitives will not have any length.
	if (!this.isObject(o))
		return minlength <= 1;

	if (this.isObject(o)) {
		for (var prop in o) {
			if (o.hasOwnProperty(prop))
				return true;
		}

		return !(true && JSON.stringify(o) === JSON.stringify({}));
	}

	return true;	// Must be a number or boolean or something.
};

this.isObject = function(o) {
	return (!this.isNullOrUndefined(o) && ('object' === typeof o));
};
this.isFunction = function(o) {
	return ('function' === typeof o);
};
this.isString = function(o) {
	return (('string' === typeof o) || (o instanceof String));
};
this.isNumber = function(n) {
	return 'number' === typeof n;
};
this.isBoolean = function(b) {
	return 'boolean' === typeof b;
};
this.isArray = function(o, minLength) {
	var isok = (this.isObject(o) && (Object.prototype.toString.call(o) == '[object Array]'));
	//('number' === typeof (o.length)) && (o.propertyIsEnumerable && !o.propertyIsEnumerable('length')));
	if (isok)
		isok = (o.length >= (minLength || 0));

	return isok;
};

this.nonNull = function(s, strIfNull) {
	if(this.hasData(s))
		return s;

	if(this.isNullOrUndefined(s) && this.hasData(strIfNull))
		return strIfNull;
	
	return '';
};

this.trim = function(str) {
	return this.nonNull(str).replace(/^\s+|\s+$/g, "");
};
this.ltrim = function(str) {
	return this.nonNull(str).replace(/^\s+/, "");
};
this.rtrim = function(str) {
	return this.nonNull(str).replace(/\s+$/, "");
};
