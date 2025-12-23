'use strict';

console.log('=== Driver file loaded ===');

const Homey = require('homey');
const AguaIotApi = require('../../lib/agua-iot-api');

console.log('=== Imports done ===');

class PelletStoveDriver extends Homey.Driver {

  async onInit() {
    console.log('=== Driver onInit called ===');
    this.log('Pellet Stove driver has been initialized');
    this.log('Driver ready for pairing');
    
    // Register flow cards
    this._registerFlowCards();
  }

  _registerFlowCards() {
    // Action: Set power level
    this.homey.flow.getActionCard('pellet_stove_set_power')
      .registerRunListener(async (args, state) => {
        await args.device.setPowerLevel(args.power_level);
        return true;
      });
  }

  async onPair(session) {
    let email = '';
    let password = '';
    let api = null;
    let devices = [];
    
    // TODO: Make this configurable - for now hardcoded for testing
    const selectedBrand = 'jollymec';

    this.log('Pairing session started');

    session.setHandler('login', async (credentials) => {
      this.log('login handler called');
      email = credentials.username;
      password = credentials.password;

      try {
        this.log(`Attempting login for brand: ${selectedBrand}, email: ${email}`);
        
        // Create API instance with selected brand
        api = new AguaIotApi({
          brand: selectedBrand,
          email: email,
          password: password
        });

        // Try to login
        this.log('Calling api.login()...');
        await api.login();
        this.log('Login successful!');
        
        // Get devices
        this.log('Calling api.getDevices()...');
        const deviceList = await api.getDevices();
        this.log('Devices received:', JSON.stringify(deviceList));
        
        if (!deviceList || deviceList.length === 0) {
          this.error('No devices found in account');
          throw new Error(this.homey.__('pair.error.no_devices'));
        }

        // Map devices to Homey format
        devices = deviceList.map(device => ({
          name: device.name || device.product_name || 'Pellet Stove',
          data: {
            id: String(device.id),
            deviceId: device.id
          },
          store: {
            brand: selectedBrand,
            email: email,
            password: password,
            uuid: api.uuid,
            apiUrl: api.apiUrl,
            customerCode: api.customerCode,
            brandId: api.brandId,
            loginApiUrl: api.loginApiUrl || null,
            id_device: device.id_device,
            id_product: device.id_product,
            id_registers_map: device.id_registers_map
          },
          settings: {
            brand: AguaIotApi.getBrandConfig(selectedBrand).name,
            email: email
          }
        }));

        this.log('Mapped devices:', devices.length);
        return true;
      } catch (error) {
        this.error('Login failed:', error.message);
        throw new Error(this.homey.__('pair.error.login_failed') + ': ' + error.message);
      }
    });

    session.setHandler('list_devices', async () => {
      this.log('list_devices handler called, returning', devices.length, 'devices');
      return devices;
    });
  }

  async onRepair(session, device) {
    session.setHandler('login', async (credentials) => {
      const store = device.getStore();
      
      try {
        const api = new AguaIotApi({
          brand: store.brand,
          email: credentials.username,
          password: credentials.password,
          uuid: store.uuid
        });

        await api.login();
        
        // Update stored credentials
        await device.setStoreValue('email', credentials.username);
        await device.setStoreValue('password', credentials.password);
        
        // Reinitialize device
        await device.onInit();
        
        return true;
      } catch (error) {
        this.error('Repair login failed:', error);
        throw new Error(this.homey.__('pair.error.login_failed') + ': ' + error.message);
      }
    });
  }

}

module.exports = PelletStoveDriver;
