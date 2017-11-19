// colorSensor.js

(function(ext) {
    var device = null;
    var _rxBuf = [];
    
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
        responseValue();
	};

	ext.initializeTCS230 = function(s0, s1, s2, s3, out, freqScalingString) {
        pins = [s0, s1, s2, s3, out];

        var freqScaling = valueOrIndex(freqScalingString, freqScales);
        digitalWrite(s0, (freqScaling == 0 || freqScaling == 2) ? 0 : 1);
        digitalWrite(s1, (freqScaling == 0 || freqScaling == 20) ? 0 : 1);
    };
    // pins are verified to be conserved
    ext.setColorFilter = function(colorFilterString) { 
        var filter = valueOrIndex(colorFilterString, colorFilters);

        switch(filter) {
            case 1: 
                prepareToReadRedTCS230();
                break;
            case 2: 
                prepareToReadGreenTCS230();
                break;
            case 3: 
                prepareToReadBlueTCS230();
                break;
            default:
                prepareToReadClearTCS230();
                break;
        }
    };

    ext.readColorWithCurrentFilter = function(nextID) { 
        getPulse(nextID, pins[4]);
    };

	var _level = 0;
	ext.blink = function(){
		device.send([0x22, 0x23])
	}

    function outputInDigitalPins(val) {
        if(typeof val != "number") {
            digitalWrite(13, 0);
        } else {
            digitalWrite(13, 1);

            var bin = val.toString(2);

            for(var i = 2; i < 13; ++i) {
                digitalWrite(i, 0);
            }
            var outMaxPin = 12;
            var outMinPin = 2;
            var outLength = outMaxPin - outMinPin + 1;

            if (bin.length > outLength) {
                digitalWrite(13, 0);
            } else {
                var bi = 0;
                for (var i = bin.length - 1; i >= 0; --i) {
                    if(bin[i] == 1) {
                        digitalWrite(outMinPin + bi, 1);
                    } else {
                        digitalWrite(outMinPin + bi, 0);
                    }
                    ++bi;
                }
            }
        }
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
        var deviceId = 37;
        var timeout = 20000;
        getPackage(nextID, deviceId, pin, short2array(timeout));
    }

    function runPackage(){
        sendPackage(arguments, 2);
    }
    function getPackage(){
        var nextID = arguments[0];
        Array.prototype.shift.call(arguments);
        sendPackage(arguments, 1);
    }


    var _isParseStart = false;
    var _isParseStartIndex = 0;
    function processData(bytes) {
        var len = bytes.length;
        if(_rxBuf.length>30){
            _rxBuf = [];
        }
        for(var index=0;index<bytes.length;index++){
            var c = bytes[index];
            _rxBuf.push(c);
            if(_rxBuf.length>=2){
                if(_rxBuf[_rxBuf.length-1]==0x55 && _rxBuf[_rxBuf.length-2]==0xff){
                    _isParseStart = true;
                    _isParseStartIndex = _rxBuf.length-2;
                }
                if(_rxBuf[_rxBuf.length-1]==0xa && _rxBuf[_rxBuf.length-2]==0xd&&_isParseStart){
                    _isParseStart = false;
                    
                    var position = _isParseStartIndex+2;
                    var extId = _rxBuf[position];
                    position++;
                    var type = _rxBuf[position];
                    position++;
                    //1 byte 2 float 3 short 4 len+string 5 double
                    var value;
                    switch(type){
                        case 1:{
                            value = _rxBuf[position];
                            position++;
                        }
                            break;
                        case 2:{
                            value = readFloat(_rxBuf,position);
                            position+=4;
                            if(value<-255||value>1023){
                                value = 0;
                            }
                        }
                            break;
                        case 3:{
                            value = readInt(_rxBuf,position,2);
                            position+=2;
                        }
                            break;
                        case 4:{
                            var l = _rxBuf[position];
                            position++;
                            value = readString(_rxBuf,position,l);
                        }
                            break;
                        case 5:{
                            value = readDouble(_rxBuf,position);
                            position+=4;
                        }
                            break;
                        case 6:
                            value = readInt(_rxBuf,position,4);
                            position+=4;
                            break;
                    }
                    if(type<=6){
                        responseValue(extId,value);
                    }else{
                        responseValue();
                    }
                    _rxBuf = [];
                }
            } 
        }
    }
    function readFloat(arr,position){
        var f= [arr[position],arr[position+1],arr[position+2],arr[position+3]];
        return parseFloat(f);
    }
    function readInt(arr,position,count){
        var result = 0;
        for(var i=0; i<count; ++i){
            result |= arr[position+i] << (i << 3);
        }
        return result;
    }
    function readDouble(arr,position){
        return readFloat(arr,position);
    }
    function readString(arr,position,len){
        var value = "";
        for(var ii=0;ii<len;ii++){
            value += String.fromCharCode(_rxBuf[ii+position]);
        }
        return value;
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
