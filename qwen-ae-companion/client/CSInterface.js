/**
 * CSInterface - Biblioteca Adobe CEP
 * Versão mínima necessária para comunicação entre HTML/JS e ExtendScript
 */

function CSInterface() {}

CSInterface.prototype.evalScript = function(script, callback) {
    if (callback === null || callback === undefined) {
        callback = function() {};
    }
    try {
        window.__adobe_cep__.evalScript(script, callback);
    } catch (e) {
        callback("Error: " + e.toString());
    }
};

CSInterface.prototype.getSystemPath = function(pathType) {
    var path = "";
    var context = this;
    this.evalScript('$.getSystemPath("' + pathType + '")', function(result) {
        path = result;
    });
    return path;
};

CSInterface.prototype.openURLInDefaultBrowser = function(url) {
    cep.util.openURLInDefaultBrowser(url);
};

CSInterface.prototype.getExtensionID = function() {
    return window.__adobe_cep__.getExtensionId();
};

CSInterface.prototype.getHostEnvironment = function() {
    var hostEnv = null;
    var context = this;
    this.evalScript('JSON.stringify(CSEvent)', function(result) {
        hostEnv = result;
    });
    return hostEnv;
};

CSInterface.prototype.closeExtension = function() {
    window.__adobe_cep__.closeExtension();
};

CSInterface.prototype.dispatchEvent = function(event) {
    if (typeof event.data === "object") {
        event.data = JSON.stringify(event.data);
    }
    window.__adobe_cep__.dispatchEvent(event);
};

CSInterface.prototype.addEventListener = function(type, listener, obj) {
    window.__adobe_cep__.addEventListener(type, listener, obj);
};

CSInterface.prototype.removeEventListener = function(type, listener) {
    window.__adobe_cep__.removeEventListener(type, listener);
};