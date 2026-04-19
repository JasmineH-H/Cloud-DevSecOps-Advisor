const buckets = new Map();

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const firstIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return firstIp || req.ip || "unknown";
}

function createRateLimiter({ windowMs, maxRequests, keyPrefix }) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientKey(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later."
      });
    }

    bucket.count += 1;
    return next();
  };
}

module.exports = {
  createRateLimiter
};
