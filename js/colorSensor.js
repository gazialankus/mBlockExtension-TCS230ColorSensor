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
    }
    
	ext.resetAll = function(){};
	
	ext.runArduino = function(){
		
	};
	ext.initializeTCS230 = function(s0, s1, s2, s3, s4, out, freqScalingString) {
        var freqScaling = valueOrIndex(freqScalingString, freqScales);
        runPackage(30,freqScaling+11,0);
        // runPackage(30,s0,(freqScaling == 0 || freqScaling == 2) ? 0 : 1);
        // runPackage(30,s1,(freqScaling == 0 || freqScaling == 20) ? 0 : 1);
    };
    ext.readColorWithFilter = function(nextId, colorFilter) { //10 + colorFilter
        runPackage(30,colorFilter+10,0);
    };
	var _level = 0;
	ext.blink = function(){
		device.send([0x22, 0x23])
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
