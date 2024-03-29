"use strict";
const fs = require('fs');
const b32 = require('hi-base32');
const crypto = require("hypercore-crypto");
const express = require("express");
const net = require("net");
const pump = require("pump");
const DHT = require("hyperdht");
const node = new DHT({});
const { announce } = require('hyper-ipc-secure')();

require('dotenv').config()

module.exports = () => {
  const announces = [];
  const hyperconfig = JSON.parse(fs.readFileSync('../hyperconfig.json'));
  //console.log(hyperconfig);
  const keyPair = crypto.keyPair();


  const app = express()
  const { createProxyMiddleware } = require('http-proxy-middleware');

  const router = JSON.parse(fs.readFileSync('../routerconfig.json'));
  const config = JSON.parse(fs.readFileSync('./site/config.json'));
  let changed;
  for (let site of Object.keys(router)) {
    //console.log(site, config.sites, config.sites.filter(a => a.subject === site).length);
    if (!config.sites.filter(a => a.subject === site).length) {
      config.sites.push({ subject: site });
      changed = true;
    }
  }
  if (changed) fs.writeFileSync('./site/config.json', JSON.stringify(config));
  const proxy = createProxyMiddleware({
    router,
    changeOrigin: false,
    secure: false,
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader('X-Forwarded-Host', req.hostname);
      proxyReq.setHeader('X-Forwarded-Proto', 'https'); 
    },
    onProxyRes: (proxyRes, req, res) => {
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //proxyRes.headers['Cross-Origin-Resource-Policy'] = 'cross-site';
      //proxyRes.headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      //proxyRes.headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    },
    ws: true
  });
  app.use('/', proxy);
  require("greenlock-express")
    .init({
      packageRoot: __dirname,
      configDir: "./site/",
      maintainerEmail: "jon@example.com",
      cluster: false
    }).ready(httpsWorker);
  async function httpsWorker(glx) {
    let https = 0;
    let http = 0;
    let port = 80;
    let sslport = 443;
    const done = async () => {
      await node.ready();
      for (let conf of hyperconfig) {
        console.log("ANNOUNCING", conf)
        announce('hyperbolic' + conf, keyPair);
        const b32pub = b32.encode(keyPair.publicKey).replace('====', '').toLowerCase();
        const server = node.createServer();
        server.on("connection", function (incoming) {
          incoming.once("data", function (data) {
            let outgoing;
            if (data == 'dns') {
              incoming.write(JSON.stringify({host:node.host}));
              incoming.end();
            } else {
              if (data == 'http') {
                outgoing = net.connect(http, '127.0.0.1');
              }
              if (data == 'https') {
                outgoing = net.connect(https, '127.0.0.1');
              }
              pump(incoming, outgoing, incoming);
            }
          });
        });
        server.listen(keyPair);
        console.log('listening', b32pub);
        console.log('listening on https ' + https);
        console.log('listening on http ' + http);
      }
    }
    while (!https) {
      try {
        console.log('starting https', sslport);
        await (new Promise((res) => {
          glx.httpsServer(null, app).listen(sslport, "0.0.0.0", function () {
            https = sslport;
            if (http && https) {
              console.log("HTTP AND HTTP STARTED")
              done();
              
            }
            res();
          });
        }))
      } catch (e) {
        sslport = 10240 + parseInt(Math.random() * 10240);
        console.error(e);
      }
      await new Promise(res => { setTimeout(res, 1000) });
    }
    while (!http) {
      try {
        console.log('starting http', port);
        await (new Promise((res) => {
          glx.httpServer().listen(port, "0.0.0.0", function () {
            http = port;
            if (http && https) done();
            res();
          });
        }))
      } catch (e) {
        port = 10240 + parseInt(Math.random() * 10240);
        console.error(e);
      }
      await new Promise(res => { setTimeout(res, 1000) });
    }
  }
 
}

