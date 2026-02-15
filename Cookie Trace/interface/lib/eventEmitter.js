
export class EventEmitter {
  
  constructor() {
    this.queue = {};
  }

  
  emit(event, ...params) {
    const queue = this.queue[event];

    if (typeof queue === 'undefined') {
      return;
    }

    queue.forEach(function (callback) {
      callback(...params);
    });
  }

 
  on(event, callback) {
    if (typeof this.queue[event] === 'undefined') {
      this.queue[event] = [];
    }

    this.queue[event].push(callback);
  }
}
