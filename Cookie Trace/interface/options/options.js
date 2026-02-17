
import { BrowserDetector } from '../lib/browserDetector.js';
import { Cookie } from '../lib/cookie.js';
import { GenericStorageHandler } from '../lib/genericStorageHandler.js';
import { JsonFormat } from '../lib/jsonFormat.js';
import { NetscapeFormat } from '../lib/netscapeFormat.js';
import { OptionsHandler } from '../lib/optionsHandler.js';
import { PermissionHandler } from '../lib/permissionHandler.js';
import { ThemeHandler } from '../lib/themeHandler.js';
import { GenericCookieHandler } from '../lib/genericCookieHandler.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Options page loaded");
  const browserDetector = new BrowserDetector();
  const storageHandler = new GenericStorageHandler(browserDetector);
  const optionHandler = new OptionsHandler(browserDetector, storageHandler);
  const themeHandler = new ThemeHandler(optionHandler);
  const permissionHandler = new PermissionHandler(browserDetector);
  const genericCookieHandler = new GenericCookieHandler(browserDetector);

  const advancedCookieInput = document.getElementById('advanced-cookie');
  const animationsEnabledInput = document.getElementById('animations-enabled');
  const exportFormatInput = document.getElementById('export-format');
  const extraInfoInput = document.getElementById('extra-info');
  const themeInput = document.getElementById('theme');
  const buttonBarTopInput = document.getElementById('button-bar-top');
  const longLivedCookieThresholdInput = document.getElementById('long-lived-cookie-threshold');
  const piiScanModeInput = document.getElementById('pii-scan-mode');
  const piiBrowserNotificationsEnabledInput = document.getElementById('pii-browser-notifications-enabled');
  const mlEnabledInput = document.getElementById('ml-enabled');
  const profilingProtectionEnabledInput = document.getElementById('profiling-protection-enabled');
  const profilingProtectionThresholdInput = document.getElementById('profiling-protection-threshold');
  const changelogLimitInput = document.getElementById('changelog-limit');

  try {
    await optionHandler.loadOptions();
    console.log("Options loaded:", optionHandler.options);
    themeHandler.updateTheme();
    setFormValues();
  } catch (error) {
      console.error("Error initializing options page:", error);
  }

  function updateProfilingProtectionUi() {
    if (!profilingProtectionEnabledInput || !profilingProtectionThresholdInput) return;

    const enabled = !!profilingProtectionEnabledInput.checked;
    profilingProtectionThresholdInput.disabled = !enabled;

    const subOption = document.getElementById('profiling-protection-threshold-suboption');
    if (subOption) {
      subOption.classList.toggle('is-disabled', !enabled);
      subOption.classList.toggle('hidden', !enabled);
    }
  }

  optionHandler.on('optionsChanged', (oldOptions) => {
      console.log("Options changed event received", oldOptions, optionHandler.options);
      setFormValues();
      themeHandler.updateTheme();
      handleAnimationsEnabled();
  });

  setInputEvents();

  updateProfilingProtectionUi();

  function setFormValues() {
    if (!optionHandler.options) {
        console.warn("setFormValues called before options are loaded.");
        return;
    }
    handleAnimationsEnabled();
    advancedCookieInput.checked = optionHandler.getCookieAdvanced();
    animationsEnabledInput.checked = optionHandler.getAnimationsEnabled();
    exportFormatInput.value = optionHandler.getExportFormat();
    extraInfoInput.value = optionHandler.getExtraInfo();
    themeInput.value = optionHandler.getTheme();
    buttonBarTopInput.checked = optionHandler.getButtonBarTop();
    longLivedCookieThresholdInput.value = optionHandler.getLongLivedCookieThreshold();
    piiScanModeInput.value = optionHandler.getPiiScanMode();
    if (piiBrowserNotificationsEnabledInput) {
      piiBrowserNotificationsEnabledInput.checked = optionHandler.getPiiBrowserNotificationsEnabled();
    }
    mlEnabledInput.checked = optionHandler.getMlEnabled();
    profilingProtectionEnabledInput.checked = optionHandler.getProfilingProtectionEnabled();
    profilingProtectionThresholdInput.value = optionHandler.getProfilingProtectionThresholdPercent();
    changelogLimitInput.value = optionHandler.options.changelogLimit;

    updateProfilingProtectionUi();
  }

  function setInputEvents() {
    advancedCookieInput.addEventListener('change', () => {
      console.log('Advanced cookie changed:', advancedCookieInput.checked);
      optionHandler.setCookieAdvanced(advancedCookieInput.checked);
    });
    animationsEnabledInput.addEventListener('change', () => {
      console.log('Animations enabled changed:', animationsEnabledInput.checked);
      optionHandler.setAnimationsEnabled(animationsEnabledInput.checked);
      handleAnimationsEnabled();
    });
    exportFormatInput.addEventListener('change', () => {
      console.log('Export format changed:', exportFormatInput.value);
      optionHandler.setExportFormat(exportFormatInput.value);
    });
    extraInfoInput.addEventListener('change', () => {
      console.log('Extra info changed:', extraInfoInput.value);
      optionHandler.setExtraInfo(extraInfoInput.value);
    });
    themeInput.addEventListener('change', () => {
      console.log('Theme changed:', themeInput.value);
      optionHandler.setTheme(themeInput.value);
    });
    buttonBarTopInput.addEventListener('change', () => {
      console.log('Button bar top changed:', buttonBarTopInput.checked);
      optionHandler.setButtonBarTop(buttonBarTopInput.checked);
    });
    longLivedCookieThresholdInput.addEventListener('change', () => {
      console.log('Long lived cookie threshold changed:', longLivedCookieThresholdInput.value);
      optionHandler.setLongLivedCookieThreshold(longLivedCookieThresholdInput.value);
    });
    piiScanModeInput.addEventListener('change', () => {
      console.log('PII scan mode changed:', piiScanModeInput.value);
      optionHandler.setPiiScanMode(piiScanModeInput.value);
    });
    if (piiBrowserNotificationsEnabledInput) {
      piiBrowserNotificationsEnabledInput.addEventListener('change', () => {
        console.log('PII browser notifications changed:', piiBrowserNotificationsEnabledInput.checked);
        optionHandler.setPiiBrowserNotificationsEnabled(piiBrowserNotificationsEnabledInput.checked);
      });
    }
    mlEnabledInput.addEventListener('change', () => {
      console.log('ML enabled changed:', mlEnabledInput.checked);
      optionHandler.setMlEnabled(mlEnabledInput.checked);
    });
    profilingProtectionEnabledInput.addEventListener('change', () => {
      console.log('Profiling protection enabled changed:', profilingProtectionEnabledInput.checked);
      optionHandler.setProfilingProtectionEnabled(profilingProtectionEnabledInput.checked);
      updateProfilingProtectionUi();
    });
    profilingProtectionThresholdInput.addEventListener('change', () => {
      const value = parseInt(profilingProtectionThresholdInput.value, 10);
      console.log('Profiling protection threshold changed:', value);
      optionHandler.setProfilingProtectionThresholdPercent(value);
      profilingProtectionThresholdInput.value = optionHandler.getProfilingProtectionThresholdPercent();
    });
    changelogLimitInput.addEventListener('change', () => {
      const value = parseInt(changelogLimitInput.value, 10);
      const min = 0;
      const max = 20000;
      if (isNaN(value) || value < min || value > max) {
        alert(`Значение должно быть в диапазоне от ${min} до ${max}.`);
        changelogLimitInput.value = optionHandler.options.changelogLimit;
        return;
      }
      console.log('Changelog limit changed:', value);
      optionHandler.options.changelogLimit = value;
      optionHandler.saveOptions();
    });

    document.getElementById('delete-all').addEventListener('click', deleteAllCookies);
    document.getElementById('export-all-json').addEventListener('click', () => exportCookiesAs(JsonFormat, 'JSON'));
    document.getElementById('export-all-netscape').addEventListener('click', () => exportCookiesAs(NetscapeFormat, 'Netscape'));
  }

  async function ensureAllUrlsPermission() {
    try {
        const hasPermissions = await permissionHandler.checkPermissions('<all_urls>');
        if (!hasPermissions) {
            console.log('Requesting <all_urls> permission...');
            const granted = await permissionHandler.requestPermission('<all_urls>');
            if (!granted) {
                alert('Необходимо разрешение на доступ ко всем URL для выполнения этой операции.');
                return false;
            }
            console.log('<all_urls> permission granted.');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return true;
    } catch(error) {
        console.error('Permission request failed:', error);
        alert('Ошибка при проверке разрешений.');
        return false;
    }
  }

  async function getAllBrowserCookies() {
    return new Promise((resolve) => {
      genericCookieHandler.getAllCookiesInBrowser((cookies) => {
        if (!cookies) {
          console.error("Failed to get all cookies. Check permissions and console logs.");
          resolve(null);
          return;
        }
        console.log(`Retrieved ${cookies.length} cookies.`);
        const loadedCookies = {};
        for (const cookie of cookies) {
          const id = Cookie.hashCode(cookie);
          loadedCookies[id] = new Cookie(id, cookie, optionHandler);
        }
        resolve(loadedCookies);
      });
    });
  }


  async function deleteAllCookies() {
    const hasPermission = await ensureAllUrlsPermission();
    if (!hasPermission) {
        console.log("Permission <all_urls> not granted. Aborting delete all.");
        return;
    }

    const deleteAll = confirm(
      'ВЫ УВЕРЕНЫ, что хотите удалить ВСЕ cookies для ВСЕХ сайтов?\nЭто действие необратимо и приведет к выходу из большинства учетных записей.'
    );
    if (!deleteAll) return;

    let cookiesToDelete;
    try {
        cookiesToDelete = await getAllBrowserCookies();
         if (!cookiesToDelete) {
             alert('Не удалось получить список cookies. Возможно, проблема с разрешениями.');
             return;
         }
    } catch (error) {
        console.error("Error fetching cookies for deletion:", error);
        alert('Ошибка при получении списка cookies для удаления.');
        return;
    }


    let deletedCount = 0;
    let failedCount = 0;
    const promises = [];
    const totalCookies = Object.keys(cookiesToDelete).length;
    console.log(`Attempting to delete ${totalCookies} cookies...`);

    for (const cookieId in cookiesToDelete) {
      const cookieData = cookiesToDelete[cookieId].cookie;
      const protocol = cookieData.secure ? 'https://' : 'http://';
      const domainForUrl = cookieData.domain.startsWith('.') ? cookieData.domain.substring(1) : cookieData.domain;
      if (!domainForUrl) {
        console.warn(`Skipping cookie "${cookieData.name}" due to missing domain.`);
        failedCount++;
        continue;
      }
      const url = protocol + domainForUrl + (cookieData.path || '/');

      promises.push(new Promise(resolve => {
        genericCookieHandler.removeCookie(cookieData.name, url, (error, _details) => {
            if (error) {
                console.warn(`Failed to delete cookie '${cookieData.name}' for ${url}:`, error);
                failedCount++;
            } else {
                deletedCount++;
            }
            resolve();
        }, false);
      }));
    }

    await Promise.allSettled(promises);

    console.log(`Deletion finished. Deleted: ${deletedCount}, Failed: ${failedCount}`);
    alert(`Удаление завершено.\nУдалено: ${deletedCount}\nНе удалось удалить: ${failedCount}`);
  }

  async function exportCookiesAs(Formatter, formatName) {
    const hasPermission = await ensureAllUrlsPermission();
    if (!hasPermission) {
        console.log("Permission <all_urls> not granted. Aborting export.");
        return;
    }

    let cookiesToExport;
     try {
         cookiesToExport = await getAllBrowserCookies();
         if (!cookiesToExport) {
             alert('Не удалось получить список cookies для экспорта. Проверьте разрешения.');
             return;
         }
    } catch (error) {
        console.error("Error fetching cookies for export:", error);
        alert('Ошибка при получении списка cookies для экспорта.');
        return;
    }

    try {
        const formattedCookies = Formatter.format(cookiesToExport);
        copyText(formattedCookies);
        alert('Cookies скопированы в буфер обмена в формате ' + formatName + '.');
    } catch (e) {
        console.error("Export formatting/copying failed:", e);
        alert('Ошибка при форматировании или копировании cookies.');
    }
  }

  function copyText(text) {
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const successful = document.execCommand('copy');
      const msg = successful ? 'успешно' : 'не';
      console.log(`Текст ${msg} скопирован в буфер обмена`);
      if(!successful) {
          throw new Error('document.execCommand returned false');
      }
    } catch (err) {
      console.error('Ошибка копирования в буфер обмена: ', err);
      alert('Не удалось автоматически скопировать текст. Пожалуйста, скопируйте вручную.');
    }
    document.body.removeChild(textarea);
  }

  function handleAnimationsEnabled() {
    if (optionHandler.getAnimationsEnabled()) {
      document.body.classList.remove('notransition');
    } else {
      document.body.classList.add('notransition');
    }
  }
});
