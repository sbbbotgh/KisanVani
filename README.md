# KisanVani

KisanVani is a voice-first agri-advisory prototype for Indian farmers. It combines district-level weather from Open-Meteo, live mandi reports from the OGD India Agmarknet dataset, and Sarvam speech recognition and speech generation. It is a hackathon demo, not a substitute for checking current market, crop-grade, or procurement conditions.

## Run locally

```sh
npm install
cp .env.example .env.local
# Add provider keys to .env.local; do not put keys in frontend Vite variables.
npm run dev
```

Set `OGD_API_KEY` from data.gov.in, `SARVAM_API_KEY` from Sarvam, and `GEMINI_API_KEY` from Google AI Studio in the ignored `.env.local` file or the deployment's server-side secret manager. Vite's server proxies read those values; they are not included in the browser bundle. Without a key, the relevant service reports that it is not configured rather than substituting a mandi price. For production deployments, provide equivalent server routes—the included proxies run in Vite dev and preview servers.

`npm run build` creates the production frontend bundle, and `npm run lint` runs Oxlint.

## What the demo does

- Supports English, Hinglish, Punjlish, Tanglish, Hindi, Punjabi, Tamil, and Marathi text and voice flows. Sarvam `saaras:v3` transcribes short code-mixed audio, and `bulbul:v4-flash` generates spoken advice. The UI shows the transcript and written reply; recording is capped at eight seconds in 2G Lite mode.
- Fetches selected-crop mandi records from OGD India / Agmarknet on demand, filtered by state and commodity so comparison can include multiple markets across that state. The dashboard shows a local district quote when one is returned; the comparison shows all returned state markets. The UI displays commodity, market, modal/min/max prices, and reported arrival dates. The server proxy caches responses for five minutes and reports configuration/provider errors explicitly. Demo scenarios may use bundled illustrative data and are labeled as demos.
- If the selected district has no live quote, the app geocodes available crop markets in that state's live report, finds the five closest mandi locations, and displays those five sorted by reported modal price. Advisory requests receive those live quotes, arrival dates, and approximate distances so Gemini or the on-device fallback can explain the best reported nearby option without presenting it as a quote for the selected district. Geocoding is India-only, cached in memory for the session, and no precise farmer coordinates are sent to Gemini. If no nearby live quote can be resolved, the app says so rather than substituting demo prices.
- Compares the selected crop's live records across returned state markets. Farmers enter harvest tonnes, labor rate and shared labor hours, freight per 100 kg, and travel time per market. Estimated net is `modal price × quintals − freight − shared labor`; travel time is displayed separately and does not change earnings. MSP references are illustrative 2025–26 demo values, not live official data.
- Requests current conditions and a three-day rain forecast from Open-Meteo for a searchable Indian district/city. Farmers can optionally grant browser location access to switch the weather forecast to their current coordinates; this does not change the selected mandi or share location with the speech provider. The UI identifies live, cached, sample, and demo weather separately. If the live request fails and no cached forecast exists, the fallback is sample weather and is labeled as such.
- Sends typed questions and Sarvam transcripts to Gemini for a structured decision badge, reason, and short answer in the selected language. Context includes the selected crop, district/state, available weather, up to eight live mandi reports, and—when needed—the five closest live mandi quotes sorted by modal price, with approximate distances and report dates. Previous sessions and precise coordinates are not sent. Gemini cannot recommend holding without supplied price history or transporting from price differences alone; weather-based sell advice requires live weather. If Gemini is unavailable or proposes an unsupported decision, the app clearly labels and shows its on-device fallback advice.
- Keeps the structured mandi comparison rules on-device. Live data is requested only when the relevant screen needs it; the interface has text-input alternatives and a short mono recording mode for low-bandwidth networks.

## Data, credentials, and privacy

Mandi prices in the live dashboard and earnings comparison come from the configured OGD / Agmarknet feed, not bundled sample prices. The displayed arrival date is the provider's report date; confirm today's price, grade, and sale terms directly with the mandi before acting. A live quote is not enough to infer a price trend, so the advisory asks farmers to confirm the trend rather than making an unsupported hold recommendation. Demo scenarios and MSP references remain illustrative.

Weather is fetched from Open-Meteo over the network. Location search uses Open-Meteo geocoding and filters results to India. Current-location weather is optional and requires browser permission; coordinates are sent only to Open-Meteo for the forecast and cached locally. A previously saved forecast may be used offline; if none is available, a clearly labeled sample forecast is shown. Weather values are location-coordinate estimates, not field-level sensor measurements.

Recorded voice audio is sent to Sarvam via the server proxy for transcription. User questions and the limited context described above are sent to Gemini through the server proxy for answers; the answer text is sent to Sarvam when preparing spoken audio. API keys stay server-side; review provider terms and privacy practices before using real farmer recordings. If a provider is unavailable, the app shows an explicit status and keeps a local-advice fallback available.

Do not paste API keys into source files, frontend `VITE_*` variables, or chat. The `.env.local` file is ignored by Git. If credentials have been shared outside a trusted team, rotate them with the providers.
