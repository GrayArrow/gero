const fs = require('fs');
const os = require('os');
const util = require('util');
const constants = require('./constants');
const skky = require('./skky');
var wscomm = require('./wscomm');
const httpcomm = require('./httpcomm');

var blegero = null;
var osinfo = {};

try {
	//const blegero = require('./blegero');
	blegero = require('./bleno-gero');
}
catch(errblegro) {
	console.log('app Bluetooth init error: ' + errblegro.message);
}

// Configuration file support.
var config = null;
var configSafe = null;
try {
	configSafe = require(constants.ConfigFilenameSafeMode);
	config = JSON.parse(JSON.stringify(configSafe));
}
catch(err) {
	console.error(err);
}

// These 3 must be declared before verifyConfigSettings();
const iot = require('./iot');

function fileExistsSync(filename, deleteIfExists) {
	try {
		fs.statSync(filename);
		
		if (deleteIfExists)
			fs.unlinkSync(filename);
	}
	catch(err) {
		if(err.code == 'ENOENT') {
			console.log(filename + ' does not exist. Skipping delete.');
			return false;
		}
	}
	
	return true;
}
function saveJsonToFileSync(jo, filename) {
	var backupFilename = filename + '.bak';
	
	try {
		if(fileExistsSync(filename))
			fs.writeFileSync(backupFilename, fs.readFileSync(filename));

		fs.writeFileSync(filename, JSON.stringify(jo));
		
		var stats = fs.statSync(filename);
		var fileSizeInBytes = stats.size;

		console.log(filename + ' is ' + fileSizeInBytes + ' bytes.');
		return fileSizeInBytes;
	}
	catch(e) {
		console.error(e);
	}
	
	return -1;
}

function readTextFileSync(filename, replaceLineEnds) {
	var fname = 'readTextFileSync: ';
	
	var s = '';
	try {
		if (fs.existsSync(filename)) {
			s = fs.readFileSync(filename, 'utf8');
			if(replaceLineEnds)
				s = skky.nonNull(s).replace(/\n$/, '');
		}
		else {
			console.log(fname + filename + ' does not exist.');
		}
	}
	catch(err) {
		console.log(fname + 'Error reading ' + skky.nonNull(filename) + ' file.');
		console.error(err);
	}
	
	return skky.nonNull(s);
}
verifyConfigSettings();

const gero = require('./gero');

function verifyConfigSettings() {
	var isok = true;
	var filesize = 0;
	
	if (skky.isNullOrUndefined(config)) {
		isok = false;
		config = {};
	}

	if (!skky.hasData(config.mainServerUrl))
		config.mainServerUrl = constants.DefaultGeroServer;

	config.ipAddress = getIpAddressInfo();
	config.lastInitialization = iot.getBase(isok ? 0 : -1);
	
	if((config.localWebServerListeningPort || 0) < 1)
		config.localWebServerListeningPort = 8000;
	if ((config.configRequestRetryInMillis || 0) < 1)
		config.configRequestRetryInMillis = 5000;	// Default to 5 seconds.
	
	filesize = saveJsonToFileSync(config, constants.ConfigFilenameSafeMode);
	if (filesize > 100)
		isok = true;

	osinfo.cpuInfo = os.cpus();
	osinfo.osName = os.type();
	osinfo.cpuArchitecture = os.arch();
	osinfo.osNics = os.networkInterfaces();
	osinfo.osTempDir = os.tmpdir();
	osinfo.osTotalMemory = os.totalmem();
	osinfo.osFreeMemory = os.freemem();
	osinfo.osUptime = os.uptime();
	osinfo.osHostname = os.hostname();
	osinfo.osPlatform = os.platform();
	osinfo.osRelease = os.release();
	osinfo.isArduino = false;
	osinfo.isFedora = false;
	osinfo.isLinux = (os.platform() == 'linux');
	osinfo.isMac = (os.platform() == 'darwin');
	osinfo.isRaspberryPi = false;
	osinfo.isWindows = (os.platform() == 'win32');

	var distro = readTextFileSync('/etc/os-release');
	if (distro.length > 0) {
		osinfo.distro = distro;
		if(distro.toLowerCase().indexOf('raspbian') > -1)
			osinfo.isRaspberryPi = true;
		if(distro.toLowerCase().indexOf('fedora') > -1)
			osinfo.isFedora = true;
	}
	
	distro = readTextFileSync('/etc/release');
	if (distro.length > 0 && distro.toLowerCase().indexOf('edison') > -1) {
		osinfo.distro = distro;
		osinfo.isArduino = true;
	}

	try {
		if (!skky.hasData(config.machineId))
			osinfo.machineId = readTextFileSync('/etc/machine-id', true);
	}
	catch(err) {
		console.log('Error reading /etc/machine-id file on Linux.');
		console.error(err);
	}
	
	config.osInfo = osinfo;

	isok = false;
	filesize = saveJsonToFileSync(config, constants.ConfigFilename);
	if (filesize > 100)
		isok = true;
	
	return isok;
}

//function addServerSettingsToConfig(jo) {
//	var fname = 'addServerSettingsToConfig: ';
//	
//	var filesize = 0;
//	try {
//		//config.gero = jo.gero;
//		filesize = saveJsonToFileSync(jo, constants.ConfigFilename);
//		filesize = saveJsonToFileSync(config, constants.ConfigFilename);
//	}
//	catch(err) {
//		console.log(fname + 'Error saving to file: ' + constants.ConfigFilename + '.');
//		console.error(err);
//	}
//	
//	return filesize;
//}

function getIpAddressInfo() {
	var fname = 'getIpAddressInfo: ';
	
	var ifaces = os.networkInterfaces();
	var ipAddress = [];

	Object.keys(ifaces).forEach(function (ifname) {
		var alias = 0;
		
		ifaces[ifname].forEach(function (iface) {
			if ('IPv4' !== iface.family || iface.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}
			
			if (alias >= 1) {
				// this single interface has multiple ipv4 addresses
				console.log(fname + ifname + ':' + alias, iface.address);
			} else {
				// this interface has only one ipv4 adress
				console.log(fname + ifname, iface.address);
			}

			++alias;
			ipAddress.push(iface.address);
		});
	});
	
	return ipAddress;
}

function processCommand(cmd) {
	const fname = 'processCommand: ';
	var s = '';
	var i = 0;
	var obj = skky.getObject(cmd.o);
	var iotretarr = [];
	var ret = iot.getBase();
	//ret.id = (cmd.id || 0);
	var appobj = null;
	var gp = null;
	var myiotret = null;
	
	console.log(fname + 'Received command (' + (cmd.code || 0) + '): ' + constants.getCommandAsText(cmd.code || 0) + '.');
	if (skky.isNullOrUndefined(cmd.code))
		return null;

	if (!skky.allGood(cmd) || skky.hasData(cmd.r)) {
		console.log(fname + 'returning allGood: ' + skky.allGood(cmd) + ', has return data: ' + skky.hasData(cmd.r) + '.');
		return null;
	}
	
	switch (cmd.code || 0) {
		case constants.CMDCODE_GeroConfiguration:
			try {
				ret.code = resetConfiguration(obj);
				ret.addMessage(fname + 'Initialized ' + ret.code + ' GPIO pins.');
			}
			catch(err) {
				console.log(fname + err.message);
				ret.addError(err.message);
			}
			break;
		case constants.CMDCODE_GpioGetState:
			if (skky.isNullOrUndefined(obj)) {
				ret.addError(fname + 'GpioGetState: No obj found in JSON.');
			}
			else if ((cmd.r || []).length > 0) {
				console.log('GpioGetState acknowledge.');
			}
			else {
				if(skky.isNumber(obj.gpioid)) {
					gp = gero.findGpio(obj.gpioid);
					if (skky.isNullOrUndefined(gp)) {
						console.log(fname + 'GpioGetState: Could not find GPIO for id: ' + obj.gpioid);
					
						ret.addError(fname + 'GpioGetState: No GPIO to set.');
					}
					else {
						myiotret = iot.getBase();
						myiotret.o = skky.addObjectToList(myiotret.o, gero.getStateJson(gp));
						console.log(myiotret);
						iotretarr.push(myiotret);
						
						console.log('GpioGetState-iotretarr: ' + util.inspect(iotretarr, null, null));
					}
				}
				else {
					ret.addError(fname + 'GpioGetState: No gpioid found.');
				}
			}
		
			break;
		
		case constants.CMDCODE_GpioSetState:
			if (skky.hasData(cmd.o)) {
				for(i = 0; !skky.isNullOrUndefined(skky.getObject(cmd.o, i)); ++i) {
					obj = skky.getObject(cmd.o, i);
					
					gp = gero.findGpio(obj.gpioid);
					if (skky.isNullOrUndefined(gp) || skky.isNullOrUndefined(obj)) {
						console.log(fname + 'Could not find GPIO for id: ' + obj.gpioid);
					
						ret.addError(fname + 'No GPIO to set.');
					}
					else {
						try {
							//console.log(fname + 'Found obj: ' + util.inspect(obj, null, null));
							obj.state = (obj.state || 0);
							//console.log('cmd.info.state: ' + cmd.info.state);
							if(skky.hasData(obj.morseCode)) {
								gp.morseCode(obj.morseCode);
							}
							else {
								gp.setHwState(obj.state || 0);
							}
							
							//iotretarr = gero.getStateJson(gp);
							myiotret = iot.getBase();
							myiotret.o = skky.addObjectToList(myiotret.o, gero.getStateJson(gp));
							//console.log(myiotret);
							iotretarr.push(myiotret);
		
							console.log('GpioSetState-iotretarr: ' + util.inspect(iotretarr, null, null));
						}
						catch(ex) {
							//console.log('getState2 error');
							console.log(ex);
							ret.addError(fname + ' GPIO Set State Exception caught: ' + ex.message);
						}
					}
				}
			}

			break;
		
		case constants.CMDCODE_ApplicationRun:
			console.log('Received Gero Application command: ' + util.inspect(obj, null, null));
			appobj = skky.getObject(obj);

			var appret = gero.runApp(appobj);
			if(null !== appret)
				ret = appret;
			break;

		case constants.CMDCODE_ApplicationState:
			console.log('Received ' + constants.getCommandAsText(cmd.code) + '.');
			appobj = skky.getObject(obj);
			if (skky.isNullOrUndefined(appobj)) {
				console.log('Could not run ' + constants.getCommandAsText(cmd.code) + '. Invalid object.');
			}
			else {
				switch (appobj.apptype || 0) {
					case constants.APPID_ColorPickerRgb:
					case constants.APPID_Thermometer:
						var jret = gero.getAppStateJson(appobj);
						if (skky.isString(jret)) {
							console.log(fname + jret);
							ret.addError(jret);
						}
						else if (skky.isObject(jret)) {
							ret.addObject(jret);
							console.log(fname + constants.getCommandAsText(cmd.code) + ': ' + util.inspect(jret, null, null));
						}

						break;

					default:
						console.log(fname + 'Attempt to run invalid Application state with ID: ' + appobj.apptype + '.');
						ret.addError(fname + 'Attempt to run invalid Application state with ID: ' + appobj.apptype + '.');
						break;
				}
			}
			break;

		case constants.CMDCODE_BluetoothInit:
			try {
				s = readTextFileSync(constants.ConfigFilename, true);
				ret.addObject(JSON.parse(s));
				ret.code = 1;
				ret.addMessage(fname + 'Bluetooth initialization.');
			}
			catch(err) {
				console.log(fname + err.message);
				ret.addError(err.message);
			}
			break;

		default:
			s = fname + 'Could not find command: ' + cmd.code + '.';
			ret.addError(s);
			console.log(s);
			break;
	}
	
	if (!iotretarr.length && !skky.isNullOrUndefined(ret))
		iotretarr.push(ret);

	if (!(iotretarr || []).length) {
		console.log(fname + 'iotretarr is empty. Nothing to return.');
		return null;
	}

	//console.log(fname + 'iotretarr: ' + iotretarr);
	cmd.r = iotretarr;
	return cmd;
}

function processCommands(jo) {
	const fname = 'processCommands: ';
	var iotmain = null;
	//console.log(fname + util.inspect(jo, true, null));

	for(var cmd = null, index = 0; cmd = skky.getObject(jo.c, index); ++index) {
		try {
			//console.log(fname + 'Received ' + constants.getCommandAsText(cmd.code || 0) + ' (' + (cmd.code || 0) + ')');

			var iotcmdWithRet = processCommand(cmd);

			if (skky.isNullOrUndefined(iotcmdWithRet)) {
				console.log(fname + 'NO iotcmdWithRet from ' + constants.getCommandAsText(cmd.code || 0) + '.');
			}
			else {
				if (skky.isNullOrUndefined(iotmain))
					iotmain = iot.getTopWrapper();

				iotmain.addCommand(iotcmdWithRet);
			}
		}
		catch(ex) {
			console.log(fname + 'Exception: ' + ex.message);
		}
	}

	return iotmain;
}

function processResponse(jo) {
	var fname = 'processResponse: ';
	
	var i = 0;
	var ret = null;
	var obj = null;

	for(var cmd = null, index = 0; cmd = skky.getObject(jo.c, index); ++index) {
		try {
			switch(cmd.code || 0) {
			case constants.CMDCODE_GeroConfiguration:
				try {
					//console.log(cmd.r);
					ret = skky.getObject(cmd.r);
					if (!skky.isNullOrUndefined(ret)) {
						obj = skky.getObject(ret.o);
						if (skky.isNullOrUndefined(obj)) {
							console.log(fname + 'Could not read Gero Configuraion');
						}
						else {
							i = resetConfiguration(obj);
							console.log(fname + 'Initialized ' + i + ' GPIO pins.');
						}
					}
				}
				catch(err) {
					console.log(err);
				}
				break;
			}
		}
		catch(err) {
			console.log(fname + err.message);
		}
	}
}

function compareFields(srcObj, destObj, fieldName) {
	try {
		if (skky.isNullOrUndefined(srcObj[fieldName]))
			return false;
		
		if (destObj[fieldName] !== srcObj[fieldName]) {
			destObj[fieldName] = srcObj[fieldName];
			return true;
		}
	}
	catch(err) { }
	
	return false;
}

function updateLocalConfig(jo, configObj, filename, checkGero) {
	const fname = 'updateLocalConfig: ';

	var dirty = false;
	try {
		if (!skky.isNullOrUndefined(jo) && skky.isObject(jo)) {
			dirty |= compareFields(jo, configObj, 'mainServerUrl');
			dirty |= compareFields(jo, configObj, 'gerokey');
			if (checkGero || 0) {
				dirty |= compareFields(jo, configObj, 'gero');
			}

			if (dirty && skky.hasData(jo.mainServerUrl)) {
				var filesize = saveJsonToFileSync(jo, filename);
				console.log(fname + 'Writing ' + filesize + ' bytes to ' + filename + '.');
				if (filesize > 100)
					return true;
			}

			console.log(fname + 'NOT Writing to ' + filename + '. No Changes.');
		}
	}
	catch(e) {
		console.log(fname);
		console.log(e);
	}
	
	return false;
}

function resetConfiguration(jo) {
	var fname = 'resetConfiguration: ';

	var i = 0;
	var gp = null;
	var iter = null;

	try {
		updateLocalConfig(jo, config, constants.ConfigFilename, true);
		updateLocalConfig(jo, configSafe, constants.ConfigFilenameSafeMode, false);
	}
	catch(err) {
		console.log(fname + 'Error setting updated Gero configuration files. ' + err.message);
	}

	try {
		console.log(fname + 'New Gero ' + util.inspect((jo.gero || {})) + '.');

		gero.id = jo.gero.id;
		gero.name = jo.gero.name;
		gero.url = jo.gero.url;

		gero.reset();
	}
	catch(err) {
		console.log(fname + 'Error resetting Gero before reinitialization. ' + err.message);
	}

	for(iter in (jo.gero.Gpios || [])) {
		try {
			gp = jo.gero.Gpios[iter];

			console.log(fname + 'creating gpio (' + gp.id + '): ' + gp.name);
			gero.addNewGpio(gp);

			++i;
		}
		catch(err) {
			console.log(fname + 'Error adding GPIO service. ' + err.message);
		}
	}

	for(iter in (jo.gero.gpioPages || [])) {
		try {
			gp = jo.gero.gpioPages[iter];

			console.log(fname + 'creating app ' + constants.getApplicationAsText(gp.appinfo.apptype) + ' (' + gp.appinfo.appid + ').');
			gero.addNewApp(gp);

			++i;
		}
		catch(err) {
			console.log(fname + 'Error adding GPIO Pages service. ' + err.message);
		}
	}

	try {
		if (skky.hasData(gero.id)) {
			if (!skky.isNullOrUndefined(blegero))
				blegero.serviceInfo.geroid = gero.id;
		}
	}
	catch(err) {
		console.log(fname + 'Error setting BLE service. ' + err.message);
	}

	try {
		httpcomm.closeAll();
	}
	catch(e) {
		console.log(fname + 'error closing httpcomm. ' + e.message);
	}

	for(iter in (jo.gero.gpioPages || [])) {
		try {
			gp = jo.gero.gpioPages[iter];

			if (skky.hasData(gp.appinfo) &&
				constants.APPID_EegDetector == gp.appinfo.apptype &&
				skky.hasData(gp.appinfo.endpoint)) {
				httpcomm.createServer(gp.appinfo.endpoint, gp.appinfo.appid || 0, gp.appinfo.apptype || 0);
			}
		}
		catch(e) {
			console.log(fname + 'Error creating HTTP server. ' + e.message);
		}
	}

	return i;
}

function sendConfigurationRequest() {
	const fname = 'sendConfigurationRequest: ';

	try {
		console.log(fname + 'Making configuration request to ' + getServerUrl() + '.');
		var i = iot.getWithCommand(constants.CMDCODE_GeroConfiguration, config);
	
		console.log(fname + util.inspect(i, null, null) + '\n-- sendConfigurationRequest: END --\n' + config.mainServerUrl);
	
		webSocketManager.send(i);
	}
	catch(err) {
		console.log(fname + err.message);
	}
}

this.sendEventsToServer = function(retarr) {
	const fname = 'sendEventsToServer: ';

	try {
		var jreq = iot.getWithCommand(constants.CMDCODE_GpioGetState, retarr);
		
		console.log('Sending event to: ' + getServerUrl() + ': ' + util.inspect(jreq, null, null));
		webSocketManager.send(jreq);
	}
	catch(err) {
		console.log(fname + err.message);
	}
};

function getServerUrl() {
	return (skky.hasData(config.mainServerUrl) ? config.mainServerUrl : constants.DefaultGeroServer);
}

function gpioGetStateJsonFromAll() {
	var fname = 'gpioGetStateJsonFromAll: ';

	var i = 0;

	try {
		var gs = (gero.getStateJsonFromAll() || {});

		var iotb = iot.getBase();
		iotb.addCommand(constants.CMDCODE_GpioGetState, gs);

		return JSON.stringify(iotb);
	}
	catch(err) {
		console.log(fname + err.message);
	}

	return i;
}

function getKeepAliveData() {
	var fname = 'getKeepAliveData: ';
	
	var ka = {};
	try {
		osinfo.cpuInfo = os.cpus();
		osinfo.osName = os.type();
		osinfo.cpuArchitecture = os.arch();
		osinfo.osNics = os.networkInterfaces();
		osinfo.osTempDir = os.tmpdir();
		osinfo.osTotalMemory = os.totalmem();
		osinfo.osFreeMemory = os.freemem();
		osinfo.osUptime = os.uptime();
		osinfo.osHostname = os.hostname();
		osinfo.osPlatform = os.platform();
		osinfo.osRelease = os.release();
		
		ka.osinfo = osinfo;
		ka.gpioStates = gero.getStateJsonFromAll();
		//console.log(ka.gpios);
	}
	catch(err) {
		console.log(fname + 'Error getting OS info: ' + err.message);
	}
	
	return iot.getWithCommand(constants.CMDCODE_KeepAlive, ka);
}

var webSocketManager = new wscomm(getServerUrl, function() { return config; },
				function() { sendConfigurationRequest(); }, getKeepAliveData);

function init() {
	try {
		if (!skky.isNullOrUndefined(osinfo) && !skky.isNullOrUndefined(blegero)) {
			var str = skky.nonNull(osinfo.osHostname);
			console.log('osHostName: ' + str);
			str = skky.nonNull(str.replace(/[^\x20-\x7E]+/g, ''));
			console.log('osHostName cleaned: ' + str);
			
			if (skky.hasData(str)) {
				blegero.serviceInfo.serviceName = 'Geroix-' + str;
			}
		}
	}
	catch(err) {
		console.log('init: ' + err.message);
	}
}

function toggleTest() {
	var state = false;

	setInterval(function() {
		state = !state;
		//var s = '{"geroid":2,"c":[{"o":[{"gpioid":19,"state":' + (state ? 1 : 0) + '}],"code":2,"id":7959,"ts":1473103908258}],"id":7960,"ts":1473103908258}';
		// Send General Messages (26)
		var s = '{"geroid":' + config.nodeId + ',"c":[{"o":[{"state":' + (state ? 1 : 0) + '}],"code":26,"id":7777,"ts":1477777777777}],"id":7960,"ts":1478888888888}';
		processCommands(JSON.parse(s));
	}, 2000);
}

exports.processCommands = function(jso) {
	return processCommands(jso);
};
exports.processResponse = function(jso) {
	return processResponse(jso);
};
exports.gpioSetState = function(objstr) {
	var fname = 'gpioSetState: ';
	
	try {
		var cmd = constants.CMDCODE_GpioSetState;
		var jobj = JSON.parse(objstr);
		if (skky.hasData(jobj) && skky.hasData(skky.getObject(jobj).rclkid))
			cmd = constants.CMDCODE_GeroApplicationRun;

		var iotb = iot.getBase();
		iotb.addCommand(cmd, jobj);

		return processCommands(iotb);
	}
	catch(err) {
		console.log(fname + err.message);
	}
};
exports.gpioGetStateJsonFromAll = gpioGetStateJsonFromAll;
exports.gpioGetAllIds = function() {
	var fname = 'gpioGetAllIds: ';
	
	try {
		var ret = [];
		for(var i = gero.gpios.length - 1; i >= 0; i--) {
			ret.push(gero.gpios[i].id);
		}
		
		return ret;
	}
	catch(err) {
		console.log(fname + err.message);
	}
};
exports.gpioGetInit = function(offset) {
	var fname = 'gpioGetInit: ';
	
	try {
		if (!skky.isNullOrUndefined(config) &&
			!skky.isNullOrUndefined(config.gero) &&
			skky.hasData(config.gero.Gpios, offset)) {
			return skky.getObject(config.gero.Gpios, offset);
		}
	}
	catch(err) {
		console.log(fname + err.message);
	}
	
	return null;
};
exports.geroGetInitString = function() {
	var fname = 'gpioGetInit: ';
	
	try {
		if (!skky.isNullOrUndefined(config) && !skky.isNullOrUndefined(config.gero))
			return JSON.stringify(config.gero);
	}
	catch(err) {
		console.log(fname + err.message);
	}
	
	return null;
};
exports.serverUrl = function() {
	return getServerUrl();
};
exports.sendEegData = function(jo) {
	const fname = 'sendEegData: ';

	try {
		console.log(fname + 'Sending EEG Detector data to the Geroix cloud.');
		var i = iot.getWithCommand(constants.CMDCODE_ApplicationState, jo);

		webSocketManager.send(i);
		
		return i;
	}
	catch(err) {
		console.log(fname + err.message);
	}
};

init();
