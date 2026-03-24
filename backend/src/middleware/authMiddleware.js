function verifyIngestToken(expectedToken) {
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

    if (token !== expectedToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid ingest token"
      });
    }

    next();
  };
}

module.exports = {
  verifyIngestToken
};