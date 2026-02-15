import { GenericStorageHandler } from './genericStorageHandler.js';

const LOG_STORAGE_key = 'cookie_change_log';
const OPTIONS_STORAGE_KEY = 'all_options';

export class LogHandler {
  constructor(browserDetector) {
    this.storageHandler = new GenericStorageHandler(browserDetector);
  }

  async addLog(oldCookie, newCookie, source = 'website') {
    const [logs, options] = await Promise.all([
      this.getLogs(),
      this.storageHandler.getLocal(OPTIONS_STORAGE_KEY)
    ]);

    const maxLogEntries = (options && options.changelogLimit) ? options.changelogLimit : 2000;

    const relevantCookie = newCookie || oldCookie;

    if (!relevantCookie) {
        console.warn('Cookie Trace: Skipping log entry due to missing cookie data (both oldCookie and newCookie are null).');
        return; 
    }

    let category;
    if (!oldCookie && newCookie) {
      category = 'addition';
    } else if (oldCookie && !newCookie) {
      category = 'deletion';
    } else {
      category = 'modification';
    }

    const newLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      category,
      source,
      cookieName: relevantCookie.name || 'Unknown Name',
      domain: relevantCookie.domain || 'Unknown Domain',
      change: {
        before: oldCookie,
        after: newCookie,
      },
    };

    logs.unshift(newLog);

    if (logs.length > maxLogEntries) {
      logs.splice(maxLogEntries);
    }

    await this.storageHandler.setLocal(LOG_STORAGE_key, logs);
  }

  async getLogs() {
    const logs = await this.storageHandler.getLocal(LOG_STORAGE_key);
    return Array.isArray(logs) ? logs : [];
  }

  async clearLogs() {
    await this.storageHandler.setLocal(LOG_STORAGE_key, []);
  }
}
