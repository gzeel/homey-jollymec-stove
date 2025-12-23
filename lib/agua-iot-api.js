'use strict';

console.log('=== agua-iot-api.js loading ===');

const https = require('https');

console.log('=== agua-iot-api.js imports done ===');

// API endpoints (from py-agua-iot)
const API_PATH_APP_SIGNUP = '/appSignup';
const API_PATH_LOGIN = '/userLogin';
const API_PATH_REFRESH_TOKEN = '/refreshToken';
const API_PATH_DEVICE_LIST = '/deviceList';
const API_PATH_DEVICE_INFO = '/deviceGetInfo';
const API_PATH_DEVICE_REGISTERS_MAP = '/deviceGetRegistersMap';
const API_PATH_DEVICE_BUFFER_READING = '/deviceGetBufferReading';
const API_PATH_DEVICE_WRITING = '/deviceRequestWriting';
const API_PATH_DEVICE_JOB_STATUS = '/deviceJobStatus/';

// Supported brands
const BRANDS = {
  'alfaplam': { name: 'Alfaplam', customerCode: '862148', apiUrl: 'https://alfaplam.agua-iot.com' },
  'boreal': { name: 'Boreal Home', customerCode: '173118', apiUrl: 'https://boreal.agua-iot.com' },
  'bronpi': { name: 'Bronpi Home', customerCode: '164873', apiUrl: 'https://bronpi.agua-iot.com' },
  'darwin': { name: 'Darwin Evolution', customerCode: '475219', apiUrl: 'https://cola.agua-iot.com' },
  'easyconnect': { name: 'Easy Connect', customerCode: '354924', apiUrl: 'https://remote.mcz.it' },
  'easyconnectplus': { name: 'Easy Connect Plus', customerCode: '746318', apiUrl: 'https://remote.mcz.it' },
  'easyconnectpoele': { name: 'Easy Connect Poêle', customerCode: '354925', apiUrl: 'https://remote.mcz.it' },
  'elfire': { name: 'Elfire Wifi', customerCode: '402762', apiUrl: 'https://elfire.agua-iot.com' },
  'eoss': { name: 'EOSS WIFI', customerCode: '326495', apiUrl: 'https://solartecnik.agua-iot.com' },
  'evacalor': { name: 'EvaCalòr - PuntoFuoco', customerCode: '635987', apiUrl: 'https://evastampaggi.agua-iot.com' },
  'fontanaforni': { name: 'Fontana Forni', customerCode: '505912', apiUrl: 'https://fontanaforni.agua-iot.com' },
  'fonteflame': { name: 'Fonte Flamme contrôle 1', customerCode: '848324', apiUrl: 'https://fonteflame.agua-iot.com' },
  'globefire': { name: 'Globe-fire', customerCode: '634876', apiUrl: 'https://globefire.agua-iot.com' },
  'goheat': { name: 'GO HEAT', customerCode: '859435', apiUrl: 'https://amg.agua-iot.com' },
  'jollymec': { name: 'Jolly Mec Wi Fi', customerCode: '732584', apiUrl: 'https://jollymec.agua-iot.com' },
  'karmek': { name: 'Karmek Wifi', customerCode: '403873', apiUrl: 'https://karmekone.agua-iot.com' },
  'klover': { name: 'Klover Home', customerCode: '143789', apiUrl: 'https://klover.agua-iot.com' },
  'laminox': { name: 'LAMINOX Remote Control 2.0', customerCode: '352678', apiUrl: 'https://laminox.agua-iot.com' },
  'lorflam': { name: 'Lorflam Home', customerCode: '121567', apiUrl: 'https://lorflam.agua-iot.com' },
  'moretti': { name: 'Moretti design', customerCode: '624813', apiUrl: 'https://moretti.agua-iot.com' },
  'mycorisit': { name: 'My Corisit', customerCode: '101427', apiUrl: 'https://mycorisit.agua-iot.com' },
  'piazzetta': { 
    name: 'MyPiazzetta', 
    customerCode: '458632', 
    apiUrl: 'https://piazzetta.agua-iot.com',
    loginApiUrl: 'https://piazzetta-iot.app2cloud.it/api/bridge/endpoint/'
  },
  'nina': { name: 'Nina', customerCode: '999999', apiUrl: 'https://micronova.agua-iot.com' },
  'nobis': { name: 'Nobis-Fi', customerCode: '700700', apiUrl: 'https://nobis.agua-iot.com' },
  'nordicfire': { name: 'Nordic Fire 2.0', customerCode: '132678', apiUrl: 'https://nordicfire.agua-iot.com' },
  'ravelli': { name: 'Ravelli Wi-Fi', customerCode: '953712', apiUrl: 'https://aico.agua-iot.com' },
  'stufepelletitalia': { name: 'Stufe a pellet Italia', customerCode: '015142', apiUrl: 'https://stufepelletitalia.agua-iot.com' },
  'thermoflux': { name: 'Thermoflux', customerCode: '391278', apiUrl: 'https://thermoflux.agua-iot.com' },
  'tssmart': { name: 'TS Smart', customerCode: '046629', apiUrl: 'https://timsistem.agua-iot.com' },
  'wiphire': { name: 'Wi-Phire', customerCode: '521228', apiUrl: 'https://lineavz.agua-iot.com' }
};

class AguaIotApi {
  
  constructor(options = {}) {
    this.brand = options.brand || 'evacalor';
    this.email = options.email || '';
    this.password = options.password || '';
    this.uuid = options.uuid || this._generateUUID();
    this.brandId = options.brandId || '1';
    
    const brandConfig = BRANDS[this.brand];
    if (!brandConfig) {
      throw new Error(`Unknown brand: ${this.brand}`);
    }
    
    this.customerCode = brandConfig.customerCode;
    this.apiUrl = brandConfig.apiUrl;
    this.loginApiUrl = brandConfig.loginApiUrl || null;
    
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.devices = [];
    
    // Cache for register maps per device
    this.registerMaps = {};
    // Cache for device data
    this.deviceData = {};
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async _request(method, path, data = null, extraHeaders = {}) {
    const url = new URL(path, this.apiUrl);
    
    return new Promise((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Origin': 'file://',
        'id_brand': this.brandId,
        'customer_code': this.customerCode,
        ...extraHeaders
      };

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: method,
        headers: headers
      };

      console.log(`API Request: ${method} ${url.href}`);

      const req = https.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          console.log(`API Response: ${res.statusCode}`);
          
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const json = JSON.parse(body);
              resolve(json);
            } catch (e) {
              resolve(body);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 300)}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Request failed: ${e.message}`));
      });

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      // Only send body for POST requests
      if (data && method === 'POST') {
        const jsonData = JSON.stringify(data);
        console.log(`API Request body: ${jsonData.substring(0, 500)}`);
        req.write(jsonData);
      }
      req.end();
    });
  }

  async registerApp() {
    console.log('Registering app with Agua IOT...');
    
    const data = {
      phone_type: 'Android',
      phone_id: this.uuid,
      phone_version: '1.0',
      language: 'en',
      id_app: this.uuid,
      push_notification_token: this.uuid,
      push_notification_active: false
    };

    try {
      await this._request('POST', API_PATH_APP_SIGNUP, data);
      console.log('App registration successful');
      return true;
    } catch (error) {
      throw new Error(`Failed to register app: ${error.message}`);
    }
  }

  async login() {
    await this.registerApp();

    console.log('Logging in to Agua IOT...');

    const data = {
      email: this.email,
      password: this.password
    };

    const extraHeaders = {
      'local': 'true',
      'Authorization': this.uuid
    };

    try {
      const result = await this._request('POST', API_PATH_LOGIN, data, extraHeaders);
      
      if (result.token) {
        this.token = result.token;
        this.refreshToken = result.refresh_token;
        
        try {
          const payload = JSON.parse(Buffer.from(this.token.split('.')[1], 'base64').toString());
          this.tokenExpiry = payload.exp * 1000;
        } catch (e) {
          this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
        }
        
        console.log('Login successful');
        return true;
      } else {
        throw new Error('No token received');
      }
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async _authenticatedRequest(method, path, data = null) {
    if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
      await this.login();
    }

    const extraHeaders = {
      'local': 'false',
      'Authorization': this.token
    };

    return this._request(method, path, data, extraHeaders);
  }

  async getDevices() {
    console.log('Fetching devices...');
    
    const result = await this._authenticatedRequest('POST', API_PATH_DEVICE_LIST, {});
    
    if (!result.device || result.device.length === 0) {
      return [];
    }

    this.devices = [];
    
    for (const dev of result.device) {
      const infoPayload = {
        id_device: dev.id_device,
        id_product: dev.id_product
      };
      
      let deviceInfo = {};
      try {
        const infoResult = await this._authenticatedRequest('POST', API_PATH_DEVICE_INFO, infoPayload);
        if (infoResult.device_info && infoResult.device_info[0]) {
          deviceInfo = infoResult.device_info[0];
        }
      } catch (e) {
        console.log(`Could not fetch info for device ${dev.id}: ${e.message}`);
      }

      this.devices.push({
        id: dev.id,
        id_device: dev.id_device,
        id_product: dev.id_product,
        product_serial: dev.product_serial,
        name: dev.name,
        is_online: dev.is_online,
        name_product: dev.name_product,
        id_registers_map: deviceInfo.id_registers_map || null
      });
    }

    console.log(`Found ${this.devices.length} device(s)`);
    return this.devices;
  }

  async fetchRegistersMap(device) {
    console.log(`Fetching registers map for device: ${device.id_device}`);
    console.log(`Device id_registers_map: ${device.id_registers_map}`);
    
    const payload = {
      id_device: device.id_device,
      id_product: device.id_product,
      last_update: '2018-06-03T08:59:54.043'
    };

    const result = await this._authenticatedRequest('POST', API_PATH_DEVICE_REGISTERS_MAP, payload);
    
    if (!result.device_registers_map || !result.device_registers_map.registers_map) {
      console.log('Registers map response:', JSON.stringify(result).substring(0, 500));
      throw new Error('No registers map received');
    }

    console.log(`Found ${result.device_registers_map.registers_map.length} register maps`);

    // Find the correct registers map for this device
    const registersMap = {};
    let foundMap = false;
    
    for (const map of result.device_registers_map.registers_map) {
      console.log(`Checking map id: ${map.id} (looking for: ${device.id_registers_map})`);
      
      // If we have a specific id_registers_map, use that; otherwise use the first one
      if (map.id === device.id_registers_map || !device.id_registers_map) {
        foundMap = true;
        console.log(`Using registers map: ${map.id} with ${map.registers.length} registers`);
        
        for (const register of map.registers) {
          registersMap[register.reg_key] = {
            reg_type: register.reg_type,
            offset: register.offset,
            formula: register.formula,
            formula_inverse: register.formula_inverse,
            format_string: register.format_string,
            set_min: register.set_min,
            set_max: register.set_max,
            mask: register.mask
          };
          
          // Extract ON/OFF values for boolean registers
          if (register.enc_val) {
            for (const v of register.enc_val) {
              if (v.lang === 'ENG' && v.description === 'ON') {
                registersMap[register.reg_key].value_on = v.value;
              } else if (v.lang === 'ENG' && v.description === 'OFF') {
                registersMap[register.reg_key].value_off = v.value;
              }
            }
          }
        }
        break;
      }
    }

    if (!foundMap) {
      console.log('WARNING: Could not find matching registers map, using first available');
      const map = result.device_registers_map.registers_map[0];
      if (map && map.registers) {
        for (const register of map.registers) {
          registersMap[register.reg_key] = {
            reg_type: register.reg_type,
            offset: register.offset,
            formula: register.formula,
            formula_inverse: register.formula_inverse,
            format_string: register.format_string,
            set_min: register.set_min,
            set_max: register.set_max,
            mask: register.mask
          };
        }
      }
    }

    console.log(`Loaded ${Object.keys(registersMap).length} registers`);
    console.log(`Register keys: ${Object.keys(registersMap).slice(0, 10).join(', ')}...`);
    this.registerMaps[device.id_device] = registersMap;
    return registersMap;
  }

  async fetchDeviceData(device) {
    console.log('Fetching device data...');
    
    // Make sure we have the registers map
    if (!this.registerMaps[device.id_device]) {
      await this.fetchRegistersMap(device);
    }

    const payload = {
      id_device: device.id_device,
      id_product: device.id_product,
      BufferId: 1
    };

    const result = await this._authenticatedRequest('POST', API_PATH_DEVICE_BUFFER_READING, payload);
    console.log('Buffer reading response:', JSON.stringify(result).substring(0, 300));
    
    if (!result.idRequest) {
      throw new Error('No request ID received');
    }

    // Poll for job completion
    const jobResult = await this._pollJobStatus(result.idRequest);
    
    if (!jobResult || !jobResult.jobAnswerData) {
      console.log('Job result:', JSON.stringify(jobResult).substring(0, 500));
      throw new Error('No job answer data received');
    }

    // The buffer data has TWO arrays:
    // - Items: contains the offset numbers
    // - Values: contains the actual values for those offsets
    const items = jobResult.jobAnswerData.Items;
    const values = jobResult.jobAnswerData.Values;
    
    if (!items || !values) {
      console.log('ERROR: Items or Values not found');
      console.log('jobAnswerData keys:', Object.keys(jobResult.jobAnswerData));
      throw new Error('Buffer Items/Values not found');
    }
    
    console.log(`Items length: ${items.length}, Values length: ${values.length}`);
    
    // Create a map of offset -> value
    const bufferMap = {};
    for (let i = 0; i < items.length; i++) {
      bufferMap[items[i]] = values[i];
    }
    
    console.log(`Buffer map sample: ${JSON.stringify(Object.entries(bufferMap).slice(0, 5))}`);
    
    const deviceData = {};
    const registersMap = this.registerMaps[device.id_device];

    // Log key register offsets and their values
    const keyRegisters = ['temp_air_get', 'temp_air_set', 'status_get', 'temp_fumes_get', 'temp_gas_flue_get', 'power_set', 'real_power_get'];
    console.log('Key register mappings:');
    for (const key of keyRegisters) {
      if (registersMap[key]) {
        const reg = registersMap[key];
        const rawVal = bufferMap[reg.offset];
        console.log(`  ${key}: offset=${reg.offset}, mask=${reg.mask}, formula="${reg.formula}", rawValue=${rawVal}`);
      }
    }

    for (const [regKey, regInfo] of Object.entries(registersMap)) {
      const offset = regInfo.offset;
      
      if (bufferMap[offset] !== undefined) {
        // Apply mask first
        let rawValue = bufferMap[offset] & regInfo.mask;
        let value = rawValue;
        
        // Apply formula if present
        if (regInfo.formula && regInfo.formula !== 'x' && regInfo.formula !== '#') {
          try {
            value = this._applyFormula(rawValue, regInfo.formula);
          } catch (e) {
            console.log(`Formula error for ${regKey}: ${e.message}`);
          }
        }
        
        deviceData[regKey] = value;
      }
    }

    console.log('Device data parsed successfully');
    console.log(`Parsed ${Object.keys(deviceData).length} values`);
    
    // Log final parsed key values
    for (const key of keyRegisters) {
      if (deviceData[key] !== undefined) {
        console.log(`  ${key}: ${deviceData[key]}`);
      }
    }
    
    this.deviceData[device.id_device] = deviceData;
    return deviceData;
  }

  async _pollJobStatus(requestId, maxAttempts = 10) {
    console.log(`Polling job status for request: ${requestId}`);
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const result = await this._authenticatedRequest('GET', API_PATH_DEVICE_JOB_STATUS + requestId, null);
        console.log(`Job status (attempt ${i + 1}): ${result.jobAnswerStatus}`);
        
        if (result.jobAnswerStatus === 'completed') {
          console.log(`Job completed, data keys: ${result.jobAnswerData ? Object.keys(result.jobAnswerData).length : 'none'}`);
          if (result.jobAnswerData) {
            console.log(`Job data sample: ${JSON.stringify(result.jobAnswerData).substring(0, 200)}`);
          }
          return result;
        }
      } catch (e) {
        console.log(`Job poll error (attempt ${i + 1}): ${e.message}`);
      }
    }
    throw new Error('Job timeout - status never completed');
  }

  _applyFormula(value, formula) {
    // Formula uses # as placeholder for the value (like py-agua-iot)
    // Common formulas: "#/2", "#/10", "#*2"
    if (!formula || formula === 'x' || formula === '#') {
      return value;
    }
    
    try {
      // Replace '#' with the value and evaluate
      const expression = formula.replace(/#/g, value);
      const result = eval(expression);
      return result;
    } catch (e) {
      console.log(`Formula eval error: ${e.message} for formula "${formula}" with value ${value}`);
      return value;
    }
  }

  _applyInverseFormula(value, formula) {
    // Inverse formula also uses # as placeholder
    if (!formula || formula === 'x' || formula === '#') {
      return value;
    }
    
    try {
      const expression = formula.replace(/#/g, value);
      return eval(expression);
    } catch (e) {
      return value;
    }
  }

  async writeRegister(device, regKey, value) {
    console.log(`Writing ${regKey} = ${value}...`);
    
    // Make sure we have the registers map
    if (!this.registerMaps[device.id_device]) {
      await this.fetchRegistersMap(device);
    }

    const registersMap = this.registerMaps[device.id_device];
    const regInfo = registersMap[regKey];
    
    if (!regInfo) {
      throw new Error(`Unknown register: ${regKey}`);
    }

    // Apply inverse formula to convert display value to raw value
    let rawValue = value;
    if (regInfo.formula_inverse && regInfo.formula_inverse !== '#' && regInfo.formula_inverse !== 'x') {
      rawValue = this._applyInverseFormula(value, regInfo.formula_inverse);
      console.log(`Applied inverse formula "${regInfo.formula_inverse}": ${value} -> ${rawValue}`);
    }
    rawValue = Math.round(rawValue);

    const payload = {
      id_device: device.id_device,
      id_product: device.id_product,
      Protocol: 'RWMSmaster',
      BitData: [8],
      Endianess: ['L'],
      Items: [parseInt(regInfo.offset)],
      Masks: [parseInt(regInfo.mask)],
      Values: [rawValue]
    };

    const result = await this._authenticatedRequest('POST', API_PATH_DEVICE_WRITING, payload);
    
    if (!result.idRequest) {
      throw new Error('No request ID received for write');
    }

    // Poll for job completion
    const jobResult = await this._pollJobStatus(result.idRequest);
    console.log('Write successful');
    return jobResult;
  }

  // Convenience methods using standard register names
  async turnOn(device) {
    const regKey = 'status_managed_get';
    const registersMap = this.registerMaps[device.id_device] || await this.fetchRegistersMap(device);
    
    if (registersMap[regKey] && registersMap[regKey].value_on !== undefined) {
      return this.writeRegister(device, regKey, registersMap[regKey].value_on);
    }
    throw new Error('Turn on not supported');
  }

  async turnOff(device) {
    const regKey = 'status_managed_get';
    const registersMap = this.registerMaps[device.id_device] || await this.fetchRegistersMap(device);
    
    if (registersMap[regKey] && registersMap[regKey].value_off !== undefined) {
      return this.writeRegister(device, regKey, registersMap[regKey].value_off);
    }
    throw new Error('Turn off not supported');
  }

  async setTargetTemperature(device, temperature) {
    return this.writeRegister(device, 'temp_air_set', temperature);
  }

  async setPowerLevel(device, level) {
    return this.writeRegister(device, 'power_set', level);
  }

  // Get cached device data
  getDeviceValue(device, regKey) {
    const data = this.deviceData[device.id_device];
    if (data && data[regKey] !== undefined) {
      return data[regKey];
    }
    return null;
  }

  // Static methods
  static getBrands() {
    return Object.entries(BRANDS).map(([key, value]) => ({
      id: key,
      name: value.name
    }));
  }

  static getBrandConfig(brandId) {
    return BRANDS[brandId] || null;
  }
}

module.exports = AguaIotApi;
