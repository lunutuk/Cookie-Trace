import { GenericCookieHandler } from '../lib/genericCookieHandler.js';


export class CookieHandlerDevtools extends GenericCookieHandler {
  
  constructor(browserDetector) {
    super(browserDetector);
    this.isReady = false;
    
    this.backgroundPageConnection = this.browserDetector
      .getApi()
      .runtime.connect({ name: 'panel' });
    this.updateCurrentTab(this.init);
  }

  init = () => {
    
    this.backgroundPageConnection.onMessage.addListener(this.onMessage);
    this.backgroundPageConnection.postMessage({
      type: 'init_cookieHandler',
      tabId: this.browserDetector.getApi().devtools.inspectedWindow.tabId,
    });

    
    this.emit('ready');
    this.isReady = true;
  };

  getAllCookies(callback) {
    this.sendMessage(
      'getAllCookies',
      {
        url: this.currentTab.url,
        storeId: this.currentTab.cookieStoreId,
      },
      callback,
    );
  }

  saveCookie(cookie, url, callback) {
    this.sendMessage(
      'saveCookie',
      { cookie: this.prepareCookie(cookie, url) },
      callback,
    );
  }

  removeCookie(name, url, callback) {
    this.sendMessage(
      'removeCookie',
      {
        name: name,
        url: url,
        storeId: this.currentTab.cookieStoreId,
      },
      callback,
    );
  }

  onMessage = (request) => {
    
    switch (request.type) {
      case 'cookiesChanged':
        this.onCookiesChanged(request.data);
        return;

      case 'tabsChanged':
        this.onTabsChanged(request.data);
        return;
    }
  };

  onCookiesChanged = (changeInfo) => {
    const domain = changeInfo.cookie.domain.substring(1);
    if (this.currentTab.url.indexOf(domain) !== -1) {
      this.emit('cookiesChanged', changeInfo);
    }
  };

  onTabsChanged = (changeInfo) => {
    
    if (changeInfo.url || changeInfo.status === 'complete') {
      
      this.updateCurrentTab();
    }
  };

  updateCurrentTab = (callback) => {
    const self = this;
    this.sendMessage(
      'getCurrentTab',
      null,
      function (tabInfo) {
        const newTab =
          tabInfo[0].id !== self.currentTabId ||
          tabInfo[0].url !== self.currentTab.url;
        self.currentTabId = tabInfo[0].id;
        self.currentTab = tabInfo[0];
        if (newTab && self.isReady) {
          self.emit('cookiesChanged');
        }
        if (callback) {
          callback();
        }
      },
      function (e) {
        
      },
    );
  };

  sendMessage(type, params, callback, errorCallback) {
    if (this.browserDetector.supportsPromises()) {
      this.browserDetector
        .getApi()
        .runtime.sendMessage({ type: type, params: params })
        .then(callback, errorCallback);
    } else {
      this.browserDetector
        .getApi()
        .runtime.sendMessage({ type: type, params: params }, callback);
    }
  }
}
