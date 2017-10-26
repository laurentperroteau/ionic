import { Component, Element, Prop } from '@stencil/core';
import { Config, ScrollDetail } from '../../index';
import { createThemedClasses, getElementClassObject } from '../../utils/theme';
import { getParentElement } from '../../utils/helpers';

@Component({
  tag: 'ion-content',
  styleUrls: {
    ios: 'content.ios.scss',
    md: 'content.md.scss',
    wp: 'content.wp.scss'
  }
})
export class Content {
  private mode: string;
  private color: string;

  private cTop = 0;
  private cBottom = 0;
  private dirty = false;

  scrollEl: any;
  $scrollDetail: ScrollDetail = {};
  $fixed: HTMLElement;
  $siblingHeader: HTMLElement;
  $siblingFooter: HTMLElement;

  @Element() private el: HTMLElement;
  @Prop({ context: 'config' }) config: Config;

  /**
   * @output {ScrollEvent} Emitted when the scrolling first starts.
   */
  @Prop() ionScrollStart: Function;

  /**
   * @output {ScrollEvent} Emitted on every scroll event.
   */
  @Prop() ionScroll: Function;

  /**
   * @output {ScrollEvent} Emitted when scrolling ends.
   */
  @Prop() ionScrollEnd: Function;

  /**
   * @input {boolean} If true, the content will scroll behind the headers
   * and footers. This effect can easily be seen by setting the toolbar
   * to transparent.
   */
  @Prop() fullscreen: boolean = false;

  protected ionViewDidLoad() {
    this.scrollEl = this.el.querySelector('ion-scroll') as any;
    this.resize();
  }

  protected ionViewDidUnload() {
    this.$fixed = this.scrollEl = this.$siblingFooter = this.$siblingHeader = this.$scrollDetail = null;
  }

  enableJsScroll() {
    this.scrollEl.jsScroll = true;
  }

  /**
   * Scroll to the top of the content component.
   *
   * @param {number} [duration]  Duration of the scroll animation in milliseconds. Defaults to `300`.
   * @returns {Promise} Returns a promise which is resolved when the scroll has completed.
   */
  scrollToTop(duration: number = 300) {
    return this.scrollEl.scrollToTop(duration);
  }

  /**
   * Scroll to the bottom of the content component.
   *
   * @param {number} [duration]  Duration of the scroll animation in milliseconds. Defaults to `300`.
   * @returns {Promise} Returns a promise which is resolved when the scroll has completed.
   */
  scrollToBottom(duration: number = 300) {
    return this.scrollEl.scrollToBottom(duration);
  }

  resize() {
    if (!this.scrollEl) {
      return;
    }
    if (this.fullscreen) {
      Context.dom.read(() => {
        Context.dom.read(this.readDimensions.bind(this));
        Context.dom.write(this.writeDimensions.bind(this));
      });
    } else {
      Context.dom.write(() => this.scrollEl.style = null);
    }
  }

  readDimensions() {
    const parent = getParentElement(this.el);
    const top = Math.max(this.el.offsetTop, 0);
    const bottom = Math.max(parent.offsetHeight - top - this.el.offsetHeight, 0);
    this.dirty = top !== this.cTop || bottom !== this.cBottom;
    this.cTop = top;
    this.cBottom = bottom;
  }

  writeDimensions() {
    if (!this.dirty) {
      return;
    }
    const style = this.scrollEl.style;
    style.paddingTop = this.cTop + 'px';
    style.paddingBottom = this.cBottom + 'px';
    style.top = -this.cTop + 'px';
    style.bottom = -this.cBottom + 'px';
    this.dirty = false;
  }

  protected render() {
    const props: any = {};

    if (this.ionScrollStart) {
      props['ionScrollStart'] = this.ionScrollStart.bind(this);
    }
    if (this.ionScroll) {
      props['ionScroll'] = this.ionScroll.bind(this);
    }
    if (this.ionScrollEnd) {
      props['ionScrollEnd'] = this.ionScrollEnd.bind(this);
    }

    const themedClasses = createThemedClasses(this.mode, this.color, 'content');
    const hostClasses = getElementClassObject(this.el.classList);

    const scrollClasses = {
      ...themedClasses,
      ...hostClasses,
    };

    this.resize();

    return [
      <ion-scroll class={scrollClasses}>
        <slot></slot>
      </ion-scroll>,
      <slot name='fixed'></slot>
    ];
  }
}
