const { default: fetch } = require("node-fetch");
const path = require("path");
const fs = require("fs");
const express = require("express");
const ws = require('ws');
const rMatchFilePath = /([^\":]+)\.(js|s?css|ico|icon|bmp|jpg|png|zip|gif|svg|pdf|docx|doc|xls|xlsx|xlsm|ppt|pptx|txt|json|xml|chunk|ttf|woff|woff2|map)/g;
const rMatchFile = /(href|src)=\"([^\":]+)\.(js|s?css|ico|icon|bmp|jpg|zip|png|svg|gif|pdf|docx|doc|xls|xlsx|xlsm|ppt|pptx|txt|json|xml|chunk|ttf|woff|woff2|map)\"/g;
const rMatchFileJS = /(href|src)=\"([^\":]+)\.(js|s?css||map)\"/g;

var registeredBasePaths = [];

function rebuildHTMLIndex(source, basePath, matcher = rMatchFile) {
  /** @type {string} */
  indexHTMLSource = source;
  if (basePath.endsWith("/"))
    basePath = basePath.substr(0, basePath.length - 1);
  indexHTMLSource = indexHTMLSource.replace(
    matcher,
    (match, propName, fileName, fileType, offset) => {
      if (fileName.startsWith(basePath)) {
        return match;
      }
      return `${propName}="${basePath}${fileName}.${fileType}"`;
    }
  );
  return indexHTMLSource;
}

function InitProductionServer(app, basePath, buildPath, port) {
  var indexHTMLSource = rebuildHTMLIndex(fs.readFileSync(
    path.join(buildPath, "index.html"),
    "utf-8"
  ), ("/" + basePath).replace(/\/\//g, "/"));


  app.use(basePath + "*", (req, res, next) => {

    var baseUrl = req.originalUrl || req.baseUrl || req.url;
    baseUrl = baseUrl.replace(/\/\//g, "/");
    const referer = req.headers.referer;
    if (referer && referer.length > 0) {
      var pathname = new URL(referer).pathname;
      var longPath = registeredBasePaths.filter(bp => pathname.toLowerCase().startsWith(bp[0].toLowerCase())).sort((a, b) => a[0].length - b[0].length).reverse()[0];
      basePath = longPath[0];
      if (!baseUrl.toLowerCase().startsWith(longPath[0].toLowerCase())) _newpath = longPath[0] + baseUrl;
    }
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
function InitReactWebSocket(app, basePath, port) {
  const b = new ws(`ws://localhost:${port}/sockjs-node`, {});
  const wss = new ws.Server({ server: app, path: '/sockjs-node' });
  b.on('error', console.error);
  wss.on('error', console.error);

  app.use(async (req, res, next) => {

    if (req.url === "/sockjs-node") {

      wss.handleUpgrade(req, req.socket, req.headers, async (ws) => {
        ws.on('error', console.error);
        b.emit(ws);
        b.emit(ws);
        ws.on('message', (message) => {
          b.send(message);
        });
        b.on('message', (message) => {
          var msg = message.toJSON();
          var result = {};
          var decoded = Buffer.from(msg, { encoding: 'utf-8' });

          ws.send(decoded.toString("utf-8"));
        });
      });


      return;

    }
    next();
  });
}



function InitDevelopmentServer(app, basePath, port) {

  try {
    InitReactWebSocket(app, basePath, port);
  } catch (e) {
    console.error(e);
  }

  app.use("*", async (req, res, next) => {
    var _newpath = req.baseUrl.toString().replace(/\/\//g, "/");
    const referer = req.headers.referer;
    var longPath = [];
    basePath = basePath.replace(/\/\//g, "/");

    if (basePath.startsWith("/")) {
      basePath = basePath.substr(1);
    }
    if (_newpath.startsWith("/")) {
      _newpath = _newpath.substr(1);
    }

    if (referer && referer.length > 0) {
      var pathname = new URL(referer).pathname;
      try {
        longPath = registeredBasePaths.filter(bp => pathname.toLowerCase().startsWith(bp[0].toLowerCase())).sort((a, b) => a[0].length - b[0].length).reverse()[0];
        basePath = longPath[0];
        port = longPath[1];
        if (basePath.startsWith("/")) {
          basePath = basePath.substr(1);
        }

        if (!_newpath.toLowerCase().startsWith(basePath.toLowerCase())) {
          //     _newpath = basePath + _newpath;
        }

      } catch (err) {
        console.error(err);
      }
    }

    if ((!referer || longPath.length === 0) && !_newpath.toLowerCase().startsWith(basePath.toLowerCase())) {
      next();
      return;
    }

    if (_newpath.startsWith("/")) {
      _newpath = _newpath.substr(1);
    }
    var isIndex = false;
    if (_newpath.trim().length === 0) {
      isIndex = true;
    }

    if (_newpath.indexOf(".") === -1) {
      isIndex = true;
    }
    if (!_newpath.startsWith("/")) _newpath = "/" + _newpath;
    if (!isIndex) {
      if (_newpath.startsWith("/" + basePath)) {
        _newpath = _newpath.substr(basePath.length + 1);
      }
    }
    if (isIndex) {
      _newpath = "/" + basePath;
    }
    if (!_newpath.startsWith("/")) _newpath = "/" + _newpath;

    var _res = await fetch("http://localhost:" + port.toString() + _newpath, {
      method: req.method,
      headers: { ...req.headers, referer: null, host: null },
    }).catch(console.error);
    if (_res) {
      for (var h of _res.headers.keys()) {
        var v = _res.headers.get(h);
        if (h != "content-encoding") res.setHeader(h, v);
      }
      if (isIndex) {
        var indexSource = await _res.text().catch(console.error);
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.status(200);
        res.send(rebuildHTMLIndex(indexSource, ("/" + basePath).replace(/\/\//g, "/"), rMatchFileJS));
      }
      else {
        var _resbody = _res.body;
        res.status(_res.status);
        _resbody.pipe(res);
      }
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
  registeredBasePaths.push([basePath, port]);
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
