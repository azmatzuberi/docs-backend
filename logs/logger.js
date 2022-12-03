const express = require("express");
const app = express();

const log = app.use(function (req, res, next) {
  console.log("Logging... ");
  next();
});

module.exports = log;
