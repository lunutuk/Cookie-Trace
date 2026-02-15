export function setupMessaging(ctx) {
  const connections = {};
  let nextActionSource = 'website';

  ctx.api.runtime.onConnect.addListener(onConnect);
  ctx.api.runtime.onMessage.addListener(handleMessage);

  function onConnect(port) {
    const extensionListener = function (request, port) {
      switch (request.type) {
        case 'init_cookieHandler':
          connections[request.tabId] = port;
          return;
        case 'init_optionsHandler':
          connections[port.name] = port;
          return;
      }
    };

    port.onMessage.addListener(extensionListener);

    port.onDisconnect.addListener(function (port) {
      port.onMessage.removeListener(extensionListener);
      const tabs = Object.keys(connections);
      for (let i = 0; i < tabs.length; i++) {
        if (connections[tabs[i]] === port) {
          delete connections[tabs[i]];
          break;
        }
      }
    });
  }

  function sendMessageToTab(tabId, type, data) {
    if (tabId in connections) {
      connections[tabId].postMessage({ type, data });
    }
  }

  function sendMessageToAllTabs(type, data) {
    const tabs = Object.keys(connections);
    for (let i = 0; i < tabs.length; i++) {
      sendMessageToTab(tabs[i], type, data);
    }
  }

  function handleMessage(request, _sender, sendResponse) {
    switch (request.type) {
      case 'getTabs': {
        ctx.api.tabs.query({}, function (tabs) {
          sendResponse(tabs);
        });
        return true;
      }
      case 'getCurrentTab': {
        ctx.api.tabs.query(
          { active: true, currentWindow: true },
          function (tabInfo) {
            sendResponse(tabInfo);
          },
        );
        return true;
      }
      case 'getAllCookies': {
        const getAllCookiesParams = { url: request.params.url };
        if (ctx.browserDetector.supportsPromises()) {
          ctx.api.cookies.getAll(getAllCookiesParams).then(sendResponse);
        } else {
          ctx.api.cookies.getAll(getAllCookiesParams, sendResponse);
        }
        return true;
      }
      case 'saveCookie': {
        if (ctx.browserDetector.supportsPromises()) {
          ctx.api.cookies.set(request.params.cookie).then(
            (cookie) => sendResponse(null, cookie),
            (error) => sendResponse(error.message, null),
          );
        } else {
          ctx.api.cookies.set(request.params.cookie, (cookie) => {
            if (cookie) {
              sendResponse(null, cookie);
            } else {
              const error = ctx.api.runtime.lastError;
              sendResponse(error.message, cookie);
            }
          });
        }
        return true;
      }
      case 'removeCookie': {
        const removeParams = {
          name: request.params.name,
          url: request.params.url,
        };
        if (ctx.browserDetector.supportsPromises()) {
          ctx.api.cookies.remove(removeParams).then(sendResponse);
        } else {
          ctx.api.cookies.remove(removeParams, sendResponse);
        }
        return true;
      }
      case 'permissionsContains': {
        ctx.permissionHandler.checkPermissions(request.params).then(sendResponse);
        return true;
      }
      case 'permissionsRequest': {
        ctx.permissionHandler.requestPermission(request.params).then(sendResponse);
        return true;
      }
      case 'optionsChanged': {
        ctx.resetOptionsCache();
        sendMessageToAllTabs('optionsChanged', { from: request.params.from });
        return true;
      }
      case 'setNextActionCategory': {
        return true;
      }
      case 'setNextActionSource': {
        nextActionSource = request.payload;
        setTimeout(() => {
          nextActionSource = 'website';
        }, 500);
        return true;
      }
      case 'getLogs': {
        ctx.logHandler.getLogs().then(sendResponse);
        return true;
      }
      case 'clearLogs': {
        ctx.logHandler.clearLogs().then(sendResponse);
        return true;
      }
    }
  }

  return {
    connections,
    sendMessageToTab,
    sendMessageToAllTabs,
    getNextActionSource: () => nextActionSource,
    resetNextActionSource: () => {
      nextActionSource = 'website';
    },
  };
}
