
export class PermissionHandler {
 
  constructor(browserDetector) {
    this.browserDetector = browserDetector;
  }

  canHavePermissions(url) {
    if (url.indexOf('about:') === 0 || url.indexOf('edge:') === 0) {
      return false;
    }
    return true;
  }

  async checkPermissions(url) {
    return await this.sendMessage('permissionsContains', url);
  }

  async requestPermission(url) {
    return await this.sendMessage('permissionsRequest', url);
  }

  sendMessage(type, params) {
    const self = this;
    if (this.browserDetector.supportsPromises()) {
      return this.browserDetector
        .getApi()
        .runtime.sendMessage({ type: type, params: params });
    } else {
      return new Promise(function (resolve) {
        self.browserDetector
          .getApi()
          .runtime.sendMessage({ type: type, params: params }, resolve);
      });
    }
  }
}
