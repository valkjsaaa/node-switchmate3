var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Session for performing Toggle Commands on Switchmate.
 * @argument {SwitchmateDevice} sm_device
 */
var Switchmate3ToggleSession = function (sm_device)
{
    if (!(this instanceof Switchmate3ToggleSession))
        return new Switchmate3ToggleSession();
    var self = this;
    self.Switchmate3 = sm_device;
    self.event = new EventEmitter();
    self.connectAttempts = 0;
    self.ToggleSuccess = false;
    self.TargetState = null;
    self.TargetBool = null;
    self.Identify = null;
    self.CmdInProgress = false;
    self._toggleTimeout = null;
    self._connectTimeout = null;

    self.onConnect = function ()
    {
        clearTimeout(self._connectTimeout);
        self.connectAttempts += 1;
        self.event.emit('msg', 'Connected to Switchmate3 ' + self.Switchmate3.id + '.');
        self.Switchmate3.notifyToggleResult(function (err)
        {

            if (!err)
            {
                self.doToggle();
            }
        });
    };

    self.doToggle = function ()
    {
        self.event.emit('msg', 'Turning Switchmate3 ' + self.blnToWords(self.TargetBool) + ".");
        self._toggleTimeout = setTimeout(self.onToggleFail, 5 * 1000); //five seconds to work.
        self.Switchmate3.isOn(function (status) {
            if (status === null) {
                self.event.emit('fail', '');
                self.event.emit('toggleDone',false);
            } else {
                if (status === self.TargetBool) {
                    self.event.emit('toggleSuccess', null);
                } else {
                    var onoff = self.TargetBool ? 1 : 0;
                    self.Switchmate3.toggle(onoff, function (err) {
                        if (err) {
                            self.event.emit('fail', '');
                            self.event.emit('toggleFail',false);
                        }
                    });
                }
            }
        })
    };

    self.onDisconnect = function ()
    {
        if (self.ToggleSuccess === true)
        {
            self.Switchmate3.CmdInProgress = false;
            self.ToggleSuccess = false;
            self.TargetState = null;
            self.TargetBool = null;
            self.Identify = null;
            self._toggleTimeout = null;
            self._connectTimeout = null;
            self.connectAttempts = 0;
            self.event.emit('success', true);
            self.event.emit('toggleDone',true);
        } else if (self.connectAttempts < 3)
        {
            self._connectTimeout = setTimeout(self.onToggleFail, 10 * 1000); //five seconds to work.
            self.event.emit('msg', 'Retrying...');
            self.Switchmate3.connectAndSetUp(self.onConnect);
        } else
        {
            self.Switchmate3.CmdInProgress = false;
            self.event.emit('fail', '');
            self.event.emit('toggleDone',false);
        }
    };

    self.onToggleResponse = function (response)
    {
        if (response === self.TargetBool) {
            clearTimeout(self._toggleTimeout);
            if (self.TargetState === "identify" && self.Identify === null) {
                self.Identify = true;
                self.TargetBool = !self.TargetBool;
                self.doToggle();
            } else {
                self.ToggleSuccess = true;
                self.Switchmate3.disconnect();
            }
        }
    };

    /**
     * If Toggling the Switchmate3 fails without the worst error code, return this.
     */
    self.onToggleFail = function ()
    {
        clearTimeout(self._toggleTimeout);
        clearTimeout(self._connectTimeout);
        self.ToggleSuccess = false;
        self.event.emit('msg', 'Attempt failed.');
        self.Switchmate3.disconnect();
    };

    self.blnToWords = function (bln)
    {
        return (bln) ? 'on' : 'off';
    };

    self.Switchmate3.on('toggleFail', self.onToggleFail);
    self.Switchmate3.on('toggleResponse', self.onToggleResponse);
    self.Switchmate3.on('disconnect', self.onDisconnect);
};

/**
 * Identifies a paired Switchmate/
 * Changes Switchmate to opposite Toggle State, then reverts it back.
 * @returns {undefined}
 */
Switchmate3ToggleSession.prototype.IdentifySwitchmate3 = function ()
{
    var self = this;
    if (!self.Switchmate3.CmdInProgress === true || typeof self.Switchmate3.CmdInProgress === 'undefined')
    {
        var Sm = this.Switchmate3;
        self.Switchmate3.CmdInProgress = true;
        this.TargetBool = !Sm.ToggleState;
        this.TargetState = "identify";
        setTimeout(function(){Sm.CmdInProgress = false;}, 60 * 1000);
        this._connectTimeout = setTimeout(this.onToggleFail, 10 * 1000);
        Sm.connectAndSetUp(this.onConnect);
    }
};

/**
 * Turns on a paired Switchmate3
 */
Switchmate3ToggleSession.prototype.TurnOn = function ()
{
    var self = this;
    if (!self.Switchmate3.CmdInProgress === true || typeof self.Switchmate3.CmdInProgress === 'undefined')
    {
        var Sm = this.Switchmate3;
        if (Sm.ToggleState === true)
        {
            this.event.emit('msg', 'Switchmate3 is already on!');
            this.event.emit('success');
        } else
        {
            self.Switchmate3.CmdInProgress = true;
            this.TargetBool = true;
            this.TargetState = "on";
            setTimeout(function(){Sm.CmdInProgress = false;}, 60 * 1000);
            this._connectTimeout = setTimeout(this.onToggleFail, 10 * 1000);
            Sm.connectAndSetUp(this.onConnect);
        }
    }
};

/**
 * Turns off a paired Switchmate3.
 */
Switchmate3ToggleSession.prototype.TurnOff = function ()
{
    var self = this;
    if (!self.Switchmate3.CmdInProgress === true)
    {
        var Sm = this.Switchmate3;
        if (Sm.ToggleState === false)
        {
            self.event.emit('msg', 'Switchmate3 is already off!');
            self.event.emit('success');
        } else
        {
            Sm.CmdInProgress = true;
            self.TargetBool = false;
            self.TargetState = "off";
            self._connectTimeout = setTimeout(self.onToggleFail, 10 * 1000);
            setTimeout(function(){Sm.CmdInProgress = false;}, 60 * 1000);
            Sm.connectAndSetUp(this.onConnect);
        }
    }
};

Switchmate3ToggleSession.prototype.Reset = function ()
{
    var self = this;

    if (!self.Switchmate3.CmdInProgress === true)
    {
        self.connectAttempts = 0;
        self.ToggleSuccess = false;
        self.TargetState = null;
        self.TargetBool = null;
        self.Identify = null;
        self._toggleTimeout = null;
    }
};
util.inherits(Switchmate3ToggleSession, EventEmitter);
module.exports = Switchmate3ToggleSession;
