import { Themes } from './options/themes.js';


export class ThemeHandler {

  constructor(optionHandler) {
    this.optionHandler = optionHandler;
    optionHandler.on('optionsChanged', this.onOptionsChanged);
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (event) => {
        
        this.updateTheme();
      });
  }

  
  updateTheme() {
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const selectedTheme = this.optionHandler.getTheme();
    switch (selectedTheme) {
      case Themes.Light:
      case Themes.Dark:
        document.body.dataset.theme = selectedTheme;
        break;
      default:
        if (prefersDarkScheme.matches) {
          document.body.dataset.theme = 'dark';
        } else {
          document.body.dataset.theme = 'light';
        }
        break;
    }
  }

  
  onOptionsChanged = (oldOptions) => {
    if (oldOptions.theme != this.optionHandler.getTheme()) {
      this.updateTheme();
    }
  };
}
