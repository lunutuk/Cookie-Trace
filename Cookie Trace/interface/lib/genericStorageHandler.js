import { EventEmitter } from './eventEmitter.js';


export class GenericStorageHandler extends EventEmitter {
  
  constructor(browserDetector) {
    super();
    this.browserDetector = browserDetector;
  }

 
  async getLocal(key) {
    const self = this;
    let promise;
    if (this.browserDetector.supportsPromises()) {
      promise = this.browserDetector.getApi().storage.local.get([key]);
    } else {
      promise = new Promise((resolve, reject) => {
        self.browserDetector.getApi().storage.local.get([key], (data) => {
          const error = self.browserDetector.getApi().runtime.lastError;
          if (error) {
            reject(error);
          }
          resolve(data ?? null);
        });
      });
    }

    return promise.then((data) => {
      return data[key] ?? null;
    });
  }

 
  async setLocal(key, data) {
    const self = this;
    const dataObj = {};
    dataObj[key] = data;

    if (this.browserDetector.supportsPromises()) {
      return this.browserDetector.getApi().storage.local.set(dataObj);
    } else {
      return new Promise((resolve, reject) => {
        this.browserDetector.getApi().storage.local.set(dataObj, () => {
          const error = self.browserDetector.getApi().runtime.lastError;
          if (error) {
            reject(error);
          }
          resolve();
        });
      });
    }
  }
}
