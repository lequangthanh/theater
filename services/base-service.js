function BaseService() {

}

BaseService.prototype.getContents = function (options) {
    console.log("getContents called on base service", this.type, options);
    if (!options) options = {};
    if (!options.forceRefresh && this.cachedContents) {
        return Promise.resolve(this.cachedContents);
    }
    return this.findAvailableContents(options).then(function (contents) {
        console.log("Caching content for ", this.type, contents.length);
        this.cachedContents = contents;
        return contents;
    }.bind(this));
};

BaseService.prototype.fetchPlaybackInfo = function(options) {
    return {};
}

BaseService.prototype.start = function (content) {
    var thiz = this;

    return new Promise(function (resolve, reject) {
        if (thiz.converter) {
            try {
                thiz.converter.destroy();
            } catch (e) {}
        }
        thiz.converter = thiz.createConverter();
        var url = content.selectedUrl && content.selectedUrl.length > 0 ? content.selectedUrl : content.url;

        thiz.converter.convert(url, {content: content}).then(function (url) {
            resolve({
                url: url,
                subtitlePath: content.subtitlePath,
                live: thiz.isLiveContent(content),
                content: content
            })
        }).catch(function (e) {
            reject(e);
        });
    });
};
BaseService.prototype.terminate = function () {
    if (this.converter) {
        try {
            this.converter.destroy();
        } catch (e) {}
    }
};
BaseService.prototype.isLiveContent = function (content) {
    return false;
};

BaseService.prototype.findCachedContent = function (url) {
    return this.cache ? this.cache[url] : {
        title: url,
        contentType: "video",
        type: this.type,
        duration: null,
        description: "",
        thumbnails: [],
        url: url,
        extras: {}
    };
};

BaseService.prototype.getSearchFilterOptions = function() {
    var s = [];
    for (var source of this.sources) {
        var r = {};
        r.name = source.name;
        r.filterOptions = source.getSearchFilterOptions();
        s.push(r);
    }
    return s;
}

BaseService.prototype.getCurrentStatus = function () {
    return this.converter ? this.converter.status : State.Idle;
};
BaseService.prototype.getBackendStatus = function () {
    return this.converter ? this.converter.getFullStatus() : null;
};

module.exports = BaseService;
