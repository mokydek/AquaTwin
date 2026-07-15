# Hardware bridge

AquaTwin can ingest readings from real sensors through the `ingest` edge function.
A device authenticates with an API key and POSTs a small JSON batch. This document
covers a minimal ESP32 setup and the smoke test.

## Parts list

- ESP32 devkit board (any common variant with WiFi)
- Analog pH module with its probe
- DS18B20 waterproof temperature probe (one wire)
- Dissolved oxygen module (optional)

Wire the sensors per their own datasheets. Calibrate the pH probe against buffer
solutions (usually pH 4.0 and 7.0) before trusting the values.

## Create an API key

In the app, open Settings, Data sources, New key. Copy the raw key that is shown
once; it cannot be retrieved again. The endpoint URL is shown in the same section
and looks like `https://<project-ref>.supabase.co/functions/v1/ingest`.

## Payload

```
POST /functions/v1/ingest
content-type: application/json
x-api-key: aqk_YOUR_KEY_HERE

{
  "readings": [
    { "sensor": "ph", "value": 7.10 },
    { "sensor": "water_temp", "value": 24.5 }
  ]
}
```

Valid sensor names: `ph`, `water_temp`, `dissolved_oxygen`, `ammonia`, `nitrite`,
`nitrate`. `recorded_at` is optional (ISO 8601); it defaults to the server time.
Batches are capped at 60 readings. The response is `{ "inserted", "rejected" }`.

## Curl smoke test

Replace the URL and key with your own values:

```
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/ingest' \
  -H 'content-type: application/json' \
  -H 'x-api-key: aqk_YOUR_KEY_HERE' \
  -d '{"readings":[{"sensor":"ph","value":7.10},{"sensor":"water_temp","value":24.5}]}'
```

A healthy response is `{"inserted":2,"rejected":[]}`. A wrong or revoked key
returns HTTP 401.

## Minimal Arduino sketch outline

```
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "your-ssid";
const char* WIFI_PASS = "your-pass";
const char* INGEST_URL = "https://<project-ref>.supabase.co/functions/v1/ingest";
const char* API_KEY = "aqk_YOUR_KEY_HERE";

void setup() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  float ph = readPh();          // your calibrated reading
  float tempC = readTemp();     // DS18B20 reading

  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("content-type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  String body = "{\"readings\":[{\"sensor\":\"ph\",\"value\":" + String(ph) +
                "},{\"sensor\":\"water_temp\",\"value\":" + String(tempC) + "}]}";
  http.POST(body);
  http.end();

  delay(60000);                 // post once per minute
}
```

## Calibration and safety notes

- Calibrate the pH probe regularly; a drifting probe will trigger false alerts.
- Keep electronics away from water and use a sealed enclosure.
- Send at a modest cadence (once per minute is plenty). Do not exceed 60 readings
  per request.
- Values outside generous physical bounds are rejected server side, so a
  disconnected probe returning garbage will not corrupt the history.

## Switching off simulation

Once real data flows, disable the Local demo simulation on the Dashboard so the
charts and alerts reflect only hardware readings. Mixing simulated and hardware
data on the same sensor produces confusing history. The dashboard shows a
Hardware connected badge when a recent hardware reading has arrived.
