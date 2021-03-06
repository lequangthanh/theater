(function () {

    const {State} = require("../common.js");
    const BaseService = require("../base-service.js");
    const {spawn} = require("child_process");
    const SopcastConverter = require("./sopcast-converter.js");

    function SopcastService() {
        this.type = SopcastService.TYPE;
        this.name = "Sopcast";
        this.converter = null;
        this.sources = [
            require("./source-sopsport_org.js")
        ];
    }

    SopcastService.TYPE = "sopcast";

    SopcastService.prototype = new BaseService();

    SopcastService.prototype.findAvailableContents = function (options) {
        var promises = [];
        var contents = [];
        for (var source of this.sources) {
            var promise = source.find().then(function(items) {
                contents = contents.concat(items);
            });
            promises.push(promise);
        }

        var thiz = this;

        return new Promise(function (resolve, reject) {
            Promise.all(promises).then(function () {
                try {
                    //TODO: implement this in a way that use can manage custom sopcast link via the web ui

                    var extra = require("fs").readFileSync("/home/pi/soplinks", {encoding: "utf8"});
                    if (extra) {
                        var links = extra.split(/[\r\n]+/);
                        for (var link of links) {
                            contents.push({
                                title: "Custom link",
                                contentType: "video",
                                duration: null,
                                description: link,
                                thumbnails: [],
                                url: [link],
                                extras: {}
                            });
                        }
                    }
                } catch (e) {
                    console.error(e);
                }

                if (contents.length == 0) {
                    contents.push({
                        title: "CBNS TV",
                        contentType: "video",
                        duration: null,
                        description: "CBNS TV Free streaming Classic and new Sci-Fi movies all day",
                        thumbnails: ["https://pbs.twimg.com/profile_images/670291739207458816/E8EMpfY1.jpg"],
                        url: ["sop://178.239.62.116:3912/140335"],
                        extras: {}
                    });
                }

                thiz.cache = {};

                for (var content of contents) {
                    content.type = SopcastService.TYPE;
                    thiz.cache[content.url] = content;
                }

                resolve(contents);
            }).catch(function (e) {
                reject(e);
            });
        });
    };

    SopcastService.prototype.createConverter = function (content) {
        return new SopcastConverter();
    };

    SopcastService.prototype.isLiveContent = function (content) {
        return true;
    };

    module.exports = new SopcastService();
})();
