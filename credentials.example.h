/**
 * @file credentials.example.h
 * @brief Template Kredensial Rahasia Wi-Fi & Otentikasi Supabase untuk ESP8266 NodeMCU
 * 
 * PETUNJUK PENGGUNAAN:
 * 1. Salin file ini menjadi 'credentials.h' di folder yang sama:
 *    cp credentials.example.h credentials.h
 * 2. Masukkan SSID dan Password Wi-Fi aktual Anda.
 * 3. Buka Dashboard Web-Lightrap -> Halaman Device Management -> Perangkat 'SLT-SBG-01'.
 * 4. Salin Device Token resmi yang tertera (hasil rotasi) dan tempelkan ke variabel DEVICE_TOKEN.
 * 5. File 'credentials.h' sudah masuk ke .gitignore sehingga aman dari commit git.
 */

#ifndef CREDENTIALS_H
#define CREDENTIALS_H

// Konfigurasi Wi-Fi Lapangan (2.4 GHz)
#define WIFI_SSID         "Amj"
#define WIFI_PASSWORD     "Alya1504"

// Identitas & Kredensial Perangkat Smart Light Trap
#define DEVICE_CODE       "SLT-SBG-01"
#define DEVICE_TOKEN      "slt_live_8b4676f8f398b81036d1225e38b5e1d55c0d9a564428feca"

// Base URL Supabase Edge Functions
#define SUPABASE_BASE_URL "https://nrskcmbnctpdxywhigtu.supabase.co/functions/v1"

#endif // CREDENTIALS_H
