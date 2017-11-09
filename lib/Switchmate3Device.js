"use strict";
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var NobleDevice = require('noble-device');

var SM_SERVICE_UUID = 'a22bd383ebdd49acb2e740eb55f5d0ab';
var SM_TOGGLE_CHAR = 'a22b0090ebdd49acb2e740eb55f5d0ab';
var SM_STATUS_CHAR = 'a22b0070ebdd49acb2e740eb55f5d0ab';


var Switchmate3Device = function (sm_peripheral)
{
    var self = this;
    if (!(this instanceof Switchmate3Device))
        return new Switchmate3Device();
    NobleDevice.call(self, sm_peripheral);
    EventEmitter.call(self);
    self.ToggleState = null;
    if (sm_peripheral.advertisement.manufacturerData && sm_peripheral.advertisement.manufacturerData.length === 6)
    {
        self.ToggleState = Boolean(sm_peripheral.advertisement.manufacturerData[0] & 0x01 === 1);
    }
    self._authCode = null;
    self._onCmd = null;
    self._offCmd = null;
    self.AuthString = null;
    self._pollInterval = 3;
    self._pollTimeoutObj = null;
    self._unreachableTimeoutObj = null;
    self.Reachable = true;
    self.CmdInProgress = false;
    self._reachableTimeout = null;

    self._updateToggleState = function (sm_ref)
    {
        //updating from refreshed version of self...
        self._unreachableTries = 0;
        if (self.Reachable === false)
        {
            self.Reachable = true; //device was found, so set to true.
            self.emit('reachable', self.id);
        }
        if (sm_ref.ToggleState === null) {
            return false;
        }
        if (self.ToggleState !== sm_ref.ToggleState)
        {
            self.ToggleState = sm_ref.ToggleState;
            self.emit('toggleStateChange', self.ToggleState, self.id);
        }
        return true;
    };

    self._unreachable = function ()
    {
        self._unreachableTries += 1;
        if (self._unreachableTries >= 5 && self.Reachable === true)
        {
            self.CmdInProgress = false;
            self.Reachable = false;
            self.emit('unreachable', self.id);
        }
    };

    self._doToggleStateCheck = function ()
    {
        if (!self.connectedAndSetUp) //if this device is not connected and active.
        {
            self._unreachableTimeoutObj = setTimeout(self._unreachable, self._pollInterval * 1000);
            //get a refresh of the Bluetooth LE Advertisement for updating the Toggle State.
            Switchmate3Device.discoverById(self.id, onDiscover);
            // noinspection JSAnnotator
            function onDiscover(sm)
            {
                clearTimeout(self._unreachableTimeoutObj);
                if (self._updateToggleState(sm)) {
                    Switchmate3Device.stopDiscover(onDiscover);
                }
            }
        }

        self._pollTimeoutObj = setTimeout(self._doToggleStateCheck, self._pollInterval * 1000);
    };
};
Switchmate3Device.SCAN_UUIDS = [SM_SERVICE_UUID];
Switchmate3Device.SCAN_DUPLICATES = true;

// inherit noble device
util.inherits(Switchmate3Device, EventEmitter);
NobleDevice.Util.inherits(Switchmate3Device, NobleDevice);

Switchmate3Device.prototype.isOn = function (done)
{
    var self = this;
    this.readDataCharacteristic(SM_SERVICE_UUID, SM_STATUS_CHAR, function (error, data) {
        if (error !== null || data.length === 0) {
            done(null);
        } else {
            if (data[0] === 0x0) {
                self.ToggleState = false;
                done(false);
            } else {
                self.ToggleState = true;
                done(true);
            }
        }
    });
};

Switchmate3Device.prototype.toggle = function (onoff, done)
{
    this.writeDataCharacteristic(SM_SERVICE_UUID, SM_TOGGLE_CHAR, new Buffer([onoff]), done);
    this.ToggleState = !this.ToggleState;
};

Switchmate3Device.prototype.onToggleResult = function (data)
{
    if (data.length > 0 && (data[0] === 0x01 || data[0] === 0x00)) {
        this.ToggleState = Boolean(data[0] !== 0x0);
        this.emit('toggleResponse', data[0] !== 0x0);
    } else
    {
        this.emit('toggleFail', data);
    }
};

Switchmate3Device.prototype.notifyToggleResult = function (callback)
{
    this.onToggleResultBinded = this.onToggleResult.bind(this);
    this.notifyCharacteristic(SM_SERVICE_UUID, SM_STATUS_CHAR, true, this.onToggleResultBinded, callback);
};

Switchmate3Device.prototype.startPollingSwitchmate3 = function ()
{
    var self = this;
    self._doToggleStateCheck();
};

Switchmate3Device.prototype.stopPollingSwitchmate3 = function ()
{
    var self = this;
    clearTimeout(self._pollTimeoutObj);
    self._pollTimeoutObj = null; //reset the timeout object.
};

Switchmate3Device.prototype.setPollInterval = function (seconds)
{
    this._pollInterval = seconds;
};

Switchmate3Device.prototype.foundMe = function (seconds)
{
    seconds = seconds || 60;
    var self = this;
    if (self.Reachable === false)
    {
        self.emit('reachable',self.id);
        self.Reachable = true;
    }
    if (self._reachableTimeout !== null)
    {
        clearTimeout(self._reachableTimeout);
    }
    self._reachableTimeout = setTimeout(function () {
        self.Reachable = false;
        self.emit('unreachable', self.id);
    }, seconds * 1000);
};

Switchmate3Device.prototype.ToggleMode = function ()
{
    var self = this;
    if (typeof self._toggleMode === 'undefined')
    {
        var Switchmate3Toggle = require('./Switchmate3ToggleSession');
        self._toggleMode = new Switchmate3Toggle(self);
    } else
    {
        self._toggleMode.Reset();
    }
    return self._toggleMode;
};

// export your device
module.exports = Switchmate3Device;
