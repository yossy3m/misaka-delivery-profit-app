"use strict";

const { calculateRoute } = require("../server.js");

function sendJson(response, statusCode, data) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.status(statusCode).json(data);
}

module.exports = async function routeHandler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "POSTリクエストのみ利用できます。" });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey || apiKey === "ここにAPIキーを貼り付けてください") {
    sendJson(response, 503, {
      error:
        "Vercelの環境変数GOOGLE_MAPS_API_KEYを設定して、再デプロイしてください。"
    });
    return;
  }

  try {
    const body =
      typeof request.body === "string"
        ? JSON.parse(request.body || "{}")
        : request.body || {};
    const result = await calculateRoute(body, apiKey);
    sendJson(response, 200, result);
  } catch (error) {
    console.error("Vercelルート取得エラー:", error.message);
    sendJson(response, error.statusCode || 502, {
      error: error.message || "ルートの取得中にエラーが発生しました。"
    });
  }
};
