// colorSensor.js

(function(ext) {
    var device = null;
    
	var levels = {
		HIGH:1,
		LOW:0
	};

    var freqScales = {
        "POWEROFF": 0, 
        "2%": 2, 
        "20%": 20, 
        "100%": 100 
    };

    var colorFilters = {
        "RED": 1, 
        "GREEN": 2, 
        "BLUE": 3, 
        "CLEAR": 0
    };

    var pins;

	ext.resetAll = function(){};
	
	ext.runArduino = function(){
		
	};
	ext.initializeTCS230 = function(s0, s1, s2, s3, out, freqScalingString) {
        pins = [s0, s1, s2, s3, out];
        var freqScaling = valueOrIndex(freqScalingString, freqScales);
        digitalWrite(s0, (freqScaling == 0 || freqScaling == 2) ? 0 : 1);
        digitalWrite(s1, (freqScaling == 0 || freqScaling == 20) ? 0 : 1);
    };
    ext.readColorWithFilter = function(nextId, colorFilterString) { 
        var filter = valueOrIndex(colorFilterString, colorFilters);
        filter == 1 ? prepareToReadRedTCS230() : (filter == 2 ? prepareToReadGreenTCS230() : (filter == 3) ? prepareToReadBlueTCS230() : prepareToReadClearTCS230());

        getPulse(nextID, pins[4]);
    };
	var _level = 0;
	ext.blink = function(){
		device.send([0x22, 0x23])
	}

    function prepareTCS230(s2Value, s3Value) {
        digitalWrite(pins[2], s2Value);
        digitalWrite(pins[3], s3Value);
    }

    function prepareToReadRedTCS230() {
        prepareTCS230(0, 0);
    } 

    function prepareToReadGreenTCS230() {
        prepareTCS230(1, 1);
    } 

    function prepareToReadBlueTCS230() {
        prepareTCS230(0, 1);
    } 

    function prepareToReadClearTCS230() {
        prepareTCS230(1, 0);
    }

    function valueOrIndex(beat, beats) {
        return typeof beat=="number"?beat:beats[beat];
    }

    function sendPackage(argList, type){
        var bytes = [0xff, 0x55, 0, 0, type];
        for(var i=0;i<argList.length;++i){
            var val = argList[i];
            if(val.constructor == "[class Array]"){
                bytes = bytes.concat(val);
            }else{
                bytes.push(val);
            }
        }
        bytes[2] = bytes.length - 3;
        device.send(bytes);
    }
    
    function digitalWrite(pin, value) {
        runPackage(30, pin, value);
    }
    function digitalRead(nextID, pin) {
        getPackage(nextID, 30, pin);
    }

    function getPulse(nextID, pin) {
        getPackage(nextID, 37, pin, short2array(20000));
    }

    function runPackage(){
        sendPackage(arguments, 2);
    }

    function processData(bytes) {
        trace(bytes);
    }

    // Extension API interactions
    var potentialDevices = [];
    ext._deviceConnected = function(dev) {
        potentialDevices.push(dev);

        if (!device) {
            tryNextDevice();
        }
    }

    function tryNextDevice() {
        // If potentialDevices is empty, device will be undefined.
        // That will get us back here next time a device is connected.
        device = potentialDevices.shift();
        if (device) {
            device.open({ stopBits: 0, bitRate: 115200, ctsFlowControl: 0 }, deviceOpened);
        }
    }

    function deviceOpened(dev) {
        if (!dev) {
            // Opening the port failed.
            tryNextDevice();
            return;
        }
        device.set_receive_handler('colorSensor',function(data) {
            processData(data);
        });
    };

    ext._deviceRemoved = function(dev) {
        if(device != dev) return;
        device = null;
    };

    ext._shutdown = function() {
        if(device) device.close();
        device = null;
    };

    ext._getStatus = function() {
        if(!device) return {status: 1, msg: 'colorSensor disconnected'};
        return {status: 2, msg: 'colorSensor connected'};
    }

    var descriptor = {};
	ScratchExtensions.register('colorSensor', descriptor, ext, {type: 'serial'});
})({});
