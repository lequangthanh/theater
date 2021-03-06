(function () {
    const request = require("request");

    function KodiController(port, options) {
        this.port = port;
        this.positionCache = {};
        this.trackCurrentPosition();
    }

    KodiController.prototype.getBaseURL = function () {
        return "http://127.0.0.1:" + this.port + "/jsonrpc?request=";
    };
    KodiController.prototype._get = function (object) {
        var thiz = this;
        return new Promise(function (resolve, reject) {
            var url = thiz.getBaseURL() + encodeURIComponent(JSON.stringify(object));
            request(url, function (error, response, body) {
                if (!response || response.statusCode != 200) {
                    reject(new Error("Invalid Kodi response"));
                    return;
                }

                var object = JSON.parse(body);
                if (object && object.method == "Player.Seek") {
                    console.log("RESPONSE: " + object.method, object);
                }
                resolve(object);
            });
        });
    };
    KodiController.prototype.play = function (url, options) {
        this.pendingSeek = null;
        this.currentContentId = options ? options.id : null;

        var thiz = this;

        return new Promise(function (resolve, reject) {
            thiz._get({
                jsonrpc: "2.0",
                id: "1",
                method: "Player.Open",
                params: {
                    item: {
                        file: url
                    }
                }
            }).then(function (result) {
                console.log("playing result", result);

                var cache = thiz.positionCache[thiz.currentContentId];
                // if (!cache) {
                //     cache = {
                //         completed: 0.1,
                //         time: {
                //             hours: 0, minutes: 1, seconds: 25
                //         }
                //     };
                // }

                if (cache && cache.completed < 1 && cache.completed > 0 && cache.time) {
                    console.log("Setting pending seek", cache);
                    thiz.pendingSeek = cache;
                }
                resolve(result);

            }).catch(reject);
        });
    };

    KodiController.prototype.doOnFirstVideoPlayer = function (worker, failed) {
        this._get({
            jsonrpc: "2.0",
            id: "1",
            method: "Player.GetActivePlayers"
        }).then(function (response) {
            var players = response.result;
            var videoPlayer = null;
            for (var player of players) {
                if (player.type == "video") {
                    videoPlayer = player;
                    break;
                }
            }

            worker(videoPlayer);
        }).catch(failed ? failed : function () {});
    };
    KodiController.prototype.stop = function () {
        this.pendingSeek = null;
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
                    thiz.currentContentId = null;
                    resolve();
                }
            }).catch(reject);
        });
    };
    KodiController.prototype.showNotification = function (title, message) {
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
    KodiController.POSITION_TRACK_INTERVAL = 1000;

    KodiController.prototype.trackCurrentPosition = function () {
        var thiz = this;
        if (!thiz.currentContentId) {
            setTimeout(function () {
                thiz.trackCurrentPosition();
            }, KodiController.POSITION_TRACK_INTERVAL);

            return;
        }
        thiz._get({
            jsonrpc: "2.0",
            id: "1",
            method: "Player.GetActivePlayers"
        }).then(function (response) {
            var players = response.result;
            var player = null;
            if (players.length > 0) {
                thiz._get({
                    jsonrpc: "2.0",
                    id: "1",
                    method: "Player.GetProperties",
                    params: {
                        playerid: players[0].playerid,
                        properties: [
                            "position",
                            "time",
                            "totaltime"
                        ]
                    }
                }).then(function (response) {
                    if (response && response.result && response.result.time) {
                        if (thiz.pendingSeek) {
                            console.log("Contains pending seek, seek now", thiz.pendingSeek);

                            var seconds = thiz.kodiTimeToSeconds(thiz.pendingSeek.time);
                            seconds = Math.max(0, seconds - 3);
                            var time = thiz.kodiTimeFromSeconds(seconds);
                            
                            var seekCommand = {
                                jsonrpc: "2.0",
                                id: "1",
                                method: "Player.Seek",
                                params: {
                                    playerid: players[0].playerid,
                                    value: time
                                }
                            };
                            console.log("seeking now", seekCommand);

                            thiz._get(seekCommand).then(function (result) {
                                console.log("SEEK result: ", result);
                            });

                            thiz.pendingSeek = null;
                        }
                        thiz.saveTrackedPosition(response.result);
                    }

                    setTimeout(function () {
                        thiz.trackCurrentPosition();
                    }, KodiController.POSITION_TRACK_INTERVAL);
                });
            } else {
                setTimeout(function () {
                    thiz.trackCurrentPosition();
                }, KodiController.POSITION_TRACK_INTERVAL);
            }
        })
    };

    KodiController.prototype.kodiTimeToSeconds = function (time) {
        return (time.hours * 60 + time.minutes) * 60 + time.seconds;
    }
    KodiController.prototype.kodiTimeFromSeconds = function (seconds) {
        seconds = Math.round(seconds);
        var time = {};
        time.seconds = seconds % 60;

        seconds = Math.floor((seconds - time.seconds) / 60);
        time.minutes = seconds % 60;

        time.hours = Math.floor((seconds - time.minutes) / 60);

        return time;
    }
    KodiController.prototype.saveTrackedPosition = function (result) {
        var cache = {
            time: result.time,
            length: result.totaltime,
            timeInSeconds: this.kodiTimeToSeconds(result.time),
            lengthInSeconds: this.kodiTimeToSeconds(result.totaltime),
        };

        cache.completed = cache.lengthInSeconds > 0 ? (cache.timeInSeconds / cache.lengthInSeconds) : 0;

        this.positionCache[this.currentContentId] = cache;
    }



    module.exports = KodiController;
})();


//http://127.0.0.1:12001/jsonrpc?request={"jsonrpc":"2.0","id":"1","method":"Player.Open","params":{"item":{"file":"http://clips.vorwaerts-gmbh.de/VfE_html5.mp4"}}}
