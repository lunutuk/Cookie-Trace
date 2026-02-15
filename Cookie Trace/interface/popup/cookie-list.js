import { CookieHandlerDevtools } from '../devtools/cookieHandlerDevtools.js';
import { Animate } from '../lib/animate.js';
import { BrowserDetector } from '../lib/browserDetector.js';
import { Cookie } from '../lib/cookie.js';
import { GenericStorageHandler } from '../lib/genericStorageHandler.js';
import { HeaderstringFormat } from '../lib/headerstringFormat.js';
import { JsonFormat } from '../lib/jsonFormat.js';
import { NetscapeFormat } from '../lib/netscapeFormat.js';
import { ExportFormats } from '../lib/options/exportFormats.js';
import { OptionsHandler } from '../lib/optionsHandler.js';
import { PermissionHandler } from '../lib/permissionHandler.js';
import { ThemeHandler } from '../lib/themeHandler.js';
import { CookieHandlerPopup } from './cookieHandlerPopup.js';
import { tooltips } from '../lib/tooltips.js';

(function () {

  let containerCookie;
  let cookiesListHtml;
  let pageTitleContainer;
  let notificationElement;
  let loadedCookies = {};
  let loadedAllCookies = {};
  let disableButtons = false;
  let changelogView = 'domains';
  let allCookiesView = 'domains';

  const notificationQueue = [];
  let notificationTimeout;

  const browserDetector = new BrowserDetector();
  const permissionHandler = new PermissionHandler(browserDetector);
  const storageHandler = new GenericStorageHandler(browserDetector);
  const optionHandler = new OptionsHandler(browserDetector, storageHandler);
  const themeHandler = new ThemeHandler(optionHandler);
  const cookieHandler = window.isDevtools
    ? new CookieHandlerDevtools(browserDetector)
    : new CookieHandlerPopup(browserDetector);

  document.addEventListener('DOMContentLoaded', async function () {
    containerCookie = document.getElementById('cookie-container');
    notificationElement = document.getElementById('notification');
    pageTitleContainer = document.getElementById('pageTitle');



    const style = document.createElement('style');
    style.textContent = `
      .tooltip-container { flex-direction: column; }
      .log-details-content { max-height: 350px; overflow-y: auto; padding: 5px 15px 5px 5px; }
      .log-details-content .diff-line { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 12px; gap: 4px; }
      .log-details-content .diff-key { font-weight: bold; }
      .log-details-content .diff-value { display: flex; align-items: center; gap: 5px; padding-left: 10px; }
      .log-details-content .old-value, .log-details-content .new-value, .log-details-content .no-change { word-break: break-all; white-space: normal; text-align: left; }
      .log-details-content .old-value { color: var(--primary-danger-color); }
      .log-details-content .new-value { color: var(--primary-success-color); }
      .log-details-content .no-change { color: var(--text-color-secondary); }
    `;
    document.head.appendChild(style);


    await initWindow();

    function expandCookie(e) {
      const parent = e.target.closest('li');
      const header = parent.querySelector('.header');
      const expando = parent.querySelector('.expando');
      
      Animate.toggleSlide(expando);
      header.classList.toggle('active');
      header.ariaExpanded = header.classList.contains('active');
      expando.ariaHidden = !header.classList.contains('active');
    }
    
    function deleteButton(e) {
      browserDetector.getApi().runtime.sendMessage({ type: 'setNextActionSource', payload: 'user' });
      e.preventDefault();
      const listElement = e.target.closest('li');
      removeCookie(listElement.dataset.name);
      return false;
    }

    function saveCookieForm(form) {
      browserDetector.getApi().runtime.sendMessage({ type: 'setNextActionSource', payload: 'user' });
      const isCreateForm = form.classList.contains('create');
      const category = isCreateForm ? 'addition' : 'modification';
      browserDetector.getApi().runtime.sendMessage({ type: 'setNextActionCategory', payload: category });

      const id = form.dataset.id;
      const name = form.querySelector('input[name="name"]').value;
      const value = form.querySelector('textarea[name="value"]').value;

      let domain;
      let path;
      let expiration;
      let sameSite;
      let hostOnly;
      let session;
      let secure;
      let httpOnly;

      if (!isCreateForm) {
        domain = form.querySelector('input[name="domain"]').value;
        path = form.querySelector('input[name="path"]').value;
        expiration = form.querySelector('input[name="expiration"]').value;
        sameSite = form.querySelector('select[name="sameSite"]').value;
        hostOnly = form.querySelector('input[name="hostOnly"]').checked;
        session = form.querySelector('input[name="session"]').checked;
        secure = form.querySelector('input[name="secure"]').checked;
        httpOnly = form.querySelector('input[name="httpOnly"]').checked;
      }
      saveCookie(
        id,
        name,
        value,
        domain,
        path,
        expiration,
        sameSite,
        hostOnly,
        session,
        secure,
        httpOnly,
      );

      if (form.classList.contains('create')) {
        showCookiesForTab();
      }

      return false;
    }

    function saveCookie(
      id,
      name,
      value,
      domain,
      path,
      expiration,
      sameSite,
      hostOnly,
      session,
      secure,
      httpOnly,
    ) {
      const cookieContainer = loadedCookies[id];
      let cookie = cookieContainer ? cookieContainer.cookie : null;
      let oldName;
      let oldHostOnly;

      if (cookie) {
        oldName = cookie.name;
        oldHostOnly = cookie.hostOnly;
      } else {
        cookie = {};
        oldName = name;
        oldHostOnly = hostOnly;
      }

      cookie.name = name;
      cookie.value = value;

      if (domain !== undefined) {
        cookie.domain = domain;
      }
      if (path !== undefined) {
        cookie.path = path;
      }
      if (sameSite !== undefined) {
        cookie.sameSite = sameSite;
      }
      if (hostOnly !== undefined) {
        cookie.hostOnly = hostOnly;
      }
      if (session !== undefined) {
        cookie.session = session;
      }
      if (secure !== undefined) {
        cookie.secure = secure;
      }
      if (httpOnly !== undefined) {
        cookie.httpOnly = httpOnly;
      }

      if (cookie.session) {
        cookie.expirationDate = null;
      } else {
        cookie.expirationDate = new Date(expiration).getTime() / 1000;
        if (!cookie.expirationDate) {
          cookie.expirationDate = null;
          cookie.session = true;
        }
      }

      if (oldName !== name || oldHostOnly !== hostOnly) {
        cookieHandler.removeCookie(oldName, getCurrentTabUrl(), function () {
          cookieHandler.saveCookie(
            cookie,
            getCurrentTabUrl(),
            function (error, cookie) {
              if (error) {
                sendNotification(error);
                return;
              }
              if (browserDetector.isSafari()) {
                onCookiesChanged();
              }
              if (cookieContainer) {
                cookieContainer.showSuccessAnimation();
              }
            },
          );
        });
      } else {
        cookieHandler.saveCookie(
          cookie,
          getCurrentTabUrl(),
          function (error, cookie) {
            if (error) {
              sendNotification(error);
              return;
            }
            if (browserDetector.isSafari()) {
              onCookiesChanged();
            }

            if (cookieContainer) {
              cookieContainer.showSuccessAnimation();
            }
          },
        );
      }
    }

    if (containerCookie) {
      containerCookie.addEventListener('click', (e) => {
        if (containerCookie.querySelector('#all-cookies-view')) return;

        let target = e.target;
        if (target.nodeName === 'path') {
          target = target.parentNode;
        }
        if (target.nodeName === 'svg') {
          target = target.parentNode;
        }

        if (
          target.classList.contains('header') ||
          target.classList.contains('header-name') ||
          target.classList.contains('header-extra-info')
        ) {
          return expandCookie(e);
        }
        if (target.classList.contains('delete')) {
          return deleteButton(e);
        }
        if (target.classList.contains('save')) {
          return saveCookieForm(e.target.closest('li').querySelector('form'));
        }
      });

      containerCookie.addEventListener('click', (e) => {
        if (!containerCookie.querySelector('#all-cookies-view')) return;

        let target = e.target;
        if (target.nodeName === 'path') {
          target = target.parentNode;
        }
        if (target.nodeName === 'svg') {
          target = target.parentNode;
        }

        const listElement = e.target.closest('li');
        if (!listElement) return;

        const cookieId = listElement.dataset.id;

        if (
          target.classList.contains('header') ||
          target.classList.contains('header-name') ||
          target.classList.contains('header-extra-info')
        ) {
          const header = listElement.querySelector('.header');
          const expando = listElement.querySelector('.expando');

          Animate.toggleSlide(expando);
          header.classList.toggle('active');
          header.ariaExpanded = header.classList.contains('active');
          expando.ariaHidden = !header.classList.contains('active');
        }

        if (target.classList.contains('delete')) {
            browserDetector.getApi().runtime.sendMessage({ type: 'setNextActionSource', payload: 'user' });
            e.preventDefault();
            const cookie = loadedAllCookies[cookieId].cookie;
            const url = `https://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}`;
            removeCookie(cookie.name, url, () => {
                listElement.remove();
                delete loadedAllCookies[cookieId];
            });
            return false;
        }

        if (target.classList.contains('save')) {
            sendNotification('Сохранение в этом режиме пока не поддерживается.');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          const target = e.target;
          if (target.classList.contains('header')) {
            e.preventDefault();
            return expandCookie(e);
          }
        }
      });
    }

    document.getElementById('create-cookie').addEventListener('click', () => {
      if (disableButtons) {
        return;
      }

      setPageTitle('Cookie Trace - Add a Cookie');

      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        createHtmlFormCookie(),
        'left',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );

      setActiveButtonBar('button-bar-add');
      document.getElementById('name-create').focus();
      return false;
    });

    document
      .getElementById('delete-all-cookies')
      .addEventListener('click', () => {
        browserDetector.getApi().runtime.sendMessage({ type: 'setNextActionSource', payload: 'user' });
        const buttonIcon = document
          .getElementById('delete-all-cookies')
          .querySelector('use');
        if (buttonIcon.getAttribute('href') === '../sprites/solid.svg#check') {
          return;
        }
        if (loadedCookies && Object.keys(loadedCookies).length) {
          for (const cookieId in loadedCookies) {
            removeCookie(loadedCookies[cookieId].cookie.name);
          }
        }
        sendNotification('All cookies were deleted');
        buttonIcon.setAttribute('href', '../sprites/solid.svg#check');
        setTimeout(() => {
          buttonIcon.setAttribute('href', '../sprites/solid.svg#trash');
        }, 1500);
      });

    document.getElementById('export-cookies').addEventListener('click', () => {
      if (disableButtons) {
        hideExportMenu();
        return;
      }
      handleExportButtonClick();
    });

    document.getElementById('import-cookies').addEventListener('click', () => {
      if (disableButtons) {
        return;
      }

      setPageTitle('Cookie Trace - Import');

      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        createHtmlFormImport(),
        'left',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );

      setActiveButtonBar('button-bar-import');

      document.getElementById('content-import').focus();
      return false;
    });

    document.getElementById('return-list-add').addEventListener('click', () => {
      showCookiesForTab();
    });
    document
      .getElementById('return-list-import')
      .addEventListener('click', () => {
        showCookiesForTab();
      });

    containerCookie.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCookieForm(e.target);
      return false;
    });

    document
      .getElementById('save-create-cookie')
      .addEventListener('click', () => {
        saveCookieForm(document.querySelector('form'));
      });

    document
      .getElementById('save-import-cookie')
      .addEventListener('click', (e) => {
        browserDetector.getApi().runtime.sendMessage({ type: 'setNextActionSource', payload: 'user' });
        const buttonIcon = document
          .getElementById('save-import-cookie')
          .querySelector('use');
        if (
          buttonIcon.getAttribute('href') !== '../sprites/solid.svg#file-import'
        ) {
          return;
        }

        const json = document.querySelector('textarea').value;
        if (!json) {
          return;
        }
        let cookies;
        try {
          cookies = JsonFormat.parse(json);
        } catch (error) {
          try {
            cookies = HeaderstringFormat.parse(json);
          } catch (error) {
            try {
              cookies = NetscapeFormat.parse(json);
            } catch (error) {
              sendNotification('The input is not in a valid format.');
              buttonIcon.setAttribute('href', '../sprites/solid.svg#times');
              setTimeout(() => {
                buttonIcon.setAttribute(
                  'href',
                  '../sprites/solid.svg#file-import',
                );
              }, 1500);
              return;
            }
          }
        }

        if (!isArray(cookies) || cookies.length === 0) {
          sendNotification('No cookies were imported. Verify your input.');
          buttonIcon.setAttribute('href', '../sprites/solid.svg#times');
          setTimeout(() => {
            buttonIcon.setAttribute('href', '../sprites/solid.svg#file-import');
          }, 1500);
          return;
        }

        for (const cookie of cookies) {
          cookie.storeId = cookieHandler.currentTab.cookieStoreId;

          if (cookie.sameSite && cookie.sameSite === 'unspecified') {
            cookie.sameSite = 'no_restriction';
          }

          try {
            cookieHandler.saveCookie(
              cookie,
              getCurrentTabUrl(),
              function (error, cookie) {
                if (error) {
                  sendNotification(error);
                }
              },
            );
          } catch (error) {
            sendNotification(error);
          }
        }

        sendNotification(`Cookies were imported`);
        showCookiesForTab();
      });

    const mainMenuContent = document.querySelector('#main-menu-content');
    const hamburgerButton = document.getElementById('hamburger-menu-button');
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('overlay');

    hamburgerButton.addEventListener('click', function (e) {
        e.stopPropagation();
        sideMenu.classList.toggle('open');
        overlay.classList.toggle('visible');
    });

    overlay.addEventListener('click', function() {
        sideMenu.classList.remove('open');
        overlay.classList.remove('visible');
    });

    document
      .querySelector('#main-menu-button')
      .addEventListener('click', function (e) {
        mainMenuContent.classList.toggle('visible');
      });

    document.addEventListener('click', function (e) {
      if (!sideMenu.contains(e.target) && !hamburgerButton.contains(e.target)) {
        sideMenu.classList.remove('open');
      }

      if (
        document.querySelector('#main-menu').contains(e.target) ||
        !mainMenuContent.classList.contains('visible')
      ) {
        return;
      }
      mainMenuContent.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      const exportMenu = document.querySelector('#export-menu');
      if (!exportMenu || exportMenu.contains(e.target)) {
        return;
      }

      const exportButton = document.querySelector('#export-cookies');
      if (!exportButton || exportButton.contains(e.target)) {
        return;
      }

      hideExportMenu();
    });

    document
      .querySelector('#advanced-toggle-all')
      .addEventListener('change', function (e) {
        optionHandler.setCookieAdvanced(e.target.checked);
        showCookiesForTab();
      });

    document
      .querySelector('#menu-all-options')
      .addEventListener('click', function (e) {
        if (browserDetector.getApi().runtime.openOptionsPage) {
          browserDetector.getApi().runtime.openOptionsPage();
        } else {
          window.open(
            browserDetector
              .getApi()
              .runtime.getURL('interface/options/options.html'),
          );
        }
      });

    notificationElement.addEventListener('animationend', (e) => {
      if (notificationElement.classList.contains('fadeInUp')) {
        return;
      }

      triggerNotification();
    });

    document
      .getElementById('notification-dismiss')
      .addEventListener('click', (e) => {
        hideNotification();
      });

    document.getElementById('menu-item-changelog').addEventListener('click', (e) => {
      e.preventDefault();
      
      sideMenu.classList.remove('open');
      overlay.classList.remove('visible');

      if (disableButtons) {
        return;
      }

      const changelogElement = createHtmlChangelog();

      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        changelogElement,
        'left',
        () => {
          disableButtons = false;
          showDomainList(changelogElement);
        },
        optionHandler.getAnimationsEnabled(),
      );

      setActiveButtonBar('button-bar-changelog');
    });

    document.getElementById('menu-item-all-cookies').addEventListener('click', (e) => {
        e.preventDefault();

        sideMenu.classList.remove('open');
        overlay.classList.remove('visible');

        if (disableButtons) {
            return;
        }

        showAllCookiesOrRequestPermission();
    });

    let allCookiesView = 'domains';

    document.getElementById('return-list-changelog').addEventListener('click', () => {
      const changelogElement = containerCookie.querySelector('#changelog-view');
      if (changelogView === 'logs') {
        showDomainList(changelogElement);
      } else {
        showCookiesForTab();
      }
    });

    document.getElementById('return-list-all-cookies').addEventListener('click', () => {
        const allCookiesContainer = containerCookie.querySelector('#all-cookies-view');
        if (allCookiesContainer && allCookiesContainer.querySelector('ul')) {
            showAllCookiesDomainList(allCookiesContainer);
        } else {
            showCookiesForTab();
        }
    });

    document.getElementById('delete-all-cookies-all').addEventListener('click', () => {
        const confirmation = confirm('Вы уверены, что хотите удалить ВСЕ cookie со всех сайтов на этом устройстве? Это действие необратимо.');
        if (confirmation) {
            deleteAllCookies();
        }
    });

    function deleteAllCookies() {
        sendNotification('Удаление всех cookie...');
        browserDetector.getApi().cookies.getAll({}, (cookies) => {
            if (!cookies || cookies.length === 0) {
                sendNotification('Не найдено cookie для удаления.');
                return;
            }

            let cookiesRemoved = 0;
            for (const cookie of cookies) {
                const url = `http${cookie.secure ? 's' : ''}://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path}`;
                removeCookie(cookie.name, url, () => {
                    cookiesRemoved++;
                    if (cookiesRemoved === cookies.length) {
                        sendNotification('Все cookie были успешно удалены.');
                        const allCookiesContainer = containerCookie.querySelector('#all-cookies-view');
                        if (allCookiesContainer) {
                            showAllCookiesDomainList(allCookiesContainer);
                        }
                    }
                });
            }
        });
    }

    document.getElementById('clear-changelog-button').addEventListener('click', () => {
      browserDetector.getApi().runtime.sendMessage({ type: 'clearLogs' }, () => {
        sendNotification('История изменений очищена');
        const changelogElement = containerCookie.querySelector('#changelog-view');
        showDomainList(changelogElement);
      });
    });

    document
      .getElementById('notification-dismiss')
      .addEventListener('click', (e) => {
        hideNotification();
      });

    adjustWidthIfSmaller();

    if (chrome && chrome.runtime && chrome.runtime.getBrowserInfo) {
      chrome.runtime.getBrowserInfo(function (info) {
        const mainVersion = info.version.split('.')[0];
        if (mainVersion < 57) {
          containerCookie.style.height = '600px';
        }
      });
    }

    containerCookie.addEventListener('click', (e) => {
      const target = e.target.closest('.tooltip-icon');
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const key = target.dataset.tooltipKey;
        const text = tooltips[key];
        if (text) {
          const titleText = key === 'ml-probability'
            ? 'Что означает этот процент?'
            : `Что такое ${key.replace('-field', '').replace('-flag', '')}?`;
          let contentElement;
          if (key === 'ml-probability') {
            contentElement = document.createElement('div');
            const p = document.createElement('p');
            p.textContent = text;
            const small = document.createElement('div');
            small.className = 'tooltip-secondary-text';
            small.textContent = 'Эвристическая оценка, возможны ошибки.';
            contentElement.appendChild(p);
            contentElement.appendChild(small);
          } else {
            contentElement = document.createElement('p');
            contentElement.textContent = text;
          }
          showInfoPopup(titleText, contentElement);
        }
      }
    }, true);
  });

  function showInfoPopup(titleText, contentElement) {
    const overlay = document.createElement('div');
    overlay.className = 'tooltip-overlay';
    document.body.appendChild(overlay);
    overlay.style.display = 'block';

    const tooltipContainer = document.createElement('div');
    tooltipContainer.className = 'tooltip-container';
    
    const title = document.createElement('h3');
    title.textContent = titleText;

    const hr = document.createElement('hr');

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';

    tooltipContainer.appendChild(title);
    tooltipContainer.appendChild(hr);
    tooltipContainer.appendChild(contentElement);
    tooltipContainer.appendChild(closeBtn);

    document.body.appendChild(tooltipContainer);
    tooltipContainer.style.display = 'flex';

    const closeTooltip = () => {
        overlay.remove();
        tooltipContainer.remove();
    };

    closeBtn.addEventListener('click', closeTooltip);
    overlay.addEventListener('click', closeTooltip);
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function(match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
  }

  function createDiffLine(key, oldValue, newValue) {
      if (oldValue === newValue) {
          return `<div class="diff-line"><span class="diff-key">${key}: </span> <span class="no-change">${escapeHTML(oldValue)}</span></div>`;
      }
      if (oldValue === null) {
          return `<div class="diff-line"><span class="diff-key">${key}: </span> <span class="new-value">${escapeHTML(newValue)}</span></div>`;
      }
      if (newValue === null) {
          return `<div class="diff-line"><span class="diff-key">${key}: </span> <span class="old-value">${escapeHTML(oldValue)}</span></div>`;
      }
      return `<div class="diff-line">
                <span class="diff-key">${key}: </span>
                <span class="diff-value">
                    <span class="old-value">${escapeHTML(oldValue)}</span>
                    <span>→</span>
                    <span class="new-value">${escapeHTML(newValue)}</span>
                </span>
              </div>`;
  }

  function formatBoolean(value) {
      return value ? 'true' : 'false';
  }

  function formatExpiration(timestamp) {
      if (!timestamp) return 'Session';
      return new Date(timestamp * 1000).toLocaleString();
  }



  function showLogDetails(log) {
    console.log('Cookie Trace UI: showLogDetails called with log:', log);
    console.log('Cookie Trace UI: log.change exists?', !!log.change);
    if (!log.change) {
        const oldTitleText = 'Детали (старый формат)';
        const oldContentElement = document.createElement('div');
        oldContentElement.className = 'log-details-content';
        const categoryText = {
            'addition': 'Добавление',
            'modification': 'Изменение',
            'deletion': 'Удаление'
        };
        const sourceText = log.source === 'user' ? 'Пользователь' : 'Сайт';
        oldContentElement.innerHTML = `
            <p><strong>Тип:</strong> ${categoryText[log.category] || 'Неизвестно'}</p>
            <p><strong>Название:</strong> ${log.cookie.name}</p>
            <p><strong>Источник:</strong> ${sourceText}</p>
            <p><em>Детальные изменения для этой записи недоступны.</em></p>
            <div class="log-details-footer">
                <span>${new Date(log.timestamp).toLocaleString()}</span>
            </div>
        `;
        showInfoPopup(oldTitleText, oldContentElement);
        return;
    }

    const titleText = 'Детали изменения';
    const contentElement = document.createElement('div');
    contentElement.className = 'log-details-content';

    const { before, after } = log.change;
    const category = log.category;
    let html = '';

    if (category === 'addition') {
        html = createDiffLine('Значение', null, after.value);
    } else if (category === 'deletion') {
        html = '';
    } else if (category === 'modification') {
        const fields = [
            { key: 'domain', name: 'Домен' },
            { key: 'path', name: 'Путь' },
            { key: 'expirationDate', name: 'Истекает', format: formatExpiration },
            { key: 'sameSite', name: 'SameSite' },
            { key: 'hostOnly', name: 'HostOnly', format: formatBoolean },
            { key: 'session', name: 'Сессия', format: formatBoolean },
            { key: 'secure', name: 'Secure', format: formatBoolean },
            { key: 'httpOnly', name: 'HttpOnly', format: formatBoolean },
            { key: 'value', name: 'Значение' },
        ];

        fields.forEach(field => {
            const oldValue = before ? (field.format ? field.format(before[field.key]) : before[field.key]) : null;
            const newValue = after ? (field.format ? field.format(after[field.key]) : after[field.key]) : null;
            
            if (oldValue !== newValue) {
                html += createDiffLine(field.name, oldValue, newValue);
            }
        });

        if (html === '') {
            html = '<p><em>(Значения не изменились)</em></p>';
        }
    }

    const sourceText = log.source === 'user' ? 'Пользователь' : 'Сайт';
    const categoryText = {
        'addition': 'Добавление',
        'modification': 'Изменение',
        'deletion': 'Удаление'
    };

    contentElement.innerHTML = `
        <p><strong>Тип:</strong> ${categoryText[log.category] || 'Неизвестно'}</p>
        <p><strong>Источник:</strong> ${sourceText}</p>
        ${html}
        <div class="log-details-footer">
            <span>${new Date(log.timestamp).toLocaleString()}</span>
        </div>
    `;

    showInfoPopup(titleText, contentElement);
  }


  async function showCookiesForTab() {
    if (!cookieHandler.currentTab) {
      return;
    }
    if (disableButtons) {
      return;
    }

    setPageTitle('Cookie Trace');
    setActiveButtonBar('button-bar-default');
    document.myThing = 'DarkSide';
    const domain = getDomainFromUrl(cookieHandler.currentTab.url);
    const subtitleLine = document.querySelector('.titles h2');
    if (subtitleLine) {
      subtitleLine.textContent = domain || cookieHandler.currentTab.url;
    }

    if (!permissionHandler.canHavePermissions(cookieHandler.currentTab.url)) {
      showPermissionImpossible();
      return;
    }
    if (!cookieHandler.currentTab) {
      showNoCookies();
      return;
    }
    const hasPermissions = await permissionHandler.checkPermissions(
      cookieHandler.currentTab.url,
    );
    if (!hasPermissions) {
      showNoPermission();
      return;
    }

    cookieHandler.getAllCookies(function (cookies) {
      cookies = cookies.sort(sortCookiesByName);

      loadedCookies = {};

      if (cookies.length === 0) {
        showNoCookies();
        return;
      }

      cookiesListHtml = document.createElement('ul');
      cookiesListHtml.appendChild(generateSearchBar());
      cookies.forEach(function (cookie) {
        const id = Cookie.hashCode(cookie);
        loadedCookies[id] = new Cookie(id, cookie, optionHandler);
        cookiesListHtml.appendChild(loadedCookies[id].html);
      });

      if (containerCookie.firstChild) {
        disableButtons = true;
        Animate.transitionPage(
          containerCookie,
          containerCookie.firstChild,
          cookiesListHtml,
          'right',
          () => {
            disableButtons = false;
          },
          optionHandler.getAnimationsEnabled(),
        );
      } else {
        containerCookie.appendChild(cookiesListHtml);
      }
    });
  }

  function showNoCookies() {
    if (disableButtons) {
      return;
    }
    cookiesListHtml = null;
    const html = document
      .importNode(document.getElementById('tmp-empty').content, true)
      .querySelector('p');
    if (containerCookie.firstChild) {
      if (containerCookie.firstChild.id === 'no-cookie') {
        return;
      }
      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        html,
        'right',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );
    } else {
      containerCookie.appendChild(html);
    }
  }

  function showNoPermission() {
    if (disableButtons) {
      return;
    }
    cookiesListHtml = null;
    const html = document
      .importNode(document.getElementById('tmp-no-permission').content, true)
      .querySelector('div');

    document.getElementById('button-bar-add').classList.remove('active');
    document.getElementById('button-bar-import').classList.remove('active');
    document.getElementById('button-bar-default').classList.remove('active');

    if (
      browserDetector.isFirefox() &&
      typeof browserDetector.getApi().devtools !== 'undefined'
    ) {
      html.querySelector('div').textContent =
        "Go to your settings (about:addons) or open the extension's popup to " +
        'adjust your permissions.';
    }

    if (containerCookie.firstChild) {
      if (containerCookie.firstChild.id === 'no-permission') {
        return;
      }
      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        html,
        'right',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );
    } else {
      containerCookie.appendChild(html);
    }
    document.getElementById('request-permission').focus();
    document
      .getElementById('request-permission')
      .addEventListener('click', async (event) => {
        const isPermissionGranted = await permissionHandler.requestPermission(
          cookieHandler.currentTab.url,
        );
        if (isPermissionGranted) {
          showCookiesForTab();
        }
      });
    document
      .getElementById('request-permission-all')
      .addEventListener('click', async (event) => {
        const isPermissionGranted =
          await permissionHandler.requestPermission('<all_urls>');
        if (isPermissionGranted) {
          showCookiesForTab();
        }
      });
  }

  function showPermissionImpossible() {
    if (disableButtons) {
      return;
    }
    cookiesListHtml = null;
    const html = document
      .importNode(
        document.getElementById('tmp-permission-impossible').content,
        true,
      )
      .querySelector('div');

    document.getElementById('button-bar-add').classList.remove('active');
    document.getElementById('button-bar-import').classList.remove('active');
    document.getElementById('button-bar-default').classList.remove('active');
    if (containerCookie.firstChild) {
      if (containerCookie.firstChild.id === 'permission-impossible') {
        return;
      }
      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        html,
        'right',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );
    } else {
      containerCookie.appendChild(html);
    }
  }

  function showVersion() {
    const version = browserDetector.getApi().runtime.getManifest().version;
    document.getElementById('version').textContent = 'v' + version;
  }

  function handleAnimationsEnabled() {
    if (optionHandler.getAnimationsEnabled()) {
      document.body.classList.remove('notransition');
    } else {
      document.body.classList.add('notransition');
    }
  }

  function createHtmlForCookie(name, value, id) {
    const cookie = new Cookie(
      id,
      {
        name: name,
        value: value,
      },
      optionHandler,
    );

    return cookie.html;
  }

  function createHtmlFormCookie() {
    const template = document.importNode(
      document.getElementById('tmp-create').content,
      true,
    );
    return template.querySelector('form');
  }

  function createHtmlFormImport() {
    const template = document.importNode(
      document.getElementById('tmp-import').content,
      true,
    );
    return template.querySelector('form');
  }

  function createHtmlChangelog() {
    const template = document.importNode(
      document.getElementById('tmp-changelog').content,
      true,
    );
    return template.querySelector('div');
  }

  function createHtmlAllCookies() {
      const template = document.importNode(
          document.getElementById('tmp-all-cookies').content,
          true,
      );
      return template.querySelector('div');
  }

  async function showAllCookiesOrRequestPermission() {
    const allCookiesElement = createHtmlAllCookies();

    disableButtons = true;
    Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        allCookiesElement,
        'left',
        async () => {
            disableButtons = false;
            const hasPermissions = await permissionHandler.checkPermissions('<all_urls>');
            if (hasPermissions) {
                showAllCookiesDomainList(allCookiesElement);
            } else {
                showAllCookiesNoPermission(allCookiesElement);
            }
        },
        optionHandler.getAnimationsEnabled(),
    );

    setActiveButtonBar('button-bar-all-cookies');
  }

  function showAllCookiesDomainList(allCookiesContainer) {
    allCookiesView = 'domains';
    setPageTitle('Cookie Trace - Все Cookie');

    document.getElementById('delete-all-cookies-all').style.display = 'block';
    document.getElementById('delete-site-cookies-btn')?.remove();

    if (!allCookiesContainer) return;

    allCookiesContainer.innerHTML = '<p style="text-align: center;">Загрузка cookie...</p>';

    try {
      browserDetector.getApi().cookies.getAll({}, (cookies) => {
        if (browserDetector.getApi().runtime.lastError) {
          console.error(browserDetector.getApi().runtime.lastError);
          allCookiesContainer.innerHTML = '<p style="text-align: center; color: var(--primary-danger-color);">Не удалось загрузить cookie. Убедитесь, что у расширения есть необходимые разрешения.</p>';
          return;
        }

        if (!allCookiesContainer) return;
        allCookiesContainer.innerHTML = '';

        if (!cookies || cookies.length === 0) {
            const noCookiesMessage = document.createElement('p');
            noCookiesMessage.textContent = 'Не найдено ни одного cookie.';
            noCookiesMessage.style.textAlign = 'center';
            allCookiesContainer.appendChild(noCookiesMessage);
            return;
        }

        const domains = cookies.reduce((acc, cookie) => {
            const domain = getPrimaryDomain(cookie.domain);
            if (!acc[domain]) {
                acc[domain] = [];
            }
            acc[domain].push(cookie);
            return acc;
        }, {});

        const domainKeys = Object.keys(domains).sort((a, b) => domains[b].length - domains[a].length);
        const totalSites = domainKeys.length;
        const totalCookies = cookies.length;

        const header = document.createElement('div');
        header.className = 'domain-list-header';
        header.innerHTML = `
            <div class="header-left">
                <span>Сайты</span>
                <span class="total-count">(${totalSites})</span>
            </div>
            <div class="header-right">
                <span>Количество</span>
                <span class="total-count">(${totalCookies})</span>
            </div>
        `;
        allCookiesContainer.appendChild(header);

        const searchBar = document.importNode(document.getElementById('tmp-domain-search-bar').content, true);
        const searchInput = searchBar.getElementById('domainSearchField');
        searchInput.addEventListener('keyup', filterDomains);
        allCookiesContainer.appendChild(searchBar);

        const domainList = document.createElement('div');
        domainList.className = 'domain-list';

        domainKeys.forEach(domain => {
            const domainEntry = document.createElement('div');
            domainEntry.className = 'domain-entry';
            domainEntry.innerHTML = `
              <span class="domain-name">${domain}</span>
              <span class="domain-log-count">${domains[domain].length}</span>
            `;
            domainEntry.addEventListener('click', () => showCookiesForDomain(domain, domains[domain]));
            domainList.appendChild(domainEntry);
        });

        allCookiesContainer.appendChild(domainList);
      });
    } catch (e) {
        console.error(e);
        allCookiesContainer.innerHTML = '<p style="text-align: center; color: var(--primary-danger-color);">Произошла критическая ошибка при загрузке cookie.</p>';
    }
  }

  function showCookiesForDomain(domain, cookies) {
    allCookiesView = 'cookies';
    setPageTitle(`Cookie Trace - Все Cookie - ${domain}`);

    document.getElementById('delete-all-cookies-all').style.display = 'none';
    document.getElementById('delete-site-cookies-btn')?.remove();

    const deleteSiteBtn = document.createElement('button');
    deleteSiteBtn.id = 'delete-site-cookies-btn';
    deleteSiteBtn.className = 'panel-section-footer-button danger';
    deleteSiteBtn.type = 'button';
    deleteSiteBtn.innerHTML = `
        <div>
            <svg class="icon"><use href="../sprites/solid.svg#trash"></use></svg>
            <div class="tooltip" role="tooltip">Удалить с этого сайта</div>
        </div>
    `;
    deleteSiteBtn.addEventListener('click', () => {
        const confirmation = confirm(`Вы уверены, что хотите удалить все cookie для сайта ${domain}?`);
        if (confirmation) {
            let cookiesRemoved = 0;
            for (const cookie of cookies) {
                const url = `http${cookie.secure ? 's' : ''}://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path}`;
                removeCookie(cookie.name, url, () => {
                    cookiesRemoved++;
                    if (cookiesRemoved === cookies.length) {
                        sendNotification(`Все cookie для ${domain} удалены.`);
                        const allCookiesContainer = containerCookie.querySelector('#all-cookies-view');
                        if (allCookiesContainer) {
                            showAllCookiesDomainList(allCookiesContainer);
                        }
                    }
                });
            }
        }
    });
    document.getElementById('button-bar-all-cookies').querySelector('.panel-section-footer').appendChild(deleteSiteBtn);

    const allCookiesContainer = containerCookie.querySelector('#all-cookies-view');
    if (!allCookiesContainer) return;

    allCookiesContainer.innerHTML = '';
    loadedAllCookies = {};

    const cookiesListHtml = document.createElement('ul');
    cookies.forEach(function (cookie) {
        const id = Cookie.hashCode(cookie);
        const cookieObject = new Cookie(id, cookie, optionHandler);
        loadedAllCookies[id] = cookieObject;
        cookiesListHtml.appendChild(cookieObject.html);
    });

    allCookiesContainer.appendChild(cookiesListHtml);
  }

  function showAllCookiesNoPermission(allCookiesContainer) {
    const noPermissionElement = document.importNode(
        document.getElementById('tmp-no-permission-all-cookies').content,
        true,
    ).querySelector('div');

    if (!allCookiesContainer) return;
    allCookiesContainer.innerHTML = '';
    allCookiesContainer.appendChild(noPermissionElement);

    const requestButton = noPermissionElement.querySelector('#request-permission-all-cookies');
    requestButton.addEventListener('click', async () => {
        const isGranted = await permissionHandler.requestPermission('<all_urls>');
        if (isGranted) {
            showAllCookiesDomainList(allCookiesContainer);
        }
    });
  }

  function handleExportButtonClick() {
    const exportOption = optionHandler.getExportFormat();
    switch (exportOption) {
      case ExportFormats.Ask:
        toggleExportMenu();
        break;
      case ExportFormats.JSON:
        enterSelectionMode('json');
        break;
      case ExportFormats.HeaderString:
        enterSelectionMode('headerstring');
        break;
      case ExportFormats.Netscape:
        enterSelectionMode('netscape');
        break;
    }
  }

  function showCenterNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.innerHTML = `<svg class="icon"><use href="../sprites/solid.svg#circle-info"></use></svg><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 3750);
  }

  function enterSelectionMode(format) {
    hideExportMenu();
    showCenterNotification('Выберите cookie для экспорта');
    document.body.classList.add('selection-mode');
    document.getElementById('button-bar-default').classList.remove('active');

    const selectionButtonBar = document.createElement('div');
    selectionButtonBar.id = 'selection-button-bar';
    selectionButtonBar.classList.add('panel', 'button-bar', 'active');
    selectionButtonBar.innerHTML = `
      <div class="panel-section panel-section-footer">
        <button class="panel-section-footer-button" id="cancel-selection" type="button">
          <div>
            <svg class="icon"><use href="../sprites/solid.svg#arrow-left"></use></svg>
            <div class="tooltip" role="tooltip">Отмена</div>
          </div>
        </button>
        <div class="panel-section-footer-separator"></div>
        <button class="panel-section-footer-button" id="export-all-selection" type="button">
          <div>
            <svg class="icon"><use href="../sprites/solid.svg#file-export"></use></svg>
            <div class="tooltip" role="tooltip">Экспортировать все</div>
          </div>
        </button>
        <div class="panel-section-footer-separator"></div>
        <button class="panel-section-footer-button primary" id="export-selected-selection" type="button">
          <div>
            <svg class="icon"><use href="../sprites/solid.svg#file-export"></use></svg>
            <div class="tooltip" role="tooltip">Экспортировать выбранные</div>
          </div>
        </button>
      </div>
    `;
    document.body.appendChild(selectionButtonBar);

    document.getElementById('cancel-selection').addEventListener('click', exitSelectionMode);
    document.getElementById('export-all-selection').addEventListener('click', () => {
      exportAll(format);
      exitSelectionMode();
    });
    document.getElementById('export-selected-selection').addEventListener('click', () => {
      exportSelected(format);
      exitSelectionMode();
    });

    const cookieElements = cookiesListHtml.querySelectorAll('.cookie');
    cookieElements.forEach(cookieElement => {
      cookieElement.addEventListener('click', toggleCookieSelection);
    });
  }

  function exitSelectionMode() {
    document.body.classList.remove('selection-mode');
    document.getElementById('button-bar-default').classList.add('active');

    const selectionButtonBar = document.getElementById('selection-button-bar');
    if (selectionButtonBar) {
      selectionButtonBar.remove();
    }

    const cookieElements = cookiesListHtml.querySelectorAll('.cookie');
    cookieElements.forEach(cookieElement => {
      cookieElement.classList.remove('selected');
      cookieElement.removeEventListener('click', toggleCookieSelection);
    });
  }

  function toggleCookieSelection(e) {
    e.stopPropagation();
    const target = e.currentTarget;
    target.classList.toggle('selected');
  }

  function exportSelected(format) {
    const selectedCookies = {};
    const selectedElements = cookiesListHtml.querySelectorAll('.cookie.selected');

    selectedElements.forEach(element => {
      const cookieId = Object.keys(loadedCookies).find(key => loadedCookies[key].html === element);
      if (cookieId) {
        selectedCookies[cookieId] = loadedCookies[cookieId];
      }
    });

    if (Object.keys(selectedCookies).length === 0) {
      sendNotification('Не выбрано ни одного cookie для экспорта.');
      return;
    }

    let formattedCookies;
    if (format === 'json') {
      formattedCookies = JsonFormat.format(selectedCookies);
    } else if (format === 'headerstring') {
      formattedCookies = HeaderstringFormat.format(selectedCookies);
    } else if (format === 'netscape') {
      formattedCookies = NetscapeFormat.format(selectedCookies);
    }

    copyText(formattedCookies);
    sendNotification('Выбранные cookie экспортированы в буфер обмена.');
  }

  function exportAll(format) {
    let formattedCookies;
    if (format === 'json') {
      formattedCookies = JsonFormat.format(loadedCookies);
    } else if (format === 'headerstring') {
      formattedCookies = HeaderstringFormat.format(loadedCookies);
    } else if (format === 'netscape') {
      formattedCookies = NetscapeFormat.format(loadedCookies);
    }

    copyText(formattedCookies);
    sendNotification('Все cookie экспортированы в буфер обмена.');
  }

  function toggleExportMenu() {
    if (document.getElementById('export-menu')) {
      hideExportMenu();
    } else {
      showExportMenu();
    }
  }

  function showExportMenu() {
    const template = document.importNode(
      document.getElementById('tmp-export-options').content,
      true,
    );
    containerCookie.appendChild(template.getElementById('export-menu'));

    document.getElementById('export-json').focus();
    document
      .getElementById('export-json')
      .addEventListener('click', (event) => {
        enterSelectionMode('json');
      });
    document
      .getElementById('export-headerstring')
      .addEventListener('click', (event) => {
        enterSelectionMode('headerstring');
      });
    document
      .getElementById('export-netscape')
      .addEventListener('click', (event) => {
        enterSelectionMode('netscape');
      });
  }

  function hideExportMenu() {
    const exportMenu = document.getElementById('export-menu');
    if (exportMenu) {
      containerCookie.removeChild(exportMenu);
      document.activeElement.blur();
    }
  }

  if (typeof createHtmlFormCookie === 'undefined') {
    createHtmlFormCookie = createHtmlForCookie;
  }

  function removeCookie(name, url, callback) {
    cookieHandler.removeCookie(name, url || getCurrentTabUrl(), function (e) {
      if (callback) {
        callback();
      }
      if (browserDetector.isSafari()) {
        onCookiesChanged();
      }
    });
  }

  function onCookiesChanged(changeInfo) {
    if (!changeInfo) {
      showCookiesForTab();
      return;
    }

    const id = Cookie.hashCode(changeInfo.cookie);

    if (changeInfo.cause === 'overwrite') {
      return;
    }

    if (changeInfo.removed) {
      if (loadedCookies[id]) {
        loadedCookies[id].removeHtml(() => {
          if (!Object.keys(loadedCookies).length) {
            showNoCookies();
          }
        });
        delete loadedCookies[id];
      }
      return;
    }

    if (loadedCookies[id]) {
      loadedCookies[id].updateHtml(changeInfo.cookie);
      return;
    }

    const newCookie = new Cookie(id, changeInfo.cookie, optionHandler);
    loadedCookies[id] = newCookie;

    if (!cookiesListHtml && document.getElementById('no-cookies')) {
      clearChildren(containerCookie);
      cookiesListHtml = document.createElement('ul');
      cookiesListHtml.appendChild(generateSearchBar());
      containerCookie.appendChild(cookiesListHtml);
    }

    if (cookiesListHtml) {
      cookiesListHtml.appendChild(newCookie.html);
    }
  }

  function sortCookiesByName(a, b) {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    return aName < bName ? -1 : aName > bName ? 1 : 0;
  }

  async function initWindow(_tab) {
    await optionHandler.loadOptions();
    themeHandler.updateTheme();
    moveButtonBar();
    handleAnimationsEnabled();
    optionHandler.on('optionsChanged', onOptionsChanged);
    cookieHandler.on('cookiesChanged', onCookiesChanged);
    cookieHandler.on('ready', showCookiesForTab);
    document.querySelector('#advanced-toggle-all').checked =
      optionHandler.getCookieAdvanced();
    if (cookieHandler.isReady) {
      showCookiesForTab();
    }
    showVersion();
  }

  function getCurrentTabUrl() {
    if (cookieHandler.currentTab) {
      return cookieHandler.currentTab.url;
    }
    return '';
  }

  function getDomainFromUrl(url) {
    const matches = url.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
    return matches && matches[1];
  }

  function sendNotification(message) {
    notificationQueue.push(message);
    triggerNotification();
  }

  function generateSearchBar() {
    const searchBarContainer = document.importNode(
      document.getElementById('tmp-search-bar').content,
      true,
    );
    searchBarContainer
      .getElementById('searchField')
      .addEventListener('keyup', (e) =>
        filterCookies(e.target, e.target.value),
      );
    return searchBarContainer;
  }

  function triggerNotification() {
    if (!notificationQueue || !notificationQueue.length) {
      return;
    }
    if (notificationTimeout) {
      return;
    }
    if (notificationElement.classList.contains('fadeInUp')) {
      return;
    }

    showNotification();
  }

  function showNotification() {
    if (notificationTimeout) {
      return;
    }

    notificationElement.parentElement.style.display = 'block';
    notificationElement.querySelector('#notification-dismiss').style.display =
      'block';
    notificationElement.querySelector('span').textContent =
      notificationQueue.shift();
    notificationElement.querySelector('span').setAttribute('role', 'alert');
    notificationElement.classList.add('fadeInUp');
    notificationElement.classList.remove('fadeOutDown');

    notificationTimeout = setTimeout(() => {
      hideNotification();
    }, 2500);
  }

  function hideNotification() {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }

    notificationElement.querySelector('span').setAttribute('role', '');
    notificationElement.classList.remove('fadeInUp');
    notificationElement.classList.add('fadeOutDown');
    notificationElement.querySelector('#notification-dismiss').style.display =
      'none';
  }

  function setPageTitle(title) {
    if (!pageTitleContainer) {
      return;
    }

    pageTitleContainer.querySelector('h1').textContent = title;
  }

  function copyText(text) {
    const fakeText = document.createElement('textarea');
    fakeText.classList.add('clipboardCopier');
    fakeText.textContent = text;
    document.body.appendChild(fakeText);
    fakeText.focus();
    fakeText.select();
    document.execCommand('Copy');
    document.body.removeChild(fakeText);
  }

  function isArray(value) {
    return value && typeof value === 'object' && value.constructor === Array;
  }

  function clearChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function adjustWidthIfSmaller() {
    const realWidth = document.documentElement.clientWidth;
    if (realWidth < 500) {
      document.body.style.minWidth = '100%';
    document.body.style.width = realWidth + 'px';
  }}

  function setActiveButtonBar(barId) {
    const buttonBars = [
        'button-bar-default',
        'button-bar-add',
        'button-bar-import',
        'button-bar-changelog',
        'button-bar-all-cookies'
    ];

    buttonBars.forEach(id => {
        const bar = document.getElementById(id);
        if (bar) {
            bar.classList.remove('active');
        }
    });

    if (barId) {
        const bar = document.getElementById(barId);
        if (bar) {
            bar.classList.add('active');
        }
    }
  }

  function filterCookies(target, filterText) {
    const cookies = cookiesListHtml.querySelectorAll('.cookie');
    filterText = filterText.toLowerCase();

    if (filterText) {
      target.classList.add('content');
    } else {
      target.classList.remove('content');
    }

    for (let i = 0; i < cookies.length; i++) {
      const cookieElement = cookies[i];
      const cookieName = cookieElement.children[0]
        .getElementsByTagName('span')[0]
        .textContent.toLocaleLowerCase();
      if (!filterText || cookieName.indexOf(filterText) > -1) {
        cookieElement.classList.remove('hide');
      } else {
        cookieElement.classList.add('hide');
      }
    }
  }

  function filterDomains(event) {
    const filterText = event.target.value.toLowerCase();
    const domains = containerCookie.querySelectorAll('.domain-entry');

    if (filterText) {
        event.target.classList.add('content');
    } else {
        event.target.classList.remove('content');
    }

    for (const domainElement of domains) {
        const domainName = domainElement.querySelector('.domain-name').textContent.toLowerCase();
        if (!filterText || domainName.indexOf(filterText) > -1) {
            domainElement.classList.remove('hide');
        } else {
            domainElement.classList.add('hide');
        }
    }
  }


  function onOptionsChanged(oldOptions) {
    handleAnimationsEnabled();
    moveButtonBar();
    if (oldOptions.advancedCookies != optionHandler.getCookieAdvanced()) {
      document.querySelector('#advanced-toggle-all').checked =
        optionHandler.getCookieAdvanced();
      showCookiesForTab();
    }

    if (oldOptions.extraInfo != optionHandler.getExtraInfo()) {
      showCookiesForTab();
    }
  }

  function moveButtonBar() {
    const siblingElement = optionHandler.getButtonBarTop()
      ? document.getElementById('pageTitle').nextSibling
      : document.body.lastChild;
    document.querySelectorAll('.button-bar').forEach((bar) => {
      siblingElement.parentNode.insertBefore(bar, siblingElement);
      if (optionHandler.getButtonBarTop()) {
        document.body.classList.add('button-bar-top');
      } else {
        document.body.classList.remove('button-bar-top');
      }
    });
  }
function getPrimaryDomain(domain) {
    if (!domain) return 'Unknown';
    const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
    const parts = cleanDomain.split('.');
    if (parts.length <= 2) {
        return cleanDomain;
    }
    return parts.slice(-2).join('.');
}

function showDomainList(logContainer) {
  changelogView = 'domains';
  setPageTitle('Cookie Trace - История изменений');
  if (!logContainer) return;

  const contentContainer = logContainer.querySelector('.changelog-content') || logContainer;

  contentContainer.innerHTML = '<p style="text-align: center;">Загрузка сайтов...</p>';

  browserDetector.getApi().runtime.sendMessage({ type: 'getLogs' }, (logs) => {
    if (!logContainer) return;
    const inner = logContainer.querySelector('.changelog-content') || logContainer;
    inner.innerHTML = '';

    if (!logs || logs.length === 0) {
      const noLogsMessage = document.createElement('p');
      noLogsMessage.textContent = 'История изменений пуста.';
      noLogsMessage.style.textAlign = 'center';
      inner.appendChild(noLogsMessage);
      return;
    }

    const domains = logs.reduce((acc, log) => {
      const domain = getPrimaryDomain(log.domain || (log.cookie && log.cookie.domain));
      if (!acc[domain]) {
        acc[domain] = [];
      }
      acc[domain].push(log);
      return acc;
    }, {});

    const domainKeys = Object.keys(domains).sort();

    if (domainKeys.length === 0) {
      const noLogsMessage = document.createElement('p');
      noLogsMessage.textContent = 'История изменений пуста.';
      noLogsMessage.style.textAlign = 'center';
      inner.appendChild(noLogsMessage);
      return;
    }

    const domainList = document.createElement('div');
    domainList.className = 'domain-list';

    domainKeys.forEach(domain => {
      const domainEntry = document.createElement('div');
      domainEntry.className = 'domain-entry';
      domainEntry.innerHTML = `
        <span class="domain-name">${domain}</span>
        <span class="domain-log-count">${domains[domain].length}</span>
      `;
      domainEntry.addEventListener('click', () => showLogsForDomain(logContainer, domain, domains[domain]));
      domainList.appendChild(domainEntry);
    });

    inner.appendChild(domainList);
  });
}

function showLogsForDomain(logContainer, domain, logs) {
  changelogView = 'logs';
  setPageTitle(`История - ${domain}`);
  if (!logContainer) return;

  const contentContainer = logContainer.querySelector('.changelog-content') || logContainer;

  contentContainer.innerHTML = '';

    const headers = document.createElement('div');
  headers.className = 'changelog-headers';
    headers.innerHTML = `
      <div class="log-column type">Тип изменения</div>
      <div class="log-column name">Название cookie</div>
      <div class="log-column date">Дата</div>
    `;
    contentContainer.appendChild(headers);

    const logList = document.createElement('div');
  logList.className = 'log-list';
    logs.forEach(log => {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';

      const categoryText = {
        'addition': 'Добавление',
        'modification': 'Изменение',
        'deletion': 'Удаление'
      };
      const categoryIcon = {
        'addition': 'plus',
        'modification': 'pen',
        'deletion': 'trash'
      };

      logEntry.innerHTML = `
        <div class="log-column type"><svg class="icon" style="width: 16px; height: 16px; margin-right: 8px;"><use href="../sprites/solid.svg#${categoryIcon[log.category] || 'circle-info'}"></use></svg>${categoryText[log.category] || 'Неизвестно'}</div>
        <div class="log-column name">${log.cookieName || (log.cookie && log.cookie.name)}</div>
        <div class="log-column date">${new Date(log.timestamp).toLocaleString()}</div>
      `;
      logEntry.addEventListener('click', () => {
        showLogDetails(log);
        logEntry.classList.add('clicked');
        setTimeout(() => {
            logEntry.classList.remove('clicked');
        }, 1000);
      });
      logList.appendChild(logEntry);
    });
    contentContainer.appendChild(logList);
}
})();