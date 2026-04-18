const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const scanRoutes = require("./routes/scanRoutes");

const app = express();
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "15mb";

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: jsonBodyLimit }));

app.use("/", scanRoutes);

module.exports = app;
