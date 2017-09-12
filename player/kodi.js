(function () {
    const request = require("request");

    function VLCController(port, options) {
        this.port = port;
    }

    VLCController.prototype.getBaseURL = function () {
        return "http://127.0.0.1:" + this.port + "/jsonrpc?request=";
    };
    VLCController.prototype._get = function (object) {
        var thiz = this;
        return new Promise(function (resolve, reject) {
            var url = thiz.getBaseURL() + encodeURIComponent(JSON.stringify(object));
            console.log("KODI RPC: " + object.method);
            request(url, function (error, response, body) {
                if (!response || response.statusCode != 200) {
                    reject(new Error("Invalid Kodi response"));
                    return;
                }

                var object = JSON.parse(body);
                console.log("KODI RESPONSE", object);
                resolve(object);
            });
        });
    };
    VLCController.prototype.play = function (url) {
        return this._get({
            jsonrpc: "2.0",
            id: "1",
            method: "Player.Open",
            params: {
                item: {
                    file: url
                }
            }
        });
    };
    VLCController.prototype.stop = function () {
        var thiz = this;
        return new Promise(function (resolve, reject) {
            thiz._get({
                jsonrpc: "2.0",
                id: "1",
                method: "Player.GetActivePlayers"
            }).then(function (response) {
                var players = response.result;
                var pending = [];
                for (var player of players) {
                    pending.push(thiz._get({
                        jsonrpc: "2.0",
                        id: "1",
                        method: "Player.Stop",
                        params: {
                            playerid: player.playerid
                        }
                    }));
                }
                if (pending.length > 0) {
                    Promise.all(pending).then(function () {
                        setTimeout(resolve, 2000);
                    }).catch(reject);
                } else {
                    resolve();
                }
            }).catch(reject);
        });
    };
    VLCController.prototype.showNotification = function (title, message) {
        return this._get({
            jsonrpc: "2.0",
            id: "1",
            method: "GUI.ShowNotification",
            params: {
                title: title || "Theater",
                message: message
            }
        });
    };


    module.exports = VLCController;
})();


//http://127.0.0.1:12001/jsonrpc?request={"jsonrpc":"2.0","id":"1","method":"Player.Open","params":{"item":{"file":"http://clips.vorwaerts-gmbh.de/VfE_html5.mp4"}}}
