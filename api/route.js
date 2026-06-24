"use strict";

const GOOGLE_GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const API_KEY_PLACEHOLDER = "ここにAPIキーを貼り付けてください";

function sendJson(response, statusCode, data) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = statusCode;
  response.end(JSON.stringify(data));
}

function readRequestBody(request) {
  if (request.body && typeof request.body === "object") {
    return Promise.resolve(request.body);
  }

  if (typeof request.body === "string") {
    try {
      return Promise.resolve(JSON.parse(request.body || "{}"));
    } catch {
      return Promise.reject(new Error("入力データの形式が正しくありません。"));
    }
  }

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

  const response = await fetch(`${GOOGLE_GEOCODING_API_URL}?${query}`);

  if (!response.ok) {
    throw new Error("Google Geocoding APIとの通信に失敗しました。");
  }

  const data = await response.json();

  if (data.status === "ZERO_RESULTS") {
    throw new Error(`「${address}」に該当する日本国内の住所が見つかりませんでした。`);
  }

  if (data.status === "REQUEST_DENIED") {
    throw new Error(
      "住所検索が拒否されました。Google Maps APIキーとGeocoding APIの設定を確認してください。"
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

function toRoutePoint(point) {
  return {
    location: {
      latLng: {
        latitude: point.latitude,
        longitude: point.longitude
      }
    }
  };
}

async function fetchGoogleRoute(origin, pickup, destination, apiKey) {
  const intermediates = pickup ? [toRoutePoint(pickup)] : [];

  const response = await fetch(GOOGLE_ROUTES_API_URL, {
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
      origin: toRoutePoint(origin),
      destination: toRoutePoint(destination),
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
  });

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
      distanceMeters: Number(outboundRoute.distanceMeters || 0),
      duration: outboundRoute.duration,
      tollYen: getTollInYen(outboundRoute)
    };
  }

  const outboundToll = getTollInYen(outboundRoute);
  const returnToll = getTollInYen(returnRoute);
  const tolls = [outboundToll, returnToll].filter((toll) => toll !== null);

  return {
    distanceMeters:
      Number(outboundRoute.distanceMeters || 0) + Number(returnRoute.distanceMeters || 0),
    duration: `${durationToSeconds(outboundRoute.duration) + durationToSeconds(returnRoute.duration)}s`,
    tollYen: tolls.length > 0 ? tolls.reduce((total, toll) => total + toll, 0) : null
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

  const outboundRoutePromise = fetchGoogleRoute(origin, pickup, destination, apiKey);
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

module.exports = async function routeHandler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "POSTリクエストのみ利用できます。" });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey || apiKey === API_KEY_PLACEHOLDER) {
    sendJson(response, 503, {
      error:
        "Vercelの環境変数 GOOGLE_MAPS_API_KEY を設定してから、再デプロイしてください。"
    });
    return;
  }

  try {
    const body = await readRequestBody(request);
    const result = await calculateRoute(body, apiKey);
    sendJson(response, 200, result);
  } catch (error) {
    console.error("Vercelルート取得エラー:", error.message);
    sendJson(response, error.statusCode || 502, {
      error: error.message || "ルートの取得中にエラーが発生しました。"
    });
  }
};

module.exports.calculateRoute = calculateRoute;
module.exports.combineRouteResults = combineRouteResults;
