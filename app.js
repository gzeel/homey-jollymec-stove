'use strict';

const Homey = require('homey');

class MicronovaAguaIotApp extends Homey.App {

  async onInit() {
    console.log('=== Micronova Agua IOT app starting ===');
    this.log('Micronova Agua IOT app has been initialized');
    console.log('=== App initialization complete ===');
  }

}

module.exports = MicronovaAguaIotApp;
