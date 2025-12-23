# Jolly Mec Micronova Agua IOT for Homey

Control your pellet stove connected via the Micronova Agua IOT platform from your Homey.

## Supported Brands

This app supports Agua IOT pellet stoves and specific Jolly Mec.

## Features

### Capabilities

- **On/Off**: Turn your pellet stove on or off
- **Target Temperature**: Set the desired room temperature
- **Room Temperature**: View the current room temperature
- **Fumes Temperature**: View the exhaust/fumes temperature
- **Power Level**: Set the power level (1-5) via dim slider
- **Alarm**: Get notified when your stove has an alarm

### Flow Support

- **Triggers**:
  - Stove alarm triggered
- **Actions**:
  - Set power level (1-5)

## Installation

1. Install this app from the Homey App Store
2. Add a device and select your stove brand
3. Log in with your credentials (the same you use in the official app)
4. Select your stove(s) from the list

## Configuration

### Settings

- **Poll Interval**: How often to update device status (30-300 seconds, default: 60)

## Troubleshooting

### Login Failed

- Make sure you're using the correct email and password
- Verify that you can log in to the official app of your brand
- Some brands may have changed their API or customer codes

### Device Not Responding

- Check if your stove is connected to WiFi
- Try restarting the stove's WiFi module
- Increase the poll interval if you get rate limited

## Credits

This app is based on the work of:

- [py-agua-iot](https://github.com/fredericvl/py-agua-iot) by Frederic Van Linthoudt
- [home_assistant_micronova_agua_iot](https://github.com/vincentwolsink/home_assistant_micronova_agua_iot) by Vincent Wolsink

## Disclaimer

This app is not affiliated with or endorsed by Micronova or any of the stove brands. Use at your own risk.

## License

Apache-2.0

## Support

For issues and feature requests, please open an issue on GitHub.
