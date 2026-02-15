import { BrowserDetector } from '../lib/browserDetector.js';
import { GenericStorageHandler } from '../lib/genericStorageHandler.js';
import { OptionsHandler } from '../lib/optionsHandler.js';

(async function () {
  const browserDetector = new BrowserDetector();
  const storageHandler = new GenericStorageHandler(browserDetector);
  const optionHandler = new OptionsHandler(browserDetector, storageHandler);

  await optionHandler.loadOptions();
  optionHandler.on('optionsChanged', onOptionsChanged);
  handleDevtools();
  
  function createDevtools() {
    browserDetector
      .getApi()
      .devtools.panels.create(
        'Cookie Trace',
        '/icons/cookie-filled-small.svg',
        '/interface/devtools/cookie-list.html',
        function (panel) {},
      );
  }

  function handleDevtools() {
    
    if (optionHandler.getDevtoolsEnabled()) {
      createDevtools();
    }
  }

  function onOptionsChanged(oldOptions) {
    if (oldOptions.devtoolsEnabled != optionHandler.getDevtoolsEnabled()) {
      handleDevtools();
    }
  }
})();
