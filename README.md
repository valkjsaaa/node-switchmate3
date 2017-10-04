# A Node.js API for Switchmate3 #

Switchmate is a BLE controlled light switch add-on that provide smart home capability to conventional light switches.

This library is developed for a specific model of Switchmate switch TSM003W. This is the newer toggle style Switchmate
which have a smaller form factor for fitting on a multi-gang switch.

This library referenced the design of [node-switchmate](https://github.com/emmcc/node-switchmate) a Node.js API for the
original Switchmate (RSM0001 & RSM0002). As the communication protocol of these two product is quite different. I
decided to just write a new library. Any attempt to merge them would be welcome :)

This library is still very experimental. Please create an issue or a pull request for any problem you encountered.

During the creation of this library, [clemon79's comments on Home Assistant forum](https://community.home-assistant.io/t/switchmate-switch-covers/17851/28)
helps a lot!.