const { default: fetch } = require("node-fetch");
const path = require("path");
const fs = require("fs");
const express = require("express");

function InitProductionServer(app, basePath, buildPath, port) {
  var indexHTMLSource = fs.readFileSync(
      path.join(buildPath, "index.html"),
      "utf-8"
  );
  var rMatchFilePath = /([^\":]+)\.(js|s?css|ico|icon|bmp|jpg|png|zip|gif|svg|pdf|docx|doc|xls|xlsx|xlsm|ppt|pptx|txt|json|xml|chunk|ttf|woff|woff2|map)/g;
  var rMatchFile = /(href|src)=\"([^\":]+)\.(js|s?css|ico|icon|bmp|jpg|zip|png|svg|gif|pdf|docx|doc|xls|xlsx|xlsm|ppt|pptx|txt|json|xml|chunk|ttf|woff|woff2|map)\"/g;
  if (basePath.endsWith("/"))
    basePath = basePath.substr(0, basePath.length - 1);
  indexHTMLSource = indexHTMLSource.replace(
      rMatchFile,
      '$1="' + basePath + '$2.$3"'
  );

  app.use("*", (req, res, next) => {

    //res.sendFile(path.join(buildPath, "index.html"));
    var baseUrl = req.originalUrl || req.baseUrl || req.url;
    baseUrl = baseUrl.replace(/\/\//g, "/");
    var mresult = baseUrl.match(rMatchFilePath);
    console.log('Fetching: ' + baseUrl);
    const filePath = path.join(buildPath, baseUrl);
    const extension = path.extname(baseUrl);
    if (fs.existsSync(filePath) && extension && extension.length >= 1) {
      var _base = basePath.replace(/\/\//g, "/");
      if (baseUrl.startsWith(_base)) {
        baseUrl = baseUrl.substr(_base.length);
      }
      res.sendFile(filePath);
    } else {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.status(200);
      res.send(indexHTMLSource);
    }
  });
}

function InitDevelopmentServer(app, basePath, port) {
  app.use("/*", async (req, res, next) => {
    var _newpath = req.baseUrl.toString().replace(/\/\//g, "/");
    basePath = basePath.replace(/\/\//g, "/");
    if (basePath.startsWith("/")) {
      basePath = basePath.substr(1);
    }
    if (_newpath.startsWith("/")) {
      _newpath = _newpath.substr(1);
    }
    if (_newpath.toLowerCase().startsWith(basePath.toLowerCase())) {
      _newpath = _newpath.substr(basePath.length);
    }
    _newpath = "/" + _newpath;

    var _res = await fetch("http://localhost:" + port + _newpath, {
      method: req.method,
      headers: req.headers,
    }).catch((p) => { });
    if (_res) {
      for (var h of _res.headers.keys()) {
        var v = _res.headers.get(h);
        if (h != "content-encoding") res.setHeader(h, v);
      }
      var _resbody = _res.body;
      res.status(_res.status);
      _resbody.pipe(res);
    } else {
      res.send("404");
    }
  });
}

/**
 * 
 * @param {Object} app 
 * @param {String} basePath 
 * @param {String} clientPath 
 * @param {Number} port 
 * @param {Boolean} disableAutoStartDevServer 
 */
async function UseReactServer(app, basePath = "/", clientPath = null, port = 3000, disableAutoStartDevServer = true) {
  var buildpath = path.join(process.cwd(), clientPath, "build");
  if (fs.existsSync(buildpath)) {
    InitProductionServer(app, basePath, buildpath);
  } else {
    fetch("http://localhost:" + port + "/", {
      method: "get",
    }).then(p => { InitDevelopmentServer(app, basePath, port); }).catch((p) => {
      if (!disableAutoStartDevServer) {
        var cmd = require("./CommandLineHost");
        var _client = path.join(__dirname, "client");
        if (clientPath) _client = clientPath;
        var c = new cmd(
            /^win/.test(process.platform) ? "npm.cmd" : "npm",
            ["run", "start"],
            _client
        );
        c.start();
      }
      InitDevelopmentServer(app, basePath, port);
    });
  }
}

module.exports = UseReactServer;
