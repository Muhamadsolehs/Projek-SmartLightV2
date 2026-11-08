const fs = require('fs');

function crc16(buffer) {
  let crc = 0xFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= (buffer[i] << 8);
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

const testBuf = Buffer.from('SmartLightTrapESP8266Test');
console.log('CRC16 of test string:', '0x' + crc16(testBuf).toString(16).toUpperCase());

