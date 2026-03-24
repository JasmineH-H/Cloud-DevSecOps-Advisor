const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const scanRoutes = require("./routes/scanRoutes");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/", scanRoutes);

module.exports = app;