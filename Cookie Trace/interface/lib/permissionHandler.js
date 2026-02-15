
export class PermissionHandler {
  
  constructor(browserDetector) {
    this.browserDetector = browserDetector;
    
    this.impossibleUrls = [
      'about:',
      'moz-extension:',
      'chrome:',
      'chrome-extension:',
      'edge:',
      'safari-web-extension:',
    ];
  }

  
  canHavePermissions(url) {
    if (url === '') {
      return false;
    }
    for (const impossibleUrl of this.impossibleUrls) {
      if (url.indexOf(impossibleUrl) === 0) {
        return false;
      }
    }
    return true;
  }

  
  async checkPermissions(url) {
    const testPermission = {
      origins: [url],
    };
    try {
      const { protocol, hostname } = new URL(url);
      const rootDomain = this.getRootDomainName(hostname);
      testPermission.origins = [
        `${protocol}//${hostname}/*`,
        `${protocol}//*.${rootDomain}/*`,
      ];
    } catch (err) {
      
    }

    
    if (typeof this.browserDetector.getApi().permissions === 'undefined') {
      return true;
    }

    return await this.browserDetector
      .getApi()
      .permissions.contains(testPermission);
  }

  
  async requestPermission(url) {
    const permission = {
      origins: [url],
    };
    try {
      const { protocol, hostname } = new URL(url);
      const rootDomain = this.getRootDomainName(hostname);
      permission.origins = [
        `${protocol}//${hostname}/*`,
        `${protocol}//*.${rootDomain}/*`,
      ];
    } catch (err) {
      
    }
    return this.browserDetector.getApi().permissions.request(permission);
  }

  
  getRootDomainName(domain) {
    const parts = domain.split('.').reverse();
    const cnt = parts.length;
    if (cnt >= 3) {
      if (parts[1].match(/^(com|edu|gov|net|mil|org|nom|co|name|info|biz)$/i)) {
        return parts[2] + '.' + parts[1] + '.' + parts[0];
      }
    }
    return parts[1] + '.' + parts[0];
  }
}
