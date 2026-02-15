import { Browsers } from './browsers.js';
import { Env } from './env.js';


export class BrowserDetector {
  
  constructor() {
    
    this.namespace = chrome || window.browser || window.chrome;
    this.supportPromises = false;
    this.supportSidePanel = false;

    try {
      this.supportPromises =
        this.namespace.runtime.getPlatformInfo() instanceof Promise;
      console.info('Promises support: ', this.supportPromises);
    } catch (e) {
      
    }

    try {
      this.supportSidePanel = typeof this.getApi().sidePanel !== 'undefined';
      console.info('SidePanel support: ', this.supportSidePanel);
    } catch (e) {
      
    }

    if (Env.browserName === '@@browser_name') {
      Env.browserName = Browsers.Chrome;
      
    }

    
  }

  
  getApi() {
    return this.namespace;
  }

  
  isFirefox() {
    return Env.browserName === Browsers.Firefox;
  }

  
  isChrome() {
    return Env.browserName === Browsers.Chrome;
  }

  
  isEdge() {
    return Env.browserName === Browsers.Edge;
  }

  
  isSafari() {
    return Env.browserName === Browsers.Safari;
  }

  
  supportsPromises() {
    return this.supportPromises;
  }

  
  supportsSidePanel() {
    return this.supportSidePanel;
  }

  
  getBrowserName() {
    return Env.browserName;
  }
}
