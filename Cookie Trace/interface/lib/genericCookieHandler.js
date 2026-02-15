import { EventEmitter } from './eventEmitter.js';


export class GenericCookieHandler extends EventEmitter {
  
  constructor(browserDetector) {
    super();
    this.cookies = [];
    this.currentTab = null;
    this.browserDetector = browserDetector;
  }

  
  getAllCookies(callback) {
    if (this.browserDetector.supportsPromises()) {
      this.browserDetector
        .getApi()
        .cookies.getAll({
          url: this.currentTab.url,
          storeId: this.currentTab.cookieStoreId,
        })
        .then(callback, function (e) {
          
        });
    } else {
      this.browserDetector.getApi().cookies.getAll(
        {
          url: this.currentTab.url,
          storeId: this.currentTab.cookieStoreId,
        },
        callback,
      );
    }
  }

 
  prepareCookie(cookie, url) {
    const newCookie = {
      domain: cookie.domain || '',
      name: cookie.name || '',
      value: cookie.value || '',
      path: cookie.path || null,
      secure: cookie.secure || null,
      httpOnly: cookie.httpOnly || null,
      expirationDate: cookie.expirationDate || null,
      storeId: cookie.storeId || this.currentTab.cookieStoreId || null,
      url: url,
    };

   
    if (this.browserDetector.isSafari() && newCookie.domain) {
      newCookie.url = 'http://' + newCookie.domain;
    }
    if (this.browserDetector.isSafari() && !newCookie.path) {
      newCookie.path = '/';
    }

    if (
      cookie.hostOnly ||
      (this.browserDetector.isSafari() && !newCookie.domain)
    ) {
      newCookie.domain = null;
    }

    if (!this.browserDetector.isSafari()) {
      newCookie.sameSite = cookie.sameSite || undefined;

      if (newCookie.sameSite == 'no_restriction') {
        newCookie.secure = true;
      }
    }

    return newCookie;
  }

  
  saveCookie(cookie, url, callback) {
    cookie = this.prepareCookie(cookie, url);
    if (this.browserDetector.supportsPromises()) {
      this.browserDetector
        .getApi()
        .cookies.set(cookie)
        .then(
          (cookie, a, b, c) => {
            if (callback) {
              callback(null, cookie);
            }
          },
          (error) => {
            
            if (callback) {
              callback(error.message, null);
            }
          },
        );
    } else {
      this.browserDetector.getApi().cookies.set(cookie, (cookieResponse) => {
        const error = this.browserDetector.getApi().runtime.lastError;
        if (!cookieResponse || error) {
          
          if (callback) {
            const errorMessage =
              (error ? error.message : '') || 'Unknown error';
            return callback(errorMessage, cookieResponse);
          }
          return;
        }

        if (callback) {
          return callback(null, cookieResponse);
        }
      });
    }
  }

  
  removeCookie(name, url, callback, isRecursive = false) {
    
    if (this.browserDetector.isSafari() && !isRecursive) {
      this.getAllCookies((cookies) => {
        for (const cookie of cookies) {
          if (cookie.name === name) {
            this.removeCookie(name, 'http://' + cookie.domain, callback, true);
          }
        }
      });
    } else if (this.browserDetector.supportsPromises()) {
      this.browserDetector
        .getApi()
        .cookies.remove({
          name: name,
          url: url,
          storeId: this.currentTab.cookieStoreId,
        })
        .then(callback, function (e) {
          
          if (callback) {
            callback();
          }
        });
    } else {
      this.browserDetector.getApi().cookies.remove(
        {
          name: name,
          url: url,
          storeId: this.currentTab.cookieStoreId,
        },
        (cookieResponse) => {
          const error = this.browserDetector.getApi().runtime.lastError;
          if (!cookieResponse || error) {
            
            if (callback) {
              const errorMessage =
                (error ? error.message : '') || 'Unknown error';
              return callback(errorMessage, cookieResponse);
            }
            return;
          }

          if (callback) {
            return callback(null, cookieResponse);
          }
        },
      );
    }
  }

  
  getAllCookiesInBrowser(callback) {
    if (this.browserDetector.supportsPromises()) {
      this.browserDetector
        .getApi()
        .cookies.getAll({})
        .then(callback, function (e) {
          
        });
    } else {
      this.browserDetector.getApi().cookies.getAll({}, callback);
    }
  }
}
