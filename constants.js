const skky = require('./skky');

function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

define('DefaultGeroServer', 'wss://iot.geroix.com/gero.ashx');

define('ConfigFilenameSafeMode', './config.json');
define('ConfigFilename', './config.all.json');

// Command Codes
define('CMDCODE_GeroConfiguration', 1);
define('CMDCODE_GpioSetState', 2);
define('CMDCODE_NodeResponse', 3);
define('CMDCODE_GeroConfigurationRequest', 4);
define('CMDCODE_DataResults', 5);
define('CMDCODE_Refresh', 6);
define('CMDCODE_GeroRefresh', 7);
define('CMDCODE_GpioRefresh', 8);
define('CMDCODE_GeroGetState', 9);
define('CMDCODE_GpioGetState', 10);
define('CMDCODE_GetState', 11);
define('CMDCODE_ChartRequest', 12);
define('CMDCODE_ApplicationRun', 13);
define('CMDCODE_SaveApplication', 14);
define('CMDCODE_ApplicationRefresh', 15);
define('CMDCODE_GetOsInfo', 16);
define('CMDCODE_KeepAlive', 19);
define('CMDCODE_BluetoothInit', 22);
define('CMDCODE_BluetoothInitGero', 23);
define('CMDCODE_BluetoothInitGpio', 24);
define('CMDCODE_GeneralMessage', 25);
define('CMDCODE_ApplicationState', 26);
define('CMDCODE_FileSystem', 27);

// Application Ids
define('APPID_Shift8_595', 1);
define('APPID_VolumeControl', 2);
define('APPID_LightMeter', 3);
define('APPID_Buzzer', 4);
define('APPID_Thermometer', 5);
define('APPID_RaspberryPiCamera', 6);
define('APPID_MoistureSensor', 7);
define('APPID_Chart', 8);
define('APPID_ColorPickerRgb', 9);
define('APPID_SimpleLed', 10);
define('APPID_OnOff', 11);
define('APPID_CoffeeMaker', 12);
define('APPID_PushButton', 13);
define('APPID_EegDetector', 14);
define('APPID_GeneralMessage', 15);
define('APPID_SystemCommand', 16);
define('APPID_Accelerometer', 17);
define('APPID_HallEffectSensor', 18);
define('APPID_Beacon', 19);

exports.getApplicationAsText = function(apptype) {
	switch (skky.nonNull(apptype)) {
		case this.APPID_Shift8_595:
			return 'Shift8_595';
        case this.APPID_VolumeControl:
            return 'VolumeControl';
        case this.APPID_LightMeter:
            return 'LightMeter';
        case this.APPID_Buzzer:
            return 'Buzzer';
        case this.APPID_Thermometer:
            return 'Thermometer';
        case this.APPID_RaspberryPiCamera:
            return 'RaspberryPiCamera';
        case this.APPID_MoistureSensor:
            return 'MoistureSensor';
        case this.APPID_Chart:
            return 'Chart';
        case this.APPID_ColorPickerRgb:
            return 'ColorPickerRgb';
        case this.APPID_SimpleLed:
            return 'SimpleLed';
        case this.APPID_OnOff:
            return 'OnOff';
        case this.APPID_CoffeeMaker:
            return 'CoffeeMaker';
        case this.APPID_PushButton:
            return 'PushButton';
        case this.APPID_EegDetector:
            return 'EegDetector';
        case this.APPID_GeneralMessage:
            return 'GeneralMessage';
        case this.APPID_SystemCommand:
            return 'SystemCommand';
        case this.APPID_Accelerometer:
            return 'Accelerometer';
        case this.APPID_HallEffectSensor:
            return 'HallEffectSensor';
        case this.APPID_Beacon:
            return 'Beacon';
	}
	
	return '';
}

exports.getCommandAsText = function(cmd) {
	switch (skky.nonNull(cmd)) {
		case this.CMDCODE_GeroConfiguration:
			return 'GeroConfiguration';
		case this.CMDCODE_GpioSetState:
			return 'GpioSetState';
		case this.CMDCODE_NodeResponse:
			return 'NodeResponse';
		case this.CMDCODE_GeroConfigurationRequest:
			return 'GeroConfigurationRequest';
		case this.CMDCODE_DataResults:
			return 'DataResults';
		case this.CMDCODE_Refresh:
			return 'Refresh';
		case this.CMDCODE_GeroRefresh:
			return 'GeroRefresh';
		case this.CMDCODE_GpioRefresh:
			return 'GpioRefresh';
		case this.CMDCODE_GeroGetState:
			return 'GeroGetState';
		case this.CMDCODE_GpioGetState:
			return 'GpioGetState';
		case this.CMDCODE_GetState:
			return 'GetState';
		case this.CMDCODE_ChartRequest:
			return 'ChartRequest';
		case this.CMDCODE_ApplicationRun:
			return 'ApplicationRun';
		case this.CMDCODE_ApplicationRefresh:
			return 'ApplicationRefresh';
		case this.CMDCODE_GetOsInfo:
			return 'GetOsInfo';
		case this.CMDCODE_KeepAlive:
			return 'KeepAlive';
		case this.CMDCODE_BluetoothInit:
			return 'BluetoothInit';
		case this.CMDCODE_BluetoothInitGero:
			return 'BluetoothInitGero';
		case this.CMDCODE_BluetoothInitGpio:
			return 'BluetoothInitGpio';
		case this.CMDCODE_GeneralMessage:
			return 'GeneralMessage';
        case this.CMDCODE_ApplicationState:
            return 'ApplicationState';
        case this.CMDCODE_FileSystem:
            return 'FileSystem';
	}
	
	return '';
}
