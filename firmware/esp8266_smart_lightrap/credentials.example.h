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
#define WIFI_SSID         "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD     "PASSWORD_WIFI_ANDA"

// Identitas & Kredensial Perangkat Smart Light Trap
#define DEVICE_CODE       "SLT-SBG-01"
#define DEVICE_TOKEN      "GANTI_DENGAN_TOKEN_DEVICE_DARI_SUPABASE"

// Base URL Supabase Edge Functions & REST API
#define SUPABASE_BASE_URL "https://xzzjfwstrpayhnpymqpq.supabase.co/functions/v1"
#define SUPABASE_REST_URL "https://xzzjfwstrpayhnpymqpq.supabase.co/rest/v1/relay_status?id=eq.1"
#define SUPABASE_API_KEY  "sb_publishable_pJOVYiINorwqPGSzRX1M_w__IMG1xWq"

#endif // CREDENTIALS_H
