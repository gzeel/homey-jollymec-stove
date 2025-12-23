'use strict';

const Homey = require('homey');
const AguaIotApi = require('../../lib/agua-iot-api');

class PelletStoveDevice extends Homey.Device {

  async onInit() {
    this.log('Pellet Stove device has been initialized');
    
    // Get stored credentials
    const store = this.getStore();
    
    // Initialize API
    this.api = new AguaIotApi({
      brand: store.brand,
      email: store.email,
      password: store.password,
      uuid: store.uuid
    });

    // Store the full device info needed for API calls
    const data = this.getData();
    this.deviceInfo = {
      id: data.id,
      id_device: store.id_device || data.id,
      id_product: store.id_product || null,
      id_registers_map: store.id_registers_map || null
    };
    
    this.log('Device info:', JSON.stringify(this.deviceInfo));
    
    // Register capability listeners
    this._registerCapabilityListeners();
    
    // Initial data fetch
    try {
      await this.api.login();
      await this._updateDeviceData();
    } catch (error) {
      this.error('Initial data fetch failed:', error);
      this.setUnavailable(this.homey.__('device.unavailable.connection_error'));
    }

    // Start polling
    this._startPolling();
  }

  _registerCapabilityListeners() {
    // On/Off capability
    this.registerCapabilityListener('onoff', async (value) => {
      this.log(`Setting onoff to: ${value}`);
      try {
        if (value) {
          await this.api.turnOn(this.deviceInfo);
        } else {
          await this.api.turnOff(this.deviceInfo);
        }
        // Trigger update after a delay to get new status
        this.homey.setTimeout(() => this._updateDeviceData(), 5000);
      } catch (error) {
        this.error('Failed to set onoff:', error);
        throw new Error(this.homey.__('device.error.command_failed'));
      }
    });

    // Target temperature capability
    this.registerCapabilityListener('target_temperature', async (value) => {
      this.log(`Setting target temperature to: ${value}`);
      try {
        await this.api.setTargetTemperature(this.deviceInfo, value);
      } catch (error) {
        this.error('Failed to set target temperature:', error);
        throw new Error(this.homey.__('device.error.command_failed'));
      }
    });

    // Power level via dim capability (0-1.0 maps to power 0-5)
    if (this.hasCapability('dim')) {
      this.registerCapabilityListener('dim', async (value) => {
        // Convert dim value (0-1.0) to power level (0-5)
        const powerLevel = Math.round(value * 5);
        this.log(`Setting power level to: ${powerLevel} (dim: ${value})`);
        try {
          await this.api.setPowerLevel(this.deviceInfo, powerLevel);
        } catch (error) {
          this.error('Failed to set power level:', error);
          throw new Error(this.homey.__('device.error.command_failed'));
        }
      });
    }
  }

  _startPolling() {
    const pollInterval = this.getSetting('poll_interval') || 60;
    
    // Clear existing interval if any
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
    }
    
    // Set up polling
    this.pollInterval = this.homey.setInterval(async () => {
      try {
        await this._updateDeviceData();
      } catch (error) {
        this.error('Polling error:', error);
      }
    }, pollInterval * 1000);
    
    this.log(`Polling started with interval: ${pollInterval} seconds`);
  }

  async _updateDeviceData() {
    try {
      this.log('Starting device data update...');
      
      // Fetch device data (this includes registers map fetching if needed)
      const data = await this.api.fetchDeviceData(this.deviceInfo);
      
      if (!data || Object.keys(data).length === 0) {
        this.log('No data received or empty data');
        return;
      }

      this.log(`Received ${Object.keys(data).length} data points`);

      // Parse and update capabilities from data
      await this._parseDeviceData(data);
      
      // Device is available
      if (!this.getAvailable()) {
        this.setAvailable();
      }
      
    } catch (error) {
      this.error('Update device data failed:', error.message);
      
      // If authentication error, try to re-login
      if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('UNAUTHORIZED')) {
        try {
          this.log('Re-authenticating...');
          await this.api.login();
        } catch (loginError) {
          this.setUnavailable(this.homey.__('device.unavailable.auth_error'));
        }
      }
    }
  }

  async _parseDeviceData(data) {
    this.log('Parsing device data...');
    this.log('Available keys:', Object.keys(data).join(', '));
    
    // Helper to get value from multiple possible keys
    const getValue = (...keys) => {
      for (const key of keys) {
        if (data[key] !== undefined) {
          this.log(`Found ${key}: ${data[key]}`);
          return data[key];
        }
      }
      return undefined;
    };
    
    // Status (on/off) - based on jollymec_ext_thermostat.json fixture:
    // 0: OFF, 1-6: Ignition, 7: Work (running!), 8: Brazier cleaning,
    // 9: Final cleaning, 10-11: Stand-by, 12-13: Alarm
    const status = getValue('status_get', 'status', 'state', 'STATUS');
    if (status !== undefined) {
      const statusInt = parseInt(status);
      // Status 1-9 means actively running (ignition, work, or cleaning phases)
      // Status 0, 10-13 means off, standby, or alarm
      const isOn = statusInt >= 1 && statusInt <= 9;
      await this.setCapabilityValue('onoff', isOn).catch(this.error);
      
      const statusNames = {
        0: 'OFF',
        1: 'Ignition', 2: 'Ignition', 3: 'Ignition', 
        4: 'Ignition', 5: 'Ignition', 6: 'Ignition',
        7: 'Work',
        8: 'Brazier cleaning',
        9: 'Final cleaning',
        10: 'Stand-by', 11: 'Stand-by',
        12: 'Alarm', 13: 'M. Alarm'
      };
      const statusName = statusNames[statusInt] || `Unknown (${statusInt})`;
      this.log(`Status: ${statusInt} (${statusName}), isOn: ${isOn}`);
    }

    // Room/air temperature - try multiple possible register names
    const airTemp = getValue('temp_air_get', 'temp_air', 'temp_amb_get', 'temp_amb', 'room_temp', 'T_AMB');
    if (airTemp !== undefined && !isNaN(airTemp)) {
      const temp = parseFloat(airTemp);
      await this.setCapabilityValue('measure_temperature', temp).catch(this.error);
      this.log(`Room temperature: ${temp}`);
    }

    // Target temperature - try multiple possible register names
    const targetTemp = getValue('temp_air_set', 'set_temp', 'target_temp', 'SETP', 'temp_set');
    if (targetTemp !== undefined && !isNaN(targetTemp)) {
      const temp = parseFloat(targetTemp);
      await this.setCapabilityValue('target_temperature', temp).catch(this.error);
      this.log(`Target temperature: ${temp}`);
    }

    // Fumes/exhaust temperature - temp_gas_flue_get is used by Jollymec (formula "#+30")
    const fumesTemp = getValue('temp_gas_flue_get', 'temp_fumes_get', 'temp_fumes', 'fumes_temp', 'T_FUMI', 'exhaust_temp');
    if (fumesTemp !== undefined && !isNaN(fumesTemp)) {
      if (this.hasCapability('measure_temperature.fumes')) {
        const temp = parseFloat(fumesTemp);
        await this.setCapabilityValue('measure_temperature.fumes', temp).catch(this.error);
        this.log(`Fumes temperature: ${temp}`);
      }
    }

    // Power level - read from real_power_get or power_set
    // real_power_get: 1=Eco, 2=Silent, 3=P1, 4=P2, 5=P3, 6=P4, 7=P5
    // power_set: 0=SIL, 1-5=Power levels
    const realPower = getValue('real_power_get');
    const powerSet = getValue('power_set', 'power', 'power_level', 'PWR', 'POT');
    
    if (this.hasCapability('dim')) {
      let powerLevel = 0;
      
      if (realPower !== undefined && !isNaN(realPower)) {
        // Convert real_power_get (1-7) to power level (0-5)
        // 1=Eco->0, 2=Silent->0, 3=P1->1, 4=P2->2, 5=P3->3, 6=P4->4, 7=P5->5
        const realPowerInt = parseInt(realPower);
        if (realPowerInt <= 2) {
          powerLevel = 0; // Eco or Silent = 0
        } else {
          powerLevel = realPowerInt - 2; // P1-P5 = 1-5
        }
        this.log(`Real power: ${realPower}, converted to level: ${powerLevel}`);
      } else if (powerSet !== undefined && !isNaN(powerSet)) {
        powerLevel = parseInt(powerSet);
        this.log(`Power set: ${powerSet}`);
      }
      
      const dimValue = Math.min(1, Math.max(0, powerLevel / 5));
      await this.setCapabilityValue('dim', dimValue).catch(this.error);
      this.log(`Power level: ${powerLevel}, dim: ${dimValue}`);
    }

    // Alarm status - try multiple possible register names
    const alarmCode = getValue('alarms_get', 'alarm', 'error_code', 'ALARM', 'ERR');
    if (alarmCode !== undefined) {
      const hasAlarm = parseInt(alarmCode) > 0;
      await this.setCapabilityValue('alarm_generic', hasAlarm).catch(this.error);
      this.log(`Alarm code: ${alarmCode}, hasAlarm: ${hasAlarm}`);
      
      if (hasAlarm) {
        this.homey.flow.getDeviceTriggerCard('pellet_stove_alarm')
          .trigger(this, { alarm_code: parseInt(alarmCode) })
          .catch(this.error);
      }
    }
    
    this.log('Device data parsing complete');
  }

  async setPowerLevel(level) {
    // Power levels: 0 = Silent, 1-5 = power levels
    const powerLevel = Math.max(0, Math.min(5, level));
    await this.api.setPowerLevel(this.deviceInfo, powerLevel);
    const dimValue = powerLevel / 5;
    await this.setCapabilityValue('dim', dimValue);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    if (changedKeys.includes('poll_interval')) {
      this._startPolling();
    }
  }

  async onDeleted() {
    this.log('Pellet Stove device has been deleted');
    
    // Clear polling interval
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
    }
  }

}

module.exports = PelletStoveDevice;
