import { GenericCookieHandler } from '../lib/genericCookieHandler.js';


export class CookieHandlerPopup extends GenericCookieHandler {
  
  constructor(browserDetector) {
    super(browserDetector);
    
    this.isReady = false;
    this.currentTabId = null;

    if (this.browserDetector.supportsPromises()) {
      this.browserDetector
        .getApi()
        .tabs.query({ active: true, currentWindow: true })
        .then(this.init);
    } else {
      this.browserDetector
        .getApi()
        .tabs.query({ active: true, currentWindow: true }, this.init);
    }
  }

 
  init = (tabInfo) => {
    this.currentTabId = tabInfo[0].id;
    this.currentTab = tabInfo[0];
    const api = this.browserDetector.getApi();
    api.tabs.onUpdated.addListener(this.onTabsChanged);
    api.tabs.onActivated.addListener(this.onTabActivated);
    if (!this.browserDetector.isSafari()) {
      api.cookies.onChanged.addListener(this.onCookiesChanged);
    }

    this.emit('ready');
    this.isReady = true;
  };

  
  onCookiesChanged = (changeInfo) => {
    const domain = changeInfo.cookie.domain.substring(1);
    if (
      this.currentTab.url.indexOf(domain) !== -1 &&
      changeInfo.cookie.storeId === (this.currentTab.cookieStoreId || '0')
    ) {
      this.emit('cookiesChanged', changeInfo);
    }
  };

  
  onTabsChanged = (tabId, changeInfo, _tab) => {
    if (
      tabId === this.currentTabId &&
      (changeInfo.url || changeInfo.status === 'complete')
    ) {
      
      if (this.browserDetector.supportsPromises()) {
        this.browserDetector
          .getApi()
          .tabs.query({ active: true, currentWindow: true })
          .then(this.updateCurrentTab);
      } else {
        this.browserDetector
          .getApi()
          .tabs.query(
            { active: true, currentWindow: true },
            this.updateCurrentTab,
          );
      }
    }
  };

  
  onTabActivated = (activeInfo) => {
    if (this.browserDetector.supportsPromises()) {
      this.browserDetector
        .getApi()
        .tabs.query({ active: true, currentWindow: true })
        .then(this.updateCurrentTab);
    } else {
      this.browserDetector
        .getApi()
        .tabs.query(
          { active: true, currentWindow: true },
          this.updateCurrentTab,
        );
    }
  };

  
  updateCurrentTab = (tabInfo) => {
    const newTab =
      tabInfo[0].id !== this.currentTabId ||
      tabInfo[0].url !== this.currentTab.url;
    this.currentTabId = tabInfo[0].id;
    this.currentTab = tabInfo[0];

    if (newTab && this.isReady) {
      this.emit('cookiesChanged');
    }
  };
}
