import { Component, Element, Event, EventEmitter, Listen, Prop } from '@stencil/core';
import { Config, GestureDetail } from '../../index';
import { GestureController, GestureDelegate } from '../gesture-controller/gesture-controller';


@Component({
  tag: 'ion-scroll'
})
export class Scroll {
  @Element() private el: HTMLElement;

  private gesture: GestureDelegate;
  private positions: number[] = [];
  private _l: number;
  private _t: number;
  private tmr: any;
  private queued = false;

  isScrolling: boolean = false;
  detail: ScrollDetail = {};

  @Prop({ context: 'config'}) config: Config;
  @Prop() enabled: boolean = true;
  @Prop() jsScroll: boolean = false;

  @Prop() onionScrollStart: ScrollCallback;
  @Prop() onionScroll: ScrollCallback;
  @Prop() onionScrollEnd: ScrollCallback;

  @Event() ionScrollStart: EventEmitter;
  @Event() ionScroll: EventEmitter;
  @Event() ionScrollEnd: EventEmitter;

  protected ionViewDidLoad() {
    if (Context.isServer) return;

    const gestureCtrl = Context.gesture = Context.gesture || new GestureController;
    this.gesture = gestureCtrl.createGesture('scroll', 100, false);
  }


  // Native Scroll *************************

  @Listen('scroll', { passive: true })
  onNativeScroll() {
    const self = this;

    if (!self.queued && self.enabled) {
      self.queued = true;

      Context.dom.read(function(timeStamp) {
        self.queued = false;
        self.onScroll(timeStamp || Date.now());
      });
    }
  }

  onScroll(timeStamp: number) {
    const self = this;
    const detail = self.detail;
    const positions = self.positions;

    detail.timeStamp = timeStamp;

    // get the current scrollTop
    // ******** DOM READ ****************
    detail.scrollTop = self.getTop();

    // get the current scrollLeft
    // ******** DOM READ ****************
    detail.scrollLeft = self.getLeft();

    if (!self.isScrolling) {
      // currently not scrolling, so this is a scroll start
      self.isScrolling = true;

      // remember the start positions
      detail.startY = detail.scrollTop;
      detail.startX = detail.scrollLeft;

      // new scroll, so do some resets
      detail.velocityY = detail.velocityX = detail.deltaY = detail.deltaX = positions.length = 0;

      // emit only on the first scroll event
      if (self.onionScrollStart) {
        self.onionScrollStart(detail);
      } else {
        self.ionScrollStart.emit(detail);
      }
    }

    // actively scrolling
    positions.push(detail.scrollTop, detail.scrollLeft, detail.timeStamp);

    if (positions.length > 3) {
      // we've gotten at least 2 scroll events so far
      detail.deltaY = (detail.scrollTop - detail.startY);
      detail.deltaX = (detail.scrollLeft - detail.startX);

      var endPos = (positions.length - 1);
      var startPos = endPos;
      var timeRange = (detail.timeStamp - 100);

      // move pointer to position measured 100ms ago
      for (var i = endPos; i > 0 && positions[i] > timeRange; i -= 3) {
        startPos = i;
      }

      if (startPos !== endPos) {
        // compute relative movement between these two points
        var movedTop = (positions[startPos - 2] - positions[endPos - 2]);
        var movedLeft = (positions[startPos - 1] - positions[endPos - 1]);
        var factor = 16.67 / (positions[startPos] - positions[endPos]);

        // based on XXms compute the movement to apply for each render step
        detail.velocityY = movedTop * factor;
        detail.velocityX = movedLeft * factor;
      }
    }

    clearTimeout(self.tmr);
    self.tmr = setTimeout(function() {

      // haven't scrolled in a while, so it's a scrollend
      self.isScrolling = false;

      Context.dom.read(function(timeStamp) {
        if (!self.isScrolling) {
          self.onEnd(timeStamp);
        }
      });
    }, 80);

    // emit on each scroll event
    if (self.onionScroll) {
      self.onionScroll(detail);
    } else {
      self.ionScroll.emit(detail);
    }
  }


  onEnd(timeStamp: number) {
    const detail = this.detail;

    detail.timeStamp = timeStamp || Date.now();

    // emit that the scroll has ended
    if (this.onionScrollEnd) {
      this.onionScrollEnd(detail);
    } else {
      this.ionScrollEnd.emit(detail);
    }
  }


  enableJsScroll(contentTop: number, contentBottom: number) {
    this.jsScroll = true;

    Context.enableListener(this, 'scroll', false);
    Context.enableListener(this, 'touchstart', true);

    contentTop; contentBottom;
  }


  // Touch Scroll *************************

  @Listen('touchstart', { passive: true, enabled: false })
  onTouchStart() {
    if (!this.enabled) {
      return;
    }

    Context.enableListener(this, 'touchmove', true);
    Context.enableListener(this, 'touchend', true);

    throw 'jsScroll: TODO!';
  }

  @Listen('touchmove', { passive: true, enabled: false })
  onTouchMove() {
    if (!this.enabled) {
      return;
    }
  }

  @Listen('touchend', { passive: true, enabled: false })
  onTouchEnd() {
    Context.enableListener(this, 'touchmove', false);
    Context.enableListener(this, 'touchend', false);

    if (!this.enabled) {
      return;
    }
  }


  /**
   * DOM READ
   */
  getTop() {
    if (this.jsScroll) {
      return this._t;
    }
    return this._t = this.el.scrollTop;
  }

  /**
   * DOM READ
   */
  getLeft() {
    if (this.jsScroll) {
      return 0;
    }
    return this._l = this.el.scrollLeft;
  }

  /**
   * DOM WRITE
   */
  setTop(top: number) {
    this._t = top;

    if (this.jsScroll) {
      this.el.style.transform = this.el.style.webkitTransform = `translate3d(${this._l * -1}px,${top * -1}px,0px)`;

    } else {
      this.el.scrollTop = top;
    }
  }

  /**
   * DOM WRITE
   */
  setLeft(left: number) {
    this._l = left;

    if (this.jsScroll) {
      this.el.style.transform = this.el.style.webkitTransform = `translate3d(${left * -1}px,${this._t * -1}px,0px)`;

    } else {
      this.el.scrollLeft = left;
    }
  }

  scrollToPoint(x: number, y: number, duration: number, done?: Function): Promise<any> {
    // scroll animation loop w/ easing
    // credit https://gist.github.com/dezinezync/5487119

    let promise: Promise<any>;
    if (done === undefined) {
      // only create a promise if a done callback wasn't provided
      // done can be a null, which avoids any functions
      promise = new Promise(resolve => {
        done = resolve;
      });
    }

    const self = this;
    const el = self.el;
    if (!el) {
      // invalid element
      done();
      return promise;
    }

    if (duration < 32) {
      self.setTop(y);
      self.setLeft(x);
      done();
      return promise;
    }

    const fromY = el.scrollTop;
    const fromX = el.scrollLeft;

    const maxAttempts = (duration / 16) + 100;

    let startTime: number;
    let attempts = 0;
    let stopScroll = false;

    // scroll loop
    function step(timeStamp: number) {
      attempts++;

      if (!self.el || stopScroll || attempts > maxAttempts) {
        self.isScrolling = false;
        el.style.transform = el.style.webkitTransform = '';
        done();
        return;
      }

      let time = Math.min(1, ((timeStamp - startTime) / duration));

      // where .5 would be 50% of time on a linear scale easedT gives a
      // fraction based on the easing method
      let easedT = (--time) * time * time + 1;

      if (fromY !== y) {
        self.setTop((easedT * (y - fromY)) + fromY);
      }

      if (fromX !== x) {
        self.setLeft(Math.floor((easedT * (x - fromX)) + fromX));
      }

      if (easedT < 1) {
        // do not use DomController here
        // must use nativeRaf in order to fire in the next frame
        Context.dom.raf(step);

      } else {
        stopScroll = true;
        self.isScrolling = false;
        el.style.transform = el.style.webkitTransform = '';
        done();
      }
    }

    // start scroll loop
    self.isScrolling = true;

    // chill out for a frame first
    Context.dom.write(() => {
      Context.dom.write(timeStamp => {
        startTime = timeStamp;
        step(timeStamp);
      });
    });

    return promise;
  }

  scrollToTop(duration: number): Promise<void> {
    return this.scrollToPoint(0, 0, duration);
  }

  scrollToBottom(duration: number): Promise<void> {
    let y = 0;
    if (this.el) {
      y = this.el.scrollHeight - this.el.clientHeight;
    }
    return this.scrollToPoint(0, y, duration);
  }


  protected ionViewDidUnload() {
    this.gesture && this.gesture.destroy();
    this.gesture = this.detail = this.detail.event = null;
  }

  protected render() {
    return (
      <div class='scroll-inner'>
        <slot></slot>
      </div>
    );
  }

}

export interface ScrollDetail extends GestureDetail {
  scrollTop?: number;
  scrollLeft?: number;
  scrollHeight?: number;
  scrollWidth?: number;
  contentHeight?: number;
  contentWidth?: number;
  contentTop?: number;
  contentBottom?: number;
  contentElement?: HTMLElement;
  fixedElement?: HTMLElement;
  scrollElement?: HTMLElement;
  headerElement?: HTMLElement;
  footerElement?: HTMLElement;
}


export interface ScrollCallback {
  (detail?: ScrollDetail): boolean|void;
}
