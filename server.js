"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 3000;
const APP_DIRECTORY = __dirname;

loadEnvironmentFile(path.join(APP_DIRECTORY, ".env"));

const staticFiles = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
  "/script.js": { file: "script.js", type: "text/javascript; charset=utf-8" }
};

function loadEnvironmentFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function serveStaticFile(response, route) {
  const fileInfo = staticFiles[route];

  if (!fileInfo) {
    sendJson(response, 404, { error: "ページが見つかりません。" });
    return;
  }

  fs.readFile(path.join(APP_DIRECTORY, fileInfo.file), (error, content) => {
    if (error) {
      sendJson(response, 500, { error: "画面ファイルを読み込めませんでした。" });
      return;
    }

    response.writeHead(200, {
      "Content-Type": fileInfo.type,
      "Cache-Control": "no-cache"
    });
    response.end(content);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 20_000) {
        reject(new Error("入力データが大きすぎます。"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("入力データの形式が正しくありません。"));
      }
    });

    request.on("error", reject);
  });
}

async function geocodeAddress(address, apiKey) {
  const query = new URLSearchParams({
    address,
    key: apiKey,
    language: "ja",
    region: "jp",
    components: "country:JP"
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${query}`
  );

  if (!response.ok) {
    throw new Error("Google Geocoding APIとの通信に失敗しました。");
  }

  const data = await response.json();

  if (data.status === "ZERO_RESULTS") {
    throw new Error(`「${address}」に該当する日本国内の住所が見つかりませんでした。`);
  }

  if (data.status === "REQUEST_DENIED") {
    throw new Error(
      "住所検索が拒否されました。.envのAPIキーとGeocoding APIの設定を確認してください。"
    );
  }

  if (data.status === "OVER_QUERY_LIMIT") {
    throw new Error("Google APIの利用上限に達しました。請求設定や割り当てを確認してください。");
  }

  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(`住所検索に失敗しました。（${data.status || "不明なエラー"}）`);
  }

  const result = data.results[0];

  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address
  };
}

async function fetchGoogleRoute(origin, pickup, destination, apiKey) {
  const intermediates = pickup
    ? [
        {
          location: {
            latLng: {
              latitude: pickup.latitude,
              longitude: pickup.longitude
            }
          }
        }
      ]
    : [];

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "routes.distanceMeters",
          "routes.duration",
          "routes.travelAdvisory.tollInfo.estimatedPrice"
        ].join(",")
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude
            }
          }
        },
        intermediates,
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: false,
          vehicleInfo: {
            emissionType: "GASOLINE"
          }
        },
        extraComputations: ["TOLLS"],
        languageCode: "ja-JP",
        regionCode: "JP",
        units: "METRIC"
      })
    }
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message
        ? `Google Routes APIエラー：${data.error.message}`
        : "Google Routes APIからルートを取得できませんでした。"
    );
  }

  if (!data.routes?.[0]) {
    throw new Error("車で移動できるルートが見つかりませんでした。");
  }

  return data.routes[0];
}

function getTollInYen(route) {
  const prices = route.travelAdvisory?.tollInfo?.estimatedPrice ?? [];
  const yenPrices = prices.filter((price) => price.currencyCode === "JPY");

  if (yenPrices.length === 0) {
    return null;
  }

  return yenPrices.reduce((sum, price) => {
    const units = Number(price.units ?? 0);
    const nanos = Number(price.nanos ?? 0) / 1_000_000_000;
    return sum + units + nanos;
  }, 0);
}

function durationToSeconds(duration) {
  const seconds = Number.parseFloat(String(duration || "").replace("s", ""));
  return Number.isFinite(seconds) ? seconds : 0;
}

function combineRouteResults(outboundRoute, returnRoute = null) {
  if (!returnRoute) {
    return {
      distanceMeters: outboundRoute.distanceMeters,
      duration: outboundRoute.duration,
      tollYen: getTollInYen(outboundRoute)
    };
  }

  const outboundToll = getTollInYen(outboundRoute);
  const returnToll = getTollInYen(returnRoute);
  const tolls = [outboundToll, returnToll].filter((toll) => toll !== null);

  return {
    distanceMeters:
      Number(outboundRoute.distanceMeters || 0) +
      Number(returnRoute.distanceMeters || 0),
    duration:
      `${durationToSeconds(outboundRoute.duration) +
      durationToSeconds(returnRoute.duration)}s`,
    tollYen:
      tolls.length > 0 ? tolls.reduce((total, toll) => total + toll, 0) : null
  };
}

async function calculateRoute(body, apiKey) {
  const originText = String(body.origin || "").trim();
  const pickupText = String(body.pickup || "").trim();
  const destinationText = String(body.destination || "").trim();
  const roundTrip = body.roundTrip === true;

  if (!originText || !destinationText) {
    const error = new Error("出発地と配送先を入力してください。");
    error.statusCode = 400;
    throw error;
  }

  const [origin, pickup, destination] = await Promise.all([
    geocodeAddress(originText, apiKey),
    pickupText ? geocodeAddress(pickupText, apiKey) : Promise.resolve(null),
    geocodeAddress(destinationText, apiKey)
  ]);
  const outboundRoutePromise = fetchGoogleRoute(
    origin,
    pickup,
    destination,
    apiKey
  );
  const returnRoutePromise = roundTrip
    ? fetchGoogleRoute(destination, null, origin, apiKey)
    : Promise.resolve(null);
  const [outboundRoute, returnRoute] = await Promise.all([
    outboundRoutePromise,
    returnRoutePromise
  ]);
  const routeResult = combineRouteResults(outboundRoute, returnRoute);

  return {
    originAddress: origin.formattedAddress,
    pickupAddress: pickup?.formattedAddress ?? null,
    destinationAddress: destination.formattedAddress,
    roundTrip,
    distanceMeters: routeResult.distanceMeters,
    duration: routeResult.duration,
    tollYen: routeResult.tollYen
  };
}

async function handleRouteRequest(request, response) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey || apiKey === "ここにAPIキーを貼り付けてください") {
    sendJson(response, 503, {
      error: ".envにGoogle Maps APIキーを設定してから、サーバーを再起動してください。"
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const result = await calculateRoute(body, apiKey);
    sendJson(response, 200, result);
  } catch (error) {
    console.error("ルート取得エラー:", error.message);
    sendJson(response, error.statusCode || 502, {
      error: error.message || "ルートの取得中にエラーが発生しました。"
    });
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || HOST}`);

  if (request.method === "POST" && requestUrl.pathname === "/api/route") {
    await handleRouteRequest(request, response);
    return;
  }

  if (request.method === "GET") {
    serveStaticFile(response, requestUrl.pathname);
    return;
  }

  sendJson(response, 405, { error: "許可されていない操作です。" });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`配送利益計算アプリを起動しました: http://${HOST}:${PORT}`);
  });
}

module.exports = {
  calculateRoute,
  combineRouteResults
};
