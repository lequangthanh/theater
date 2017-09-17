(function () {
    const {spawn, exec} = require("child_process");
    const {NodeCec, CEC} = require( "node-cec" );

    function OMXController() {
        this.stopRequest = true;
        this.setupCEC();
    }

    OMXController.prototype.play = function (url, options) {
        var thiz = this;
        this.args = {
            url: url,
            options: options
        };

        return new Promise(function (resolve, reject) {
            thiz.stop().then(function () {
                var cmd = "omxplayer -o hdmi --blank ";
                if ((options && options.live) || url.indexOf("tv.asf")) cmd += "--live ";
                cmd += url;
                cmd += " > ~/omxplayer.log 2>&1";

                thiz.stopRequested = false;
                thiz.process = exec(cmd, function (error, stdout, stderr) {
                });

                resolve();

                thiz.process.on("exit", function () {
                    console.log("OMXPlayer exit, stopRequested = " + thiz.stopRequested);
                    if (!thiz.stopRequested) {
                        console.log("  > Restart playback automatically...");
                        thiz.play(thiz.args.url, thiz.args.opions);
                    }
                })
            });
        });
    };
    OMXController.prototype.stop = function () {
        var thiz = this;
        this.stopRequested = true;
        if (this.process) this.process.removeAllListeners();
        return new Promise(function (resolve, reject) {
            exec("killall omxplayer.bin", function (error, stdout, stderr) {
                resolve();
            });
        });
    };
    OMXController.prototype.showNotification = function (title, message) {
        return new Promise(function (resolve, reject) {
            resolve();
            // exec("notify-send", function (error, stdout, stderr) {
            //     resolve();
            // });
        });
    };

    OMXController.prototype.setupCEC = function () {
        this.cec = new NodeCec("node-cec-monitor");
        process.on("SIGINT", function() {
            if (this.cec != null) {
                this.cec.stop();
            }
            process.exit(0);
        });

        this.cec.on("PLAY", function () {
            console.log("CEC: PLAY");
        });
        this.cec.on("PAUSE", function () {
            console.log("CEC: PAUSE");
        });
        this.cec.on("STOP", function () {
            console.log("CEC: STOP");
        });

        this.cec.start("cec-client");
        console.log("CEC started.");
    };


    module.exports = OMXController;
})();


//http://127.0.0.1:12001/jsonrpc?request={"jsonrpc":"2.0","id":"1","method":"Player.Open","params":{"item":{"file":"http://clips.vorwaerts-gmbh.de/VfE_html5.mp4"}}}
