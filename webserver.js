(function () {
    const express = require("express");
    const path = require("path");
    const serviceManager = require("./services/service-manager.js");
    const common = require("./services/common.js");
    const addWSSupport = require("express-ws");

    var server = null;
    var wsServer = null;
    var player = null;
    var statusWSEnpoint = null;
    var exportedServer = {
        start: start,
        setPlayer: setPlayer,
        lanIP: null
    }
    function start() {
        server = express();
        wsServer = addWSSupport(server);

        server.use("/static", express.static(path.join(__dirname, "ui/static")));

        server.get("/api/services", function (request, response) {
            var services = serviceManager.getServices();
            var items = [];
            for (var service of services) {
                items.push({
                    type: service.type,
                    name: service.name
                })
            }
            response.json(items);
        });

        server.get("/api/contents", function (request, response) {
            var service = serviceManager.getService(request.query.service);
            var refresh = request.query.refresh == "true";
            var quality = request.query.quality || "";
            var genre = request.query.genre || "";
            var sortBy = request.query.sortBy || "";
            var order = request.query.order || "";
            var page = request.query.page || "";
            var limit = request.query.limit || "10";
            var source = request.query.source || "";
            service.getContents(
              {
                forceRefresh: refresh,
                term: request.query.term,
                quality: quality,
                genre: genre,
                sortBy:  sortBy,
                order: order,
                limit: limit,
                page: page,
                source: source
              }).then(function (contents) {
                //console.log("Content returned for ", service.type, contents);
                response.json(contents);
            }).catch(function (e) {
                console.error(e);
                response.status(500).send(e);
            });
        });

        server.get("/api/search/options", function (request, response) {
            var service = serviceManager.getService(request.query.service);
            var options = service ? service.getSearchFilterOptions() : {};
            response.json(options);
        });
        server.get("/api/fetch/playback", function (request, response) {
            var service = serviceManager.getService(request.query.service);
            var info = service.fetchPlaybackInfo({url: request.query.url});
            if (info && info.playableLinks && info.playableLinks.length) {

                info.playableLinks.sort(function(a, b) {
                    var q1 = a.quality ? parseInt(a.quality.replace("p", ""), 10) : 0;
                    var q2 = b.quality ? parseInt(b.quality.replace("p", ""), 10) : 0;
                    return q2 - q1;
                });
            }
            response.json(info);
        });

        server.get("/api/play", function (request, response) {
            var selectedUrl = request.query.selectedUrl ? request.query.selectedUrl : null;
            serviceManager.play(request.query.service, request.query.url, selectedUrl).then(function () {
                response.json({message: "OK"})
            }).catch (function () {
                console.error(e);
                response.status(500).send(e);
            });
        });
        server.get("/api/replay", function (request, response) {
            serviceManager.resendPlayback().then(function () {
                response.json({message: "OK"})
            }).catch (function () {
                console.error(e);
                response.status(500).send(e);
            });
        });
        server.get("/api/stop", function (request, response) {
            serviceManager.stop().then(function () {
                response.json({message: "OK"})
            }).catch (function () {
                console.error(e);
                response.status(500).send(e);
            });
        });
        server.get("/api/status", function (request, response) {
            response.json(serviceManager.getCurrentStatus());
        });


        //Web-socket interface:

        server.ws("/status", function(ws, request) {
            ws.on("message", function(msg) {
                if (msg === "get") ws.send(JSON.stringify(serviceManager.getCurrentStatus()));
            });
        });

        //actively provide status as soon as a client is connected
        wsServer.getWss().on("connection", function (ws, request) {
            ws.send(JSON.stringify(serviceManager.getCurrentStatus()));
        });

        //when backend signals a status change, broadcast that to all the connected ws clients
        serviceManager.hub.on("status", function (status) {
            broadcast(status);
        })

        var ip = common.findLANAddress();
        var port = 12002;
        console.log("Listen at: " + ip + ":" + port);
        server.listen(port, ip);
        console.log("Web server started.");

        exportedServer.lanIP = ip;
    }

    function setPlayer(providedPlayer) {
        player = providedPlayer;
    }

    function broadcast(status) {
        if (!wsServer || !wsServer.getWss().clients) return;
        wsServer.getWss().clients.forEach(function (client) {
            if (client.readyState === 1) client.send(JSON.stringify(status));
        });
    }


    module.exports = exportedServer;
})();
