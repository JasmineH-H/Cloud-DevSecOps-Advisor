function resolveExpectedToken(rawExpectedToken, jsonKey) {
  const normalized = String(rawExpectedToken || "").trim();
  if (!normalized) {
    return "";
  }

  if (!normalized.startsWith("{")) {
    return normalized;
  }

  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== "object") {
      return normalized;
    }

    const preferredKeys = [];
    if (jsonKey) {
      preferredKeys.push(jsonKey);
    }
    preferredKeys.push(
      "ingest_token_sast",
      "ingest_token_pentest",
      "INGEST_TOKEN_SAST",
      "INGEST_TOKEN_PENTEST",
      "token"
    );

    for (const key of preferredKeys) {
      const value = parsed[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }

    return normalized;
  } catch (error) {
    return normalized;
  }
}

function verifyIngestToken(expectedToken, jsonKey = "") {
  return function (req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Missing Authorization header"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid Authorization header format"
      });
    }

    const token = authHeader.split(" ")[1];

    const resolvedExpectedToken = resolveExpectedToken(expectedToken, jsonKey);

    if (token !== resolvedExpectedToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid ingest token"
      });
    }

    next();
  };
}

function verifyDebugToken(expectedToken) {
  return function (req, res, next) {
    // Debug endpoints are disabled unless both flag + token are configured.
    if (process.env.ENABLE_DEBUG_ROUTES !== "true") {
      return res.status(404).json({
        success: false,
        message: "Not found"
      });
    }

    if (!expectedToken) {
      return res.status(503).json({
        success: false,
        message: "Debug routes are not configured"
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header"
      });
    }

    const token = authHeader.split(" ")[1];
    if (token !== expectedToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid debug token"
      });
    }

    next();
  };
}

module.exports = {
  verifyIngestToken,
  verifyDebugToken
};