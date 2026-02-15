
export class Animate {
  
  static toggleSlide(el, callback = null) {
    let elMaxHeight = 0;
    const self = this;

    el.style.display = 'flex';

    el.addEventListener(
      'transitionend',
      function () {
        if (callback) {
          callback();
        }

        if (self.isHidden(el)) {
          el.style.display = 'none';
        }

        
        document.body.style.height = '100%';
        setTimeout(function () {
          document.body.style.height = '';
        }, 10);
      },
      {
        once: true,
      },
    );

    if (el.getAttribute('data-max-height')) {
     
      if (this.isHidden(el)) {
       
        setTimeout(function () {
          el.style.maxHeight = el.getAttribute('data-max-height');
        }, 10);
      } else {
        elMaxHeight = this.getHeight(el) + 'px';
        el.setAttribute('data-max-height', elMaxHeight);
        el.style.maxHeight = '0';
      }
    } else {
      elMaxHeight = this.getHeight(el) + 'px';
      el.style.transition = 'max-height 0.25s ease-in-out';
      el.style.overflowY = 'hidden';
     
      el.setAttribute('data-max-height', elMaxHeight);

      let nextMaxHeight;
      if (el.offsetHeight > 0) {
        nextMaxHeight = 0;
        el.style.maxHeight = elMaxHeight;
      } else {
        nextMaxHeight = elMaxHeight;
        el.style.maxHeight = 0;
      }

      setTimeout(function () {
        el.style.maxHeight = nextMaxHeight;
      }, 10);
    }
  }

  
  static resizeSlide(el, callback = null) {
    if (callback) {
      el.addEventListener(
        'transitionend',
        function () {
          callback();
        },
        {
          once: true,
        },
      );
    }
    const elMaxHeight = this.getHeight(el, true) + 'px';
    el.style.transition = 'max-height 0.25s ease-in-out';
    el.style.overflowY = 'hidden';
    
    el.setAttribute('data-max-height', elMaxHeight);

    const nextMaxHeight = elMaxHeight;
    el.style.maxHeight = el.offsetHeight;

   
    setTimeout(function () {
      el.style.maxHeight = nextMaxHeight;
    }, 10);
  }

  
  static transitionPage(
    container,
    oldPage,
    newPage,
    direction = 'left',
    callback = null,
    animationsEnabled = true,
  ) {
    if (!animationsEnabled) {
      if (oldPage) {
        oldPage.remove();
      }
      container.appendChild(newPage);
      callback();
      return;
    }
    const animationTime = '0.3s';

    container.addEventListener(
      'transitionend',
      () => {
        container.style.maxHeight = '';
        container.style.transition = '';
        container.style.display = '';
        container.style.width = '';
        container.style.transform = '';
        container.style.overflowY = 'auto';
        if (oldPage) {
          oldPage.remove();
        }
        callback();
      },
      {
        passive: true,
        once: true,
      },
    );

    container.style.overflowY = 'hidden';
    container.style.width = '200%';
    container.style.display = 'flex';

    if (oldPage) {
      oldPage.style.flex = '0 0 50%';
    }
    newPage.style.flex = '0 0 50%';

    if (direction === 'left') {
      container.appendChild(newPage);
    } else {
      container.insertBefore(newPage, container.firstChild);
     
    }

    
    if (window.isPopup) {
      let newPageHeight = this.getHeight(newPage);
      const oldPageHeight = oldPage ? this.getHeight(oldPage) : 0;
      container.style.maxHeight = oldPageHeight + 'px';

      if (newPageHeight > 400) {
        newPageHeight = 400;
      }

      setTimeout(() => {
        let transition = `max-height ${animationTime} ease-in-out`;
        if (container.style.transition) {
          transition = ', ' + transition;
        }
        container.style.transition += transition;
        setTimeout(() => {
          container.style.maxHeight = newPageHeight + 'px';
        }, 1);
      }, 1);
    }

    if (direction === 'left') {
      let transition = `transform ${animationTime} ease-in-out`;
      if (container.style.transition) {
        transition = ', ' + transition;
      }
      container.style.transition += transition;
      setTimeout(() => {
        container.style.transform = 'translateX(-50%)';
      }, 10);
    } else {
      container.style.transform = 'translateX(-50%)';
      setTimeout(() => {
        let transition = `transform ${animationTime} ease-in-out`;
        if (container.style.transition) {
          transition = ', ' + transition;
        }
        container.style.transition += transition;
        setTimeout(() => {
          container.style.transform = 'translateX(0)';
        }, 1);
      }, 1);
    }
  }

  
  static getHeight(el, ignoreMaxHeight) {
    const elStyle = window.getComputedStyle(el);
    const elMaxHeight = elStyle.maxHeight;
    const elMaxHeightInt = elMaxHeight.replace('px', '').replace('%', '');

   
    if (!ignoreMaxHeight && elMaxHeightInt !== '0' && elMaxHeight !== 'none') {
      return el.offsetHeight;
    }

    const previousDisplay = el.style.display;

   
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    el.style.display = 'block';
    el.style.maxHeight = 'none';

    const wantedHeight = el.offsetHeight;

   
    el.style.display = previousDisplay;
    el.style.position = '';
    el.style.visibility = '';
    el.style.maxHeight = elMaxHeight;

    return wantedHeight;
  }

 
  static isHidden(el) {
    return el.style.maxHeight.replace('px', '').replace('%', '') === '0';
  }
}
