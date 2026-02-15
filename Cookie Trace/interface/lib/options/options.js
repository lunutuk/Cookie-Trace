import { ExportFormats } from './exportFormats.js';
import { ExtraInfos } from './extraInfos.js';
import { Themes } from './themes.js';

export class Options {
  constructor() {
    this.advancedCookies = false;
    this.devtoolsEnabled = true;
    this.animationsEnabled = true;
    this.mlEnabled = true;
    this.profilingProtectionEnabled = false;
    this.profilingProtectionThresholdPercent = 95;
    this.exportFormat = ExportFormats.Ask;
    this.extraInfo = ExtraInfos.Nothing;
    this.theme = Themes.Auto;
    this.buttonBarTop = false;
    this.longLivedCookieThreshold = 'off';
    this.piiScanMode = 'off';
    this.piiBrowserNotificationsEnabled = true;
    this.changelogLimit = 300;
  }
}