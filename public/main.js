"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ns-hugo-imp:/home/geo/.cache/hugo_cache/modules/filecache/modules/pkg/mod/github.com/encas-parka/hugo-cookbook-theme@v0.0.0-20251204214933-25586c2e961b/assets/js/bootstrap.bundle.js
  var require_bootstrap_bundle = __commonJS({
    "ns-hugo-imp:/home/geo/.cache/hugo_cache/modules/filecache/modules/pkg/mod/github.com/encas-parka/hugo-cookbook-theme@v0.0.0-20251204214933-25586c2e961b/assets/js/bootstrap.bundle.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.bootstrap = factory());
      })(exports, (function() {
        "use strict";
        const elementMap = /* @__PURE__ */ new Map();
        const Data = {
          set(element, key, instance) {
            if (!elementMap.has(element)) {
              elementMap.set(element, /* @__PURE__ */ new Map());
            }
            const instanceMap = elementMap.get(element);
            if (!instanceMap.has(key) && instanceMap.size !== 0) {
              console.error(`Bootstrap doesn't allow more than one instance per element. Bound instance: ${Array.from(instanceMap.keys())[0]}.`);
              return;
            }
            instanceMap.set(key, instance);
          },
          get(element, key) {
            if (elementMap.has(element)) {
              return elementMap.get(element).get(key) || null;
            }
            return null;
          },
          remove(element, key) {
            if (!elementMap.has(element)) {
              return;
            }
            const instanceMap = elementMap.get(element);
            instanceMap.delete(key);
            if (instanceMap.size === 0) {
              elementMap.delete(element);
            }
          }
        };
        const MAX_UID = 1e6;
        const MILLISECONDS_MULTIPLIER = 1e3;
        const TRANSITION_END = "transitionend";
        const parseSelector = (selector) => {
          if (selector && window.CSS && window.CSS.escape) {
            selector = selector.replace(/#([^\s"#']+)/g, (match, id) => `#${CSS.escape(id)}`);
          }
          return selector;
        };
        const toType = (object) => {
          if (object === null || object === void 0) {
            return `${object}`;
          }
          return Object.prototype.toString.call(object).match(/\s([a-z]+)/i)[1].toLowerCase();
        };
        const getUID = (prefix) => {
          do {
            prefix += Math.floor(Math.random() * MAX_UID);
          } while (document.getElementById(prefix));
          return prefix;
        };
        const getTransitionDurationFromElement = (element) => {
          if (!element) {
            return 0;
          }
          let {
            transitionDuration,
            transitionDelay
          } = window.getComputedStyle(element);
          const floatTransitionDuration = Number.parseFloat(transitionDuration);
          const floatTransitionDelay = Number.parseFloat(transitionDelay);
          if (!floatTransitionDuration && !floatTransitionDelay) {
            return 0;
          }
          transitionDuration = transitionDuration.split(",")[0];
          transitionDelay = transitionDelay.split(",")[0];
          return (Number.parseFloat(transitionDuration) + Number.parseFloat(transitionDelay)) * MILLISECONDS_MULTIPLIER;
        };
        const triggerTransitionEnd = (element) => {
          element.dispatchEvent(new Event(TRANSITION_END));
        };
        const isElement$1 = (object) => {
          if (!object || typeof object !== "object") {
            return false;
          }
          if (typeof object.jquery !== "undefined") {
            object = object[0];
          }
          return typeof object.nodeType !== "undefined";
        };
        const getElement = (object) => {
          if (isElement$1(object)) {
            return object.jquery ? object[0] : object;
          }
          if (typeof object === "string" && object.length > 0) {
            return document.querySelector(parseSelector(object));
          }
          return null;
        };
        const isVisible = (element) => {
          if (!isElement$1(element) || element.getClientRects().length === 0) {
            return false;
          }
          const elementIsVisible = getComputedStyle(element).getPropertyValue("visibility") === "visible";
          const closedDetails = element.closest("details:not([open])");
          if (!closedDetails) {
            return elementIsVisible;
          }
          if (closedDetails !== element) {
            const summary = element.closest("summary");
            if (summary && summary.parentNode !== closedDetails) {
              return false;
            }
            if (summary === null) {
              return false;
            }
          }
          return elementIsVisible;
        };
        const isDisabled = (element) => {
          if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return true;
          }
          if (element.classList.contains("disabled")) {
            return true;
          }
          if (typeof element.disabled !== "undefined") {
            return element.disabled;
          }
          return element.hasAttribute("disabled") && element.getAttribute("disabled") !== "false";
        };
        const findShadowRoot = (element) => {
          if (!document.documentElement.attachShadow) {
            return null;
          }
          if (typeof element.getRootNode === "function") {
            const root = element.getRootNode();
            return root instanceof ShadowRoot ? root : null;
          }
          if (element instanceof ShadowRoot) {
            return element;
          }
          if (!element.parentNode) {
            return null;
          }
          return findShadowRoot(element.parentNode);
        };
        const noop = () => {
        };
        const reflow = (element) => {
          element.offsetHeight;
        };
        const getjQuery = () => {
          if (window.jQuery && !document.body.hasAttribute("data-bs-no-jquery")) {
            return window.jQuery;
          }
          return null;
        };
        const DOMContentLoadedCallbacks = [];
        const onDOMContentLoaded = (callback) => {
          if (document.readyState === "loading") {
            if (!DOMContentLoadedCallbacks.length) {
              document.addEventListener("DOMContentLoaded", () => {
                for (const callback2 of DOMContentLoadedCallbacks) {
                  callback2();
                }
              });
            }
            DOMContentLoadedCallbacks.push(callback);
          } else {
            callback();
          }
        };
        const isRTL = () => document.documentElement.dir === "rtl";
        const defineJQueryPlugin = (plugin) => {
          onDOMContentLoaded(() => {
            const $ = getjQuery();
            if ($) {
              const name = plugin.NAME;
              const JQUERY_NO_CONFLICT = $.fn[name];
              $.fn[name] = plugin.jQueryInterface;
              $.fn[name].Constructor = plugin;
              $.fn[name].noConflict = () => {
                $.fn[name] = JQUERY_NO_CONFLICT;
                return plugin.jQueryInterface;
              };
            }
          });
        };
        const execute = (possibleCallback, args = [], defaultValue = possibleCallback) => {
          return typeof possibleCallback === "function" ? possibleCallback(...args) : defaultValue;
        };
        const executeAfterTransition = (callback, transitionElement, waitForTransition = true) => {
          if (!waitForTransition) {
            execute(callback);
            return;
          }
          const durationPadding = 5;
          const emulatedDuration = getTransitionDurationFromElement(transitionElement) + durationPadding;
          let called = false;
          const handler = ({
            target
          }) => {
            if (target !== transitionElement) {
              return;
            }
            called = true;
            transitionElement.removeEventListener(TRANSITION_END, handler);
            execute(callback);
          };
          transitionElement.addEventListener(TRANSITION_END, handler);
          setTimeout(() => {
            if (!called) {
              triggerTransitionEnd(transitionElement);
            }
          }, emulatedDuration);
        };
        const getNextActiveElement = (list, activeElement, shouldGetNext, isCycleAllowed) => {
          const listLength = list.length;
          let index = list.indexOf(activeElement);
          if (index === -1) {
            return !shouldGetNext && isCycleAllowed ? list[listLength - 1] : list[0];
          }
          index += shouldGetNext ? 1 : -1;
          if (isCycleAllowed) {
            index = (index + listLength) % listLength;
          }
          return list[Math.max(0, Math.min(index, listLength - 1))];
        };
        const namespaceRegex = /[^.]*(?=\..*)\.|.*/;
        const stripNameRegex = /\..*/;
        const stripUidRegex = /::\d+$/;
        const eventRegistry = {};
        let uidEvent = 1;
        const customEvents = {
          mouseenter: "mouseover",
          mouseleave: "mouseout"
        };
        const nativeEvents = /* @__PURE__ */ new Set(["click", "dblclick", "mouseup", "mousedown", "contextmenu", "mousewheel", "DOMMouseScroll", "mouseover", "mouseout", "mousemove", "selectstart", "selectend", "keydown", "keypress", "keyup", "orientationchange", "touchstart", "touchmove", "touchend", "touchcancel", "pointerdown", "pointermove", "pointerup", "pointerleave", "pointercancel", "gesturestart", "gesturechange", "gestureend", "focus", "blur", "change", "reset", "select", "submit", "focusin", "focusout", "load", "unload", "beforeunload", "resize", "move", "DOMContentLoaded", "readystatechange", "error", "abort", "scroll"]);
        function makeEventUid(element, uid) {
          return uid && `${uid}::${uidEvent++}` || element.uidEvent || uidEvent++;
        }
        function getElementEvents(element) {
          const uid = makeEventUid(element);
          element.uidEvent = uid;
          eventRegistry[uid] = eventRegistry[uid] || {};
          return eventRegistry[uid];
        }
        function bootstrapHandler(element, fn) {
          return function handler(event) {
            hydrateObj(event, {
              delegateTarget: element
            });
            if (handler.oneOff) {
              EventHandler.off(element, event.type, fn);
            }
            return fn.apply(element, [event]);
          };
        }
        function bootstrapDelegationHandler(element, selector, fn) {
          return function handler(event) {
            const domElements = element.querySelectorAll(selector);
            for (let {
              target
            } = event; target && target !== this; target = target.parentNode) {
              for (const domElement of domElements) {
                if (domElement !== target) {
                  continue;
                }
                hydrateObj(event, {
                  delegateTarget: target
                });
                if (handler.oneOff) {
                  EventHandler.off(element, event.type, selector, fn);
                }
                return fn.apply(target, [event]);
              }
            }
          };
        }
        function findHandler(events, callable, delegationSelector = null) {
          return Object.values(events).find((event) => event.callable === callable && event.delegationSelector === delegationSelector);
        }
        function normalizeParameters(originalTypeEvent, handler, delegationFunction) {
          const isDelegated = typeof handler === "string";
          const callable = isDelegated ? delegationFunction : handler || delegationFunction;
          let typeEvent = getTypeEvent(originalTypeEvent);
          if (!nativeEvents.has(typeEvent)) {
            typeEvent = originalTypeEvent;
          }
          return [isDelegated, callable, typeEvent];
        }
        function addHandler(element, originalTypeEvent, handler, delegationFunction, oneOff) {
          if (typeof originalTypeEvent !== "string" || !element) {
            return;
          }
          let [isDelegated, callable, typeEvent] = normalizeParameters(originalTypeEvent, handler, delegationFunction);
          if (originalTypeEvent in customEvents) {
            const wrapFunction = (fn2) => {
              return function(event) {
                if (!event.relatedTarget || event.relatedTarget !== event.delegateTarget && !event.delegateTarget.contains(event.relatedTarget)) {
                  return fn2.call(this, event);
                }
              };
            };
            callable = wrapFunction(callable);
          }
          const events = getElementEvents(element);
          const handlers = events[typeEvent] || (events[typeEvent] = {});
          const previousFunction = findHandler(handlers, callable, isDelegated ? handler : null);
          if (previousFunction) {
            previousFunction.oneOff = previousFunction.oneOff && oneOff;
            return;
          }
          const uid = makeEventUid(callable, originalTypeEvent.replace(namespaceRegex, ""));
          const fn = isDelegated ? bootstrapDelegationHandler(element, handler, callable) : bootstrapHandler(element, callable);
          fn.delegationSelector = isDelegated ? handler : null;
          fn.callable = callable;
          fn.oneOff = oneOff;
          fn.uidEvent = uid;
          handlers[uid] = fn;
          element.addEventListener(typeEvent, fn, isDelegated);
        }
        function removeHandler(element, events, typeEvent, handler, delegationSelector) {
          const fn = findHandler(events[typeEvent], handler, delegationSelector);
          if (!fn) {
            return;
          }
          element.removeEventListener(typeEvent, fn, Boolean(delegationSelector));
          delete events[typeEvent][fn.uidEvent];
        }
        function removeNamespacedHandlers(element, events, typeEvent, namespace) {
          const storeElementEvent = events[typeEvent] || {};
          for (const [handlerKey, event] of Object.entries(storeElementEvent)) {
            if (handlerKey.includes(namespace)) {
              removeHandler(element, events, typeEvent, event.callable, event.delegationSelector);
            }
          }
        }
        function getTypeEvent(event) {
          event = event.replace(stripNameRegex, "");
          return customEvents[event] || event;
        }
        const EventHandler = {
          on(element, event, handler, delegationFunction) {
            addHandler(element, event, handler, delegationFunction, false);
          },
          one(element, event, handler, delegationFunction) {
            addHandler(element, event, handler, delegationFunction, true);
          },
          off(element, originalTypeEvent, handler, delegationFunction) {
            if (typeof originalTypeEvent !== "string" || !element) {
              return;
            }
            const [isDelegated, callable, typeEvent] = normalizeParameters(originalTypeEvent, handler, delegationFunction);
            const inNamespace = typeEvent !== originalTypeEvent;
            const events = getElementEvents(element);
            const storeElementEvent = events[typeEvent] || {};
            const isNamespace = originalTypeEvent.startsWith(".");
            if (typeof callable !== "undefined") {
              if (!Object.keys(storeElementEvent).length) {
                return;
              }
              removeHandler(element, events, typeEvent, callable, isDelegated ? handler : null);
              return;
            }
            if (isNamespace) {
              for (const elementEvent of Object.keys(events)) {
                removeNamespacedHandlers(element, events, elementEvent, originalTypeEvent.slice(1));
              }
            }
            for (const [keyHandlers, event] of Object.entries(storeElementEvent)) {
              const handlerKey = keyHandlers.replace(stripUidRegex, "");
              if (!inNamespace || originalTypeEvent.includes(handlerKey)) {
                removeHandler(element, events, typeEvent, event.callable, event.delegationSelector);
              }
            }
          },
          trigger(element, event, args) {
            if (typeof event !== "string" || !element) {
              return null;
            }
            const $ = getjQuery();
            const typeEvent = getTypeEvent(event);
            const inNamespace = event !== typeEvent;
            let jQueryEvent = null;
            let bubbles = true;
            let nativeDispatch = true;
            let defaultPrevented = false;
            if (inNamespace && $) {
              jQueryEvent = $.Event(event, args);
              $(element).trigger(jQueryEvent);
              bubbles = !jQueryEvent.isPropagationStopped();
              nativeDispatch = !jQueryEvent.isImmediatePropagationStopped();
              defaultPrevented = jQueryEvent.isDefaultPrevented();
            }
            const evt = hydrateObj(new Event(event, {
              bubbles,
              cancelable: true
            }), args);
            if (defaultPrevented) {
              evt.preventDefault();
            }
            if (nativeDispatch) {
              element.dispatchEvent(evt);
            }
            if (evt.defaultPrevented && jQueryEvent) {
              jQueryEvent.preventDefault();
            }
            return evt;
          }
        };
        function hydrateObj(obj, meta = {}) {
          for (const [key, value] of Object.entries(meta)) {
            try {
              obj[key] = value;
            } catch (_unused) {
              Object.defineProperty(obj, key, {
                configurable: true,
                get() {
                  return value;
                }
              });
            }
          }
          return obj;
        }
        function normalizeData(value) {
          if (value === "true") {
            return true;
          }
          if (value === "false") {
            return false;
          }
          if (value === Number(value).toString()) {
            return Number(value);
          }
          if (value === "" || value === "null") {
            return null;
          }
          if (typeof value !== "string") {
            return value;
          }
          try {
            return JSON.parse(decodeURIComponent(value));
          } catch (_unused) {
            return value;
          }
        }
        function normalizeDataKey(key) {
          return key.replace(/[A-Z]/g, (chr) => `-${chr.toLowerCase()}`);
        }
        const Manipulator = {
          setDataAttribute(element, key, value) {
            element.setAttribute(`data-bs-${normalizeDataKey(key)}`, value);
          },
          removeDataAttribute(element, key) {
            element.removeAttribute(`data-bs-${normalizeDataKey(key)}`);
          },
          getDataAttributes(element) {
            if (!element) {
              return {};
            }
            const attributes = {};
            const bsKeys = Object.keys(element.dataset).filter((key) => key.startsWith("bs") && !key.startsWith("bsConfig"));
            for (const key of bsKeys) {
              let pureKey = key.replace(/^bs/, "");
              pureKey = pureKey.charAt(0).toLowerCase() + pureKey.slice(1, pureKey.length);
              attributes[pureKey] = normalizeData(element.dataset[key]);
            }
            return attributes;
          },
          getDataAttribute(element, key) {
            return normalizeData(element.getAttribute(`data-bs-${normalizeDataKey(key)}`));
          }
        };
        class Config {
          // Getters
          static get Default() {
            return {};
          }
          static get DefaultType() {
            return {};
          }
          static get NAME() {
            throw new Error('You have to implement the static method "NAME", for each component!');
          }
          _getConfig(config) {
            config = this._mergeConfigObj(config);
            config = this._configAfterMerge(config);
            this._typeCheckConfig(config);
            return config;
          }
          _configAfterMerge(config) {
            return config;
          }
          _mergeConfigObj(config, element) {
            const jsonConfig = isElement$1(element) ? Manipulator.getDataAttribute(element, "config") : {};
            return {
              ...this.constructor.Default,
              ...typeof jsonConfig === "object" ? jsonConfig : {},
              ...isElement$1(element) ? Manipulator.getDataAttributes(element) : {},
              ...typeof config === "object" ? config : {}
            };
          }
          _typeCheckConfig(config, configTypes = this.constructor.DefaultType) {
            for (const [property, expectedTypes] of Object.entries(configTypes)) {
              const value = config[property];
              const valueType = isElement$1(value) ? "element" : toType(value);
              if (!new RegExp(expectedTypes).test(valueType)) {
                throw new TypeError(`${this.constructor.NAME.toUpperCase()}: Option "${property}" provided type "${valueType}" but expected type "${expectedTypes}".`);
              }
            }
          }
        }
        const VERSION = "5.3.2";
        class BaseComponent extends Config {
          constructor(element, config) {
            super();
            element = getElement(element);
            if (!element) {
              return;
            }
            this._element = element;
            this._config = this._getConfig(config);
            Data.set(this._element, this.constructor.DATA_KEY, this);
          }
          // Public
          dispose() {
            Data.remove(this._element, this.constructor.DATA_KEY);
            EventHandler.off(this._element, this.constructor.EVENT_KEY);
            for (const propertyName of Object.getOwnPropertyNames(this)) {
              this[propertyName] = null;
            }
          }
          _queueCallback(callback, element, isAnimated = true) {
            executeAfterTransition(callback, element, isAnimated);
          }
          _getConfig(config) {
            config = this._mergeConfigObj(config, this._element);
            config = this._configAfterMerge(config);
            this._typeCheckConfig(config);
            return config;
          }
          // Static
          static getInstance(element) {
            return Data.get(getElement(element), this.DATA_KEY);
          }
          static getOrCreateInstance(element, config = {}) {
            return this.getInstance(element) || new this(element, typeof config === "object" ? config : null);
          }
          static get VERSION() {
            return VERSION;
          }
          static get DATA_KEY() {
            return `bs.${this.NAME}`;
          }
          static get EVENT_KEY() {
            return `.${this.DATA_KEY}`;
          }
          static eventName(name) {
            return `${name}${this.EVENT_KEY}`;
          }
        }
        const getSelector = (element) => {
          let selector = element.getAttribute("data-bs-target");
          if (!selector || selector === "#") {
            let hrefAttribute = element.getAttribute("href");
            if (!hrefAttribute || !hrefAttribute.includes("#") && !hrefAttribute.startsWith(".")) {
              return null;
            }
            if (hrefAttribute.includes("#") && !hrefAttribute.startsWith("#")) {
              hrefAttribute = `#${hrefAttribute.split("#")[1]}`;
            }
            selector = hrefAttribute && hrefAttribute !== "#" ? parseSelector(hrefAttribute.trim()) : null;
          }
          return selector;
        };
        const SelectorEngine = {
          find(selector, element = document.documentElement) {
            return [].concat(...Element.prototype.querySelectorAll.call(element, selector));
          },
          findOne(selector, element = document.documentElement) {
            return Element.prototype.querySelector.call(element, selector);
          },
          children(element, selector) {
            return [].concat(...element.children).filter((child) => child.matches(selector));
          },
          parents(element, selector) {
            const parents = [];
            let ancestor = element.parentNode.closest(selector);
            while (ancestor) {
              parents.push(ancestor);
              ancestor = ancestor.parentNode.closest(selector);
            }
            return parents;
          },
          prev(element, selector) {
            let previous = element.previousElementSibling;
            while (previous) {
              if (previous.matches(selector)) {
                return [previous];
              }
              previous = previous.previousElementSibling;
            }
            return [];
          },
          // TODO: this is now unused; remove later along with prev()
          next(element, selector) {
            let next = element.nextElementSibling;
            while (next) {
              if (next.matches(selector)) {
                return [next];
              }
              next = next.nextElementSibling;
            }
            return [];
          },
          focusableChildren(element) {
            const focusables = ["a", "button", "input", "textarea", "select", "details", "[tabindex]", '[contenteditable="true"]'].map((selector) => `${selector}:not([tabindex^="-"])`).join(",");
            return this.find(focusables, element).filter((el) => !isDisabled(el) && isVisible(el));
          },
          getSelectorFromElement(element) {
            const selector = getSelector(element);
            if (selector) {
              return SelectorEngine.findOne(selector) ? selector : null;
            }
            return null;
          },
          getElementFromSelector(element) {
            const selector = getSelector(element);
            return selector ? SelectorEngine.findOne(selector) : null;
          },
          getMultipleElementsFromSelector(element) {
            const selector = getSelector(element);
            return selector ? SelectorEngine.find(selector) : [];
          }
        };
        const enableDismissTrigger = (component, method = "hide") => {
          const clickEvent = `click.dismiss${component.EVENT_KEY}`;
          const name = component.NAME;
          EventHandler.on(document, clickEvent, `[data-bs-dismiss="${name}"]`, function(event) {
            if (["A", "AREA"].includes(this.tagName)) {
              event.preventDefault();
            }
            if (isDisabled(this)) {
              return;
            }
            const target = SelectorEngine.getElementFromSelector(this) || this.closest(`.${name}`);
            const instance = component.getOrCreateInstance(target);
            instance[method]();
          });
        };
        const NAME$f = "alert";
        const DATA_KEY$a = "bs.alert";
        const EVENT_KEY$b = `.${DATA_KEY$a}`;
        const EVENT_CLOSE = `close${EVENT_KEY$b}`;
        const EVENT_CLOSED = `closed${EVENT_KEY$b}`;
        const CLASS_NAME_FADE$5 = "fade";
        const CLASS_NAME_SHOW$8 = "show";
        class Alert extends BaseComponent {
          // Getters
          static get NAME() {
            return NAME$f;
          }
          // Public
          close() {
            const closeEvent = EventHandler.trigger(this._element, EVENT_CLOSE);
            if (closeEvent.defaultPrevented) {
              return;
            }
            this._element.classList.remove(CLASS_NAME_SHOW$8);
            const isAnimated = this._element.classList.contains(CLASS_NAME_FADE$5);
            this._queueCallback(() => this._destroyElement(), this._element, isAnimated);
          }
          // Private
          _destroyElement() {
            this._element.remove();
            EventHandler.trigger(this._element, EVENT_CLOSED);
            this.dispose();
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Alert.getOrCreateInstance(this);
              if (typeof config !== "string") {
                return;
              }
              if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
                throw new TypeError(`No method named "${config}"`);
              }
              data[config](this);
            });
          }
        }
        enableDismissTrigger(Alert, "close");
        defineJQueryPlugin(Alert);
        const NAME$e = "button";
        const DATA_KEY$9 = "bs.button";
        const EVENT_KEY$a = `.${DATA_KEY$9}`;
        const DATA_API_KEY$6 = ".data-api";
        const CLASS_NAME_ACTIVE$3 = "active";
        const SELECTOR_DATA_TOGGLE$5 = '[data-bs-toggle="button"]';
        const EVENT_CLICK_DATA_API$6 = `click${EVENT_KEY$a}${DATA_API_KEY$6}`;
        class Button extends BaseComponent {
          // Getters
          static get NAME() {
            return NAME$e;
          }
          // Public
          toggle() {
            this._element.setAttribute("aria-pressed", this._element.classList.toggle(CLASS_NAME_ACTIVE$3));
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Button.getOrCreateInstance(this);
              if (config === "toggle") {
                data[config]();
              }
            });
          }
        }
        EventHandler.on(document, EVENT_CLICK_DATA_API$6, SELECTOR_DATA_TOGGLE$5, (event) => {
          event.preventDefault();
          const button = event.target.closest(SELECTOR_DATA_TOGGLE$5);
          const data = Button.getOrCreateInstance(button);
          data.toggle();
        });
        defineJQueryPlugin(Button);
        const NAME$d = "swipe";
        const EVENT_KEY$9 = ".bs.swipe";
        const EVENT_TOUCHSTART = `touchstart${EVENT_KEY$9}`;
        const EVENT_TOUCHMOVE = `touchmove${EVENT_KEY$9}`;
        const EVENT_TOUCHEND = `touchend${EVENT_KEY$9}`;
        const EVENT_POINTERDOWN = `pointerdown${EVENT_KEY$9}`;
        const EVENT_POINTERUP = `pointerup${EVENT_KEY$9}`;
        const POINTER_TYPE_TOUCH = "touch";
        const POINTER_TYPE_PEN = "pen";
        const CLASS_NAME_POINTER_EVENT = "pointer-event";
        const SWIPE_THRESHOLD = 40;
        const Default$c = {
          endCallback: null,
          leftCallback: null,
          rightCallback: null
        };
        const DefaultType$c = {
          endCallback: "(function|null)",
          leftCallback: "(function|null)",
          rightCallback: "(function|null)"
        };
        class Swipe extends Config {
          constructor(element, config) {
            super();
            this._element = element;
            if (!element || !Swipe.isSupported()) {
              return;
            }
            this._config = this._getConfig(config);
            this._deltaX = 0;
            this._supportPointerEvents = Boolean(window.PointerEvent);
            this._initEvents();
          }
          // Getters
          static get Default() {
            return Default$c;
          }
          static get DefaultType() {
            return DefaultType$c;
          }
          static get NAME() {
            return NAME$d;
          }
          // Public
          dispose() {
            EventHandler.off(this._element, EVENT_KEY$9);
          }
          // Private
          _start(event) {
            if (!this._supportPointerEvents) {
              this._deltaX = event.touches[0].clientX;
              return;
            }
            if (this._eventIsPointerPenTouch(event)) {
              this._deltaX = event.clientX;
            }
          }
          _end(event) {
            if (this._eventIsPointerPenTouch(event)) {
              this._deltaX = event.clientX - this._deltaX;
            }
            this._handleSwipe();
            execute(this._config.endCallback);
          }
          _move(event) {
            this._deltaX = event.touches && event.touches.length > 1 ? 0 : event.touches[0].clientX - this._deltaX;
          }
          _handleSwipe() {
            const absDeltaX = Math.abs(this._deltaX);
            if (absDeltaX <= SWIPE_THRESHOLD) {
              return;
            }
            const direction = absDeltaX / this._deltaX;
            this._deltaX = 0;
            if (!direction) {
              return;
            }
            execute(direction > 0 ? this._config.rightCallback : this._config.leftCallback);
          }
          _initEvents() {
            if (this._supportPointerEvents) {
              EventHandler.on(this._element, EVENT_POINTERDOWN, (event) => this._start(event));
              EventHandler.on(this._element, EVENT_POINTERUP, (event) => this._end(event));
              this._element.classList.add(CLASS_NAME_POINTER_EVENT);
            } else {
              EventHandler.on(this._element, EVENT_TOUCHSTART, (event) => this._start(event));
              EventHandler.on(this._element, EVENT_TOUCHMOVE, (event) => this._move(event));
              EventHandler.on(this._element, EVENT_TOUCHEND, (event) => this._end(event));
            }
          }
          _eventIsPointerPenTouch(event) {
            return this._supportPointerEvents && (event.pointerType === POINTER_TYPE_PEN || event.pointerType === POINTER_TYPE_TOUCH);
          }
          // Static
          static isSupported() {
            return "ontouchstart" in document.documentElement || navigator.maxTouchPoints > 0;
          }
        }
        const NAME$c = "carousel";
        const DATA_KEY$8 = "bs.carousel";
        const EVENT_KEY$8 = `.${DATA_KEY$8}`;
        const DATA_API_KEY$5 = ".data-api";
        const ARROW_LEFT_KEY$1 = "ArrowLeft";
        const ARROW_RIGHT_KEY$1 = "ArrowRight";
        const TOUCHEVENT_COMPAT_WAIT = 500;
        const ORDER_NEXT = "next";
        const ORDER_PREV = "prev";
        const DIRECTION_LEFT = "left";
        const DIRECTION_RIGHT = "right";
        const EVENT_SLIDE = `slide${EVENT_KEY$8}`;
        const EVENT_SLID = `slid${EVENT_KEY$8}`;
        const EVENT_KEYDOWN$1 = `keydown${EVENT_KEY$8}`;
        const EVENT_MOUSEENTER$1 = `mouseenter${EVENT_KEY$8}`;
        const EVENT_MOUSELEAVE$1 = `mouseleave${EVENT_KEY$8}`;
        const EVENT_DRAG_START = `dragstart${EVENT_KEY$8}`;
        const EVENT_LOAD_DATA_API$3 = `load${EVENT_KEY$8}${DATA_API_KEY$5}`;
        const EVENT_CLICK_DATA_API$5 = `click${EVENT_KEY$8}${DATA_API_KEY$5}`;
        const CLASS_NAME_CAROUSEL = "carousel";
        const CLASS_NAME_ACTIVE$2 = "active";
        const CLASS_NAME_SLIDE = "slide";
        const CLASS_NAME_END = "carousel-item-end";
        const CLASS_NAME_START = "carousel-item-start";
        const CLASS_NAME_NEXT = "carousel-item-next";
        const CLASS_NAME_PREV = "carousel-item-prev";
        const SELECTOR_ACTIVE = ".active";
        const SELECTOR_ITEM = ".carousel-item";
        const SELECTOR_ACTIVE_ITEM = SELECTOR_ACTIVE + SELECTOR_ITEM;
        const SELECTOR_ITEM_IMG = ".carousel-item img";
        const SELECTOR_INDICATORS = ".carousel-indicators";
        const SELECTOR_DATA_SLIDE = "[data-bs-slide], [data-bs-slide-to]";
        const SELECTOR_DATA_RIDE = '[data-bs-ride="carousel"]';
        const KEY_TO_DIRECTION = {
          [ARROW_LEFT_KEY$1]: DIRECTION_RIGHT,
          [ARROW_RIGHT_KEY$1]: DIRECTION_LEFT
        };
        const Default$b = {
          interval: 5e3,
          keyboard: true,
          pause: "hover",
          ride: false,
          touch: true,
          wrap: true
        };
        const DefaultType$b = {
          interval: "(number|boolean)",
          // TODO:v6 remove boolean support
          keyboard: "boolean",
          pause: "(string|boolean)",
          ride: "(boolean|string)",
          touch: "boolean",
          wrap: "boolean"
        };
        class Carousel extends BaseComponent {
          constructor(element, config) {
            super(element, config);
            this._interval = null;
            this._activeElement = null;
            this._isSliding = false;
            this.touchTimeout = null;
            this._swipeHelper = null;
            this._indicatorsElement = SelectorEngine.findOne(SELECTOR_INDICATORS, this._element);
            this._addEventListeners();
            if (this._config.ride === CLASS_NAME_CAROUSEL) {
              this.cycle();
            }
          }
          // Getters
          static get Default() {
            return Default$b;
          }
          static get DefaultType() {
            return DefaultType$b;
          }
          static get NAME() {
            return NAME$c;
          }
          // Public
          next() {
            this._slide(ORDER_NEXT);
          }
          nextWhenVisible() {
            if (!document.hidden && isVisible(this._element)) {
              this.next();
            }
          }
          prev() {
            this._slide(ORDER_PREV);
          }
          pause() {
            if (this._isSliding) {
              triggerTransitionEnd(this._element);
            }
            this._clearInterval();
          }
          cycle() {
            this._clearInterval();
            this._updateInterval();
            this._interval = setInterval(() => this.nextWhenVisible(), this._config.interval);
          }
          _maybeEnableCycle() {
            if (!this._config.ride) {
              return;
            }
            if (this._isSliding) {
              EventHandler.one(this._element, EVENT_SLID, () => this.cycle());
              return;
            }
            this.cycle();
          }
          to(index) {
            const items = this._getItems();
            if (index > items.length - 1 || index < 0) {
              return;
            }
            if (this._isSliding) {
              EventHandler.one(this._element, EVENT_SLID, () => this.to(index));
              return;
            }
            const activeIndex = this._getItemIndex(this._getActive());
            if (activeIndex === index) {
              return;
            }
            const order2 = index > activeIndex ? ORDER_NEXT : ORDER_PREV;
            this._slide(order2, items[index]);
          }
          dispose() {
            if (this._swipeHelper) {
              this._swipeHelper.dispose();
            }
            super.dispose();
          }
          // Private
          _configAfterMerge(config) {
            config.defaultInterval = config.interval;
            return config;
          }
          _addEventListeners() {
            if (this._config.keyboard) {
              EventHandler.on(this._element, EVENT_KEYDOWN$1, (event) => this._keydown(event));
            }
            if (this._config.pause === "hover") {
              EventHandler.on(this._element, EVENT_MOUSEENTER$1, () => this.pause());
              EventHandler.on(this._element, EVENT_MOUSELEAVE$1, () => this._maybeEnableCycle());
            }
            if (this._config.touch && Swipe.isSupported()) {
              this._addTouchEventListeners();
            }
          }
          _addTouchEventListeners() {
            for (const img of SelectorEngine.find(SELECTOR_ITEM_IMG, this._element)) {
              EventHandler.on(img, EVENT_DRAG_START, (event) => event.preventDefault());
            }
            const endCallBack = () => {
              if (this._config.pause !== "hover") {
                return;
              }
              this.pause();
              if (this.touchTimeout) {
                clearTimeout(this.touchTimeout);
              }
              this.touchTimeout = setTimeout(() => this._maybeEnableCycle(), TOUCHEVENT_COMPAT_WAIT + this._config.interval);
            };
            const swipeConfig = {
              leftCallback: () => this._slide(this._directionToOrder(DIRECTION_LEFT)),
              rightCallback: () => this._slide(this._directionToOrder(DIRECTION_RIGHT)),
              endCallback: endCallBack
            };
            this._swipeHelper = new Swipe(this._element, swipeConfig);
          }
          _keydown(event) {
            if (/input|textarea/i.test(event.target.tagName)) {
              return;
            }
            const direction = KEY_TO_DIRECTION[event.key];
            if (direction) {
              event.preventDefault();
              this._slide(this._directionToOrder(direction));
            }
          }
          _getItemIndex(element) {
            return this._getItems().indexOf(element);
          }
          _setActiveIndicatorElement(index) {
            if (!this._indicatorsElement) {
              return;
            }
            const activeIndicator = SelectorEngine.findOne(SELECTOR_ACTIVE, this._indicatorsElement);
            activeIndicator.classList.remove(CLASS_NAME_ACTIVE$2);
            activeIndicator.removeAttribute("aria-current");
            const newActiveIndicator = SelectorEngine.findOne(`[data-bs-slide-to="${index}"]`, this._indicatorsElement);
            if (newActiveIndicator) {
              newActiveIndicator.classList.add(CLASS_NAME_ACTIVE$2);
              newActiveIndicator.setAttribute("aria-current", "true");
            }
          }
          _updateInterval() {
            const element = this._activeElement || this._getActive();
            if (!element) {
              return;
            }
            const elementInterval = Number.parseInt(element.getAttribute("data-bs-interval"), 10);
            this._config.interval = elementInterval || this._config.defaultInterval;
          }
          _slide(order2, element = null) {
            if (this._isSliding) {
              return;
            }
            const activeElement = this._getActive();
            const isNext = order2 === ORDER_NEXT;
            const nextElement = element || getNextActiveElement(this._getItems(), activeElement, isNext, this._config.wrap);
            if (nextElement === activeElement) {
              return;
            }
            const nextElementIndex = this._getItemIndex(nextElement);
            const triggerEvent = (eventName) => {
              return EventHandler.trigger(this._element, eventName, {
                relatedTarget: nextElement,
                direction: this._orderToDirection(order2),
                from: this._getItemIndex(activeElement),
                to: nextElementIndex
              });
            };
            const slideEvent = triggerEvent(EVENT_SLIDE);
            if (slideEvent.defaultPrevented) {
              return;
            }
            if (!activeElement || !nextElement) {
              return;
            }
            const isCycling = Boolean(this._interval);
            this.pause();
            this._isSliding = true;
            this._setActiveIndicatorElement(nextElementIndex);
            this._activeElement = nextElement;
            const directionalClassName = isNext ? CLASS_NAME_START : CLASS_NAME_END;
            const orderClassName = isNext ? CLASS_NAME_NEXT : CLASS_NAME_PREV;
            nextElement.classList.add(orderClassName);
            reflow(nextElement);
            activeElement.classList.add(directionalClassName);
            nextElement.classList.add(directionalClassName);
            const completeCallBack = () => {
              nextElement.classList.remove(directionalClassName, orderClassName);
              nextElement.classList.add(CLASS_NAME_ACTIVE$2);
              activeElement.classList.remove(CLASS_NAME_ACTIVE$2, orderClassName, directionalClassName);
              this._isSliding = false;
              triggerEvent(EVENT_SLID);
            };
            this._queueCallback(completeCallBack, activeElement, this._isAnimated());
            if (isCycling) {
              this.cycle();
            }
          }
          _isAnimated() {
            return this._element.classList.contains(CLASS_NAME_SLIDE);
          }
          _getActive() {
            return SelectorEngine.findOne(SELECTOR_ACTIVE_ITEM, this._element);
          }
          _getItems() {
            return SelectorEngine.find(SELECTOR_ITEM, this._element);
          }
          _clearInterval() {
            if (this._interval) {
              clearInterval(this._interval);
              this._interval = null;
            }
          }
          _directionToOrder(direction) {
            if (isRTL()) {
              return direction === DIRECTION_LEFT ? ORDER_PREV : ORDER_NEXT;
            }
            return direction === DIRECTION_LEFT ? ORDER_NEXT : ORDER_PREV;
          }
          _orderToDirection(order2) {
            if (isRTL()) {
              return order2 === ORDER_PREV ? DIRECTION_LEFT : DIRECTION_RIGHT;
            }
            return order2 === ORDER_PREV ? DIRECTION_RIGHT : DIRECTION_LEFT;
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Carousel.getOrCreateInstance(this, config);
              if (typeof config === "number") {
                data.to(config);
                return;
              }
              if (typeof config === "string") {
                if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
                  throw new TypeError(`No method named "${config}"`);
                }
                data[config]();
              }
            });
          }
        }
        EventHandler.on(document, EVENT_CLICK_DATA_API$5, SELECTOR_DATA_SLIDE, function(event) {
          const target = SelectorEngine.getElementFromSelector(this);
          if (!target || !target.classList.contains(CLASS_NAME_CAROUSEL)) {
            return;
          }
          event.preventDefault();
          const carousel = Carousel.getOrCreateInstance(target);
          const slideIndex = this.getAttribute("data-bs-slide-to");
          if (slideIndex) {
            carousel.to(slideIndex);
            carousel._maybeEnableCycle();
            return;
          }
          if (Manipulator.getDataAttribute(this, "slide") === "next") {
            carousel.next();
            carousel._maybeEnableCycle();
            return;
          }
          carousel.prev();
          carousel._maybeEnableCycle();
        });
        EventHandler.on(window, EVENT_LOAD_DATA_API$3, () => {
          const carousels = SelectorEngine.find(SELECTOR_DATA_RIDE);
          for (const carousel of carousels) {
            Carousel.getOrCreateInstance(carousel);
          }
        });
        defineJQueryPlugin(Carousel);
        const NAME$b = "collapse";
        const DATA_KEY$7 = "bs.collapse";
        const EVENT_KEY$7 = `.${DATA_KEY$7}`;
        const DATA_API_KEY$4 = ".data-api";
        const EVENT_SHOW$6 = `show${EVENT_KEY$7}`;
        const EVENT_SHOWN$6 = `shown${EVENT_KEY$7}`;
        const EVENT_HIDE$6 = `hide${EVENT_KEY$7}`;
        const EVENT_HIDDEN$6 = `hidden${EVENT_KEY$7}`;
        const EVENT_CLICK_DATA_API$4 = `click${EVENT_KEY$7}${DATA_API_KEY$4}`;
        const CLASS_NAME_SHOW$7 = "show";
        const CLASS_NAME_COLLAPSE = "collapse";
        const CLASS_NAME_COLLAPSING = "collapsing";
        const CLASS_NAME_COLLAPSED = "collapsed";
        const CLASS_NAME_DEEPER_CHILDREN = `:scope .${CLASS_NAME_COLLAPSE} .${CLASS_NAME_COLLAPSE}`;
        const CLASS_NAME_HORIZONTAL = "collapse-horizontal";
        const WIDTH = "width";
        const HEIGHT = "height";
        const SELECTOR_ACTIVES = ".collapse.show, .collapse.collapsing";
        const SELECTOR_DATA_TOGGLE$4 = '[data-bs-toggle="collapse"]';
        const Default$a = {
          parent: null,
          toggle: true
        };
        const DefaultType$a = {
          parent: "(null|element)",
          toggle: "boolean"
        };
        class Collapse extends BaseComponent {
          constructor(element, config) {
            super(element, config);
            this._isTransitioning = false;
            this._triggerArray = [];
            const toggleList = SelectorEngine.find(SELECTOR_DATA_TOGGLE$4);
            for (const elem of toggleList) {
              const selector = SelectorEngine.getSelectorFromElement(elem);
              const filterElement = SelectorEngine.find(selector).filter((foundElement) => foundElement === this._element);
              if (selector !== null && filterElement.length) {
                this._triggerArray.push(elem);
              }
            }
            this._initializeChildren();
            if (!this._config.parent) {
              this._addAriaAndCollapsedClass(this._triggerArray, this._isShown());
            }
            if (this._config.toggle) {
              this.toggle();
            }
          }
          // Getters
          static get Default() {
            return Default$a;
          }
          static get DefaultType() {
            return DefaultType$a;
          }
          static get NAME() {
            return NAME$b;
          }
          // Public
          toggle() {
            if (this._isShown()) {
              this.hide();
            } else {
              this.show();
            }
          }
          show() {
            if (this._isTransitioning || this._isShown()) {
              return;
            }
            let activeChildren = [];
            if (this._config.parent) {
              activeChildren = this._getFirstLevelChildren(SELECTOR_ACTIVES).filter((element) => element !== this._element).map((element) => Collapse.getOrCreateInstance(element, {
                toggle: false
              }));
            }
            if (activeChildren.length && activeChildren[0]._isTransitioning) {
              return;
            }
            const startEvent = EventHandler.trigger(this._element, EVENT_SHOW$6);
            if (startEvent.defaultPrevented) {
              return;
            }
            for (const activeInstance of activeChildren) {
              activeInstance.hide();
            }
            const dimension = this._getDimension();
            this._element.classList.remove(CLASS_NAME_COLLAPSE);
            this._element.classList.add(CLASS_NAME_COLLAPSING);
            this._element.style[dimension] = 0;
            this._addAriaAndCollapsedClass(this._triggerArray, true);
            this._isTransitioning = true;
            const complete = () => {
              this._isTransitioning = false;
              this._element.classList.remove(CLASS_NAME_COLLAPSING);
              this._element.classList.add(CLASS_NAME_COLLAPSE, CLASS_NAME_SHOW$7);
              this._element.style[dimension] = "";
              EventHandler.trigger(this._element, EVENT_SHOWN$6);
            };
            const capitalizedDimension = dimension[0].toUpperCase() + dimension.slice(1);
            const scrollSize = `scroll${capitalizedDimension}`;
            this._queueCallback(complete, this._element, true);
            this._element.style[dimension] = `${this._element[scrollSize]}px`;
          }
          hide() {
            if (this._isTransitioning || !this._isShown()) {
              return;
            }
            const startEvent = EventHandler.trigger(this._element, EVENT_HIDE$6);
            if (startEvent.defaultPrevented) {
              return;
            }
            const dimension = this._getDimension();
            this._element.style[dimension] = `${this._element.getBoundingClientRect()[dimension]}px`;
            reflow(this._element);
            this._element.classList.add(CLASS_NAME_COLLAPSING);
            this._element.classList.remove(CLASS_NAME_COLLAPSE, CLASS_NAME_SHOW$7);
            for (const trigger of this._triggerArray) {
              const element = SelectorEngine.getElementFromSelector(trigger);
              if (element && !this._isShown(element)) {
                this._addAriaAndCollapsedClass([trigger], false);
              }
            }
            this._isTransitioning = true;
            const complete = () => {
              this._isTransitioning = false;
              this._element.classList.remove(CLASS_NAME_COLLAPSING);
              this._element.classList.add(CLASS_NAME_COLLAPSE);
              EventHandler.trigger(this._element, EVENT_HIDDEN$6);
            };
            this._element.style[dimension] = "";
            this._queueCallback(complete, this._element, true);
          }
          _isShown(element = this._element) {
            return element.classList.contains(CLASS_NAME_SHOW$7);
          }
          // Private
          _configAfterMerge(config) {
            config.toggle = Boolean(config.toggle);
            config.parent = getElement(config.parent);
            return config;
          }
          _getDimension() {
            return this._element.classList.contains(CLASS_NAME_HORIZONTAL) ? WIDTH : HEIGHT;
          }
          _initializeChildren() {
            if (!this._config.parent) {
              return;
            }
            const children = this._getFirstLevelChildren(SELECTOR_DATA_TOGGLE$4);
            for (const element of children) {
              const selected = SelectorEngine.getElementFromSelector(element);
              if (selected) {
                this._addAriaAndCollapsedClass([element], this._isShown(selected));
              }
            }
          }
          _getFirstLevelChildren(selector) {
            const children = SelectorEngine.find(CLASS_NAME_DEEPER_CHILDREN, this._config.parent);
            return SelectorEngine.find(selector, this._config.parent).filter((element) => !children.includes(element));
          }
          _addAriaAndCollapsedClass(triggerArray, isOpen) {
            if (!triggerArray.length) {
              return;
            }
            for (const element of triggerArray) {
              element.classList.toggle(CLASS_NAME_COLLAPSED, !isOpen);
              element.setAttribute("aria-expanded", isOpen);
            }
          }
          // Static
          static jQueryInterface(config) {
            const _config = {};
            if (typeof config === "string" && /show|hide/.test(config)) {
              _config.toggle = false;
            }
            return this.each(function() {
              const data = Collapse.getOrCreateInstance(this, _config);
              if (typeof config === "string") {
                if (typeof data[config] === "undefined") {
                  throw new TypeError(`No method named "${config}"`);
                }
                data[config]();
              }
            });
          }
        }
        EventHandler.on(document, EVENT_CLICK_DATA_API$4, SELECTOR_DATA_TOGGLE$4, function(event) {
          if (event.target.tagName === "A" || event.delegateTarget && event.delegateTarget.tagName === "A") {
            event.preventDefault();
          }
          for (const element of SelectorEngine.getMultipleElementsFromSelector(this)) {
            Collapse.getOrCreateInstance(element, {
              toggle: false
            }).toggle();
          }
        });
        defineJQueryPlugin(Collapse);
        var top = "top";
        var bottom = "bottom";
        var right = "right";
        var left = "left";
        var auto = "auto";
        var basePlacements = [top, bottom, right, left];
        var start = "start";
        var end = "end";
        var clippingParents = "clippingParents";
        var viewport = "viewport";
        var popper = "popper";
        var reference = "reference";
        var variationPlacements = /* @__PURE__ */ basePlacements.reduce(function(acc, placement) {
          return acc.concat([placement + "-" + start, placement + "-" + end]);
        }, []);
        var placements = /* @__PURE__ */ [].concat(basePlacements, [auto]).reduce(function(acc, placement) {
          return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
        }, []);
        var beforeRead = "beforeRead";
        var read = "read";
        var afterRead = "afterRead";
        var beforeMain = "beforeMain";
        var main = "main";
        var afterMain = "afterMain";
        var beforeWrite = "beforeWrite";
        var write = "write";
        var afterWrite = "afterWrite";
        var modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];
        function getNodeName(element) {
          return element ? (element.nodeName || "").toLowerCase() : null;
        }
        function getWindow(node) {
          if (node == null) {
            return window;
          }
          if (node.toString() !== "[object Window]") {
            var ownerDocument = node.ownerDocument;
            return ownerDocument ? ownerDocument.defaultView || window : window;
          }
          return node;
        }
        function isElement(node) {
          var OwnElement = getWindow(node).Element;
          return node instanceof OwnElement || node instanceof Element;
        }
        function isHTMLElement(node) {
          var OwnElement = getWindow(node).HTMLElement;
          return node instanceof OwnElement || node instanceof HTMLElement;
        }
        function isShadowRoot(node) {
          if (typeof ShadowRoot === "undefined") {
            return false;
          }
          var OwnElement = getWindow(node).ShadowRoot;
          return node instanceof OwnElement || node instanceof ShadowRoot;
        }
        function applyStyles(_ref) {
          var state = _ref.state;
          Object.keys(state.elements).forEach(function(name) {
            var style = state.styles[name] || {};
            var attributes = state.attributes[name] || {};
            var element = state.elements[name];
            if (!isHTMLElement(element) || !getNodeName(element)) {
              return;
            }
            Object.assign(element.style, style);
            Object.keys(attributes).forEach(function(name2) {
              var value = attributes[name2];
              if (value === false) {
                element.removeAttribute(name2);
              } else {
                element.setAttribute(name2, value === true ? "" : value);
              }
            });
          });
        }
        function effect$2(_ref2) {
          var state = _ref2.state;
          var initialStyles = {
            popper: {
              position: state.options.strategy,
              left: "0",
              top: "0",
              margin: "0"
            },
            arrow: {
              position: "absolute"
            },
            reference: {}
          };
          Object.assign(state.elements.popper.style, initialStyles.popper);
          state.styles = initialStyles;
          if (state.elements.arrow) {
            Object.assign(state.elements.arrow.style, initialStyles.arrow);
          }
          return function() {
            Object.keys(state.elements).forEach(function(name) {
              var element = state.elements[name];
              var attributes = state.attributes[name] || {};
              var styleProperties = Object.keys(state.styles.hasOwnProperty(name) ? state.styles[name] : initialStyles[name]);
              var style = styleProperties.reduce(function(style2, property) {
                style2[property] = "";
                return style2;
              }, {});
              if (!isHTMLElement(element) || !getNodeName(element)) {
                return;
              }
              Object.assign(element.style, style);
              Object.keys(attributes).forEach(function(attribute) {
                element.removeAttribute(attribute);
              });
            });
          };
        }
        const applyStyles$1 = {
          name: "applyStyles",
          enabled: true,
          phase: "write",
          fn: applyStyles,
          effect: effect$2,
          requires: ["computeStyles"]
        };
        function getBasePlacement(placement) {
          return placement.split("-")[0];
        }
        var max = Math.max;
        var min = Math.min;
        var round = Math.round;
        function getUAString() {
          var uaData = navigator.userAgentData;
          if (uaData != null && uaData.brands && Array.isArray(uaData.brands)) {
            return uaData.brands.map(function(item) {
              return item.brand + "/" + item.version;
            }).join(" ");
          }
          return navigator.userAgent;
        }
        function isLayoutViewport() {
          return !/^((?!chrome|android).)*safari/i.test(getUAString());
        }
        function getBoundingClientRect(element, includeScale, isFixedStrategy) {
          if (includeScale === void 0) {
            includeScale = false;
          }
          if (isFixedStrategy === void 0) {
            isFixedStrategy = false;
          }
          var clientRect = element.getBoundingClientRect();
          var scaleX = 1;
          var scaleY = 1;
          if (includeScale && isHTMLElement(element)) {
            scaleX = element.offsetWidth > 0 ? round(clientRect.width) / element.offsetWidth || 1 : 1;
            scaleY = element.offsetHeight > 0 ? round(clientRect.height) / element.offsetHeight || 1 : 1;
          }
          var _ref = isElement(element) ? getWindow(element) : window, visualViewport = _ref.visualViewport;
          var addVisualOffsets = !isLayoutViewport() && isFixedStrategy;
          var x = (clientRect.left + (addVisualOffsets && visualViewport ? visualViewport.offsetLeft : 0)) / scaleX;
          var y = (clientRect.top + (addVisualOffsets && visualViewport ? visualViewport.offsetTop : 0)) / scaleY;
          var width = clientRect.width / scaleX;
          var height = clientRect.height / scaleY;
          return {
            width,
            height,
            top: y,
            right: x + width,
            bottom: y + height,
            left: x,
            x,
            y
          };
        }
        function getLayoutRect(element) {
          var clientRect = getBoundingClientRect(element);
          var width = element.offsetWidth;
          var height = element.offsetHeight;
          if (Math.abs(clientRect.width - width) <= 1) {
            width = clientRect.width;
          }
          if (Math.abs(clientRect.height - height) <= 1) {
            height = clientRect.height;
          }
          return {
            x: element.offsetLeft,
            y: element.offsetTop,
            width,
            height
          };
        }
        function contains(parent, child) {
          var rootNode = child.getRootNode && child.getRootNode();
          if (parent.contains(child)) {
            return true;
          } else if (rootNode && isShadowRoot(rootNode)) {
            var next = child;
            do {
              if (next && parent.isSameNode(next)) {
                return true;
              }
              next = next.parentNode || next.host;
            } while (next);
          }
          return false;
        }
        function getComputedStyle$1(element) {
          return getWindow(element).getComputedStyle(element);
        }
        function isTableElement(element) {
          return ["table", "td", "th"].indexOf(getNodeName(element)) >= 0;
        }
        function getDocumentElement(element) {
          return ((isElement(element) ? element.ownerDocument : (
            // $FlowFixMe[prop-missing]
            element.document
          )) || window.document).documentElement;
        }
        function getParentNode(element) {
          if (getNodeName(element) === "html") {
            return element;
          }
          return (
            // this is a quicker (but less type safe) way to save quite some bytes from the bundle
            // $FlowFixMe[incompatible-return]
            // $FlowFixMe[prop-missing]
            element.assignedSlot || // step into the shadow DOM of the parent of a slotted node
            element.parentNode || // DOM Element detected
            (isShadowRoot(element) ? element.host : null) || // ShadowRoot detected
            // $FlowFixMe[incompatible-call]: HTMLElement is a Node
            getDocumentElement(element)
          );
        }
        function getTrueOffsetParent(element) {
          if (!isHTMLElement(element) || // https://github.com/popperjs/popper-core/issues/837
          getComputedStyle$1(element).position === "fixed") {
            return null;
          }
          return element.offsetParent;
        }
        function getContainingBlock(element) {
          var isFirefox = /firefox/i.test(getUAString());
          var isIE = /Trident/i.test(getUAString());
          if (isIE && isHTMLElement(element)) {
            var elementCss = getComputedStyle$1(element);
            if (elementCss.position === "fixed") {
              return null;
            }
          }
          var currentNode = getParentNode(element);
          if (isShadowRoot(currentNode)) {
            currentNode = currentNode.host;
          }
          while (isHTMLElement(currentNode) && ["html", "body"].indexOf(getNodeName(currentNode)) < 0) {
            var css = getComputedStyle$1(currentNode);
            if (css.transform !== "none" || css.perspective !== "none" || css.contain === "paint" || ["transform", "perspective"].indexOf(css.willChange) !== -1 || isFirefox && css.willChange === "filter" || isFirefox && css.filter && css.filter !== "none") {
              return currentNode;
            } else {
              currentNode = currentNode.parentNode;
            }
          }
          return null;
        }
        function getOffsetParent(element) {
          var window2 = getWindow(element);
          var offsetParent = getTrueOffsetParent(element);
          while (offsetParent && isTableElement(offsetParent) && getComputedStyle$1(offsetParent).position === "static") {
            offsetParent = getTrueOffsetParent(offsetParent);
          }
          if (offsetParent && (getNodeName(offsetParent) === "html" || getNodeName(offsetParent) === "body" && getComputedStyle$1(offsetParent).position === "static")) {
            return window2;
          }
          return offsetParent || getContainingBlock(element) || window2;
        }
        function getMainAxisFromPlacement(placement) {
          return ["top", "bottom"].indexOf(placement) >= 0 ? "x" : "y";
        }
        function within(min$1, value, max$1) {
          return max(min$1, min(value, max$1));
        }
        function withinMaxClamp(min2, value, max2) {
          var v = within(min2, value, max2);
          return v > max2 ? max2 : v;
        }
        function getFreshSideObject() {
          return {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          };
        }
        function mergePaddingObject(paddingObject) {
          return Object.assign({}, getFreshSideObject(), paddingObject);
        }
        function expandToHashMap(value, keys) {
          return keys.reduce(function(hashMap, key) {
            hashMap[key] = value;
            return hashMap;
          }, {});
        }
        var toPaddingObject = function toPaddingObject2(padding, state) {
          padding = typeof padding === "function" ? padding(Object.assign({}, state.rects, {
            placement: state.placement
          })) : padding;
          return mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
        };
        function arrow(_ref) {
          var _state$modifiersData$;
          var state = _ref.state, name = _ref.name, options = _ref.options;
          var arrowElement = state.elements.arrow;
          var popperOffsets2 = state.modifiersData.popperOffsets;
          var basePlacement = getBasePlacement(state.placement);
          var axis = getMainAxisFromPlacement(basePlacement);
          var isVertical = [left, right].indexOf(basePlacement) >= 0;
          var len = isVertical ? "height" : "width";
          if (!arrowElement || !popperOffsets2) {
            return;
          }
          var paddingObject = toPaddingObject(options.padding, state);
          var arrowRect = getLayoutRect(arrowElement);
          var minProp = axis === "y" ? top : left;
          var maxProp = axis === "y" ? bottom : right;
          var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets2[axis] - state.rects.popper[len];
          var startDiff = popperOffsets2[axis] - state.rects.reference[axis];
          var arrowOffsetParent = getOffsetParent(arrowElement);
          var clientSize = arrowOffsetParent ? axis === "y" ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
          var centerToReference = endDiff / 2 - startDiff / 2;
          var min2 = paddingObject[minProp];
          var max2 = clientSize - arrowRect[len] - paddingObject[maxProp];
          var center = clientSize / 2 - arrowRect[len] / 2 + centerToReference;
          var offset2 = within(min2, center, max2);
          var axisProp = axis;
          state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = offset2, _state$modifiersData$.centerOffset = offset2 - center, _state$modifiersData$);
        }
        function effect$1(_ref2) {
          var state = _ref2.state, options = _ref2.options;
          var _options$element = options.element, arrowElement = _options$element === void 0 ? "[data-popper-arrow]" : _options$element;
          if (arrowElement == null) {
            return;
          }
          if (typeof arrowElement === "string") {
            arrowElement = state.elements.popper.querySelector(arrowElement);
            if (!arrowElement) {
              return;
            }
          }
          if (!contains(state.elements.popper, arrowElement)) {
            return;
          }
          state.elements.arrow = arrowElement;
        }
        const arrow$1 = {
          name: "arrow",
          enabled: true,
          phase: "main",
          fn: arrow,
          effect: effect$1,
          requires: ["popperOffsets"],
          requiresIfExists: ["preventOverflow"]
        };
        function getVariation(placement) {
          return placement.split("-")[1];
        }
        var unsetSides = {
          top: "auto",
          right: "auto",
          bottom: "auto",
          left: "auto"
        };
        function roundOffsetsByDPR(_ref, win) {
          var x = _ref.x, y = _ref.y;
          var dpr = win.devicePixelRatio || 1;
          return {
            x: round(x * dpr) / dpr || 0,
            y: round(y * dpr) / dpr || 0
          };
        }
        function mapToStyles(_ref2) {
          var _Object$assign2;
          var popper2 = _ref2.popper, popperRect = _ref2.popperRect, placement = _ref2.placement, variation = _ref2.variation, offsets = _ref2.offsets, position = _ref2.position, gpuAcceleration = _ref2.gpuAcceleration, adaptive = _ref2.adaptive, roundOffsets = _ref2.roundOffsets, isFixed = _ref2.isFixed;
          var _offsets$x = offsets.x, x = _offsets$x === void 0 ? 0 : _offsets$x, _offsets$y = offsets.y, y = _offsets$y === void 0 ? 0 : _offsets$y;
          var _ref3 = typeof roundOffsets === "function" ? roundOffsets({
            x,
            y
          }) : {
            x,
            y
          };
          x = _ref3.x;
          y = _ref3.y;
          var hasX = offsets.hasOwnProperty("x");
          var hasY = offsets.hasOwnProperty("y");
          var sideX = left;
          var sideY = top;
          var win = window;
          if (adaptive) {
            var offsetParent = getOffsetParent(popper2);
            var heightProp = "clientHeight";
            var widthProp = "clientWidth";
            if (offsetParent === getWindow(popper2)) {
              offsetParent = getDocumentElement(popper2);
              if (getComputedStyle$1(offsetParent).position !== "static" && position === "absolute") {
                heightProp = "scrollHeight";
                widthProp = "scrollWidth";
              }
            }
            offsetParent = offsetParent;
            if (placement === top || (placement === left || placement === right) && variation === end) {
              sideY = bottom;
              var offsetY = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.height : (
                // $FlowFixMe[prop-missing]
                offsetParent[heightProp]
              );
              y -= offsetY - popperRect.height;
              y *= gpuAcceleration ? 1 : -1;
            }
            if (placement === left || (placement === top || placement === bottom) && variation === end) {
              sideX = right;
              var offsetX = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.width : (
                // $FlowFixMe[prop-missing]
                offsetParent[widthProp]
              );
              x -= offsetX - popperRect.width;
              x *= gpuAcceleration ? 1 : -1;
            }
          }
          var commonStyles = Object.assign({
            position
          }, adaptive && unsetSides);
          var _ref4 = roundOffsets === true ? roundOffsetsByDPR({
            x,
            y
          }, getWindow(popper2)) : {
            x,
            y
          };
          x = _ref4.x;
          y = _ref4.y;
          if (gpuAcceleration) {
            var _Object$assign;
            return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? "0" : "", _Object$assign[sideX] = hasX ? "0" : "", _Object$assign.transform = (win.devicePixelRatio || 1) <= 1 ? "translate(" + x + "px, " + y + "px)" : "translate3d(" + x + "px, " + y + "px, 0)", _Object$assign));
          }
          return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y + "px" : "", _Object$assign2[sideX] = hasX ? x + "px" : "", _Object$assign2.transform = "", _Object$assign2));
        }
        function computeStyles(_ref5) {
          var state = _ref5.state, options = _ref5.options;
          var _options$gpuAccelerat = options.gpuAcceleration, gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat, _options$adaptive = options.adaptive, adaptive = _options$adaptive === void 0 ? true : _options$adaptive, _options$roundOffsets = options.roundOffsets, roundOffsets = _options$roundOffsets === void 0 ? true : _options$roundOffsets;
          var commonStyles = {
            placement: getBasePlacement(state.placement),
            variation: getVariation(state.placement),
            popper: state.elements.popper,
            popperRect: state.rects.popper,
            gpuAcceleration,
            isFixed: state.options.strategy === "fixed"
          };
          if (state.modifiersData.popperOffsets != null) {
            state.styles.popper = Object.assign({}, state.styles.popper, mapToStyles(Object.assign({}, commonStyles, {
              offsets: state.modifiersData.popperOffsets,
              position: state.options.strategy,
              adaptive,
              roundOffsets
            })));
          }
          if (state.modifiersData.arrow != null) {
            state.styles.arrow = Object.assign({}, state.styles.arrow, mapToStyles(Object.assign({}, commonStyles, {
              offsets: state.modifiersData.arrow,
              position: "absolute",
              adaptive: false,
              roundOffsets
            })));
          }
          state.attributes.popper = Object.assign({}, state.attributes.popper, {
            "data-popper-placement": state.placement
          });
        }
        const computeStyles$1 = {
          name: "computeStyles",
          enabled: true,
          phase: "beforeWrite",
          fn: computeStyles,
          data: {}
        };
        var passive = {
          passive: true
        };
        function effect(_ref) {
          var state = _ref.state, instance = _ref.instance, options = _ref.options;
          var _options$scroll = options.scroll, scroll = _options$scroll === void 0 ? true : _options$scroll, _options$resize = options.resize, resize = _options$resize === void 0 ? true : _options$resize;
          var window2 = getWindow(state.elements.popper);
          var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);
          if (scroll) {
            scrollParents.forEach(function(scrollParent) {
              scrollParent.addEventListener("scroll", instance.update, passive);
            });
          }
          if (resize) {
            window2.addEventListener("resize", instance.update, passive);
          }
          return function() {
            if (scroll) {
              scrollParents.forEach(function(scrollParent) {
                scrollParent.removeEventListener("scroll", instance.update, passive);
              });
            }
            if (resize) {
              window2.removeEventListener("resize", instance.update, passive);
            }
          };
        }
        const eventListeners = {
          name: "eventListeners",
          enabled: true,
          phase: "write",
          fn: function fn() {
          },
          effect,
          data: {}
        };
        var hash$1 = {
          left: "right",
          right: "left",
          bottom: "top",
          top: "bottom"
        };
        function getOppositePlacement(placement) {
          return placement.replace(/left|right|bottom|top/g, function(matched) {
            return hash$1[matched];
          });
        }
        var hash = {
          start: "end",
          end: "start"
        };
        function getOppositeVariationPlacement(placement) {
          return placement.replace(/start|end/g, function(matched) {
            return hash[matched];
          });
        }
        function getWindowScroll(node) {
          var win = getWindow(node);
          var scrollLeft = win.pageXOffset;
          var scrollTop = win.pageYOffset;
          return {
            scrollLeft,
            scrollTop
          };
        }
        function getWindowScrollBarX(element) {
          return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
        }
        function getViewportRect(element, strategy) {
          var win = getWindow(element);
          var html = getDocumentElement(element);
          var visualViewport = win.visualViewport;
          var width = html.clientWidth;
          var height = html.clientHeight;
          var x = 0;
          var y = 0;
          if (visualViewport) {
            width = visualViewport.width;
            height = visualViewport.height;
            var layoutViewport = isLayoutViewport();
            if (layoutViewport || !layoutViewport && strategy === "fixed") {
              x = visualViewport.offsetLeft;
              y = visualViewport.offsetTop;
            }
          }
          return {
            width,
            height,
            x: x + getWindowScrollBarX(element),
            y
          };
        }
        function getDocumentRect(element) {
          var _element$ownerDocumen;
          var html = getDocumentElement(element);
          var winScroll = getWindowScroll(element);
          var body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
          var width = max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
          var height = max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
          var x = -winScroll.scrollLeft + getWindowScrollBarX(element);
          var y = -winScroll.scrollTop;
          if (getComputedStyle$1(body || html).direction === "rtl") {
            x += max(html.clientWidth, body ? body.clientWidth : 0) - width;
          }
          return {
            width,
            height,
            x,
            y
          };
        }
        function isScrollParent(element) {
          var _getComputedStyle = getComputedStyle$1(element), overflow = _getComputedStyle.overflow, overflowX = _getComputedStyle.overflowX, overflowY = _getComputedStyle.overflowY;
          return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
        }
        function getScrollParent(node) {
          if (["html", "body", "#document"].indexOf(getNodeName(node)) >= 0) {
            return node.ownerDocument.body;
          }
          if (isHTMLElement(node) && isScrollParent(node)) {
            return node;
          }
          return getScrollParent(getParentNode(node));
        }
        function listScrollParents(element, list) {
          var _element$ownerDocumen;
          if (list === void 0) {
            list = [];
          }
          var scrollParent = getScrollParent(element);
          var isBody = scrollParent === ((_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body);
          var win = getWindow(scrollParent);
          var target = isBody ? [win].concat(win.visualViewport || [], isScrollParent(scrollParent) ? scrollParent : []) : scrollParent;
          var updatedList = list.concat(target);
          return isBody ? updatedList : (
            // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
            updatedList.concat(listScrollParents(getParentNode(target)))
          );
        }
        function rectToClientRect(rect) {
          return Object.assign({}, rect, {
            left: rect.x,
            top: rect.y,
            right: rect.x + rect.width,
            bottom: rect.y + rect.height
          });
        }
        function getInnerBoundingClientRect(element, strategy) {
          var rect = getBoundingClientRect(element, false, strategy === "fixed");
          rect.top = rect.top + element.clientTop;
          rect.left = rect.left + element.clientLeft;
          rect.bottom = rect.top + element.clientHeight;
          rect.right = rect.left + element.clientWidth;
          rect.width = element.clientWidth;
          rect.height = element.clientHeight;
          rect.x = rect.left;
          rect.y = rect.top;
          return rect;
        }
        function getClientRectFromMixedType(element, clippingParent, strategy) {
          return clippingParent === viewport ? rectToClientRect(getViewportRect(element, strategy)) : isElement(clippingParent) ? getInnerBoundingClientRect(clippingParent, strategy) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
        }
        function getClippingParents(element) {
          var clippingParents2 = listScrollParents(getParentNode(element));
          var canEscapeClipping = ["absolute", "fixed"].indexOf(getComputedStyle$1(element).position) >= 0;
          var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;
          if (!isElement(clipperElement)) {
            return [];
          }
          return clippingParents2.filter(function(clippingParent) {
            return isElement(clippingParent) && contains(clippingParent, clipperElement) && getNodeName(clippingParent) !== "body";
          });
        }
        function getClippingRect(element, boundary, rootBoundary, strategy) {
          var mainClippingParents = boundary === "clippingParents" ? getClippingParents(element) : [].concat(boundary);
          var clippingParents2 = [].concat(mainClippingParents, [rootBoundary]);
          var firstClippingParent = clippingParents2[0];
          var clippingRect = clippingParents2.reduce(function(accRect, clippingParent) {
            var rect = getClientRectFromMixedType(element, clippingParent, strategy);
            accRect.top = max(rect.top, accRect.top);
            accRect.right = min(rect.right, accRect.right);
            accRect.bottom = min(rect.bottom, accRect.bottom);
            accRect.left = max(rect.left, accRect.left);
            return accRect;
          }, getClientRectFromMixedType(element, firstClippingParent, strategy));
          clippingRect.width = clippingRect.right - clippingRect.left;
          clippingRect.height = clippingRect.bottom - clippingRect.top;
          clippingRect.x = clippingRect.left;
          clippingRect.y = clippingRect.top;
          return clippingRect;
        }
        function computeOffsets(_ref) {
          var reference2 = _ref.reference, element = _ref.element, placement = _ref.placement;
          var basePlacement = placement ? getBasePlacement(placement) : null;
          var variation = placement ? getVariation(placement) : null;
          var commonX = reference2.x + reference2.width / 2 - element.width / 2;
          var commonY = reference2.y + reference2.height / 2 - element.height / 2;
          var offsets;
          switch (basePlacement) {
            case top:
              offsets = {
                x: commonX,
                y: reference2.y - element.height
              };
              break;
            case bottom:
              offsets = {
                x: commonX,
                y: reference2.y + reference2.height
              };
              break;
            case right:
              offsets = {
                x: reference2.x + reference2.width,
                y: commonY
              };
              break;
            case left:
              offsets = {
                x: reference2.x - element.width,
                y: commonY
              };
              break;
            default:
              offsets = {
                x: reference2.x,
                y: reference2.y
              };
          }
          var mainAxis = basePlacement ? getMainAxisFromPlacement(basePlacement) : null;
          if (mainAxis != null) {
            var len = mainAxis === "y" ? "height" : "width";
            switch (variation) {
              case start:
                offsets[mainAxis] = offsets[mainAxis] - (reference2[len] / 2 - element[len] / 2);
                break;
              case end:
                offsets[mainAxis] = offsets[mainAxis] + (reference2[len] / 2 - element[len] / 2);
                break;
            }
          }
          return offsets;
        }
        function detectOverflow(state, options) {
          if (options === void 0) {
            options = {};
          }
          var _options = options, _options$placement = _options.placement, placement = _options$placement === void 0 ? state.placement : _options$placement, _options$strategy = _options.strategy, strategy = _options$strategy === void 0 ? state.strategy : _options$strategy, _options$boundary = _options.boundary, boundary = _options$boundary === void 0 ? clippingParents : _options$boundary, _options$rootBoundary = _options.rootBoundary, rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary, _options$elementConte = _options.elementContext, elementContext = _options$elementConte === void 0 ? popper : _options$elementConte, _options$altBoundary = _options.altBoundary, altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary, _options$padding = _options.padding, padding = _options$padding === void 0 ? 0 : _options$padding;
          var paddingObject = mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
          var altContext = elementContext === popper ? reference : popper;
          var popperRect = state.rects.popper;
          var element = state.elements[altBoundary ? altContext : elementContext];
          var clippingClientRect = getClippingRect(isElement(element) ? element : element.contextElement || getDocumentElement(state.elements.popper), boundary, rootBoundary, strategy);
          var referenceClientRect = getBoundingClientRect(state.elements.reference);
          var popperOffsets2 = computeOffsets({
            reference: referenceClientRect,
            element: popperRect,
            strategy: "absolute",
            placement
          });
          var popperClientRect = rectToClientRect(Object.assign({}, popperRect, popperOffsets2));
          var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect;
          var overflowOffsets = {
            top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
            bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
            left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
            right: elementClientRect.right - clippingClientRect.right + paddingObject.right
          };
          var offsetData = state.modifiersData.offset;
          if (elementContext === popper && offsetData) {
            var offset2 = offsetData[placement];
            Object.keys(overflowOffsets).forEach(function(key) {
              var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
              var axis = [top, bottom].indexOf(key) >= 0 ? "y" : "x";
              overflowOffsets[key] += offset2[axis] * multiply;
            });
          }
          return overflowOffsets;
        }
        function computeAutoPlacement(state, options) {
          if (options === void 0) {
            options = {};
          }
          var _options = options, placement = _options.placement, boundary = _options.boundary, rootBoundary = _options.rootBoundary, padding = _options.padding, flipVariations = _options.flipVariations, _options$allowedAutoP = _options.allowedAutoPlacements, allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
          var variation = getVariation(placement);
          var placements$1 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function(placement2) {
            return getVariation(placement2) === variation;
          }) : basePlacements;
          var allowedPlacements = placements$1.filter(function(placement2) {
            return allowedAutoPlacements.indexOf(placement2) >= 0;
          });
          if (allowedPlacements.length === 0) {
            allowedPlacements = placements$1;
          }
          var overflows = allowedPlacements.reduce(function(acc, placement2) {
            acc[placement2] = detectOverflow(state, {
              placement: placement2,
              boundary,
              rootBoundary,
              padding
            })[getBasePlacement(placement2)];
            return acc;
          }, {});
          return Object.keys(overflows).sort(function(a, b) {
            return overflows[a] - overflows[b];
          });
        }
        function getExpandedFallbackPlacements(placement) {
          if (getBasePlacement(placement) === auto) {
            return [];
          }
          var oppositePlacement = getOppositePlacement(placement);
          return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
        }
        function flip(_ref) {
          var state = _ref.state, options = _ref.options, name = _ref.name;
          if (state.modifiersData[name]._skip) {
            return;
          }
          var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? true : _options$altAxis, specifiedFallbackPlacements = options.fallbackPlacements, padding = options.padding, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, _options$flipVariatio = options.flipVariations, flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio, allowedAutoPlacements = options.allowedAutoPlacements;
          var preferredPlacement = state.options.placement;
          var basePlacement = getBasePlacement(preferredPlacement);
          var isBasePlacement = basePlacement === preferredPlacement;
          var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
          var placements2 = [preferredPlacement].concat(fallbackPlacements).reduce(function(acc, placement2) {
            return acc.concat(getBasePlacement(placement2) === auto ? computeAutoPlacement(state, {
              placement: placement2,
              boundary,
              rootBoundary,
              padding,
              flipVariations,
              allowedAutoPlacements
            }) : placement2);
          }, []);
          var referenceRect = state.rects.reference;
          var popperRect = state.rects.popper;
          var checksMap = /* @__PURE__ */ new Map();
          var makeFallbackChecks = true;
          var firstFittingPlacement = placements2[0];
          for (var i = 0; i < placements2.length; i++) {
            var placement = placements2[i];
            var _basePlacement = getBasePlacement(placement);
            var isStartVariation = getVariation(placement) === start;
            var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
            var len = isVertical ? "width" : "height";
            var overflow = detectOverflow(state, {
              placement,
              boundary,
              rootBoundary,
              altBoundary,
              padding
            });
            var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;
            if (referenceRect[len] > popperRect[len]) {
              mainVariationSide = getOppositePlacement(mainVariationSide);
            }
            var altVariationSide = getOppositePlacement(mainVariationSide);
            var checks = [];
            if (checkMainAxis) {
              checks.push(overflow[_basePlacement] <= 0);
            }
            if (checkAltAxis) {
              checks.push(overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0);
            }
            if (checks.every(function(check) {
              return check;
            })) {
              firstFittingPlacement = placement;
              makeFallbackChecks = false;
              break;
            }
            checksMap.set(placement, checks);
          }
          if (makeFallbackChecks) {
            var numberOfChecks = flipVariations ? 3 : 1;
            var _loop = function _loop2(_i2) {
              var fittingPlacement = placements2.find(function(placement2) {
                var checks2 = checksMap.get(placement2);
                if (checks2) {
                  return checks2.slice(0, _i2).every(function(check) {
                    return check;
                  });
                }
              });
              if (fittingPlacement) {
                firstFittingPlacement = fittingPlacement;
                return "break";
              }
            };
            for (var _i = numberOfChecks; _i > 0; _i--) {
              var _ret = _loop(_i);
              if (_ret === "break") break;
            }
          }
          if (state.placement !== firstFittingPlacement) {
            state.modifiersData[name]._skip = true;
            state.placement = firstFittingPlacement;
            state.reset = true;
          }
        }
        const flip$1 = {
          name: "flip",
          enabled: true,
          phase: "main",
          fn: flip,
          requiresIfExists: ["offset"],
          data: {
            _skip: false
          }
        };
        function getSideOffsets(overflow, rect, preventedOffsets) {
          if (preventedOffsets === void 0) {
            preventedOffsets = {
              x: 0,
              y: 0
            };
          }
          return {
            top: overflow.top - rect.height - preventedOffsets.y,
            right: overflow.right - rect.width + preventedOffsets.x,
            bottom: overflow.bottom - rect.height + preventedOffsets.y,
            left: overflow.left - rect.width - preventedOffsets.x
          };
        }
        function isAnySideFullyClipped(overflow) {
          return [top, right, bottom, left].some(function(side) {
            return overflow[side] >= 0;
          });
        }
        function hide(_ref) {
          var state = _ref.state, name = _ref.name;
          var referenceRect = state.rects.reference;
          var popperRect = state.rects.popper;
          var preventedOffsets = state.modifiersData.preventOverflow;
          var referenceOverflow = detectOverflow(state, {
            elementContext: "reference"
          });
          var popperAltOverflow = detectOverflow(state, {
            altBoundary: true
          });
          var referenceClippingOffsets = getSideOffsets(referenceOverflow, referenceRect);
          var popperEscapeOffsets = getSideOffsets(popperAltOverflow, popperRect, preventedOffsets);
          var isReferenceHidden = isAnySideFullyClipped(referenceClippingOffsets);
          var hasPopperEscaped = isAnySideFullyClipped(popperEscapeOffsets);
          state.modifiersData[name] = {
            referenceClippingOffsets,
            popperEscapeOffsets,
            isReferenceHidden,
            hasPopperEscaped
          };
          state.attributes.popper = Object.assign({}, state.attributes.popper, {
            "data-popper-reference-hidden": isReferenceHidden,
            "data-popper-escaped": hasPopperEscaped
          });
        }
        const hide$1 = {
          name: "hide",
          enabled: true,
          phase: "main",
          requiresIfExists: ["preventOverflow"],
          fn: hide
        };
        function distanceAndSkiddingToXY(placement, rects, offset2) {
          var basePlacement = getBasePlacement(placement);
          var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;
          var _ref = typeof offset2 === "function" ? offset2(Object.assign({}, rects, {
            placement
          })) : offset2, skidding = _ref[0], distance = _ref[1];
          skidding = skidding || 0;
          distance = (distance || 0) * invertDistance;
          return [left, right].indexOf(basePlacement) >= 0 ? {
            x: distance,
            y: skidding
          } : {
            x: skidding,
            y: distance
          };
        }
        function offset(_ref2) {
          var state = _ref2.state, options = _ref2.options, name = _ref2.name;
          var _options$offset = options.offset, offset2 = _options$offset === void 0 ? [0, 0] : _options$offset;
          var data = placements.reduce(function(acc, placement) {
            acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset2);
            return acc;
          }, {});
          var _data$state$placement = data[state.placement], x = _data$state$placement.x, y = _data$state$placement.y;
          if (state.modifiersData.popperOffsets != null) {
            state.modifiersData.popperOffsets.x += x;
            state.modifiersData.popperOffsets.y += y;
          }
          state.modifiersData[name] = data;
        }
        const offset$1 = {
          name: "offset",
          enabled: true,
          phase: "main",
          requires: ["popperOffsets"],
          fn: offset
        };
        function popperOffsets(_ref) {
          var state = _ref.state, name = _ref.name;
          state.modifiersData[name] = computeOffsets({
            reference: state.rects.reference,
            element: state.rects.popper,
            strategy: "absolute",
            placement: state.placement
          });
        }
        const popperOffsets$1 = {
          name: "popperOffsets",
          enabled: true,
          phase: "read",
          fn: popperOffsets,
          data: {}
        };
        function getAltAxis(axis) {
          return axis === "x" ? "y" : "x";
        }
        function preventOverflow(_ref) {
          var state = _ref.state, options = _ref.options, name = _ref.name;
          var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, padding = options.padding, _options$tether = options.tether, tether = _options$tether === void 0 ? true : _options$tether, _options$tetherOffset = options.tetherOffset, tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
          var overflow = detectOverflow(state, {
            boundary,
            rootBoundary,
            padding,
            altBoundary
          });
          var basePlacement = getBasePlacement(state.placement);
          var variation = getVariation(state.placement);
          var isBasePlacement = !variation;
          var mainAxis = getMainAxisFromPlacement(basePlacement);
          var altAxis = getAltAxis(mainAxis);
          var popperOffsets2 = state.modifiersData.popperOffsets;
          var referenceRect = state.rects.reference;
          var popperRect = state.rects.popper;
          var tetherOffsetValue = typeof tetherOffset === "function" ? tetherOffset(Object.assign({}, state.rects, {
            placement: state.placement
          })) : tetherOffset;
          var normalizedTetherOffsetValue = typeof tetherOffsetValue === "number" ? {
            mainAxis: tetherOffsetValue,
            altAxis: tetherOffsetValue
          } : Object.assign({
            mainAxis: 0,
            altAxis: 0
          }, tetherOffsetValue);
          var offsetModifierState = state.modifiersData.offset ? state.modifiersData.offset[state.placement] : null;
          var data = {
            x: 0,
            y: 0
          };
          if (!popperOffsets2) {
            return;
          }
          if (checkMainAxis) {
            var _offsetModifierState$;
            var mainSide = mainAxis === "y" ? top : left;
            var altSide = mainAxis === "y" ? bottom : right;
            var len = mainAxis === "y" ? "height" : "width";
            var offset2 = popperOffsets2[mainAxis];
            var min$1 = offset2 + overflow[mainSide];
            var max$1 = offset2 - overflow[altSide];
            var additive = tether ? -popperRect[len] / 2 : 0;
            var minLen = variation === start ? referenceRect[len] : popperRect[len];
            var maxLen = variation === start ? -popperRect[len] : -referenceRect[len];
            var arrowElement = state.elements.arrow;
            var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
              width: 0,
              height: 0
            };
            var arrowPaddingObject = state.modifiersData["arrow#persistent"] ? state.modifiersData["arrow#persistent"].padding : getFreshSideObject();
            var arrowPaddingMin = arrowPaddingObject[mainSide];
            var arrowPaddingMax = arrowPaddingObject[altSide];
            var arrowLen = within(0, referenceRect[len], arrowRect[len]);
            var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis : minLen - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis;
            var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis : maxLen + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis;
            var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
            var clientOffset = arrowOffsetParent ? mainAxis === "y" ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
            var offsetModifierValue = (_offsetModifierState$ = offsetModifierState == null ? void 0 : offsetModifierState[mainAxis]) != null ? _offsetModifierState$ : 0;
            var tetherMin = offset2 + minOffset - offsetModifierValue - clientOffset;
            var tetherMax = offset2 + maxOffset - offsetModifierValue;
            var preventedOffset = within(tether ? min(min$1, tetherMin) : min$1, offset2, tether ? max(max$1, tetherMax) : max$1);
            popperOffsets2[mainAxis] = preventedOffset;
            data[mainAxis] = preventedOffset - offset2;
          }
          if (checkAltAxis) {
            var _offsetModifierState$2;
            var _mainSide = mainAxis === "x" ? top : left;
            var _altSide = mainAxis === "x" ? bottom : right;
            var _offset = popperOffsets2[altAxis];
            var _len = altAxis === "y" ? "height" : "width";
            var _min = _offset + overflow[_mainSide];
            var _max = _offset - overflow[_altSide];
            var isOriginSide = [top, left].indexOf(basePlacement) !== -1;
            var _offsetModifierValue = (_offsetModifierState$2 = offsetModifierState == null ? void 0 : offsetModifierState[altAxis]) != null ? _offsetModifierState$2 : 0;
            var _tetherMin = isOriginSide ? _min : _offset - referenceRect[_len] - popperRect[_len] - _offsetModifierValue + normalizedTetherOffsetValue.altAxis;
            var _tetherMax = isOriginSide ? _offset + referenceRect[_len] + popperRect[_len] - _offsetModifierValue - normalizedTetherOffsetValue.altAxis : _max;
            var _preventedOffset = tether && isOriginSide ? withinMaxClamp(_tetherMin, _offset, _tetherMax) : within(tether ? _tetherMin : _min, _offset, tether ? _tetherMax : _max);
            popperOffsets2[altAxis] = _preventedOffset;
            data[altAxis] = _preventedOffset - _offset;
          }
          state.modifiersData[name] = data;
        }
        const preventOverflow$1 = {
          name: "preventOverflow",
          enabled: true,
          phase: "main",
          fn: preventOverflow,
          requiresIfExists: ["offset"]
        };
        function getHTMLElementScroll(element) {
          return {
            scrollLeft: element.scrollLeft,
            scrollTop: element.scrollTop
          };
        }
        function getNodeScroll(node) {
          if (node === getWindow(node) || !isHTMLElement(node)) {
            return getWindowScroll(node);
          } else {
            return getHTMLElementScroll(node);
          }
        }
        function isElementScaled(element) {
          var rect = element.getBoundingClientRect();
          var scaleX = round(rect.width) / element.offsetWidth || 1;
          var scaleY = round(rect.height) / element.offsetHeight || 1;
          return scaleX !== 1 || scaleY !== 1;
        }
        function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
          if (isFixed === void 0) {
            isFixed = false;
          }
          var isOffsetParentAnElement = isHTMLElement(offsetParent);
          var offsetParentIsScaled = isHTMLElement(offsetParent) && isElementScaled(offsetParent);
          var documentElement = getDocumentElement(offsetParent);
          var rect = getBoundingClientRect(elementOrVirtualElement, offsetParentIsScaled, isFixed);
          var scroll = {
            scrollLeft: 0,
            scrollTop: 0
          };
          var offsets = {
            x: 0,
            y: 0
          };
          if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
            if (getNodeName(offsetParent) !== "body" || // https://github.com/popperjs/popper-core/issues/1078
            isScrollParent(documentElement)) {
              scroll = getNodeScroll(offsetParent);
            }
            if (isHTMLElement(offsetParent)) {
              offsets = getBoundingClientRect(offsetParent, true);
              offsets.x += offsetParent.clientLeft;
              offsets.y += offsetParent.clientTop;
            } else if (documentElement) {
              offsets.x = getWindowScrollBarX(documentElement);
            }
          }
          return {
            x: rect.left + scroll.scrollLeft - offsets.x,
            y: rect.top + scroll.scrollTop - offsets.y,
            width: rect.width,
            height: rect.height
          };
        }
        function order(modifiers) {
          var map = /* @__PURE__ */ new Map();
          var visited = /* @__PURE__ */ new Set();
          var result = [];
          modifiers.forEach(function(modifier) {
            map.set(modifier.name, modifier);
          });
          function sort(modifier) {
            visited.add(modifier.name);
            var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
            requires.forEach(function(dep) {
              if (!visited.has(dep)) {
                var depModifier = map.get(dep);
                if (depModifier) {
                  sort(depModifier);
                }
              }
            });
            result.push(modifier);
          }
          modifiers.forEach(function(modifier) {
            if (!visited.has(modifier.name)) {
              sort(modifier);
            }
          });
          return result;
        }
        function orderModifiers(modifiers) {
          var orderedModifiers = order(modifiers);
          return modifierPhases.reduce(function(acc, phase) {
            return acc.concat(orderedModifiers.filter(function(modifier) {
              return modifier.phase === phase;
            }));
          }, []);
        }
        function debounce(fn) {
          var pending;
          return function() {
            if (!pending) {
              pending = new Promise(function(resolve) {
                Promise.resolve().then(function() {
                  pending = void 0;
                  resolve(fn());
                });
              });
            }
            return pending;
          };
        }
        function mergeByName(modifiers) {
          var merged = modifiers.reduce(function(merged2, current) {
            var existing = merged2[current.name];
            merged2[current.name] = existing ? Object.assign({}, existing, current, {
              options: Object.assign({}, existing.options, current.options),
              data: Object.assign({}, existing.data, current.data)
            }) : current;
            return merged2;
          }, {});
          return Object.keys(merged).map(function(key) {
            return merged[key];
          });
        }
        var DEFAULT_OPTIONS = {
          placement: "bottom",
          modifiers: [],
          strategy: "absolute"
        };
        function areValidElements() {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          return !args.some(function(element) {
            return !(element && typeof element.getBoundingClientRect === "function");
          });
        }
        function popperGenerator(generatorOptions) {
          if (generatorOptions === void 0) {
            generatorOptions = {};
          }
          var _generatorOptions = generatorOptions, _generatorOptions$def = _generatorOptions.defaultModifiers, defaultModifiers2 = _generatorOptions$def === void 0 ? [] : _generatorOptions$def, _generatorOptions$def2 = _generatorOptions.defaultOptions, defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
          return function createPopper2(reference2, popper2, options) {
            if (options === void 0) {
              options = defaultOptions;
            }
            var state = {
              placement: "bottom",
              orderedModifiers: [],
              options: Object.assign({}, DEFAULT_OPTIONS, defaultOptions),
              modifiersData: {},
              elements: {
                reference: reference2,
                popper: popper2
              },
              attributes: {},
              styles: {}
            };
            var effectCleanupFns = [];
            var isDestroyed = false;
            var instance = {
              state,
              setOptions: function setOptions(setOptionsAction) {
                var options2 = typeof setOptionsAction === "function" ? setOptionsAction(state.options) : setOptionsAction;
                cleanupModifierEffects();
                state.options = Object.assign({}, defaultOptions, state.options, options2);
                state.scrollParents = {
                  reference: isElement(reference2) ? listScrollParents(reference2) : reference2.contextElement ? listScrollParents(reference2.contextElement) : [],
                  popper: listScrollParents(popper2)
                };
                var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers2, state.options.modifiers)));
                state.orderedModifiers = orderedModifiers.filter(function(m) {
                  return m.enabled;
                });
                runModifierEffects();
                return instance.update();
              },
              // Sync update – it will always be executed, even if not necessary. This
              // is useful for low frequency updates where sync behavior simplifies the
              // logic.
              // For high frequency updates (e.g. `resize` and `scroll` events), always
              // prefer the async Popper#update method
              forceUpdate: function forceUpdate() {
                if (isDestroyed) {
                  return;
                }
                var _state$elements = state.elements, reference3 = _state$elements.reference, popper3 = _state$elements.popper;
                if (!areValidElements(reference3, popper3)) {
                  return;
                }
                state.rects = {
                  reference: getCompositeRect(reference3, getOffsetParent(popper3), state.options.strategy === "fixed"),
                  popper: getLayoutRect(popper3)
                };
                state.reset = false;
                state.placement = state.options.placement;
                state.orderedModifiers.forEach(function(modifier) {
                  return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
                });
                for (var index = 0; index < state.orderedModifiers.length; index++) {
                  if (state.reset === true) {
                    state.reset = false;
                    index = -1;
                    continue;
                  }
                  var _state$orderedModifie = state.orderedModifiers[index], fn = _state$orderedModifie.fn, _state$orderedModifie2 = _state$orderedModifie.options, _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2, name = _state$orderedModifie.name;
                  if (typeof fn === "function") {
                    state = fn({
                      state,
                      options: _options,
                      name,
                      instance
                    }) || state;
                  }
                }
              },
              // Async and optimistically optimized update – it will not be executed if
              // not necessary (debounced to run at most once-per-tick)
              update: debounce(function() {
                return new Promise(function(resolve) {
                  instance.forceUpdate();
                  resolve(state);
                });
              }),
              destroy: function destroy() {
                cleanupModifierEffects();
                isDestroyed = true;
              }
            };
            if (!areValidElements(reference2, popper2)) {
              return instance;
            }
            instance.setOptions(options).then(function(state2) {
              if (!isDestroyed && options.onFirstUpdate) {
                options.onFirstUpdate(state2);
              }
            });
            function runModifierEffects() {
              state.orderedModifiers.forEach(function(_ref) {
                var name = _ref.name, _ref$options = _ref.options, options2 = _ref$options === void 0 ? {} : _ref$options, effect2 = _ref.effect;
                if (typeof effect2 === "function") {
                  var cleanupFn = effect2({
                    state,
                    name,
                    instance,
                    options: options2
                  });
                  var noopFn = function noopFn2() {
                  };
                  effectCleanupFns.push(cleanupFn || noopFn);
                }
              });
            }
            function cleanupModifierEffects() {
              effectCleanupFns.forEach(function(fn) {
                return fn();
              });
              effectCleanupFns = [];
            }
            return instance;
          };
        }
        var createPopper$2 = /* @__PURE__ */ popperGenerator();
        var defaultModifiers$1 = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1];
        var createPopper$1 = /* @__PURE__ */ popperGenerator({
          defaultModifiers: defaultModifiers$1
        });
        var defaultModifiers = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1, offset$1, flip$1, preventOverflow$1, arrow$1, hide$1];
        var createPopper = /* @__PURE__ */ popperGenerator({
          defaultModifiers
        });
        const Popper = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
          __proto__: null,
          afterMain,
          afterRead,
          afterWrite,
          applyStyles: applyStyles$1,
          arrow: arrow$1,
          auto,
          basePlacements,
          beforeMain,
          beforeRead,
          beforeWrite,
          bottom,
          clippingParents,
          computeStyles: computeStyles$1,
          createPopper,
          createPopperBase: createPopper$2,
          createPopperLite: createPopper$1,
          detectOverflow,
          end,
          eventListeners,
          flip: flip$1,
          hide: hide$1,
          left,
          main,
          modifierPhases,
          offset: offset$1,
          placements,
          popper,
          popperGenerator,
          popperOffsets: popperOffsets$1,
          preventOverflow: preventOverflow$1,
          read,
          reference,
          right,
          start,
          top,
          variationPlacements,
          viewport,
          write
        }, Symbol.toStringTag, { value: "Module" }));
        const NAME$a = "dropdown";
        const DATA_KEY$6 = "bs.dropdown";
        const EVENT_KEY$6 = `.${DATA_KEY$6}`;
        const DATA_API_KEY$3 = ".data-api";
        const ESCAPE_KEY$2 = "Escape";
        const TAB_KEY$1 = "Tab";
        const ARROW_UP_KEY$1 = "ArrowUp";
        const ARROW_DOWN_KEY$1 = "ArrowDown";
        const RIGHT_MOUSE_BUTTON = 2;
        const EVENT_HIDE$5 = `hide${EVENT_KEY$6}`;
        const EVENT_HIDDEN$5 = `hidden${EVENT_KEY$6}`;
        const EVENT_SHOW$5 = `show${EVENT_KEY$6}`;
        const EVENT_SHOWN$5 = `shown${EVENT_KEY$6}`;
        const EVENT_CLICK_DATA_API$3 = `click${EVENT_KEY$6}${DATA_API_KEY$3}`;
        const EVENT_KEYDOWN_DATA_API = `keydown${EVENT_KEY$6}${DATA_API_KEY$3}`;
        const EVENT_KEYUP_DATA_API = `keyup${EVENT_KEY$6}${DATA_API_KEY$3}`;
        const CLASS_NAME_SHOW$6 = "show";
        const CLASS_NAME_DROPUP = "dropup";
        const CLASS_NAME_DROPEND = "dropend";
        const CLASS_NAME_DROPSTART = "dropstart";
        const CLASS_NAME_DROPUP_CENTER = "dropup-center";
        const CLASS_NAME_DROPDOWN_CENTER = "dropdown-center";
        const SELECTOR_DATA_TOGGLE$3 = '[data-bs-toggle="dropdown"]:not(.disabled):not(:disabled)';
        const SELECTOR_DATA_TOGGLE_SHOWN = `${SELECTOR_DATA_TOGGLE$3}.${CLASS_NAME_SHOW$6}`;
        const SELECTOR_MENU = ".dropdown-menu";
        const SELECTOR_NAVBAR = ".navbar";
        const SELECTOR_NAVBAR_NAV = ".navbar-nav";
        const SELECTOR_VISIBLE_ITEMS = ".dropdown-menu .dropdown-item:not(.disabled):not(:disabled)";
        const PLACEMENT_TOP = isRTL() ? "top-end" : "top-start";
        const PLACEMENT_TOPEND = isRTL() ? "top-start" : "top-end";
        const PLACEMENT_BOTTOM = isRTL() ? "bottom-end" : "bottom-start";
        const PLACEMENT_BOTTOMEND = isRTL() ? "bottom-start" : "bottom-end";
        const PLACEMENT_RIGHT = isRTL() ? "left-start" : "right-start";
        const PLACEMENT_LEFT = isRTL() ? "right-start" : "left-start";
        const PLACEMENT_TOPCENTER = "top";
        const PLACEMENT_BOTTOMCENTER = "bottom";
        const Default$9 = {
          autoClose: true,
          boundary: "clippingParents",
          display: "dynamic",
          offset: [0, 2],
          popperConfig: null,
          reference: "toggle"
        };
        const DefaultType$9 = {
          autoClose: "(boolean|string)",
          boundary: "(string|element)",
          display: "string",
          offset: "(array|string|function)",
          popperConfig: "(null|object|function)",
          reference: "(string|element|object)"
        };
        class Dropdown extends BaseComponent {
          constructor(element, config) {
            super(element, config);
            this._popper = null;
            this._parent = this._element.parentNode;
            this._menu = SelectorEngine.next(this._element, SELECTOR_MENU)[0] || SelectorEngine.prev(this._element, SELECTOR_MENU)[0] || SelectorEngine.findOne(SELECTOR_MENU, this._parent);
            this._inNavbar = this._detectNavbar();
          }
          // Getters
          static get Default() {
            return Default$9;
          }
          static get DefaultType() {
            return DefaultType$9;
          }
          static get NAME() {
            return NAME$a;
          }
          // Public
          toggle() {
            return this._isShown() ? this.hide() : this.show();
          }
          show() {
            if (isDisabled(this._element) || this._isShown()) {
              return;
            }
            const relatedTarget = {
              relatedTarget: this._element
            };
            const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$5, relatedTarget);
            if (showEvent.defaultPrevented) {
              return;
            }
            this._createPopper();
            if ("ontouchstart" in document.documentElement && !this._parent.closest(SELECTOR_NAVBAR_NAV)) {
              for (const element of [].concat(...document.body.children)) {
                EventHandler.on(element, "mouseover", noop);
              }
            }
            this._element.focus();
            this._element.setAttribute("aria-expanded", true);
            this._menu.classList.add(CLASS_NAME_SHOW$6);
            this._element.classList.add(CLASS_NAME_SHOW$6);
            EventHandler.trigger(this._element, EVENT_SHOWN$5, relatedTarget);
          }
          hide() {
            if (isDisabled(this._element) || !this._isShown()) {
              return;
            }
            const relatedTarget = {
              relatedTarget: this._element
            };
            this._completeHide(relatedTarget);
          }
          dispose() {
            if (this._popper) {
              this._popper.destroy();
            }
            super.dispose();
          }
          update() {
            this._inNavbar = this._detectNavbar();
            if (this._popper) {
              this._popper.update();
            }
          }
          // Private
          _completeHide(relatedTarget) {
            const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$5, relatedTarget);
            if (hideEvent.defaultPrevented) {
              return;
            }
            if ("ontouchstart" in document.documentElement) {
              for (const element of [].concat(...document.body.children)) {
                EventHandler.off(element, "mouseover", noop);
              }
            }
            if (this._popper) {
              this._popper.destroy();
            }
            this._menu.classList.remove(CLASS_NAME_SHOW$6);
            this._element.classList.remove(CLASS_NAME_SHOW$6);
            this._element.setAttribute("aria-expanded", "false");
            Manipulator.removeDataAttribute(this._menu, "popper");
            EventHandler.trigger(this._element, EVENT_HIDDEN$5, relatedTarget);
          }
          _getConfig(config) {
            config = super._getConfig(config);
            if (typeof config.reference === "object" && !isElement$1(config.reference) && typeof config.reference.getBoundingClientRect !== "function") {
              throw new TypeError(`${NAME$a.toUpperCase()}: Option "reference" provided type "object" without a required "getBoundingClientRect" method.`);
            }
            return config;
          }
          _createPopper() {
            if (typeof Popper === "undefined") {
              throw new TypeError("Bootstrap's dropdowns require Popper (https://popper.js.org)");
            }
            let referenceElement = this._element;
            if (this._config.reference === "parent") {
              referenceElement = this._parent;
            } else if (isElement$1(this._config.reference)) {
              referenceElement = getElement(this._config.reference);
            } else if (typeof this._config.reference === "object") {
              referenceElement = this._config.reference;
            }
            const popperConfig = this._getPopperConfig();
            this._popper = createPopper(referenceElement, this._menu, popperConfig);
          }
          _isShown() {
            return this._menu.classList.contains(CLASS_NAME_SHOW$6);
          }
          _getPlacement() {
            const parentDropdown = this._parent;
            if (parentDropdown.classList.contains(CLASS_NAME_DROPEND)) {
              return PLACEMENT_RIGHT;
            }
            if (parentDropdown.classList.contains(CLASS_NAME_DROPSTART)) {
              return PLACEMENT_LEFT;
            }
            if (parentDropdown.classList.contains(CLASS_NAME_DROPUP_CENTER)) {
              return PLACEMENT_TOPCENTER;
            }
            if (parentDropdown.classList.contains(CLASS_NAME_DROPDOWN_CENTER)) {
              return PLACEMENT_BOTTOMCENTER;
            }
            const isEnd = getComputedStyle(this._menu).getPropertyValue("--bs-position").trim() === "end";
            if (parentDropdown.classList.contains(CLASS_NAME_DROPUP)) {
              return isEnd ? PLACEMENT_TOPEND : PLACEMENT_TOP;
            }
            return isEnd ? PLACEMENT_BOTTOMEND : PLACEMENT_BOTTOM;
          }
          _detectNavbar() {
            return this._element.closest(SELECTOR_NAVBAR) !== null;
          }
          _getOffset() {
            const {
              offset: offset2
            } = this._config;
            if (typeof offset2 === "string") {
              return offset2.split(",").map((value) => Number.parseInt(value, 10));
            }
            if (typeof offset2 === "function") {
              return (popperData) => offset2(popperData, this._element);
            }
            return offset2;
          }
          _getPopperConfig() {
            const defaultBsPopperConfig = {
              placement: this._getPlacement(),
              modifiers: [{
                name: "preventOverflow",
                options: {
                  boundary: this._config.boundary
                }
              }, {
                name: "offset",
                options: {
                  offset: this._getOffset()
                }
              }]
            };
            if (this._inNavbar || this._config.display === "static") {
              Manipulator.setDataAttribute(this._menu, "popper", "static");
              defaultBsPopperConfig.modifiers = [{
                name: "applyStyles",
                enabled: false
              }];
            }
            return {
              ...defaultBsPopperConfig,
              ...execute(this._config.popperConfig, [defaultBsPopperConfig])
            };
          }
          _selectMenuItem({
            key,
            target
          }) {
            const items = SelectorEngine.find(SELECTOR_VISIBLE_ITEMS, this._menu).filter((element) => isVisible(element));
            if (!items.length) {
              return;
            }
            getNextActiveElement(items, target, key === ARROW_DOWN_KEY$1, !items.includes(target)).focus();
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Dropdown.getOrCreateInstance(this, config);
              if (typeof config !== "string") {
                return;
              }
              if (typeof data[config] === "undefined") {
                throw new TypeError(`No method named "${config}"`);
              }
              data[config]();
            });
          }
          static clearMenus(event) {
            if (event.button === RIGHT_MOUSE_BUTTON || event.type === "keyup" && event.key !== TAB_KEY$1) {
              return;
            }
            const openToggles = SelectorEngine.find(SELECTOR_DATA_TOGGLE_SHOWN);
            for (const toggle of openToggles) {
              const context = Dropdown.getInstance(toggle);
              if (!context || context._config.autoClose === false) {
                continue;
              }
              const composedPath = event.composedPath();
              const isMenuTarget = composedPath.includes(context._menu);
              if (composedPath.includes(context._element) || context._config.autoClose === "inside" && !isMenuTarget || context._config.autoClose === "outside" && isMenuTarget) {
                continue;
              }
              if (context._menu.contains(event.target) && (event.type === "keyup" && event.key === TAB_KEY$1 || /input|select|option|textarea|form/i.test(event.target.tagName))) {
                continue;
              }
              const relatedTarget = {
                relatedTarget: context._element
              };
              if (event.type === "click") {
                relatedTarget.clickEvent = event;
              }
              context._completeHide(relatedTarget);
            }
          }
          static dataApiKeydownHandler(event) {
            const isInput = /input|textarea/i.test(event.target.tagName);
            const isEscapeEvent = event.key === ESCAPE_KEY$2;
            const isUpOrDownEvent = [ARROW_UP_KEY$1, ARROW_DOWN_KEY$1].includes(event.key);
            if (!isUpOrDownEvent && !isEscapeEvent) {
              return;
            }
            if (isInput && !isEscapeEvent) {
              return;
            }
            event.preventDefault();
            const getToggleButton = this.matches(SELECTOR_DATA_TOGGLE$3) ? this : SelectorEngine.prev(this, SELECTOR_DATA_TOGGLE$3)[0] || SelectorEngine.next(this, SELECTOR_DATA_TOGGLE$3)[0] || SelectorEngine.findOne(SELECTOR_DATA_TOGGLE$3, event.delegateTarget.parentNode);
            const instance = Dropdown.getOrCreateInstance(getToggleButton);
            if (isUpOrDownEvent) {
              event.stopPropagation();
              instance.show();
              instance._selectMenuItem(event);
              return;
            }
            if (instance._isShown()) {
              event.stopPropagation();
              instance.hide();
              getToggleButton.focus();
            }
          }
        }
        EventHandler.on(document, EVENT_KEYDOWN_DATA_API, SELECTOR_DATA_TOGGLE$3, Dropdown.dataApiKeydownHandler);
        EventHandler.on(document, EVENT_KEYDOWN_DATA_API, SELECTOR_MENU, Dropdown.dataApiKeydownHandler);
        EventHandler.on(document, EVENT_CLICK_DATA_API$3, Dropdown.clearMenus);
        EventHandler.on(document, EVENT_KEYUP_DATA_API, Dropdown.clearMenus);
        EventHandler.on(document, EVENT_CLICK_DATA_API$3, SELECTOR_DATA_TOGGLE$3, function(event) {
          event.preventDefault();
          Dropdown.getOrCreateInstance(this).toggle();
        });
        defineJQueryPlugin(Dropdown);
        const NAME$9 = "backdrop";
        const CLASS_NAME_FADE$4 = "fade";
        const CLASS_NAME_SHOW$5 = "show";
        const EVENT_MOUSEDOWN = `mousedown.bs.${NAME$9}`;
        const Default$8 = {
          className: "modal-backdrop",
          clickCallback: null,
          isAnimated: false,
          isVisible: true,
          // if false, we use the backdrop helper without adding any element to the dom
          rootElement: "body"
          // give the choice to place backdrop under different elements
        };
        const DefaultType$8 = {
          className: "string",
          clickCallback: "(function|null)",
          isAnimated: "boolean",
          isVisible: "boolean",
          rootElement: "(element|string)"
        };
        class Backdrop extends Config {
          constructor(config) {
            super();
            this._config = this._getConfig(config);
            this._isAppended = false;
            this._element = null;
          }
          // Getters
          static get Default() {
            return Default$8;
          }
          static get DefaultType() {
            return DefaultType$8;
          }
          static get NAME() {
            return NAME$9;
          }
          // Public
          show(callback) {
            if (!this._config.isVisible) {
              execute(callback);
              return;
            }
            this._append();
            const element = this._getElement();
            if (this._config.isAnimated) {
              reflow(element);
            }
            element.classList.add(CLASS_NAME_SHOW$5);
            this._emulateAnimation(() => {
              execute(callback);
            });
          }
          hide(callback) {
            if (!this._config.isVisible) {
              execute(callback);
              return;
            }
            this._getElement().classList.remove(CLASS_NAME_SHOW$5);
            this._emulateAnimation(() => {
              this.dispose();
              execute(callback);
            });
          }
          dispose() {
            if (!this._isAppended) {
              return;
            }
            EventHandler.off(this._element, EVENT_MOUSEDOWN);
            this._element.remove();
            this._isAppended = false;
          }
          // Private
          _getElement() {
            if (!this._element) {
              const backdrop = document.createElement("div");
              backdrop.className = this._config.className;
              if (this._config.isAnimated) {
                backdrop.classList.add(CLASS_NAME_FADE$4);
              }
              this._element = backdrop;
            }
            return this._element;
          }
          _configAfterMerge(config) {
            config.rootElement = getElement(config.rootElement);
            return config;
          }
          _append() {
            if (this._isAppended) {
              return;
            }
            const element = this._getElement();
            this._config.rootElement.append(element);
            EventHandler.on(element, EVENT_MOUSEDOWN, () => {
              execute(this._config.clickCallback);
            });
            this._isAppended = true;
          }
          _emulateAnimation(callback) {
            executeAfterTransition(callback, this._getElement(), this._config.isAnimated);
          }
        }
        const NAME$8 = "focustrap";
        const DATA_KEY$5 = "bs.focustrap";
        const EVENT_KEY$5 = `.${DATA_KEY$5}`;
        const EVENT_FOCUSIN$2 = `focusin${EVENT_KEY$5}`;
        const EVENT_KEYDOWN_TAB = `keydown.tab${EVENT_KEY$5}`;
        const TAB_KEY = "Tab";
        const TAB_NAV_FORWARD = "forward";
        const TAB_NAV_BACKWARD = "backward";
        const Default$7 = {
          autofocus: true,
          trapElement: null
          // The element to trap focus inside of
        };
        const DefaultType$7 = {
          autofocus: "boolean",
          trapElement: "element"
        };
        class FocusTrap extends Config {
          constructor(config) {
            super();
            this._config = this._getConfig(config);
            this._isActive = false;
            this._lastTabNavDirection = null;
          }
          // Getters
          static get Default() {
            return Default$7;
          }
          static get DefaultType() {
            return DefaultType$7;
          }
          static get NAME() {
            return NAME$8;
          }
          // Public
          activate() {
            if (this._isActive) {
              return;
            }
            if (this._config.autofocus) {
              this._config.trapElement.focus();
            }
            EventHandler.off(document, EVENT_KEY$5);
            EventHandler.on(document, EVENT_FOCUSIN$2, (event) => this._handleFocusin(event));
            EventHandler.on(document, EVENT_KEYDOWN_TAB, (event) => this._handleKeydown(event));
            this._isActive = true;
          }
          deactivate() {
            if (!this._isActive) {
              return;
            }
            this._isActive = false;
            EventHandler.off(document, EVENT_KEY$5);
          }
          // Private
          _handleFocusin(event) {
            const {
              trapElement
            } = this._config;
            if (event.target === document || event.target === trapElement || trapElement.contains(event.target)) {
              return;
            }
            const elements = SelectorEngine.focusableChildren(trapElement);
            if (elements.length === 0) {
              trapElement.focus();
            } else if (this._lastTabNavDirection === TAB_NAV_BACKWARD) {
              elements[elements.length - 1].focus();
            } else {
              elements[0].focus();
            }
          }
          _handleKeydown(event) {
            if (event.key !== TAB_KEY) {
              return;
            }
            this._lastTabNavDirection = event.shiftKey ? TAB_NAV_BACKWARD : TAB_NAV_FORWARD;
          }
        }
        const SELECTOR_FIXED_CONTENT = ".fixed-top, .fixed-bottom, .is-fixed, .sticky-top";
        const SELECTOR_STICKY_CONTENT = ".sticky-top";
        const PROPERTY_PADDING = "padding-right";
        const PROPERTY_MARGIN = "margin-right";
        class ScrollBarHelper {
          constructor() {
            this._element = document.body;
          }
          // Public
          getWidth() {
            const documentWidth = document.documentElement.clientWidth;
            return Math.abs(window.innerWidth - documentWidth);
          }
          hide() {
            const width = this.getWidth();
            this._disableOverFlow();
            this._setElementAttributes(this._element, PROPERTY_PADDING, (calculatedValue) => calculatedValue + width);
            this._setElementAttributes(SELECTOR_FIXED_CONTENT, PROPERTY_PADDING, (calculatedValue) => calculatedValue + width);
            this._setElementAttributes(SELECTOR_STICKY_CONTENT, PROPERTY_MARGIN, (calculatedValue) => calculatedValue - width);
          }
          reset() {
            this._resetElementAttributes(this._element, "overflow");
            this._resetElementAttributes(this._element, PROPERTY_PADDING);
            this._resetElementAttributes(SELECTOR_FIXED_CONTENT, PROPERTY_PADDING);
            this._resetElementAttributes(SELECTOR_STICKY_CONTENT, PROPERTY_MARGIN);
          }
          isOverflowing() {
            return this.getWidth() > 0;
          }
          // Private
          _disableOverFlow() {
            this._saveInitialAttribute(this._element, "overflow");
            this._element.style.overflow = "hidden";
          }
          _setElementAttributes(selector, styleProperty, callback) {
            const scrollbarWidth = this.getWidth();
            const manipulationCallBack = (element) => {
              if (element !== this._element && window.innerWidth > element.clientWidth + scrollbarWidth) {
                return;
              }
              this._saveInitialAttribute(element, styleProperty);
              const calculatedValue = window.getComputedStyle(element).getPropertyValue(styleProperty);
              element.style.setProperty(styleProperty, `${callback(Number.parseFloat(calculatedValue))}px`);
            };
            this._applyManipulationCallback(selector, manipulationCallBack);
          }
          _saveInitialAttribute(element, styleProperty) {
            const actualValue = element.style.getPropertyValue(styleProperty);
            if (actualValue) {
              Manipulator.setDataAttribute(element, styleProperty, actualValue);
            }
          }
          _resetElementAttributes(selector, styleProperty) {
            const manipulationCallBack = (element) => {
              const value = Manipulator.getDataAttribute(element, styleProperty);
              if (value === null) {
                element.style.removeProperty(styleProperty);
                return;
              }
              Manipulator.removeDataAttribute(element, styleProperty);
              element.style.setProperty(styleProperty, value);
            };
            this._applyManipulationCallback(selector, manipulationCallBack);
          }
          _applyManipulationCallback(selector, callBack) {
            if (isElement$1(selector)) {
              callBack(selector);
              return;
            }
            for (const sel of SelectorEngine.find(selector, this._element)) {
              callBack(sel);
            }
          }
        }
        const NAME$7 = "modal";
        const DATA_KEY$4 = "bs.modal";
        const EVENT_KEY$4 = `.${DATA_KEY$4}`;
        const DATA_API_KEY$2 = ".data-api";
        const ESCAPE_KEY$1 = "Escape";
        const EVENT_HIDE$4 = `hide${EVENT_KEY$4}`;
        const EVENT_HIDE_PREVENTED$1 = `hidePrevented${EVENT_KEY$4}`;
        const EVENT_HIDDEN$4 = `hidden${EVENT_KEY$4}`;
        const EVENT_SHOW$4 = `show${EVENT_KEY$4}`;
        const EVENT_SHOWN$4 = `shown${EVENT_KEY$4}`;
        const EVENT_RESIZE$1 = `resize${EVENT_KEY$4}`;
        const EVENT_CLICK_DISMISS = `click.dismiss${EVENT_KEY$4}`;
        const EVENT_MOUSEDOWN_DISMISS = `mousedown.dismiss${EVENT_KEY$4}`;
        const EVENT_KEYDOWN_DISMISS$1 = `keydown.dismiss${EVENT_KEY$4}`;
        const EVENT_CLICK_DATA_API$2 = `click${EVENT_KEY$4}${DATA_API_KEY$2}`;
        const CLASS_NAME_OPEN = "modal-open";
        const CLASS_NAME_FADE$3 = "fade";
        const CLASS_NAME_SHOW$4 = "show";
        const CLASS_NAME_STATIC = "modal-static";
        const OPEN_SELECTOR$1 = ".modal.show";
        const SELECTOR_DIALOG = ".modal-dialog";
        const SELECTOR_MODAL_BODY = ".modal-body";
        const SELECTOR_DATA_TOGGLE$2 = '[data-bs-toggle="modal"]';
        const Default$6 = {
          backdrop: true,
          focus: true,
          keyboard: true
        };
        const DefaultType$6 = {
          backdrop: "(boolean|string)",
          focus: "boolean",
          keyboard: "boolean"
        };
        class Modal extends BaseComponent {
          constructor(element, config) {
            super(element, config);
            this._dialog = SelectorEngine.findOne(SELECTOR_DIALOG, this._element);
            this._backdrop = this._initializeBackDrop();
            this._focustrap = this._initializeFocusTrap();
            this._isShown = false;
            this._isTransitioning = false;
            this._scrollBar = new ScrollBarHelper();
            this._addEventListeners();
          }
          // Getters
          static get Default() {
            return Default$6;
          }
          static get DefaultType() {
            return DefaultType$6;
          }
          static get NAME() {
            return NAME$7;
          }
          // Public
          toggle(relatedTarget) {
            return this._isShown ? this.hide() : this.show(relatedTarget);
          }
          show(relatedTarget) {
            if (this._isShown || this._isTransitioning) {
              return;
            }
            const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$4, {
              relatedTarget
            });
            if (showEvent.defaultPrevented) {
              return;
            }
            this._isShown = true;
            this._isTransitioning = true;
            this._scrollBar.hide();
            document.body.classList.add(CLASS_NAME_OPEN);
            this._adjustDialog();
            this._backdrop.show(() => this._showElement(relatedTarget));
          }
          hide() {
            if (!this._isShown || this._isTransitioning) {
              return;
            }
            const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$4);
            if (hideEvent.defaultPrevented) {
              return;
            }
            this._isShown = false;
            this._isTransitioning = true;
            this._focustrap.deactivate();
            this._element.classList.remove(CLASS_NAME_SHOW$4);
            this._queueCallback(() => this._hideModal(), this._element, this._isAnimated());
          }
          dispose() {
            EventHandler.off(window, EVENT_KEY$4);
            EventHandler.off(this._dialog, EVENT_KEY$4);
            this._backdrop.dispose();
            this._focustrap.deactivate();
            super.dispose();
          }
          handleUpdate() {
            this._adjustDialog();
          }
          // Private
          _initializeBackDrop() {
            return new Backdrop({
              isVisible: Boolean(this._config.backdrop),
              // 'static' option will be translated to true, and booleans will keep their value,
              isAnimated: this._isAnimated()
            });
          }
          _initializeFocusTrap() {
            return new FocusTrap({
              trapElement: this._element
            });
          }
          _showElement(relatedTarget) {
            if (!document.body.contains(this._element)) {
              document.body.append(this._element);
            }
            this._element.style.display = "block";
            this._element.removeAttribute("aria-hidden");
            this._element.setAttribute("aria-modal", true);
            this._element.setAttribute("role", "dialog");
            this._element.scrollTop = 0;
            const modalBody = SelectorEngine.findOne(SELECTOR_MODAL_BODY, this._dialog);
            if (modalBody) {
              modalBody.scrollTop = 0;
            }
            reflow(this._element);
            this._element.classList.add(CLASS_NAME_SHOW$4);
            const transitionComplete = () => {
              if (this._config.focus) {
                this._focustrap.activate();
              }
              this._isTransitioning = false;
              EventHandler.trigger(this._element, EVENT_SHOWN$4, {
                relatedTarget
              });
            };
            this._queueCallback(transitionComplete, this._dialog, this._isAnimated());
          }
          _addEventListeners() {
            EventHandler.on(this._element, EVENT_KEYDOWN_DISMISS$1, (event) => {
              if (event.key !== ESCAPE_KEY$1) {
                return;
              }
              if (this._config.keyboard) {
                this.hide();
                return;
              }
              this._triggerBackdropTransition();
            });
            EventHandler.on(window, EVENT_RESIZE$1, () => {
              if (this._isShown && !this._isTransitioning) {
                this._adjustDialog();
              }
            });
            EventHandler.on(this._element, EVENT_MOUSEDOWN_DISMISS, (event) => {
              EventHandler.one(this._element, EVENT_CLICK_DISMISS, (event2) => {
                if (this._element !== event.target || this._element !== event2.target) {
                  return;
                }
                if (this._config.backdrop === "static") {
                  this._triggerBackdropTransition();
                  return;
                }
                if (this._config.backdrop) {
                  this.hide();
                }
              });
            });
          }
          _hideModal() {
            this._element.style.display = "none";
            this._element.setAttribute("aria-hidden", true);
            this._element.removeAttribute("aria-modal");
            this._element.removeAttribute("role");
            this._isTransitioning = false;
            this._backdrop.hide(() => {
              document.body.classList.remove(CLASS_NAME_OPEN);
              this._resetAdjustments();
              this._scrollBar.reset();
              EventHandler.trigger(this._element, EVENT_HIDDEN$4);
            });
          }
          _isAnimated() {
            return this._element.classList.contains(CLASS_NAME_FADE$3);
          }
          _triggerBackdropTransition() {
            const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED$1);
            if (hideEvent.defaultPrevented) {
              return;
            }
            const isModalOverflowing = this._element.scrollHeight > document.documentElement.clientHeight;
            const initialOverflowY = this._element.style.overflowY;
            if (initialOverflowY === "hidden" || this._element.classList.contains(CLASS_NAME_STATIC)) {
              return;
            }
            if (!isModalOverflowing) {
              this._element.style.overflowY = "hidden";
            }
            this._element.classList.add(CLASS_NAME_STATIC);
            this._queueCallback(() => {
              this._element.classList.remove(CLASS_NAME_STATIC);
              this._queueCallback(() => {
                this._element.style.overflowY = initialOverflowY;
              }, this._dialog);
            }, this._dialog);
            this._element.focus();
          }
          /**
           * The following methods are used to handle overflowing modals
           */
          _adjustDialog() {
            const isModalOverflowing = this._element.scrollHeight > document.documentElement.clientHeight;
            const scrollbarWidth = this._scrollBar.getWidth();
            const isBodyOverflowing = scrollbarWidth > 0;
            if (isBodyOverflowing && !isModalOverflowing) {
              const property = isRTL() ? "paddingLeft" : "paddingRight";
              this._element.style[property] = `${scrollbarWidth}px`;
            }
            if (!isBodyOverflowing && isModalOverflowing) {
              const property = isRTL() ? "paddingRight" : "paddingLeft";
              this._element.style[property] = `${scrollbarWidth}px`;
            }
          }
          _resetAdjustments() {
            this._element.style.paddingLeft = "";
            this._element.style.paddingRight = "";
          }
          // Static
          static jQueryInterface(config, relatedTarget) {
            return this.each(function() {
              const data = Modal.getOrCreateInstance(this, config);
              if (typeof config !== "string") {
                return;
              }
              if (typeof data[config] === "undefined") {
                throw new TypeError(`No method named "${config}"`);
              }
              data[config](relatedTarget);
            });
          }
        }
        EventHandler.on(document, EVENT_CLICK_DATA_API$2, SELECTOR_DATA_TOGGLE$2, function(event) {
          const target = SelectorEngine.getElementFromSelector(this);
          if (["A", "AREA"].includes(this.tagName)) {
            event.preventDefault();
          }
          EventHandler.one(target, EVENT_SHOW$4, (showEvent) => {
            if (showEvent.defaultPrevented) {
              return;
            }
            EventHandler.one(target, EVENT_HIDDEN$4, () => {
              if (isVisible(this)) {
                this.focus();
              }
            });
          });
          const alreadyOpen = SelectorEngine.findOne(OPEN_SELECTOR$1);
          if (alreadyOpen) {
            Modal.getInstance(alreadyOpen).hide();
          }
          const data = Modal.getOrCreateInstance(target);
          data.toggle(this);
        });
        enableDismissTrigger(Modal);
        defineJQueryPlugin(Modal);
        const NAME$6 = "offcanvas";
        const DATA_KEY$3 = "bs.offcanvas";
        const EVENT_KEY$3 = `.${DATA_KEY$3}`;
        const DATA_API_KEY$1 = ".data-api";
        const EVENT_LOAD_DATA_API$2 = `load${EVENT_KEY$3}${DATA_API_KEY$1}`;
        const ESCAPE_KEY = "Escape";
        const CLASS_NAME_SHOW$3 = "show";
        const CLASS_NAME_SHOWING$1 = "showing";
        const CLASS_NAME_HIDING = "hiding";
        const CLASS_NAME_BACKDROP = "offcanvas-backdrop";
        const OPEN_SELECTOR = ".offcanvas.show";
        const EVENT_SHOW$3 = `show${EVENT_KEY$3}`;
        const EVENT_SHOWN$3 = `shown${EVENT_KEY$3}`;
        const EVENT_HIDE$3 = `hide${EVENT_KEY$3}`;
        const EVENT_HIDE_PREVENTED = `hidePrevented${EVENT_KEY$3}`;
        const EVENT_HIDDEN$3 = `hidden${EVENT_KEY$3}`;
        const EVENT_RESIZE = `resize${EVENT_KEY$3}`;
        const EVENT_CLICK_DATA_API$1 = `click${EVENT_KEY$3}${DATA_API_KEY$1}`;
        const EVENT_KEYDOWN_DISMISS = `keydown.dismiss${EVENT_KEY$3}`;
        const SELECTOR_DATA_TOGGLE$1 = '[data-bs-toggle="offcanvas"]';
        const Default$5 = {
          backdrop: true,
          keyboard: true,
          scroll: false
        };
        const DefaultType$5 = {
          backdrop: "(boolean|string)",
          keyboard: "boolean",
          scroll: "boolean"
        };
        class Offcanvas extends BaseComponent {
          constructor(element, config) {
            super(element, config);
            this._isShown = false;
            this._backdrop = this._initializeBackDrop();
            this._focustrap = this._initializeFocusTrap();
            this._addEventListeners();
          }
          // Getters
          static get Default() {
            return Default$5;
          }
          static get DefaultType() {
            return DefaultType$5;
          }
          static get NAME() {
            return NAME$6;
          }
          // Public
          toggle(relatedTarget) {
            return this._isShown ? this.hide() : this.show(relatedTarget);
          }
          show(relatedTarget) {
            if (this._isShown) {
              return;
            }
            const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$3, {
              relatedTarget
            });
            if (showEvent.defaultPrevented) {
              return;
            }
            this._isShown = true;
            this._backdrop.show();
            if (!this._config.scroll) {
              new ScrollBarHelper().hide();
            }
            this._element.setAttribute("aria-modal", true);
            this._element.setAttribute("role", "dialog");
            this._element.classList.add(CLASS_NAME_SHOWING$1);
            const completeCallBack = () => {
              if (!this._config.scroll || this._config.backdrop) {
                this._focustrap.activate();
              }
              this._element.classList.add(CLASS_NAME_SHOW$3);
              this._element.classList.remove(CLASS_NAME_SHOWING$1);
              EventHandler.trigger(this._element, EVENT_SHOWN$3, {
                relatedTarget
              });
            };
            this._queueCallback(completeCallBack, this._element, true);
          }
          hide() {
            if (!this._isShown) {
              return;
            }
            const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$3);
            if (hideEvent.defaultPrevented) {
              return;
            }
            this._focustrap.deactivate();
            this._element.blur();
            this._isShown = false;
            this._element.classList.add(CLASS_NAME_HIDING);
            this._backdrop.hide();
            const completeCallback = () => {
              this._element.classList.remove(CLASS_NAME_SHOW$3, CLASS_NAME_HIDING);
              this._element.removeAttribute("aria-modal");
              this._element.removeAttribute("role");
              if (!this._config.scroll) {
                new ScrollBarHelper().reset();
              }
              EventHandler.trigger(this._element, EVENT_HIDDEN$3);
            };
            this._queueCallback(completeCallback, this._element, true);
          }
          dispose() {
            this._backdrop.dispose();
            this._focustrap.deactivate();
            super.dispose();
          }
          // Private
          _initializeBackDrop() {
            const clickCallback = () => {
              if (this._config.backdrop === "static") {
                EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED);
                return;
              }
              this.hide();
            };
            const isVisible2 = Boolean(this._config.backdrop);
            return new Backdrop({
              className: CLASS_NAME_BACKDROP,
              isVisible: isVisible2,
              isAnimated: true,
              rootElement: this._element.parentNode,
              clickCallback: isVisible2 ? clickCallback : null
            });
          }
          _initializeFocusTrap() {
            return new FocusTrap({
              trapElement: this._element
            });
          }
          _addEventListeners() {
            EventHandler.on(this._element, EVENT_KEYDOWN_DISMISS, (event) => {
              if (event.key !== ESCAPE_KEY) {
                return;
              }
              if (this._config.keyboard) {
                this.hide();
                return;
              }
              EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED);
            });
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Offcanvas.getOrCreateInstance(this, config);
              if (typeof config !== "string") {
                return;
              }
              if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
                throw new TypeError(`No method named "${config}"`);
              }
              data[config](this);
            });
          }
        }
        EventHandler.on(document, EVENT_CLICK_DATA_API$1, SELECTOR_DATA_TOGGLE$1, function(event) {
          const target = SelectorEngine.getElementFromSelector(this);
          if (["A", "AREA"].includes(this.tagName)) {
            event.preventDefault();
          }
          if (isDisabled(this)) {
            return;
          }
          EventHandler.one(target, EVENT_HIDDEN$3, () => {
            if (isVisible(this)) {
              this.focus();
            }
          });
          const alreadyOpen = SelectorEngine.findOne(OPEN_SELECTOR);
          if (alreadyOpen && alreadyOpen !== target) {
            Offcanvas.getInstance(alreadyOpen).hide();
          }
          const data = Offcanvas.getOrCreateInstance(target);
          data.toggle(this);
        });
        EventHandler.on(window, EVENT_LOAD_DATA_API$2, () => {
          for (const selector of SelectorEngine.find(OPEN_SELECTOR)) {
            Offcanvas.getOrCreateInstance(selector).show();
          }
        });
        EventHandler.on(window, EVENT_RESIZE, () => {
          for (const element of SelectorEngine.find("[aria-modal][class*=show][class*=offcanvas-]")) {
            if (getComputedStyle(element).position !== "fixed") {
              Offcanvas.getOrCreateInstance(element).hide();
            }
          }
        });
        enableDismissTrigger(Offcanvas);
        defineJQueryPlugin(Offcanvas);
        const ARIA_ATTRIBUTE_PATTERN = /^aria-[\w-]*$/i;
        const DefaultAllowlist = {
          // Global attributes allowed on any supplied element below.
          "*": ["class", "dir", "id", "lang", "role", ARIA_ATTRIBUTE_PATTERN],
          a: ["target", "href", "title", "rel"],
          area: [],
          b: [],
          br: [],
          col: [],
          code: [],
          div: [],
          em: [],
          hr: [],
          h1: [],
          h2: [],
          h3: [],
          h4: [],
          h5: [],
          h6: [],
          i: [],
          img: ["src", "srcset", "alt", "title", "width", "height"],
          li: [],
          ol: [],
          p: [],
          pre: [],
          s: [],
          small: [],
          span: [],
          sub: [],
          sup: [],
          strong: [],
          u: [],
          ul: []
        };
        const uriAttributes = /* @__PURE__ */ new Set(["background", "cite", "href", "itemtype", "longdesc", "poster", "src", "xlink:href"]);
        const SAFE_URL_PATTERN = /^(?!javascript:)(?:[a-z0-9+.-]+:|[^&:/?#]*(?:[/?#]|$))/i;
        const allowedAttribute = (attribute, allowedAttributeList) => {
          const attributeName = attribute.nodeName.toLowerCase();
          if (allowedAttributeList.includes(attributeName)) {
            if (uriAttributes.has(attributeName)) {
              return Boolean(SAFE_URL_PATTERN.test(attribute.nodeValue));
            }
            return true;
          }
          return allowedAttributeList.filter((attributeRegex) => attributeRegex instanceof RegExp).some((regex) => regex.test(attributeName));
        };
        function sanitizeHtml(unsafeHtml, allowList, sanitizeFunction) {
          if (!unsafeHtml.length) {
            return unsafeHtml;
          }
          if (sanitizeFunction && typeof sanitizeFunction === "function") {
            return sanitizeFunction(unsafeHtml);
          }
          const domParser = new window.DOMParser();
          const createdDocument = domParser.parseFromString(unsafeHtml, "text/html");
          const elements = [].concat(...createdDocument.body.querySelectorAll("*"));
          for (const element of elements) {
            const elementName = element.nodeName.toLowerCase();
            if (!Object.keys(allowList).includes(elementName)) {
              element.remove();
              continue;
            }
            const attributeList = [].concat(...element.attributes);
            const allowedAttributes = [].concat(allowList["*"] || [], allowList[elementName] || []);
            for (const attribute of attributeList) {
              if (!allowedAttribute(attribute, allowedAttributes)) {
                element.removeAttribute(attribute.nodeName);
              }
            }
          }
          return createdDocument.body.innerHTML;
        }
        const NAME$5 = "TemplateFactory";
        const Default$4 = {
          allowList: DefaultAllowlist,
          content: {},
          // { selector : text ,  selector2 : text2 , }
          extraClass: "",
          html: false,
          sanitize: true,
          sanitizeFn: null,
          template: "<div></div>"
        };
        const DefaultType$4 = {
          allowList: "object",
          content: "object",
          extraClass: "(string|function)",
          html: "boolean",
          sanitize: "boolean",
          sanitizeFn: "(null|function)",
          template: "string"
        };
        const DefaultContentType = {
          entry: "(string|element|function|null)",
          selector: "(string|element)"
        };
        class TemplateFactory extends Config {
          constructor(config) {
            super();
            this._config = this._getConfig(config);
          }
          // Getters
          static get Default() {
            return Default$4;
          }
          static get DefaultType() {
            return DefaultType$4;
          }
          static get NAME() {
            return NAME$5;
          }
          // Public
          getContent() {
            return Object.values(this._config.content).map((config) => this._resolvePossibleFunction(config)).filter(Boolean);
          }
          hasContent() {
            return this.getContent().length > 0;
          }
          changeContent(content) {
            this._checkContent(content);
            this._config.content = {
              ...this._config.content,
              ...content
            };
            return this;
          }
          toHtml() {
            const templateWrapper = document.createElement("div");
            templateWrapper.innerHTML = this._maybeSanitize(this._config.template);
            for (const [selector, text] of Object.entries(this._config.content)) {
              this._setContent(templateWrapper, text, selector);
            }
            const template = templateWrapper.children[0];
            const extraClass = this._resolvePossibleFunction(this._config.extraClass);
            if (extraClass) {
              template.classList.add(...extraClass.split(" "));
            }
            return template;
          }
          // Private
          _typeCheckConfig(config) {
            super._typeCheckConfig(config);
            this._checkContent(config.content);
          }
          _checkContent(arg) {
            for (const [selector, content] of Object.entries(arg)) {
              super._typeCheckConfig({
                selector,
                entry: content
              }, DefaultContentType);
            }
          }
          _setContent(template, content, selector) {
            const templateElement = SelectorEngine.findOne(selector, template);
            if (!templateElement) {
              return;
            }
            content = this._resolvePossibleFunction(content);
            if (!content) {
              templateElement.remove();
              return;
            }
            if (isElement$1(content)) {
              this._putElementInTemplate(getElement(content), templateElement);
              return;
            }
            if (this._config.html) {
              templateElement.innerHTML = this._maybeSanitize(content);
              return;
            }
            templateElement.textContent = content;
          }
          _maybeSanitize(arg) {
            return this._config.sanitize ? sanitizeHtml(arg, this._config.allowList, this._config.sanitizeFn) : arg;
          }
          _resolvePossibleFunction(arg) {
            return execute(arg, [this]);
          }
          _putElementInTemplate(element, templateElement) {
            if (this._config.html) {
              templateElement.innerHTML = "";
              templateElement.append(element);
              return;
            }
            templateElement.textContent = element.textContent;
          }
        }
        const NAME$4 = "tooltip";
        const DISALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set(["sanitize", "allowList", "sanitizeFn"]);
        const CLASS_NAME_FADE$2 = "fade";
        const CLASS_NAME_MODAL = "modal";
        const CLASS_NAME_SHOW$2 = "show";
        const SELECTOR_TOOLTIP_INNER = ".tooltip-inner";
        const SELECTOR_MODAL = `.${CLASS_NAME_MODAL}`;
        const EVENT_MODAL_HIDE = "hide.bs.modal";
        const TRIGGER_HOVER = "hover";
        const TRIGGER_FOCUS = "focus";
        const TRIGGER_CLICK = "click";
        const TRIGGER_MANUAL = "manual";
        const EVENT_HIDE$2 = "hide";
        const EVENT_HIDDEN$2 = "hidden";
        const EVENT_SHOW$2 = "show";
        const EVENT_SHOWN$2 = "shown";
        const EVENT_INSERTED = "inserted";
        const EVENT_CLICK$1 = "click";
        const EVENT_FOCUSIN$1 = "focusin";
        const EVENT_FOCUSOUT$1 = "focusout";
        const EVENT_MOUSEENTER = "mouseenter";
        const EVENT_MOUSELEAVE = "mouseleave";
        const AttachmentMap = {
          AUTO: "auto",
          TOP: "top",
          RIGHT: isRTL() ? "left" : "right",
          BOTTOM: "bottom",
          LEFT: isRTL() ? "right" : "left"
        };
        const Default$3 = {
          allowList: DefaultAllowlist,
          animation: true,
          boundary: "clippingParents",
          container: false,
          customClass: "",
          delay: 0,
          fallbackPlacements: ["top", "right", "bottom", "left"],
          html: false,
          offset: [0, 6],
          placement: "top",
          popperConfig: null,
          sanitize: true,
          sanitizeFn: null,
          selector: false,
          template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
          title: "",
          trigger: "hover focus"
        };
        const DefaultType$3 = {
          allowList: "object",
          animation: "boolean",
          boundary: "(string|element)",
          container: "(string|element|boolean)",
          customClass: "(string|function)",
          delay: "(number|object)",
          fallbackPlacements: "array",
          html: "boolean",
          offset: "(array|string|function)",
          placement: "(string|function)",
          popperConfig: "(null|object|function)",
          sanitize: "boolean",
          sanitizeFn: "(null|function)",
          selector: "(string|boolean)",
          template: "string",
          title: "(string|element|function)",
          trigger: "string"
        };
        class Tooltip extends BaseComponent {
          constructor(element, config) {
            if (typeof Popper === "undefined") {
              throw new TypeError("Bootstrap's tooltips require Popper (https://popper.js.org)");
            }
            super(element, config);
            this._isEnabled = true;
            this._timeout = 0;
            this._isHovered = null;
            this._activeTrigger = {};
            this._popper = null;
            this._templateFactory = null;
            this._newContent = null;
            this.tip = null;
            this._setListeners();
            if (!this._config.selector) {
              this._fixTitle();
            }
          }
          // Getters
          static get Default() {
            return Default$3;
          }
          static get DefaultType() {
            return DefaultType$3;
          }
          static get NAME() {
            return NAME$4;
          }
          // Public
          enable() {
            this._isEnabled = true;
          }
          disable() {
            this._isEnabled = false;
          }
          toggleEnabled() {
            this._isEnabled = !this._isEnabled;
          }
          toggle() {
            if (!this._isEnabled) {
              return;
            }
            this._activeTrigger.click = !this._activeTrigger.click;
            if (this._isShown()) {
              this._leave();
              return;
            }
            this._enter();
          }
          dispose() {
            clearTimeout(this._timeout);
            EventHandler.off(this._element.closest(SELECTOR_MODAL), EVENT_MODAL_HIDE, this._hideModalHandler);
            if (this._element.getAttribute("data-bs-original-title")) {
              this._element.setAttribute("title", this._element.getAttribute("data-bs-original-title"));
            }
            this._disposePopper();
            super.dispose();
          }
          show() {
            if (this._element.style.display === "none") {
              throw new Error("Please use show on visible elements");
            }
            if (!(this._isWithContent() && this._isEnabled)) {
              return;
            }
            const showEvent = EventHandler.trigger(this._element, this.constructor.eventName(EVENT_SHOW$2));
            const shadowRoot = findShadowRoot(this._element);
            const isInTheDom = (shadowRoot || this._element.ownerDocument.documentElement).contains(this._element);
            if (showEvent.defaultPrevented || !isInTheDom) {
              return;
            }
            this._disposePopper();
            const tip = this._getTipElement();
            this._element.setAttribute("aria-describedby", tip.getAttribute("id"));
            const {
              container
            } = this._config;
            if (!this._element.ownerDocument.documentElement.contains(this.tip)) {
              container.append(tip);
              EventHandler.trigger(this._element, this.constructor.eventName(EVENT_INSERTED));
            }
            this._popper = this._createPopper(tip);
            tip.classList.add(CLASS_NAME_SHOW$2);
            if ("ontouchstart" in document.documentElement) {
              for (const element of [].concat(...document.body.children)) {
                EventHandler.on(element, "mouseover", noop);
              }
            }
            const complete = () => {
              EventHandler.trigger(this._element, this.constructor.eventName(EVENT_SHOWN$2));
              if (this._isHovered === false) {
                this._leave();
              }
              this._isHovered = false;
            };
            this._queueCallback(complete, this.tip, this._isAnimated());
          }
          hide() {
            if (!this._isShown()) {
              return;
            }
            const hideEvent = EventHandler.trigger(this._element, this.constructor.eventName(EVENT_HIDE$2));
            if (hideEvent.defaultPrevented) {
              return;
            }
            const tip = this._getTipElement();
            tip.classList.remove(CLASS_NAME_SHOW$2);
            if ("ontouchstart" in document.documentElement) {
              for (const element of [].concat(...document.body.children)) {
                EventHandler.off(element, "mouseover", noop);
              }
            }
            this._activeTrigger[TRIGGER_CLICK] = false;
            this._activeTrigger[TRIGGER_FOCUS] = false;
            this._activeTrigger[TRIGGER_HOVER] = false;
            this._isHovered = null;
            const complete = () => {
              if (this._isWithActiveTrigger()) {
                return;
              }
              if (!this._isHovered) {
                this._disposePopper();
              }
              this._element.removeAttribute("aria-describedby");
              EventHandler.trigger(this._element, this.constructor.eventName(EVENT_HIDDEN$2));
            };
            this._queueCallback(complete, this.tip, this._isAnimated());
          }
          update() {
            if (this._popper) {
              this._popper.update();
            }
          }
          // Protected
          _isWithContent() {
            return Boolean(this._getTitle());
          }
          _getTipElement() {
            if (!this.tip) {
              this.tip = this._createTipElement(this._newContent || this._getContentForTemplate());
            }
            return this.tip;
          }
          _createTipElement(content) {
            const tip = this._getTemplateFactory(content).toHtml();
            if (!tip) {
              return null;
            }
            tip.classList.remove(CLASS_NAME_FADE$2, CLASS_NAME_SHOW$2);
            tip.classList.add(`bs-${this.constructor.NAME}-auto`);
            const tipId = getUID(this.constructor.NAME).toString();
            tip.setAttribute("id", tipId);
            if (this._isAnimated()) {
              tip.classList.add(CLASS_NAME_FADE$2);
            }
            return tip;
          }
          setContent(content) {
            this._newContent = content;
            if (this._isShown()) {
              this._disposePopper();
              this.show();
            }
          }
          _getTemplateFactory(content) {
            if (this._templateFactory) {
              this._templateFactory.changeContent(content);
            } else {
              this._templateFactory = new TemplateFactory({
                ...this._config,
                // the `content` var has to be after `this._config`
                // to override config.content in case of popover
                content,
                extraClass: this._resolvePossibleFunction(this._config.customClass)
              });
            }
            return this._templateFactory;
          }
          _getContentForTemplate() {
            return {
              [SELECTOR_TOOLTIP_INNER]: this._getTitle()
            };
          }
          _getTitle() {
            return this._resolvePossibleFunction(this._config.title) || this._element.getAttribute("data-bs-original-title");
          }
          // Private
          _initializeOnDelegatedTarget(event) {
            return this.constructor.getOrCreateInstance(event.delegateTarget, this._getDelegateConfig());
          }
          _isAnimated() {
            return this._config.animation || this.tip && this.tip.classList.contains(CLASS_NAME_FADE$2);
          }
          _isShown() {
            return this.tip && this.tip.classList.contains(CLASS_NAME_SHOW$2);
          }
          _createPopper(tip) {
            const placement = execute(this._config.placement, [this, tip, this._element]);
            const attachment = AttachmentMap[placement.toUpperCase()];
            return createPopper(this._element, tip, this._getPopperConfig(attachment));
          }
          _getOffset() {
            const {
              offset: offset2
            } = this._config;
            if (typeof offset2 === "string") {
              return offset2.split(",").map((value) => Number.parseInt(value, 10));
            }
            if (typeof offset2 === "function") {
              return (popperData) => offset2(popperData, this._element);
            }
            return offset2;
          }
          _resolvePossibleFunction(arg) {
            return execute(arg, [this._element]);
          }
          _getPopperConfig(attachment) {
            const defaultBsPopperConfig = {
              placement: attachment,
              modifiers: [{
                name: "flip",
                options: {
                  fallbackPlacements: this._config.fallbackPlacements
                }
              }, {
                name: "offset",
                options: {
                  offset: this._getOffset()
                }
              }, {
                name: "preventOverflow",
                options: {
                  boundary: this._config.boundary
                }
              }, {
                name: "arrow",
                options: {
                  element: `.${this.constructor.NAME}-arrow`
                }
              }, {
                name: "preSetPlacement",
                enabled: true,
                phase: "beforeMain",
                fn: (data) => {
                  this._getTipElement().setAttribute("data-popper-placement", data.state.placement);
                }
              }]
            };
            return {
              ...defaultBsPopperConfig,
              ...execute(this._config.popperConfig, [defaultBsPopperConfig])
            };
          }
          _setListeners() {
            const triggers = this._config.trigger.split(" ");
            for (const trigger of triggers) {
              if (trigger === "click") {
                EventHandler.on(this._element, this.constructor.eventName(EVENT_CLICK$1), this._config.selector, (event) => {
                  const context = this._initializeOnDelegatedTarget(event);
                  context.toggle();
                });
              } else if (trigger !== TRIGGER_MANUAL) {
                const eventIn = trigger === TRIGGER_HOVER ? this.constructor.eventName(EVENT_MOUSEENTER) : this.constructor.eventName(EVENT_FOCUSIN$1);
                const eventOut = trigger === TRIGGER_HOVER ? this.constructor.eventName(EVENT_MOUSELEAVE) : this.constructor.eventName(EVENT_FOCUSOUT$1);
                EventHandler.on(this._element, eventIn, this._config.selector, (event) => {
                  const context = this._initializeOnDelegatedTarget(event);
                  context._activeTrigger[event.type === "focusin" ? TRIGGER_FOCUS : TRIGGER_HOVER] = true;
                  context._enter();
                });
                EventHandler.on(this._element, eventOut, this._config.selector, (event) => {
                  const context = this._initializeOnDelegatedTarget(event);
                  context._activeTrigger[event.type === "focusout" ? TRIGGER_FOCUS : TRIGGER_HOVER] = context._element.contains(event.relatedTarget);
                  context._leave();
                });
              }
            }
            this._hideModalHandler = () => {
              if (this._element) {
                this.hide();
              }
            };
            EventHandler.on(this._element.closest(SELECTOR_MODAL), EVENT_MODAL_HIDE, this._hideModalHandler);
          }
          _fixTitle() {
            const title = this._element.getAttribute("title");
            if (!title) {
              return;
            }
            if (!this._element.getAttribute("aria-label") && !this._element.textContent.trim()) {
              this._element.setAttribute("aria-label", title);
            }
            this._element.setAttribute("data-bs-original-title", title);
            this._element.removeAttribute("title");
          }
          _enter() {
            if (this._isShown() || this._isHovered) {
              this._isHovered = true;
              return;
            }
            this._isHovered = true;
            this._setTimeout(() => {
              if (this._isHovered) {
                this.show();
              }
            }, this._config.delay.show);
          }
          _leave() {
            if (this._isWithActiveTrigger()) {
              return;
            }
            this._isHovered = false;
            this._setTimeout(() => {
              if (!this._isHovered) {
                this.hide();
              }
            }, this._config.delay.hide);
          }
          _setTimeout(handler, timeout) {
            clearTimeout(this._timeout);
            this._timeout = setTimeout(handler, timeout);
          }
          _isWithActiveTrigger() {
            return Object.values(this._activeTrigger).includes(true);
          }
          _getConfig(config) {
            const dataAttributes = Manipulator.getDataAttributes(this._element);
            for (const dataAttribute of Object.keys(dataAttributes)) {
              if (DISALLOWED_ATTRIBUTES.has(dataAttribute)) {
                delete dataAttributes[dataAttribute];
              }
            }
            config = {
              ...dataAttributes,
              ...typeof config === "object" && config ? config : {}
            };
            config = this._mergeConfigObj(config);
            config = this._configAfterMerge(config);
            this._typeCheckConfig(config);
            return config;
          }
          _configAfterMerge(config) {
            config.container = config.container === false ? document.body : getElement(config.container);
            if (typeof config.delay === "number") {
              config.delay = {
                show: config.delay,
                hide: config.delay
              };
            }
            if (typeof config.title === "number") {
              config.title = config.title.toString();
            }
            if (typeof config.content === "number") {
              config.content = config.content.toString();
            }
            return config;
          }
          _getDelegateConfig() {
            const config = {};
            for (const [key, value] of Object.entries(this._config)) {
              if (this.constructor.Default[key] !== value) {
                config[key] = value;
              }
            }
            config.selector = false;
            config.trigger = "manual";
            return config;
          }
          _disposePopper() {
            if (this._popper) {
              this._popper.destroy();
              this._popper = null;
            }
            if (this.tip) {
              this.tip.remove();
              this.tip = null;
            }
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Tooltip.getOrCreateInstance(this, config);
              if (typeof config !== "string") {
                return;
              }
              if (typeof data[config] === "undefined") {
                throw new TypeError(`No method named "${config}"`);
              }
              data[config]();
            });
          }
        }
        defineJQueryPlugin(Tooltip);
        const NAME$3 = "popover";
        const SELECTOR_TITLE = ".popover-header";
        const SELECTOR_CONTENT = ".popover-body";
        const Default$2 = {
          ...Tooltip.Default,
          content: "",
          offset: [0, 8],
          placement: "right",
          template: '<div class="popover" role="tooltip"><div class="popover-arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div></div>',
          trigger: "click"
        };
        const DefaultType$2 = {
          ...Tooltip.DefaultType,
          content: "(null|string|element|function)"
        };
        class Popover extends Tooltip {
          // Getters
          static get Default() {
            return Default$2;
          }
          static get DefaultType() {
            return DefaultType$2;
          }
          static get NAME() {
            return NAME$3;
          }
          // Overrides
          _isWithContent() {
            return this._getTitle() || this._getContent();
          }
          // Private
          _getContentForTemplate() {
            return {
              [SELECTOR_TITLE]: this._getTitle(),
              [SELECTOR_CONTENT]: this._getContent()
            };
          }
          _getContent() {
            return this._resolvePossibleFunction(this._config.content);
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Popover.getOrCreateInstance(this, config);
              if (typeof config !== "string") {
                return;
              }
              if (typeof data[config] === "undefined") {
                throw new TypeError(`No method named "${config}"`);
              }
              data[config]();
            });
          }
        }
        defineJQueryPlugin(Popover);
        const NAME$2 = "scrollspy";
        const DATA_KEY$2 = "bs.scrollspy";
        const EVENT_KEY$2 = `.${DATA_KEY$2}`;
        const DATA_API_KEY = ".data-api";
        const EVENT_ACTIVATE = `activate${EVENT_KEY$2}`;
        const EVENT_CLICK = `click${EVENT_KEY$2}`;
        const EVENT_LOAD_DATA_API$1 = `load${EVENT_KEY$2}${DATA_API_KEY}`;
        const CLASS_NAME_DROPDOWN_ITEM = "dropdown-item";
        const CLASS_NAME_ACTIVE$1 = "active";
        const SELECTOR_DATA_SPY = '[data-bs-spy="scroll"]';
        const SELECTOR_TARGET_LINKS = "[href]";
        const SELECTOR_NAV_LIST_GROUP = ".nav, .list-group";
        const SELECTOR_NAV_LINKS = ".nav-link";
        const SELECTOR_NAV_ITEMS = ".nav-item";
        const SELECTOR_LIST_ITEMS = ".list-group-item";
        const SELECTOR_LINK_ITEMS = `${SELECTOR_NAV_LINKS}, ${SELECTOR_NAV_ITEMS} > ${SELECTOR_NAV_LINKS}, ${SELECTOR_LIST_ITEMS}`;
        const SELECTOR_DROPDOWN = ".dropdown";
        const SELECTOR_DROPDOWN_TOGGLE$1 = ".dropdown-toggle";
        const Default$1 = {
          offset: null,
          // TODO: v6 @deprecated, keep it for backwards compatibility reasons
          rootMargin: "0px 0px -25%",
          smoothScroll: false,
          target: null,
          threshold: [0.1, 0.5, 1]
        };
        const DefaultType$1 = {
          offset: "(number|null)",
          // TODO v6 @deprecated, keep it for backwards compatibility reasons
          rootMargin: "string",
          smoothScroll: "boolean",
          target: "element",
          threshold: "array"
        };
        class ScrollSpy extends BaseComponent {
          constructor(element, config) {
            super(element, config);
            this._targetLinks = /* @__PURE__ */ new Map();
            this._observableSections = /* @__PURE__ */ new Map();
            this._rootElement = getComputedStyle(this._element).overflowY === "visible" ? null : this._element;
            this._activeTarget = null;
            this._observer = null;
            this._previousScrollData = {
              visibleEntryTop: 0,
              parentScrollTop: 0
            };
            this.refresh();
          }
          // Getters
          static get Default() {
            return Default$1;
          }
          static get DefaultType() {
            return DefaultType$1;
          }
          static get NAME() {
            return NAME$2;
          }
          // Public
          refresh() {
            this._initializeTargetsAndObservables();
            this._maybeEnableSmoothScroll();
            if (this._observer) {
              this._observer.disconnect();
            } else {
              this._observer = this._getNewObserver();
            }
            for (const section of this._observableSections.values()) {
              this._observer.observe(section);
            }
          }
          dispose() {
            this._observer.disconnect();
            super.dispose();
          }
          // Private
          _configAfterMerge(config) {
            config.target = getElement(config.target) || document.body;
            config.rootMargin = config.offset ? `${config.offset}px 0px -30%` : config.rootMargin;
            if (typeof config.threshold === "string") {
              config.threshold = config.threshold.split(",").map((value) => Number.parseFloat(value));
            }
            return config;
          }
          _maybeEnableSmoothScroll() {
            if (!this._config.smoothScroll) {
              return;
            }
            EventHandler.off(this._config.target, EVENT_CLICK);
            EventHandler.on(this._config.target, EVENT_CLICK, SELECTOR_TARGET_LINKS, (event) => {
              const observableSection = this._observableSections.get(event.target.hash);
              if (observableSection) {
                event.preventDefault();
                const root = this._rootElement || window;
                const height = observableSection.offsetTop - this._element.offsetTop;
                if (root.scrollTo) {
                  root.scrollTo({
                    top: height,
                    behavior: "smooth"
                  });
                  return;
                }
                root.scrollTop = height;
              }
            });
          }
          _getNewObserver() {
            const options = {
              root: this._rootElement,
              threshold: this._config.threshold,
              rootMargin: this._config.rootMargin
            };
            return new IntersectionObserver((entries) => this._observerCallback(entries), options);
          }
          // The logic of selection
          _observerCallback(entries) {
            const targetElement = (entry) => this._targetLinks.get(`#${entry.target.id}`);
            const activate = (entry) => {
              this._previousScrollData.visibleEntryTop = entry.target.offsetTop;
              this._process(targetElement(entry));
            };
            const parentScrollTop = (this._rootElement || document.documentElement).scrollTop;
            const userScrollsDown = parentScrollTop >= this._previousScrollData.parentScrollTop;
            this._previousScrollData.parentScrollTop = parentScrollTop;
            for (const entry of entries) {
              if (!entry.isIntersecting) {
                this._activeTarget = null;
                this._clearActiveClass(targetElement(entry));
                continue;
              }
              const entryIsLowerThanPrevious = entry.target.offsetTop >= this._previousScrollData.visibleEntryTop;
              if (userScrollsDown && entryIsLowerThanPrevious) {
                activate(entry);
                if (!parentScrollTop) {
                  return;
                }
                continue;
              }
              if (!userScrollsDown && !entryIsLowerThanPrevious) {
                activate(entry);
              }
            }
          }
          _initializeTargetsAndObservables() {
            this._targetLinks = /* @__PURE__ */ new Map();
            this._observableSections = /* @__PURE__ */ new Map();
            const targetLinks = SelectorEngine.find(SELECTOR_TARGET_LINKS, this._config.target);
            for (const anchor of targetLinks) {
              if (!anchor.hash || isDisabled(anchor)) {
                continue;
              }
              const observableSection = SelectorEngine.findOne(decodeURI(anchor.hash), this._element);
              if (isVisible(observableSection)) {
                this._targetLinks.set(decodeURI(anchor.hash), anchor);
                this._observableSections.set(anchor.hash, observableSection);
              }
            }
          }
          _process(target) {
            if (this._activeTarget === target) {
              return;
            }
            this._clearActiveClass(this._config.target);
            this._activeTarget = target;
            target.classList.add(CLASS_NAME_ACTIVE$1);
            this._activateParents(target);
            EventHandler.trigger(this._element, EVENT_ACTIVATE, {
              relatedTarget: target
            });
          }
          _activateParents(target) {
            if (target.classList.contains(CLASS_NAME_DROPDOWN_ITEM)) {
              SelectorEngine.findOne(SELECTOR_DROPDOWN_TOGGLE$1, target.closest(SELECTOR_DROPDOWN)).classList.add(CLASS_NAME_ACTIVE$1);
              return;
            }
            for (const listGroup of SelectorEngine.parents(target, SELECTOR_NAV_LIST_GROUP)) {
              for (const item of SelectorEngine.prev(listGroup, SELECTOR_LINK_ITEMS)) {
                item.classList.add(CLASS_NAME_ACTIVE$1);
              }
            }
          }
          _clearActiveClass(parent) {
            parent.classList.remove(CLASS_NAME_ACTIVE$1);
            const activeNodes = SelectorEngine.find(`${SELECTOR_TARGET_LINKS}.${CLASS_NAME_ACTIVE$1}`, parent);
            for (const node of activeNodes) {
              node.classList.remove(CLASS_NAME_ACTIVE$1);
            }
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = ScrollSpy.getOrCreateInstance(this, config);
              if (typeof config !== "string") {
                return;
              }
              if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
                throw new TypeError(`No method named "${config}"`);
              }
              data[config]();
            });
          }
        }
        EventHandler.on(window, EVENT_LOAD_DATA_API$1, () => {
          for (const spy of SelectorEngine.find(SELECTOR_DATA_SPY)) {
            ScrollSpy.getOrCreateInstance(spy);
          }
        });
        defineJQueryPlugin(ScrollSpy);
        const NAME$1 = "tab";
        const DATA_KEY$1 = "bs.tab";
        const EVENT_KEY$1 = `.${DATA_KEY$1}`;
        const EVENT_HIDE$1 = `hide${EVENT_KEY$1}`;
        const EVENT_HIDDEN$1 = `hidden${EVENT_KEY$1}`;
        const EVENT_SHOW$1 = `show${EVENT_KEY$1}`;
        const EVENT_SHOWN$1 = `shown${EVENT_KEY$1}`;
        const EVENT_CLICK_DATA_API = `click${EVENT_KEY$1}`;
        const EVENT_KEYDOWN = `keydown${EVENT_KEY$1}`;
        const EVENT_LOAD_DATA_API = `load${EVENT_KEY$1}`;
        const ARROW_LEFT_KEY = "ArrowLeft";
        const ARROW_RIGHT_KEY = "ArrowRight";
        const ARROW_UP_KEY = "ArrowUp";
        const ARROW_DOWN_KEY = "ArrowDown";
        const HOME_KEY = "Home";
        const END_KEY = "End";
        const CLASS_NAME_ACTIVE = "active";
        const CLASS_NAME_FADE$1 = "fade";
        const CLASS_NAME_SHOW$1 = "show";
        const CLASS_DROPDOWN = "dropdown";
        const SELECTOR_DROPDOWN_TOGGLE = ".dropdown-toggle";
        const SELECTOR_DROPDOWN_MENU = ".dropdown-menu";
        const NOT_SELECTOR_DROPDOWN_TOGGLE = `:not(${SELECTOR_DROPDOWN_TOGGLE})`;
        const SELECTOR_TAB_PANEL = '.list-group, .nav, [role="tablist"]';
        const SELECTOR_OUTER = ".nav-item, .list-group-item";
        const SELECTOR_INNER = `.nav-link${NOT_SELECTOR_DROPDOWN_TOGGLE}, .list-group-item${NOT_SELECTOR_DROPDOWN_TOGGLE}, [role="tab"]${NOT_SELECTOR_DROPDOWN_TOGGLE}`;
        const SELECTOR_DATA_TOGGLE = '[data-bs-toggle="tab"], [data-bs-toggle="pill"], [data-bs-toggle="list"]';
        const SELECTOR_INNER_ELEM = `${SELECTOR_INNER}, ${SELECTOR_DATA_TOGGLE}`;
        const SELECTOR_DATA_TOGGLE_ACTIVE = `.${CLASS_NAME_ACTIVE}[data-bs-toggle="tab"], .${CLASS_NAME_ACTIVE}[data-bs-toggle="pill"], .${CLASS_NAME_ACTIVE}[data-bs-toggle="list"]`;
        class Tab extends BaseComponent {
          constructor(element) {
            super(element);
            this._parent = this._element.closest(SELECTOR_TAB_PANEL);
            if (!this._parent) {
              return;
            }
            this._setInitialAttributes(this._parent, this._getChildren());
            EventHandler.on(this._element, EVENT_KEYDOWN, (event) => this._keydown(event));
          }
          // Getters
          static get NAME() {
            return NAME$1;
          }
          // Public
          show() {
            const innerElem = this._element;
            if (this._elemIsActive(innerElem)) {
              return;
            }
            const active = this._getActiveElem();
            const hideEvent = active ? EventHandler.trigger(active, EVENT_HIDE$1, {
              relatedTarget: innerElem
            }) : null;
            const showEvent = EventHandler.trigger(innerElem, EVENT_SHOW$1, {
              relatedTarget: active
            });
            if (showEvent.defaultPrevented || hideEvent && hideEvent.defaultPrevented) {
              return;
            }
            this._deactivate(active, innerElem);
            this._activate(innerElem, active);
          }
          // Private
          _activate(element, relatedElem) {
            if (!element) {
              return;
            }
            element.classList.add(CLASS_NAME_ACTIVE);
            this._activate(SelectorEngine.getElementFromSelector(element));
            const complete = () => {
              if (element.getAttribute("role") !== "tab") {
                element.classList.add(CLASS_NAME_SHOW$1);
                return;
              }
              element.removeAttribute("tabindex");
              element.setAttribute("aria-selected", true);
              this._toggleDropDown(element, true);
              EventHandler.trigger(element, EVENT_SHOWN$1, {
                relatedTarget: relatedElem
              });
            };
            this._queueCallback(complete, element, element.classList.contains(CLASS_NAME_FADE$1));
          }
          _deactivate(element, relatedElem) {
            if (!element) {
              return;
            }
            element.classList.remove(CLASS_NAME_ACTIVE);
            element.blur();
            this._deactivate(SelectorEngine.getElementFromSelector(element));
            const complete = () => {
              if (element.getAttribute("role") !== "tab") {
                element.classList.remove(CLASS_NAME_SHOW$1);
                return;
              }
              element.setAttribute("aria-selected", false);
              element.setAttribute("tabindex", "-1");
              this._toggleDropDown(element, false);
              EventHandler.trigger(element, EVENT_HIDDEN$1, {
                relatedTarget: relatedElem
              });
            };
            this._queueCallback(complete, element, element.classList.contains(CLASS_NAME_FADE$1));
          }
          _keydown(event) {
            if (![ARROW_LEFT_KEY, ARROW_RIGHT_KEY, ARROW_UP_KEY, ARROW_DOWN_KEY, HOME_KEY, END_KEY].includes(event.key)) {
              return;
            }
            event.stopPropagation();
            event.preventDefault();
            const children = this._getChildren().filter((element) => !isDisabled(element));
            let nextActiveElement;
            if ([HOME_KEY, END_KEY].includes(event.key)) {
              nextActiveElement = children[event.key === HOME_KEY ? 0 : children.length - 1];
            } else {
              const isNext = [ARROW_RIGHT_KEY, ARROW_DOWN_KEY].includes(event.key);
              nextActiveElement = getNextActiveElement(children, event.target, isNext, true);
            }
            if (nextActiveElement) {
              nextActiveElement.focus({
                preventScroll: true
              });
              Tab.getOrCreateInstance(nextActiveElement).show();
            }
          }
          _getChildren() {
            return SelectorEngine.find(SELECTOR_INNER_ELEM, this._parent);
          }
          _getActiveElem() {
            return this._getChildren().find((child) => this._elemIsActive(child)) || null;
          }
          _setInitialAttributes(parent, children) {
            this._setAttributeIfNotExists(parent, "role", "tablist");
            for (const child of children) {
              this._setInitialAttributesOnChild(child);
            }
          }
          _setInitialAttributesOnChild(child) {
            child = this._getInnerElement(child);
            const isActive = this._elemIsActive(child);
            const outerElem = this._getOuterElement(child);
            child.setAttribute("aria-selected", isActive);
            if (outerElem !== child) {
              this._setAttributeIfNotExists(outerElem, "role", "presentation");
            }
            if (!isActive) {
              child.setAttribute("tabindex", "-1");
            }
            this._setAttributeIfNotExists(child, "role", "tab");
            this._setInitialAttributesOnTargetPanel(child);
          }
          _setInitialAttributesOnTargetPanel(child) {
            const target = SelectorEngine.getElementFromSelector(child);
            if (!target) {
              return;
            }
            this._setAttributeIfNotExists(target, "role", "tabpanel");
            if (child.id) {
              this._setAttributeIfNotExists(target, "aria-labelledby", `${child.id}`);
            }
          }
          _toggleDropDown(element, open) {
            const outerElem = this._getOuterElement(element);
            if (!outerElem.classList.contains(CLASS_DROPDOWN)) {
              return;
            }
            const toggle = (selector, className) => {
              const element2 = SelectorEngine.findOne(selector, outerElem);
              if (element2) {
                element2.classList.toggle(className, open);
              }
            };
            toggle(SELECTOR_DROPDOWN_TOGGLE, CLASS_NAME_ACTIVE);
            toggle(SELECTOR_DROPDOWN_MENU, CLASS_NAME_SHOW$1);
            outerElem.setAttribute("aria-expanded", open);
          }
          _setAttributeIfNotExists(element, attribute, value) {
            if (!element.hasAttribute(attribute)) {
              element.setAttribute(attribute, value);
            }
          }
          _elemIsActive(elem) {
            return elem.classList.contains(CLASS_NAME_ACTIVE);
          }
          // Try to get the inner element (usually the .nav-link)
          _getInnerElement(elem) {
            return elem.matches(SELECTOR_INNER_ELEM) ? elem : SelectorEngine.findOne(SELECTOR_INNER_ELEM, elem);
          }
          // Try to get the outer element (usually the .nav-item)
          _getOuterElement(elem) {
            return elem.closest(SELECTOR_OUTER) || elem;
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Tab.getOrCreateInstance(this);
              if (typeof config !== "string") {
                return;
              }
              if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
                throw new TypeError(`No method named "${config}"`);
              }
              data[config]();
            });
          }
        }
        EventHandler.on(document, EVENT_CLICK_DATA_API, SELECTOR_DATA_TOGGLE, function(event) {
          if (["A", "AREA"].includes(this.tagName)) {
            event.preventDefault();
          }
          if (isDisabled(this)) {
            return;
          }
          Tab.getOrCreateInstance(this).show();
        });
        EventHandler.on(window, EVENT_LOAD_DATA_API, () => {
          for (const element of SelectorEngine.find(SELECTOR_DATA_TOGGLE_ACTIVE)) {
            Tab.getOrCreateInstance(element);
          }
        });
        defineJQueryPlugin(Tab);
        const NAME = "toast";
        const DATA_KEY = "bs.toast";
        const EVENT_KEY = `.${DATA_KEY}`;
        const EVENT_MOUSEOVER = `mouseover${EVENT_KEY}`;
        const EVENT_MOUSEOUT = `mouseout${EVENT_KEY}`;
        const EVENT_FOCUSIN = `focusin${EVENT_KEY}`;
        const EVENT_FOCUSOUT = `focusout${EVENT_KEY}`;
        const EVENT_HIDE = `hide${EVENT_KEY}`;
        const EVENT_HIDDEN = `hidden${EVENT_KEY}`;
        const EVENT_SHOW = `show${EVENT_KEY}`;
        const EVENT_SHOWN = `shown${EVENT_KEY}`;
        const CLASS_NAME_FADE = "fade";
        const CLASS_NAME_HIDE = "hide";
        const CLASS_NAME_SHOW = "show";
        const CLASS_NAME_SHOWING = "showing";
        const DefaultType = {
          animation: "boolean",
          autohide: "boolean",
          delay: "number"
        };
        const Default = {
          animation: true,
          autohide: true,
          delay: 5e3
        };
        class Toast extends BaseComponent {
          constructor(element, config) {
            super(element, config);
            this._timeout = null;
            this._hasMouseInteraction = false;
            this._hasKeyboardInteraction = false;
            this._setListeners();
          }
          // Getters
          static get Default() {
            return Default;
          }
          static get DefaultType() {
            return DefaultType;
          }
          static get NAME() {
            return NAME;
          }
          // Public
          show() {
            const showEvent = EventHandler.trigger(this._element, EVENT_SHOW);
            if (showEvent.defaultPrevented) {
              return;
            }
            this._clearTimeout();
            if (this._config.animation) {
              this._element.classList.add(CLASS_NAME_FADE);
            }
            const complete = () => {
              this._element.classList.remove(CLASS_NAME_SHOWING);
              EventHandler.trigger(this._element, EVENT_SHOWN);
              this._maybeScheduleHide();
            };
            this._element.classList.remove(CLASS_NAME_HIDE);
            reflow(this._element);
            this._element.classList.add(CLASS_NAME_SHOW, CLASS_NAME_SHOWING);
            this._queueCallback(complete, this._element, this._config.animation);
          }
          hide() {
            if (!this.isShown()) {
              return;
            }
            const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE);
            if (hideEvent.defaultPrevented) {
              return;
            }
            const complete = () => {
              this._element.classList.add(CLASS_NAME_HIDE);
              this._element.classList.remove(CLASS_NAME_SHOWING, CLASS_NAME_SHOW);
              EventHandler.trigger(this._element, EVENT_HIDDEN);
            };
            this._element.classList.add(CLASS_NAME_SHOWING);
            this._queueCallback(complete, this._element, this._config.animation);
          }
          dispose() {
            this._clearTimeout();
            if (this.isShown()) {
              this._element.classList.remove(CLASS_NAME_SHOW);
            }
            super.dispose();
          }
          isShown() {
            return this._element.classList.contains(CLASS_NAME_SHOW);
          }
          // Private
          _maybeScheduleHide() {
            if (!this._config.autohide) {
              return;
            }
            if (this._hasMouseInteraction || this._hasKeyboardInteraction) {
              return;
            }
            this._timeout = setTimeout(() => {
              this.hide();
            }, this._config.delay);
          }
          _onInteraction(event, isInteracting) {
            switch (event.type) {
              case "mouseover":
              case "mouseout": {
                this._hasMouseInteraction = isInteracting;
                break;
              }
              case "focusin":
              case "focusout": {
                this._hasKeyboardInteraction = isInteracting;
                break;
              }
            }
            if (isInteracting) {
              this._clearTimeout();
              return;
            }
            const nextElement = event.relatedTarget;
            if (this._element === nextElement || this._element.contains(nextElement)) {
              return;
            }
            this._maybeScheduleHide();
          }
          _setListeners() {
            EventHandler.on(this._element, EVENT_MOUSEOVER, (event) => this._onInteraction(event, true));
            EventHandler.on(this._element, EVENT_MOUSEOUT, (event) => this._onInteraction(event, false));
            EventHandler.on(this._element, EVENT_FOCUSIN, (event) => this._onInteraction(event, true));
            EventHandler.on(this._element, EVENT_FOCUSOUT, (event) => this._onInteraction(event, false));
          }
          _clearTimeout() {
            clearTimeout(this._timeout);
            this._timeout = null;
          }
          // Static
          static jQueryInterface(config) {
            return this.each(function() {
              const data = Toast.getOrCreateInstance(this, config);
              if (typeof config === "string") {
                if (typeof data[config] === "undefined") {
                  throw new TypeError(`No method named "${config}"`);
                }
                data[config](this);
              }
            });
          }
        }
        enableDismissTrigger(Toast);
        defineJQueryPlugin(Toast);
        const index_umd = {
          Alert,
          Button,
          Carousel,
          Collapse,
          Dropdown,
          Modal,
          Offcanvas,
          Popover,
          ScrollSpy,
          Tab,
          Toast,
          Tooltip
        };
        return index_umd;
      }));
    }
  });

  // ns-hugo-imp:/home/geo/.cache/hugo_cache/modules/filecache/modules/pkg/mod/github.com/encas-parka/hugo-cookbook-theme@v0.0.0-20251204214933-25586c2e961b/assets/js/appwrite-client.js
  var appwrite_client_exports = {};
  __export(appwrite_client_exports, {
    clearAuthData: () => clearAuthData,
    getAccount: () => getAccount,
    getAppwriteClients: () => getAppwriteClients,
    getConfig: () => getConfig,
    getFunctions: () => getFunctions,
    getLocalCmsUser: () => getLocalCmsUser,
    getLocalEmailVerificationStatus: () => getLocalEmailVerificationStatus,
    getTeams: () => getTeams,
    getUserEmail: () => getUserEmail,
    getUserName: () => getUserName,
    initializeAppwrite: () => initializeAppwrite,
    isAuthenticatedCms: () => isAuthenticatedCms,
    isEmailVerified: () => isEmailVerified,
    isInitialized: () => isInitialized,
    logoutGlobal: () => logoutGlobal,
    sendVerificationEmail: () => sendVerificationEmail,
    setAuthData: () => setAuthData,
    verifyEmail: () => verifyEmail
  });
  function waitForAppwrite(maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function checkAppwrite() {
        attempts++;
        if (window.Appwrite && window.Appwrite.Client && window.Appwrite.Account) {
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error("[Appwrite Client] SDK Appwrite non charg\xE9 apr\xE8s le nombre maximum de tentatives");
          reject(new Error("Le SDK Appwrite n'a pas pu \xEAtre charg\xE9."));
        } else {
          setTimeout(checkAppwrite, interval);
        }
      }
      checkAppwrite();
    });
  }
  async function initializeAppwrite() {
    if (client && account && functions) {
      console.log("[Appwrite Client] Clients d\xE9j\xE0 initialis\xE9s, r\xE9utilisation");
      return { client, account, functions };
    }
    if (initializationPromise) {
      console.log("[Appwrite Client] Initialisation en cours, attente...");
      return initializationPromise;
    }
    initializationPromise = (async () => {
      try {
        console.log("[Appwrite Client] D\xE9but de l'initialisation");
        await waitForAppwrite();
        const { Client, Account, Functions } = window.Appwrite;
        client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
        account = new Account(client);
        functions = new Functions(client);
        console.log("[Appwrite Client] Initialisation termin\xE9e avec succ\xE8s");
        return { client, account, functions };
      } catch (error) {
        console.error("[Appwrite Client] Erreur lors de l'initialisation:", error);
        client = null;
        account = null;
        functions = null;
        initializationPromise = null;
        throw error;
      }
    })();
    return initializationPromise;
  }
  async function getAppwriteClients() {
    return await initializeAppwrite();
  }
  async function getAccount() {
    const { account: account2 } = await initializeAppwrite();
    if (account2) {
      console.log("[Appwrite Client] R\xE9cup\xE9ration du compte Appwrite r\xE9ussie", account2);
    } else {
      console.error("[Appwrite Client] R\xE9cup\xE9ration du compte Appwrite \xE9chou\xE9e");
    }
    return account2;
  }
  async function getFunctions() {
    const { functions: functions2 } = await initializeAppwrite();
    return functions2;
  }
  async function getTeams() {
    const { Client, Teams } = window.Appwrite;
    if (!client) {
      await initializeAppwrite();
    }
    const teams = new Teams(client);
    return teams;
  }
  function getConfig() {
    return {
      APPWRITE_ENDPOINT,
      APPWRITE_PROJECT_ID,
      APPWRITE_FUNCTION_ID,
      ACCESS_REQUEST_FUNCTION_ID
    };
  }
  function isInitialized() {
    return !!(client && account && functions);
  }
  function getLocalCmsUser() {
    const cmsUser = localStorage.getItem("sveltia-cms.user");
    if (!cmsUser) {
      console.log("\u2139\uFE0F [getLocalCmsUser] Aucun token CMS dans localStorage");
      return null;
    }
    try {
      const parsedUser = JSON.parse(cmsUser);
      if (parsedUser.token && typeof parsedUser.token === "string" && parsedUser.token.trim() !== "") {
        console.log("\u2705 [getLocalCmsUser] Token CMS valide");
        return parsedUser;
      }
      console.log("\u26A0\uFE0F [getLocalCmsUser] Token CMS invalide - nettoyage");
      localStorage.removeItem("sveltia-cms.user");
      return null;
    } catch (e) {
      console.warn("\u274C [getLocalCmsUser] Donn\xE9es CMS corrompues dans localStorage. Nettoyage...", e);
      localStorage.removeItem("sveltia-cms.user");
      return null;
    }
  }
  function isAuthenticatedCms() {
    console.log("getLocalCmsUser(): ", getLocalCmsUser() !== null);
    return getLocalCmsUser() !== null;
  }
  async function isEmailVerified() {
    try {
      const account2 = await getAccount();
      const user = await account2.get();
      return user.emailVerification || false;
    } catch (error) {
      console.warn("[AppwriteClient] Impossible de v\xE9rifier l'\xE9tat de v\xE9rification d'email:", error);
      return false;
    }
  }
  async function sendVerificationEmail(redirectURL = null) {
    try {
      const account2 = await getAccount();
      const verificationURL = redirectURL || `${window.location.origin}/verify-email`;
      await account2.createVerification(verificationURL);
      console.log("[AppwriteClient] Email de v\xE9rification envoy\xE9 avec succ\xE8s");
    } catch (error) {
      console.error("[AppwriteClient] Erreur lors de l'envoi de l'email de v\xE9rification:", error);
      throw error;
    }
  }
  async function verifyEmail(userId, secret) {
    try {
      const account2 = await getAccount();
      await account2.updateVerification(userId, secret);
      console.log("[AppwriteClient] Email v\xE9rifi\xE9 avec succ\xE8s");
    } catch (error) {
      console.error("[AppwriteClient] Erreur lors de la v\xE9rification d'email:", error);
      throw error;
    }
  }
  function getUserEmail() {
    return localStorage.getItem("appwrite-user-email");
  }
  function getUserName() {
    return localStorage.getItem("appwrite-user-name");
  }
  function getLocalEmailVerificationStatus() {
    return localStorage.getItem("email-verification-status");
  }
  function clearAuthData() {
    localStorage.removeItem("sveltia-cms.user");
    localStorage.removeItem("appwrite-user-email");
    localStorage.removeItem("appwrite-user-name");
    localStorage.removeItem("email-verification-status");
  }
  async function logoutGlobal() {
    try {
      clearAuthData();
      const account2 = await getAccount();
      await account2.deleteSession("current");
    } catch (error) {
      console.warn("[Appwrite Client] Erreur lors de la d\xE9connexion Appwrite (peut-\xEAtre d\xE9j\xE0 d\xE9connect\xE9):", error);
    }
  }
  function setAuthData(email, name, cmsAuth) {
    localStorage.setItem("appwrite-user-email", email);
    localStorage.setItem("appwrite-user-name", name);
    localStorage.setItem("sveltia-cms.user", JSON.stringify(cmsAuth));
  }
  var APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_FUNCTION_ID, ACCESS_REQUEST_FUNCTION_ID, client, account, functions, initializationPromise;
  var init_appwrite_client = __esm({
    "ns-hugo-imp:/home/geo/.cache/hugo_cache/modules/filecache/modules/pkg/mod/github.com/encas-parka/hugo-cookbook-theme@v0.0.0-20251204214933-25586c2e961b/assets/js/appwrite-client.js"() {
      APPWRITE_ENDPOINT = "https://cloud.appwrite.io/v1";
      APPWRITE_PROJECT_ID = "689725820024e81781b7";
      APPWRITE_FUNCTION_ID = "68976500002eb5c6ee4f";
      ACCESS_REQUEST_FUNCTION_ID = "689cdea5001a4d74549d";
      client = null;
      account = null;
      functions = null;
      initializationPromise = null;
      if (typeof window !== "undefined") {
        window.AppwriteClient = {
          getAppwriteClients,
          getAccount,
          getFunctions,
          getTeams,
          getConfig,
          isInitialized,
          initializeAppwrite,
          getLocalCmsUser,
          isAuthenticatedCms,
          getUserEmail,
          getUserName,
          clearAuthData,
          setAuthData,
          logoutGlobal,
          isEmailVerified,
          sendVerificationEmail,
          verifyEmail,
          getLocalEmailVerificationStatus
        };
      }
    }
  });

  // <stdin>
  var import_bootstrap_bundle = __toESM(require_bootstrap_bundle());
  if (window.location.pathname !== "/login/" && window.location.pathname !== "/login") {
    Promise.resolve().then(() => init_appwrite_client());
  }
})();
/*!
  * Bootstrap v5.3.2 (https://getbootstrap.com/)
  * Copyright 2011-2023 The Bootstrap Authors (https://github.com/twbs/bootstrap/graphs/contributors)
  * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
  */
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvLy5jYWNoZS9odWdvX2NhY2hlL21vZHVsZXMvZmlsZWNhY2hlL21vZHVsZXMvcGtnL21vZC9naXRodWIuY29tL2VuY2FzLXBhcmthL2h1Z28tY29va2Jvb2stdGhlbWVAdjAuMC4wLTIwMjUxMjA0MjE0OTMzLTI1NTg2YzJlOTYxYi9hc3NldHMvanMvYm9vdHN0cmFwLmJ1bmRsZS5qcyIsICJucy1odWdvLWltcDovaG9tZS9nZW8vLmNhY2hlL2h1Z29fY2FjaGUvbW9kdWxlcy9maWxlY2FjaGUvbW9kdWxlcy9wa2cvbW9kL2dpdGh1Yi5jb20vZW5jYXMtcGFya2EvaHVnby1jb29rYm9vay10aGVtZUB2MC4wLjAtMjAyNTEyMDQyMTQ5MzMtMjU1ODZjMmU5NjFiL2Fzc2V0cy9qcy9hcHB3cml0ZS1jbGllbnQuanMiLCAiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyohXG4gICogQm9vdHN0cmFwIHY1LjMuMiAoaHR0cHM6Ly9nZXRib290c3RyYXAuY29tLylcbiAgKiBDb3B5cmlnaHQgMjAxMS0yMDIzIFRoZSBCb290c3RyYXAgQXV0aG9ycyAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2dyYXBocy9jb250cmlidXRvcnMpXG4gICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICovXG4oZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuICB0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG4gIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG4gIChnbG9iYWwgPSB0eXBlb2YgZ2xvYmFsVGhpcyAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWxUaGlzIDogZ2xvYmFsIHx8IHNlbGYsIGdsb2JhbC5ib290c3RyYXAgPSBmYWN0b3J5KCkpO1xufSkodGhpcywgKGZ1bmN0aW9uICgpIHsgJ3VzZSBzdHJpY3QnO1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgZG9tL2RhdGEuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG4gIC8qKlxuICAgKiBDb25zdGFudHNcbiAgICovXG5cbiAgY29uc3QgZWxlbWVudE1hcCA9IG5ldyBNYXAoKTtcbiAgY29uc3QgRGF0YSA9IHtcbiAgICBzZXQoZWxlbWVudCwga2V5LCBpbnN0YW5jZSkge1xuICAgICAgaWYgKCFlbGVtZW50TWFwLmhhcyhlbGVtZW50KSkge1xuICAgICAgICBlbGVtZW50TWFwLnNldChlbGVtZW50LCBuZXcgTWFwKCkpO1xuICAgICAgfVxuICAgICAgY29uc3QgaW5zdGFuY2VNYXAgPSBlbGVtZW50TWFwLmdldChlbGVtZW50KTtcblxuICAgICAgLy8gbWFrZSBpdCBjbGVhciB3ZSBvbmx5IHdhbnQgb25lIGluc3RhbmNlIHBlciBlbGVtZW50XG4gICAgICAvLyBjYW4gYmUgcmVtb3ZlZCBsYXRlciB3aGVuIG11bHRpcGxlIGtleS9pbnN0YW5jZXMgYXJlIGZpbmUgdG8gYmUgdXNlZFxuICAgICAgaWYgKCFpbnN0YW5jZU1hcC5oYXMoa2V5KSAmJiBpbnN0YW5jZU1hcC5zaXplICE9PSAwKSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEJvb3RzdHJhcCBkb2Vzbid0IGFsbG93IG1vcmUgdGhhbiBvbmUgaW5zdGFuY2UgcGVyIGVsZW1lbnQuIEJvdW5kIGluc3RhbmNlOiAke0FycmF5LmZyb20oaW5zdGFuY2VNYXAua2V5cygpKVswXX0uYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGluc3RhbmNlTWFwLnNldChrZXksIGluc3RhbmNlKTtcbiAgICB9LFxuICAgIGdldChlbGVtZW50LCBrZXkpIHtcbiAgICAgIGlmIChlbGVtZW50TWFwLmhhcyhlbGVtZW50KSkge1xuICAgICAgICByZXR1cm4gZWxlbWVudE1hcC5nZXQoZWxlbWVudCkuZ2V0KGtleSkgfHwgbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgcmVtb3ZlKGVsZW1lbnQsIGtleSkge1xuICAgICAgaWYgKCFlbGVtZW50TWFwLmhhcyhlbGVtZW50KSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBpbnN0YW5jZU1hcCA9IGVsZW1lbnRNYXAuZ2V0KGVsZW1lbnQpO1xuICAgICAgaW5zdGFuY2VNYXAuZGVsZXRlKGtleSk7XG5cbiAgICAgIC8vIGZyZWUgdXAgZWxlbWVudCByZWZlcmVuY2VzIGlmIHRoZXJlIGFyZSBubyBpbnN0YW5jZXMgbGVmdCBmb3IgYW4gZWxlbWVudFxuICAgICAgaWYgKGluc3RhbmNlTWFwLnNpemUgPT09IDApIHtcbiAgICAgICAgZWxlbWVudE1hcC5kZWxldGUoZWxlbWVudCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgdXRpbC9pbmRleC5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cbiAgY29uc3QgTUFYX1VJRCA9IDEwMDAwMDA7XG4gIGNvbnN0IE1JTExJU0VDT05EU19NVUxUSVBMSUVSID0gMTAwMDtcbiAgY29uc3QgVFJBTlNJVElPTl9FTkQgPSAndHJhbnNpdGlvbmVuZCc7XG5cbiAgLyoqXG4gICAqIFByb3Blcmx5IGVzY2FwZSBJRHMgc2VsZWN0b3JzIHRvIGhhbmRsZSB3ZWlyZCBJRHNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAqL1xuICBjb25zdCBwYXJzZVNlbGVjdG9yID0gc2VsZWN0b3IgPT4ge1xuICAgIGlmIChzZWxlY3RvciAmJiB3aW5kb3cuQ1NTICYmIHdpbmRvdy5DU1MuZXNjYXBlKSB7XG4gICAgICAvLyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yIG5lZWRzIGVzY2FwaW5nIHRvIGhhbmRsZSBJRHMgKGh0bWw1KykgY29udGFpbmluZyBmb3IgaW5zdGFuY2UgL1xuICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5yZXBsYWNlKC8jKFteXFxzXCIjJ10rKS9nLCAobWF0Y2gsIGlkKSA9PiBgIyR7Q1NTLmVzY2FwZShpZCl9YCk7XG4gICAgfVxuICAgIHJldHVybiBzZWxlY3RvcjtcbiAgfTtcblxuICAvLyBTaG91dC1vdXQgQW5ndXMgQ3JvbGwgKGh0dHBzOi8vZ29vLmdsL3B4d1FHcClcbiAgY29uc3QgdG9UeXBlID0gb2JqZWN0ID0+IHtcbiAgICBpZiAob2JqZWN0ID09PSBudWxsIHx8IG9iamVjdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYCR7b2JqZWN0fWA7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KS5tYXRjaCgvXFxzKFthLXpdKykvaSlbMV0udG9Mb3dlckNhc2UoKTtcbiAgfTtcblxuICAvKipcbiAgICogUHVibGljIFV0aWwgQVBJXG4gICAqL1xuXG4gIGNvbnN0IGdldFVJRCA9IHByZWZpeCA9PiB7XG4gICAgZG8ge1xuICAgICAgcHJlZml4ICs9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIE1BWF9VSUQpO1xuICAgIH0gd2hpbGUgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHByZWZpeCkpO1xuICAgIHJldHVybiBwcmVmaXg7XG4gIH07XG4gIGNvbnN0IGdldFRyYW5zaXRpb25EdXJhdGlvbkZyb21FbGVtZW50ID0gZWxlbWVudCA9PiB7XG4gICAgaWYgKCFlbGVtZW50KSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICAvLyBHZXQgdHJhbnNpdGlvbi1kdXJhdGlvbiBvZiB0aGUgZWxlbWVudFxuICAgIGxldCB7XG4gICAgICB0cmFuc2l0aW9uRHVyYXRpb24sXG4gICAgICB0cmFuc2l0aW9uRGVsYXlcbiAgICB9ID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCk7XG4gICAgY29uc3QgZmxvYXRUcmFuc2l0aW9uRHVyYXRpb24gPSBOdW1iZXIucGFyc2VGbG9hdCh0cmFuc2l0aW9uRHVyYXRpb24pO1xuICAgIGNvbnN0IGZsb2F0VHJhbnNpdGlvbkRlbGF5ID0gTnVtYmVyLnBhcnNlRmxvYXQodHJhbnNpdGlvbkRlbGF5KTtcblxuICAgIC8vIFJldHVybiAwIGlmIGVsZW1lbnQgb3IgdHJhbnNpdGlvbiBkdXJhdGlvbiBpcyBub3QgZm91bmRcbiAgICBpZiAoIWZsb2F0VHJhbnNpdGlvbkR1cmF0aW9uICYmICFmbG9hdFRyYW5zaXRpb25EZWxheSkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgLy8gSWYgbXVsdGlwbGUgZHVyYXRpb25zIGFyZSBkZWZpbmVkLCB0YWtlIHRoZSBmaXJzdFxuICAgIHRyYW5zaXRpb25EdXJhdGlvbiA9IHRyYW5zaXRpb25EdXJhdGlvbi5zcGxpdCgnLCcpWzBdO1xuICAgIHRyYW5zaXRpb25EZWxheSA9IHRyYW5zaXRpb25EZWxheS5zcGxpdCgnLCcpWzBdO1xuICAgIHJldHVybiAoTnVtYmVyLnBhcnNlRmxvYXQodHJhbnNpdGlvbkR1cmF0aW9uKSArIE51bWJlci5wYXJzZUZsb2F0KHRyYW5zaXRpb25EZWxheSkpICogTUlMTElTRUNPTkRTX01VTFRJUExJRVI7XG4gIH07XG4gIGNvbnN0IHRyaWdnZXJUcmFuc2l0aW9uRW5kID0gZWxlbWVudCA9PiB7XG4gICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudChUUkFOU0lUSU9OX0VORCkpO1xuICB9O1xuICBjb25zdCBpc0VsZW1lbnQkMSA9IG9iamVjdCA9PiB7XG4gICAgaWYgKCFvYmplY3QgfHwgdHlwZW9mIG9iamVjdCAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBvYmplY3QuanF1ZXJ5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgb2JqZWN0ID0gb2JqZWN0WzBdO1xuICAgIH1cbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdC5ub2RlVHlwZSAhPT0gJ3VuZGVmaW5lZCc7XG4gIH07XG4gIGNvbnN0IGdldEVsZW1lbnQgPSBvYmplY3QgPT4ge1xuICAgIC8vIGl0J3MgYSBqUXVlcnkgb2JqZWN0IG9yIGEgbm9kZSBlbGVtZW50XG4gICAgaWYgKGlzRWxlbWVudCQxKG9iamVjdCkpIHtcbiAgICAgIHJldHVybiBvYmplY3QuanF1ZXJ5ID8gb2JqZWN0WzBdIDogb2JqZWN0O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIG9iamVjdCA9PT0gJ3N0cmluZycgJiYgb2JqZWN0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHBhcnNlU2VsZWN0b3Iob2JqZWN0KSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9O1xuICBjb25zdCBpc1Zpc2libGUgPSBlbGVtZW50ID0+IHtcbiAgICBpZiAoIWlzRWxlbWVudCQxKGVsZW1lbnQpIHx8IGVsZW1lbnQuZ2V0Q2xpZW50UmVjdHMoKS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgZWxlbWVudElzVmlzaWJsZSA9IGdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkuZ2V0UHJvcGVydHlWYWx1ZSgndmlzaWJpbGl0eScpID09PSAndmlzaWJsZSc7XG4gICAgLy8gSGFuZGxlIGBkZXRhaWxzYCBlbGVtZW50IGFzIGl0cyBjb250ZW50IG1heSBmYWxzaWUgYXBwZWFyIHZpc2libGUgd2hlbiBpdCBpcyBjbG9zZWRcbiAgICBjb25zdCBjbG9zZWREZXRhaWxzID0gZWxlbWVudC5jbG9zZXN0KCdkZXRhaWxzOm5vdChbb3Blbl0pJyk7XG4gICAgaWYgKCFjbG9zZWREZXRhaWxzKSB7XG4gICAgICByZXR1cm4gZWxlbWVudElzVmlzaWJsZTtcbiAgICB9XG4gICAgaWYgKGNsb3NlZERldGFpbHMgIT09IGVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IHN1bW1hcnkgPSBlbGVtZW50LmNsb3Nlc3QoJ3N1bW1hcnknKTtcbiAgICAgIGlmIChzdW1tYXJ5ICYmIHN1bW1hcnkucGFyZW50Tm9kZSAhPT0gY2xvc2VkRGV0YWlscykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoc3VtbWFyeSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBlbGVtZW50SXNWaXNpYmxlO1xuICB9O1xuICBjb25zdCBpc0Rpc2FibGVkID0gZWxlbWVudCA9PiB7XG4gICAgaWYgKCFlbGVtZW50IHx8IGVsZW1lbnQubm9kZVR5cGUgIT09IE5vZGUuRUxFTUVOVF9OT0RFKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdkaXNhYmxlZCcpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbGVtZW50LmRpc2FibGVkICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuIGVsZW1lbnQuZGlzYWJsZWQ7XG4gICAgfVxuICAgIHJldHVybiBlbGVtZW50Lmhhc0F0dHJpYnV0ZSgnZGlzYWJsZWQnKSAmJiBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGlzYWJsZWQnKSAhPT0gJ2ZhbHNlJztcbiAgfTtcbiAgY29uc3QgZmluZFNoYWRvd1Jvb3QgPSBlbGVtZW50ID0+IHtcbiAgICBpZiAoIWRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hdHRhY2hTaGFkb3cpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIENhbiBmaW5kIHRoZSBzaGFkb3cgcm9vdCBvdGhlcndpc2UgaXQnbGwgcmV0dXJuIHRoZSBkb2N1bWVudFxuICAgIGlmICh0eXBlb2YgZWxlbWVudC5nZXRSb290Tm9kZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY29uc3Qgcm9vdCA9IGVsZW1lbnQuZ2V0Um9vdE5vZGUoKTtcbiAgICAgIHJldHVybiByb290IGluc3RhbmNlb2YgU2hhZG93Um9vdCA/IHJvb3QgOiBudWxsO1xuICAgIH1cbiAgICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFNoYWRvd1Jvb3QpIHtcbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH1cblxuICAgIC8vIHdoZW4gd2UgZG9uJ3QgZmluZCBhIHNoYWRvdyByb290XG4gICAgaWYgKCFlbGVtZW50LnBhcmVudE5vZGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gZmluZFNoYWRvd1Jvb3QoZWxlbWVudC5wYXJlbnROb2RlKTtcbiAgfTtcbiAgY29uc3Qgbm9vcCA9ICgpID0+IHt9O1xuXG4gIC8qKlxuICAgKiBUcmljayB0byByZXN0YXJ0IGFuIGVsZW1lbnQncyBhbmltYXRpb25cbiAgICpcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxuICAgKiBAcmV0dXJuIHZvaWRcbiAgICpcbiAgICogQHNlZSBodHRwczovL3d3dy5jaGFyaXN0aGVvLmlvL2Jsb2cvMjAyMS8wMi9yZXN0YXJ0LWEtY3NzLWFuaW1hdGlvbi13aXRoLWphdmFzY3JpcHQvI3Jlc3RhcnRpbmctYS1jc3MtYW5pbWF0aW9uXG4gICAqL1xuICBjb25zdCByZWZsb3cgPSBlbGVtZW50ID0+IHtcbiAgICBlbGVtZW50Lm9mZnNldEhlaWdodDsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtZXhwcmVzc2lvbnNcbiAgfTtcblxuICBjb25zdCBnZXRqUXVlcnkgPSAoKSA9PiB7XG4gICAgaWYgKHdpbmRvdy5qUXVlcnkgJiYgIWRvY3VtZW50LmJvZHkuaGFzQXR0cmlidXRlKCdkYXRhLWJzLW5vLWpxdWVyeScpKSB7XG4gICAgICByZXR1cm4gd2luZG93LmpRdWVyeTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH07XG4gIGNvbnN0IERPTUNvbnRlbnRMb2FkZWRDYWxsYmFja3MgPSBbXTtcbiAgY29uc3Qgb25ET01Db250ZW50TG9hZGVkID0gY2FsbGJhY2sgPT4ge1xuICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcbiAgICAgIC8vIGFkZCBsaXN0ZW5lciBvbiB0aGUgZmlyc3QgY2FsbCB3aGVuIHRoZSBkb2N1bWVudCBpcyBpbiBsb2FkaW5nIHN0YXRlXG4gICAgICBpZiAoIURPTUNvbnRlbnRMb2FkZWRDYWxsYmFja3MubGVuZ3RoKSB7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiBET01Db250ZW50TG9hZGVkQ2FsbGJhY2tzKSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBET01Db250ZW50TG9hZGVkQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgaXNSVEwgPSAoKSA9PiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGlyID09PSAncnRsJztcbiAgY29uc3QgZGVmaW5lSlF1ZXJ5UGx1Z2luID0gcGx1Z2luID0+IHtcbiAgICBvbkRPTUNvbnRlbnRMb2FkZWQoKCkgPT4ge1xuICAgICAgY29uc3QgJCA9IGdldGpRdWVyeSgpO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAoJCkge1xuICAgICAgICBjb25zdCBuYW1lID0gcGx1Z2luLk5BTUU7XG4gICAgICAgIGNvbnN0IEpRVUVSWV9OT19DT05GTElDVCA9ICQuZm5bbmFtZV07XG4gICAgICAgICQuZm5bbmFtZV0gPSBwbHVnaW4ualF1ZXJ5SW50ZXJmYWNlO1xuICAgICAgICAkLmZuW25hbWVdLkNvbnN0cnVjdG9yID0gcGx1Z2luO1xuICAgICAgICAkLmZuW25hbWVdLm5vQ29uZmxpY3QgPSAoKSA9PiB7XG4gICAgICAgICAgJC5mbltuYW1lXSA9IEpRVUVSWV9OT19DT05GTElDVDtcbiAgICAgICAgICByZXR1cm4gcGx1Z2luLmpRdWVyeUludGVyZmFjZTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbiAgY29uc3QgZXhlY3V0ZSA9IChwb3NzaWJsZUNhbGxiYWNrLCBhcmdzID0gW10sIGRlZmF1bHRWYWx1ZSA9IHBvc3NpYmxlQ2FsbGJhY2spID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIHBvc3NpYmxlQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicgPyBwb3NzaWJsZUNhbGxiYWNrKC4uLmFyZ3MpIDogZGVmYXVsdFZhbHVlO1xuICB9O1xuICBjb25zdCBleGVjdXRlQWZ0ZXJUcmFuc2l0aW9uID0gKGNhbGxiYWNrLCB0cmFuc2l0aW9uRWxlbWVudCwgd2FpdEZvclRyYW5zaXRpb24gPSB0cnVlKSA9PiB7XG4gICAgaWYgKCF3YWl0Rm9yVHJhbnNpdGlvbikge1xuICAgICAgZXhlY3V0ZShjYWxsYmFjayk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGR1cmF0aW9uUGFkZGluZyA9IDU7XG4gICAgY29uc3QgZW11bGF0ZWREdXJhdGlvbiA9IGdldFRyYW5zaXRpb25EdXJhdGlvbkZyb21FbGVtZW50KHRyYW5zaXRpb25FbGVtZW50KSArIGR1cmF0aW9uUGFkZGluZztcbiAgICBsZXQgY2FsbGVkID0gZmFsc2U7XG4gICAgY29uc3QgaGFuZGxlciA9ICh7XG4gICAgICB0YXJnZXRcbiAgICB9KSA9PiB7XG4gICAgICBpZiAodGFyZ2V0ICE9PSB0cmFuc2l0aW9uRWxlbWVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgdHJhbnNpdGlvbkVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihUUkFOU0lUSU9OX0VORCwgaGFuZGxlcik7XG4gICAgICBleGVjdXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIHRyYW5zaXRpb25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoVFJBTlNJVElPTl9FTkQsIGhhbmRsZXIpO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgdHJpZ2dlclRyYW5zaXRpb25FbmQodHJhbnNpdGlvbkVsZW1lbnQpO1xuICAgICAgfVxuICAgIH0sIGVtdWxhdGVkRHVyYXRpb24pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHByZXZpb3VzL25leHQgZWxlbWVudCBvZiBhIGxpc3QuXG4gICAqXG4gICAqIEBwYXJhbSB7YXJyYXl9IGxpc3QgICAgVGhlIGxpc3Qgb2YgZWxlbWVudHNcbiAgICogQHBhcmFtIGFjdGl2ZUVsZW1lbnQgICBUaGUgYWN0aXZlIGVsZW1lbnRcbiAgICogQHBhcmFtIHNob3VsZEdldE5leHQgICBDaG9vc2UgdG8gZ2V0IG5leHQgb3IgcHJldmlvdXMgZWxlbWVudFxuICAgKiBAcGFyYW0gaXNDeWNsZUFsbG93ZWRcbiAgICogQHJldHVybiB7RWxlbWVudHxlbGVtfSBUaGUgcHJvcGVyIGVsZW1lbnRcbiAgICovXG4gIGNvbnN0IGdldE5leHRBY3RpdmVFbGVtZW50ID0gKGxpc3QsIGFjdGl2ZUVsZW1lbnQsIHNob3VsZEdldE5leHQsIGlzQ3ljbGVBbGxvd2VkKSA9PiB7XG4gICAgY29uc3QgbGlzdExlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICAgIGxldCBpbmRleCA9IGxpc3QuaW5kZXhPZihhY3RpdmVFbGVtZW50KTtcblxuICAgIC8vIGlmIHRoZSBlbGVtZW50IGRvZXMgbm90IGV4aXN0IGluIHRoZSBsaXN0IHJldHVybiBhbiBlbGVtZW50XG4gICAgLy8gZGVwZW5kaW5nIG9uIHRoZSBkaXJlY3Rpb24gYW5kIGlmIGN5Y2xlIGlzIGFsbG93ZWRcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICByZXR1cm4gIXNob3VsZEdldE5leHQgJiYgaXNDeWNsZUFsbG93ZWQgPyBsaXN0W2xpc3RMZW5ndGggLSAxXSA6IGxpc3RbMF07XG4gICAgfVxuICAgIGluZGV4ICs9IHNob3VsZEdldE5leHQgPyAxIDogLTE7XG4gICAgaWYgKGlzQ3ljbGVBbGxvd2VkKSB7XG4gICAgICBpbmRleCA9IChpbmRleCArIGxpc3RMZW5ndGgpICUgbGlzdExlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIGxpc3RbTWF0aC5tYXgoMCwgTWF0aC5taW4oaW5kZXgsIGxpc3RMZW5ndGggLSAxKSldO1xuICB9O1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgZG9tL2V2ZW50LWhhbmRsZXIuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50c1xuICAgKi9cblxuICBjb25zdCBuYW1lc3BhY2VSZWdleCA9IC9bXi5dKig/PVxcLi4qKVxcLnwuKi87XG4gIGNvbnN0IHN0cmlwTmFtZVJlZ2V4ID0gL1xcLi4qLztcbiAgY29uc3Qgc3RyaXBVaWRSZWdleCA9IC86OlxcZCskLztcbiAgY29uc3QgZXZlbnRSZWdpc3RyeSA9IHt9OyAvLyBFdmVudHMgc3RvcmFnZVxuICBsZXQgdWlkRXZlbnQgPSAxO1xuICBjb25zdCBjdXN0b21FdmVudHMgPSB7XG4gICAgbW91c2VlbnRlcjogJ21vdXNlb3ZlcicsXG4gICAgbW91c2VsZWF2ZTogJ21vdXNlb3V0J1xuICB9O1xuICBjb25zdCBuYXRpdmVFdmVudHMgPSBuZXcgU2V0KFsnY2xpY2snLCAnZGJsY2xpY2snLCAnbW91c2V1cCcsICdtb3VzZWRvd24nLCAnY29udGV4dG1lbnUnLCAnbW91c2V3aGVlbCcsICdET01Nb3VzZVNjcm9sbCcsICdtb3VzZW92ZXInLCAnbW91c2VvdXQnLCAnbW91c2Vtb3ZlJywgJ3NlbGVjdHN0YXJ0JywgJ3NlbGVjdGVuZCcsICdrZXlkb3duJywgJ2tleXByZXNzJywgJ2tleXVwJywgJ29yaWVudGF0aW9uY2hhbmdlJywgJ3RvdWNoc3RhcnQnLCAndG91Y2htb3ZlJywgJ3RvdWNoZW5kJywgJ3RvdWNoY2FuY2VsJywgJ3BvaW50ZXJkb3duJywgJ3BvaW50ZXJtb3ZlJywgJ3BvaW50ZXJ1cCcsICdwb2ludGVybGVhdmUnLCAncG9pbnRlcmNhbmNlbCcsICdnZXN0dXJlc3RhcnQnLCAnZ2VzdHVyZWNoYW5nZScsICdnZXN0dXJlZW5kJywgJ2ZvY3VzJywgJ2JsdXInLCAnY2hhbmdlJywgJ3Jlc2V0JywgJ3NlbGVjdCcsICdzdWJtaXQnLCAnZm9jdXNpbicsICdmb2N1c291dCcsICdsb2FkJywgJ3VubG9hZCcsICdiZWZvcmV1bmxvYWQnLCAncmVzaXplJywgJ21vdmUnLCAnRE9NQ29udGVudExvYWRlZCcsICdyZWFkeXN0YXRlY2hhbmdlJywgJ2Vycm9yJywgJ2Fib3J0JywgJ3Njcm9sbCddKTtcblxuICAvKipcbiAgICogUHJpdmF0ZSBtZXRob2RzXG4gICAqL1xuXG4gIGZ1bmN0aW9uIG1ha2VFdmVudFVpZChlbGVtZW50LCB1aWQpIHtcbiAgICByZXR1cm4gdWlkICYmIGAke3VpZH06OiR7dWlkRXZlbnQrK31gIHx8IGVsZW1lbnQudWlkRXZlbnQgfHwgdWlkRXZlbnQrKztcbiAgfVxuICBmdW5jdGlvbiBnZXRFbGVtZW50RXZlbnRzKGVsZW1lbnQpIHtcbiAgICBjb25zdCB1aWQgPSBtYWtlRXZlbnRVaWQoZWxlbWVudCk7XG4gICAgZWxlbWVudC51aWRFdmVudCA9IHVpZDtcbiAgICBldmVudFJlZ2lzdHJ5W3VpZF0gPSBldmVudFJlZ2lzdHJ5W3VpZF0gfHwge307XG4gICAgcmV0dXJuIGV2ZW50UmVnaXN0cnlbdWlkXTtcbiAgfVxuICBmdW5jdGlvbiBib290c3RyYXBIYW5kbGVyKGVsZW1lbnQsIGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQpIHtcbiAgICAgIGh5ZHJhdGVPYmooZXZlbnQsIHtcbiAgICAgICAgZGVsZWdhdGVUYXJnZXQ6IGVsZW1lbnRcbiAgICAgIH0pO1xuICAgICAgaWYgKGhhbmRsZXIub25lT2ZmKSB7XG4gICAgICAgIEV2ZW50SGFuZGxlci5vZmYoZWxlbWVudCwgZXZlbnQudHlwZSwgZm4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZuLmFwcGx5KGVsZW1lbnQsIFtldmVudF0pO1xuICAgIH07XG4gIH1cbiAgZnVuY3Rpb24gYm9vdHN0cmFwRGVsZWdhdGlvbkhhbmRsZXIoZWxlbWVudCwgc2VsZWN0b3IsIGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQpIHtcbiAgICAgIGNvbnN0IGRvbUVsZW1lbnRzID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgIGZvciAobGV0IHtcbiAgICAgICAgdGFyZ2V0XG4gICAgICB9ID0gZXZlbnQ7IHRhcmdldCAmJiB0YXJnZXQgIT09IHRoaXM7IHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlKSB7XG4gICAgICAgIGZvciAoY29uc3QgZG9tRWxlbWVudCBvZiBkb21FbGVtZW50cykge1xuICAgICAgICAgIGlmIChkb21FbGVtZW50ICE9PSB0YXJnZXQpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBoeWRyYXRlT2JqKGV2ZW50LCB7XG4gICAgICAgICAgICBkZWxlZ2F0ZVRhcmdldDogdGFyZ2V0XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGhhbmRsZXIub25lT2ZmKSB7XG4gICAgICAgICAgICBFdmVudEhhbmRsZXIub2ZmKGVsZW1lbnQsIGV2ZW50LnR5cGUsIHNlbGVjdG9yLCBmbik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBmbi5hcHBseSh0YXJnZXQsIFtldmVudF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfVxuICBmdW5jdGlvbiBmaW5kSGFuZGxlcihldmVudHMsIGNhbGxhYmxlLCBkZWxlZ2F0aW9uU2VsZWN0b3IgPSBudWxsKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoZXZlbnRzKS5maW5kKGV2ZW50ID0+IGV2ZW50LmNhbGxhYmxlID09PSBjYWxsYWJsZSAmJiBldmVudC5kZWxlZ2F0aW9uU2VsZWN0b3IgPT09IGRlbGVnYXRpb25TZWxlY3Rvcik7XG4gIH1cbiAgZnVuY3Rpb24gbm9ybWFsaXplUGFyYW1ldGVycyhvcmlnaW5hbFR5cGVFdmVudCwgaGFuZGxlciwgZGVsZWdhdGlvbkZ1bmN0aW9uKSB7XG4gICAgY29uc3QgaXNEZWxlZ2F0ZWQgPSB0eXBlb2YgaGFuZGxlciA9PT0gJ3N0cmluZyc7XG4gICAgLy8gVE9ETzogdG9vbHRpcCBwYXNzZXMgYGZhbHNlYCBpbnN0ZWFkIG9mIHNlbGVjdG9yLCBzbyB3ZSBuZWVkIHRvIGNoZWNrXG4gICAgY29uc3QgY2FsbGFibGUgPSBpc0RlbGVnYXRlZCA/IGRlbGVnYXRpb25GdW5jdGlvbiA6IGhhbmRsZXIgfHwgZGVsZWdhdGlvbkZ1bmN0aW9uO1xuICAgIGxldCB0eXBlRXZlbnQgPSBnZXRUeXBlRXZlbnQob3JpZ2luYWxUeXBlRXZlbnQpO1xuICAgIGlmICghbmF0aXZlRXZlbnRzLmhhcyh0eXBlRXZlbnQpKSB7XG4gICAgICB0eXBlRXZlbnQgPSBvcmlnaW5hbFR5cGVFdmVudDtcbiAgICB9XG4gICAgcmV0dXJuIFtpc0RlbGVnYXRlZCwgY2FsbGFibGUsIHR5cGVFdmVudF07XG4gIH1cbiAgZnVuY3Rpb24gYWRkSGFuZGxlcihlbGVtZW50LCBvcmlnaW5hbFR5cGVFdmVudCwgaGFuZGxlciwgZGVsZWdhdGlvbkZ1bmN0aW9uLCBvbmVPZmYpIHtcbiAgICBpZiAodHlwZW9mIG9yaWdpbmFsVHlwZUV2ZW50ICE9PSAnc3RyaW5nJyB8fCAhZWxlbWVudCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgW2lzRGVsZWdhdGVkLCBjYWxsYWJsZSwgdHlwZUV2ZW50XSA9IG5vcm1hbGl6ZVBhcmFtZXRlcnMob3JpZ2luYWxUeXBlRXZlbnQsIGhhbmRsZXIsIGRlbGVnYXRpb25GdW5jdGlvbik7XG5cbiAgICAvLyBpbiBjYXNlIG9mIG1vdXNlZW50ZXIgb3IgbW91c2VsZWF2ZSB3cmFwIHRoZSBoYW5kbGVyIHdpdGhpbiBhIGZ1bmN0aW9uIHRoYXQgY2hlY2tzIGZvciBpdHMgRE9NIHBvc2l0aW9uXG4gICAgLy8gdGhpcyBwcmV2ZW50cyB0aGUgaGFuZGxlciBmcm9tIGJlaW5nIGRpc3BhdGNoZWQgdGhlIHNhbWUgd2F5IGFzIG1vdXNlb3ZlciBvciBtb3VzZW91dCBkb2VzXG4gICAgaWYgKG9yaWdpbmFsVHlwZUV2ZW50IGluIGN1c3RvbUV2ZW50cykge1xuICAgICAgY29uc3Qgd3JhcEZ1bmN0aW9uID0gZm4gPT4ge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKCFldmVudC5yZWxhdGVkVGFyZ2V0IHx8IGV2ZW50LnJlbGF0ZWRUYXJnZXQgIT09IGV2ZW50LmRlbGVnYXRlVGFyZ2V0ICYmICFldmVudC5kZWxlZ2F0ZVRhcmdldC5jb250YWlucyhldmVudC5yZWxhdGVkVGFyZ2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIGZuLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH07XG4gICAgICBjYWxsYWJsZSA9IHdyYXBGdW5jdGlvbihjYWxsYWJsZSk7XG4gICAgfVxuICAgIGNvbnN0IGV2ZW50cyA9IGdldEVsZW1lbnRFdmVudHMoZWxlbWVudCk7XG4gICAgY29uc3QgaGFuZGxlcnMgPSBldmVudHNbdHlwZUV2ZW50XSB8fCAoZXZlbnRzW3R5cGVFdmVudF0gPSB7fSk7XG4gICAgY29uc3QgcHJldmlvdXNGdW5jdGlvbiA9IGZpbmRIYW5kbGVyKGhhbmRsZXJzLCBjYWxsYWJsZSwgaXNEZWxlZ2F0ZWQgPyBoYW5kbGVyIDogbnVsbCk7XG4gICAgaWYgKHByZXZpb3VzRnVuY3Rpb24pIHtcbiAgICAgIHByZXZpb3VzRnVuY3Rpb24ub25lT2ZmID0gcHJldmlvdXNGdW5jdGlvbi5vbmVPZmYgJiYgb25lT2ZmO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB1aWQgPSBtYWtlRXZlbnRVaWQoY2FsbGFibGUsIG9yaWdpbmFsVHlwZUV2ZW50LnJlcGxhY2UobmFtZXNwYWNlUmVnZXgsICcnKSk7XG4gICAgY29uc3QgZm4gPSBpc0RlbGVnYXRlZCA/IGJvb3RzdHJhcERlbGVnYXRpb25IYW5kbGVyKGVsZW1lbnQsIGhhbmRsZXIsIGNhbGxhYmxlKSA6IGJvb3RzdHJhcEhhbmRsZXIoZWxlbWVudCwgY2FsbGFibGUpO1xuICAgIGZuLmRlbGVnYXRpb25TZWxlY3RvciA9IGlzRGVsZWdhdGVkID8gaGFuZGxlciA6IG51bGw7XG4gICAgZm4uY2FsbGFibGUgPSBjYWxsYWJsZTtcbiAgICBmbi5vbmVPZmYgPSBvbmVPZmY7XG4gICAgZm4udWlkRXZlbnQgPSB1aWQ7XG4gICAgaGFuZGxlcnNbdWlkXSA9IGZuO1xuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcih0eXBlRXZlbnQsIGZuLCBpc0RlbGVnYXRlZCk7XG4gIH1cbiAgZnVuY3Rpb24gcmVtb3ZlSGFuZGxlcihlbGVtZW50LCBldmVudHMsIHR5cGVFdmVudCwgaGFuZGxlciwgZGVsZWdhdGlvblNlbGVjdG9yKSB7XG4gICAgY29uc3QgZm4gPSBmaW5kSGFuZGxlcihldmVudHNbdHlwZUV2ZW50XSwgaGFuZGxlciwgZGVsZWdhdGlvblNlbGVjdG9yKTtcbiAgICBpZiAoIWZuKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlRXZlbnQsIGZuLCBCb29sZWFuKGRlbGVnYXRpb25TZWxlY3RvcikpO1xuICAgIGRlbGV0ZSBldmVudHNbdHlwZUV2ZW50XVtmbi51aWRFdmVudF07XG4gIH1cbiAgZnVuY3Rpb24gcmVtb3ZlTmFtZXNwYWNlZEhhbmRsZXJzKGVsZW1lbnQsIGV2ZW50cywgdHlwZUV2ZW50LCBuYW1lc3BhY2UpIHtcbiAgICBjb25zdCBzdG9yZUVsZW1lbnRFdmVudCA9IGV2ZW50c1t0eXBlRXZlbnRdIHx8IHt9O1xuICAgIGZvciAoY29uc3QgW2hhbmRsZXJLZXksIGV2ZW50XSBvZiBPYmplY3QuZW50cmllcyhzdG9yZUVsZW1lbnRFdmVudCkpIHtcbiAgICAgIGlmIChoYW5kbGVyS2V5LmluY2x1ZGVzKG5hbWVzcGFjZSkpIHtcbiAgICAgICAgcmVtb3ZlSGFuZGxlcihlbGVtZW50LCBldmVudHMsIHR5cGVFdmVudCwgZXZlbnQuY2FsbGFibGUsIGV2ZW50LmRlbGVnYXRpb25TZWxlY3Rvcik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGdldFR5cGVFdmVudChldmVudCkge1xuICAgIC8vIGFsbG93IHRvIGdldCB0aGUgbmF0aXZlIGV2ZW50cyBmcm9tIG5hbWVzcGFjZWQgZXZlbnRzICgnY2xpY2suYnMuYnV0dG9uJyAtLT4gJ2NsaWNrJylcbiAgICBldmVudCA9IGV2ZW50LnJlcGxhY2Uoc3RyaXBOYW1lUmVnZXgsICcnKTtcbiAgICByZXR1cm4gY3VzdG9tRXZlbnRzW2V2ZW50XSB8fCBldmVudDtcbiAgfVxuICBjb25zdCBFdmVudEhhbmRsZXIgPSB7XG4gICAgb24oZWxlbWVudCwgZXZlbnQsIGhhbmRsZXIsIGRlbGVnYXRpb25GdW5jdGlvbikge1xuICAgICAgYWRkSGFuZGxlcihlbGVtZW50LCBldmVudCwgaGFuZGxlciwgZGVsZWdhdGlvbkZ1bmN0aW9uLCBmYWxzZSk7XG4gICAgfSxcbiAgICBvbmUoZWxlbWVudCwgZXZlbnQsIGhhbmRsZXIsIGRlbGVnYXRpb25GdW5jdGlvbikge1xuICAgICAgYWRkSGFuZGxlcihlbGVtZW50LCBldmVudCwgaGFuZGxlciwgZGVsZWdhdGlvbkZ1bmN0aW9uLCB0cnVlKTtcbiAgICB9LFxuICAgIG9mZihlbGVtZW50LCBvcmlnaW5hbFR5cGVFdmVudCwgaGFuZGxlciwgZGVsZWdhdGlvbkZ1bmN0aW9uKSB7XG4gICAgICBpZiAodHlwZW9mIG9yaWdpbmFsVHlwZUV2ZW50ICE9PSAnc3RyaW5nJyB8fCAhZWxlbWVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBbaXNEZWxlZ2F0ZWQsIGNhbGxhYmxlLCB0eXBlRXZlbnRdID0gbm9ybWFsaXplUGFyYW1ldGVycyhvcmlnaW5hbFR5cGVFdmVudCwgaGFuZGxlciwgZGVsZWdhdGlvbkZ1bmN0aW9uKTtcbiAgICAgIGNvbnN0IGluTmFtZXNwYWNlID0gdHlwZUV2ZW50ICE9PSBvcmlnaW5hbFR5cGVFdmVudDtcbiAgICAgIGNvbnN0IGV2ZW50cyA9IGdldEVsZW1lbnRFdmVudHMoZWxlbWVudCk7XG4gICAgICBjb25zdCBzdG9yZUVsZW1lbnRFdmVudCA9IGV2ZW50c1t0eXBlRXZlbnRdIHx8IHt9O1xuICAgICAgY29uc3QgaXNOYW1lc3BhY2UgPSBvcmlnaW5hbFR5cGVFdmVudC5zdGFydHNXaXRoKCcuJyk7XG4gICAgICBpZiAodHlwZW9mIGNhbGxhYmxlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAvLyBTaW1wbGVzdCBjYXNlOiBoYW5kbGVyIGlzIHBhc3NlZCwgcmVtb3ZlIHRoYXQgbGlzdGVuZXIgT05MWS5cbiAgICAgICAgaWYgKCFPYmplY3Qua2V5cyhzdG9yZUVsZW1lbnRFdmVudCkubGVuZ3RoKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJlbW92ZUhhbmRsZXIoZWxlbWVudCwgZXZlbnRzLCB0eXBlRXZlbnQsIGNhbGxhYmxlLCBpc0RlbGVnYXRlZCA/IGhhbmRsZXIgOiBudWxsKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGlzTmFtZXNwYWNlKSB7XG4gICAgICAgIGZvciAoY29uc3QgZWxlbWVudEV2ZW50IG9mIE9iamVjdC5rZXlzKGV2ZW50cykpIHtcbiAgICAgICAgICByZW1vdmVOYW1lc3BhY2VkSGFuZGxlcnMoZWxlbWVudCwgZXZlbnRzLCBlbGVtZW50RXZlbnQsIG9yaWdpbmFsVHlwZUV2ZW50LnNsaWNlKDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBba2V5SGFuZGxlcnMsIGV2ZW50XSBvZiBPYmplY3QuZW50cmllcyhzdG9yZUVsZW1lbnRFdmVudCkpIHtcbiAgICAgICAgY29uc3QgaGFuZGxlcktleSA9IGtleUhhbmRsZXJzLnJlcGxhY2Uoc3RyaXBVaWRSZWdleCwgJycpO1xuICAgICAgICBpZiAoIWluTmFtZXNwYWNlIHx8IG9yaWdpbmFsVHlwZUV2ZW50LmluY2x1ZGVzKGhhbmRsZXJLZXkpKSB7XG4gICAgICAgICAgcmVtb3ZlSGFuZGxlcihlbGVtZW50LCBldmVudHMsIHR5cGVFdmVudCwgZXZlbnQuY2FsbGFibGUsIGV2ZW50LmRlbGVnYXRpb25TZWxlY3Rvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHRyaWdnZXIoZWxlbWVudCwgZXZlbnQsIGFyZ3MpIHtcbiAgICAgIGlmICh0eXBlb2YgZXZlbnQgIT09ICdzdHJpbmcnIHx8ICFlbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgY29uc3QgJCA9IGdldGpRdWVyeSgpO1xuICAgICAgY29uc3QgdHlwZUV2ZW50ID0gZ2V0VHlwZUV2ZW50KGV2ZW50KTtcbiAgICAgIGNvbnN0IGluTmFtZXNwYWNlID0gZXZlbnQgIT09IHR5cGVFdmVudDtcbiAgICAgIGxldCBqUXVlcnlFdmVudCA9IG51bGw7XG4gICAgICBsZXQgYnViYmxlcyA9IHRydWU7XG4gICAgICBsZXQgbmF0aXZlRGlzcGF0Y2ggPSB0cnVlO1xuICAgICAgbGV0IGRlZmF1bHRQcmV2ZW50ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChpbk5hbWVzcGFjZSAmJiAkKSB7XG4gICAgICAgIGpRdWVyeUV2ZW50ID0gJC5FdmVudChldmVudCwgYXJncyk7XG4gICAgICAgICQoZWxlbWVudCkudHJpZ2dlcihqUXVlcnlFdmVudCk7XG4gICAgICAgIGJ1YmJsZXMgPSAhalF1ZXJ5RXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQoKTtcbiAgICAgICAgbmF0aXZlRGlzcGF0Y2ggPSAhalF1ZXJ5RXZlbnQuaXNJbW1lZGlhdGVQcm9wYWdhdGlvblN0b3BwZWQoKTtcbiAgICAgICAgZGVmYXVsdFByZXZlbnRlZCA9IGpRdWVyeUV2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCgpO1xuICAgICAgfVxuICAgICAgY29uc3QgZXZ0ID0gaHlkcmF0ZU9iaihuZXcgRXZlbnQoZXZlbnQsIHtcbiAgICAgICAgYnViYmxlcyxcbiAgICAgICAgY2FuY2VsYWJsZTogdHJ1ZVxuICAgICAgfSksIGFyZ3MpO1xuICAgICAgaWYgKGRlZmF1bHRQcmV2ZW50ZWQpIHtcbiAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG4gICAgICBpZiAobmF0aXZlRGlzcGF0Y2gpIHtcbiAgICAgICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2dCk7XG4gICAgICB9XG4gICAgICBpZiAoZXZ0LmRlZmF1bHRQcmV2ZW50ZWQgJiYgalF1ZXJ5RXZlbnQpIHtcbiAgICAgICAgalF1ZXJ5RXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBldnQ7XG4gICAgfVxuICB9O1xuICBmdW5jdGlvbiBoeWRyYXRlT2JqKG9iaiwgbWV0YSA9IHt9KSB7XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMobWV0YSkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIG9ialtrZXldID0gdmFsdWU7XG4gICAgICB9IGNhdGNoIChfdW51c2VkKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwge1xuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgZG9tL21hbmlwdWxhdG9yLmpzXG4gICAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFpbi9MSUNFTlNFKVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICBmdW5jdGlvbiBub3JtYWxpemVEYXRhKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSAndHJ1ZScpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAodmFsdWUgPT09ICdmYWxzZScpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHZhbHVlID09PSBOdW1iZXIodmFsdWUpLnRvU3RyaW5nKCkpIHtcbiAgICAgIHJldHVybiBOdW1iZXIodmFsdWUpO1xuICAgIH1cbiAgICBpZiAodmFsdWUgPT09ICcnIHx8IHZhbHVlID09PSAnbnVsbCcpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSk7XG4gICAgfSBjYXRjaCAoX3VudXNlZCkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBub3JtYWxpemVEYXRhS2V5KGtleSkge1xuICAgIHJldHVybiBrZXkucmVwbGFjZSgvW0EtWl0vZywgY2hyID0+IGAtJHtjaHIudG9Mb3dlckNhc2UoKX1gKTtcbiAgfVxuICBjb25zdCBNYW5pcHVsYXRvciA9IHtcbiAgICBzZXREYXRhQXR0cmlidXRlKGVsZW1lbnQsIGtleSwgdmFsdWUpIHtcbiAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKGBkYXRhLWJzLSR7bm9ybWFsaXplRGF0YUtleShrZXkpfWAsIHZhbHVlKTtcbiAgICB9LFxuICAgIHJlbW92ZURhdGFBdHRyaWJ1dGUoZWxlbWVudCwga2V5KSB7XG4gICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShgZGF0YS1icy0ke25vcm1hbGl6ZURhdGFLZXkoa2V5KX1gKTtcbiAgICB9LFxuICAgIGdldERhdGFBdHRyaWJ1dGVzKGVsZW1lbnQpIHtcbiAgICAgIGlmICghZWxlbWVudCkge1xuICAgICAgICByZXR1cm4ge307XG4gICAgICB9XG4gICAgICBjb25zdCBhdHRyaWJ1dGVzID0ge307XG4gICAgICBjb25zdCBic0tleXMgPSBPYmplY3Qua2V5cyhlbGVtZW50LmRhdGFzZXQpLmZpbHRlcihrZXkgPT4ga2V5LnN0YXJ0c1dpdGgoJ2JzJykgJiYgIWtleS5zdGFydHNXaXRoKCdic0NvbmZpZycpKTtcbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIGJzS2V5cykge1xuICAgICAgICBsZXQgcHVyZUtleSA9IGtleS5yZXBsYWNlKC9eYnMvLCAnJyk7XG4gICAgICAgIHB1cmVLZXkgPSBwdXJlS2V5LmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsgcHVyZUtleS5zbGljZSgxLCBwdXJlS2V5Lmxlbmd0aCk7XG4gICAgICAgIGF0dHJpYnV0ZXNbcHVyZUtleV0gPSBub3JtYWxpemVEYXRhKGVsZW1lbnQuZGF0YXNldFtrZXldKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhdHRyaWJ1dGVzO1xuICAgIH0sXG4gICAgZ2V0RGF0YUF0dHJpYnV0ZShlbGVtZW50LCBrZXkpIHtcbiAgICAgIHJldHVybiBub3JtYWxpemVEYXRhKGVsZW1lbnQuZ2V0QXR0cmlidXRlKGBkYXRhLWJzLSR7bm9ybWFsaXplRGF0YUtleShrZXkpfWApKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCB1dGlsL2NvbmZpZy5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cblxuICAvKipcbiAgICogQ2xhc3MgZGVmaW5pdGlvblxuICAgKi9cblxuICBjbGFzcyBDb25maWcge1xuICAgIC8vIEdldHRlcnNcbiAgICBzdGF0aWMgZ2V0IERlZmF1bHQoKSB7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgRGVmYXVsdFR5cGUoKSB7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgTkFNRSgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignWW91IGhhdmUgdG8gaW1wbGVtZW50IHRoZSBzdGF0aWMgbWV0aG9kIFwiTkFNRVwiLCBmb3IgZWFjaCBjb21wb25lbnQhJyk7XG4gICAgfVxuICAgIF9nZXRDb25maWcoY29uZmlnKSB7XG4gICAgICBjb25maWcgPSB0aGlzLl9tZXJnZUNvbmZpZ09iaihjb25maWcpO1xuICAgICAgY29uZmlnID0gdGhpcy5fY29uZmlnQWZ0ZXJNZXJnZShjb25maWcpO1xuICAgICAgdGhpcy5fdHlwZUNoZWNrQ29uZmlnKGNvbmZpZyk7XG4gICAgICByZXR1cm4gY29uZmlnO1xuICAgIH1cbiAgICBfY29uZmlnQWZ0ZXJNZXJnZShjb25maWcpIHtcbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfVxuICAgIF9tZXJnZUNvbmZpZ09iaihjb25maWcsIGVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IGpzb25Db25maWcgPSBpc0VsZW1lbnQkMShlbGVtZW50KSA/IE1hbmlwdWxhdG9yLmdldERhdGFBdHRyaWJ1dGUoZWxlbWVudCwgJ2NvbmZpZycpIDoge307IC8vIHRyeSB0byBwYXJzZVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi50aGlzLmNvbnN0cnVjdG9yLkRlZmF1bHQsXG4gICAgICAgIC4uLih0eXBlb2YganNvbkNvbmZpZyA9PT0gJ29iamVjdCcgPyBqc29uQ29uZmlnIDoge30pLFxuICAgICAgICAuLi4oaXNFbGVtZW50JDEoZWxlbWVudCkgPyBNYW5pcHVsYXRvci5nZXREYXRhQXR0cmlidXRlcyhlbGVtZW50KSA6IHt9KSxcbiAgICAgICAgLi4uKHR5cGVvZiBjb25maWcgPT09ICdvYmplY3QnID8gY29uZmlnIDoge30pXG4gICAgICB9O1xuICAgIH1cbiAgICBfdHlwZUNoZWNrQ29uZmlnKGNvbmZpZywgY29uZmlnVHlwZXMgPSB0aGlzLmNvbnN0cnVjdG9yLkRlZmF1bHRUeXBlKSB7XG4gICAgICBmb3IgKGNvbnN0IFtwcm9wZXJ0eSwgZXhwZWN0ZWRUeXBlc10gb2YgT2JqZWN0LmVudHJpZXMoY29uZmlnVHlwZXMpKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gY29uZmlnW3Byb3BlcnR5XTtcbiAgICAgICAgY29uc3QgdmFsdWVUeXBlID0gaXNFbGVtZW50JDEodmFsdWUpID8gJ2VsZW1lbnQnIDogdG9UeXBlKHZhbHVlKTtcbiAgICAgICAgaWYgKCFuZXcgUmVnRXhwKGV4cGVjdGVkVHlwZXMpLnRlc3QodmFsdWVUeXBlKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYCR7dGhpcy5jb25zdHJ1Y3Rvci5OQU1FLnRvVXBwZXJDYXNlKCl9OiBPcHRpb24gXCIke3Byb3BlcnR5fVwiIHByb3ZpZGVkIHR5cGUgXCIke3ZhbHVlVHlwZX1cIiBidXQgZXhwZWN0ZWQgdHlwZSBcIiR7ZXhwZWN0ZWRUeXBlc31cIi5gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgYmFzZS1jb21wb25lbnQuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50c1xuICAgKi9cblxuICBjb25zdCBWRVJTSU9OID0gJzUuMy4yJztcblxuICAvKipcbiAgICogQ2xhc3MgZGVmaW5pdGlvblxuICAgKi9cblxuICBjbGFzcyBCYXNlQ29tcG9uZW50IGV4dGVuZHMgQ29uZmlnIHtcbiAgICBjb25zdHJ1Y3RvcihlbGVtZW50LCBjb25maWcpIHtcbiAgICAgIHN1cGVyKCk7XG4gICAgICBlbGVtZW50ID0gZ2V0RWxlbWVudChlbGVtZW50KTtcbiAgICAgIGlmICghZWxlbWVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl9lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgIHRoaXMuX2NvbmZpZyA9IHRoaXMuX2dldENvbmZpZyhjb25maWcpO1xuICAgICAgRGF0YS5zZXQodGhpcy5fZWxlbWVudCwgdGhpcy5jb25zdHJ1Y3Rvci5EQVRBX0tFWSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLy8gUHVibGljXG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIERhdGEucmVtb3ZlKHRoaXMuX2VsZW1lbnQsIHRoaXMuY29uc3RydWN0b3IuREFUQV9LRVkpO1xuICAgICAgRXZlbnRIYW5kbGVyLm9mZih0aGlzLl9lbGVtZW50LCB0aGlzLmNvbnN0cnVjdG9yLkVWRU5UX0tFWSk7XG4gICAgICBmb3IgKGNvbnN0IHByb3BlcnR5TmFtZSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzKSkge1xuICAgICAgICB0aGlzW3Byb3BlcnR5TmFtZV0gPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBfcXVldWVDYWxsYmFjayhjYWxsYmFjaywgZWxlbWVudCwgaXNBbmltYXRlZCA9IHRydWUpIHtcbiAgICAgIGV4ZWN1dGVBZnRlclRyYW5zaXRpb24oY2FsbGJhY2ssIGVsZW1lbnQsIGlzQW5pbWF0ZWQpO1xuICAgIH1cbiAgICBfZ2V0Q29uZmlnKGNvbmZpZykge1xuICAgICAgY29uZmlnID0gdGhpcy5fbWVyZ2VDb25maWdPYmooY29uZmlnLCB0aGlzLl9lbGVtZW50KTtcbiAgICAgIGNvbmZpZyA9IHRoaXMuX2NvbmZpZ0FmdGVyTWVyZ2UoY29uZmlnKTtcbiAgICAgIHRoaXMuX3R5cGVDaGVja0NvbmZpZyhjb25maWcpO1xuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG5cbiAgICAvLyBTdGF0aWNcbiAgICBzdGF0aWMgZ2V0SW5zdGFuY2UoZWxlbWVudCkge1xuICAgICAgcmV0dXJuIERhdGEuZ2V0KGdldEVsZW1lbnQoZWxlbWVudCksIHRoaXMuREFUQV9LRVkpO1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0T3JDcmVhdGVJbnN0YW5jZShlbGVtZW50LCBjb25maWcgPSB7fSkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0SW5zdGFuY2UoZWxlbWVudCkgfHwgbmV3IHRoaXMoZWxlbWVudCwgdHlwZW9mIGNvbmZpZyA9PT0gJ29iamVjdCcgPyBjb25maWcgOiBudWxsKTtcbiAgICB9XG4gICAgc3RhdGljIGdldCBWRVJTSU9OKCkge1xuICAgICAgcmV0dXJuIFZFUlNJT047XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgREFUQV9LRVkoKSB7XG4gICAgICByZXR1cm4gYGJzLiR7dGhpcy5OQU1FfWA7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgRVZFTlRfS0VZKCkge1xuICAgICAgcmV0dXJuIGAuJHt0aGlzLkRBVEFfS0VZfWA7XG4gICAgfVxuICAgIHN0YXRpYyBldmVudE5hbWUobmFtZSkge1xuICAgICAgcmV0dXJuIGAke25hbWV9JHt0aGlzLkVWRU5UX0tFWX1gO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgZG9tL3NlbGVjdG9yLWVuZ2luZS5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cbiAgY29uc3QgZ2V0U2VsZWN0b3IgPSBlbGVtZW50ID0+IHtcbiAgICBsZXQgc2VsZWN0b3IgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1icy10YXJnZXQnKTtcbiAgICBpZiAoIXNlbGVjdG9yIHx8IHNlbGVjdG9yID09PSAnIycpIHtcbiAgICAgIGxldCBocmVmQXR0cmlidXRlID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2hyZWYnKTtcblxuICAgICAgLy8gVGhlIG9ubHkgdmFsaWQgY29udGVudCB0aGF0IGNvdWxkIGRvdWJsZSBhcyBhIHNlbGVjdG9yIGFyZSBJRHMgb3IgY2xhc3NlcyxcbiAgICAgIC8vIHNvIGV2ZXJ5dGhpbmcgc3RhcnRpbmcgd2l0aCBgI2Agb3IgYC5gLiBJZiBhIFwicmVhbFwiIFVSTCBpcyB1c2VkIGFzIHRoZSBzZWxlY3RvcixcbiAgICAgIC8vIGBkb2N1bWVudC5xdWVyeVNlbGVjdG9yYCB3aWxsIHJpZ2h0ZnVsbHkgY29tcGxhaW4gaXQgaXMgaW52YWxpZC5cbiAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvaXNzdWVzLzMyMjczXG4gICAgICBpZiAoIWhyZWZBdHRyaWJ1dGUgfHwgIWhyZWZBdHRyaWJ1dGUuaW5jbHVkZXMoJyMnKSAmJiAhaHJlZkF0dHJpYnV0ZS5zdGFydHNXaXRoKCcuJykpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIC8vIEp1c3QgaW4gY2FzZSBzb21lIENNUyBwdXRzIG91dCBhIGZ1bGwgVVJMIHdpdGggdGhlIGFuY2hvciBhcHBlbmRlZFxuICAgICAgaWYgKGhyZWZBdHRyaWJ1dGUuaW5jbHVkZXMoJyMnKSAmJiAhaHJlZkF0dHJpYnV0ZS5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgICAgaHJlZkF0dHJpYnV0ZSA9IGAjJHtocmVmQXR0cmlidXRlLnNwbGl0KCcjJylbMV19YDtcbiAgICAgIH1cbiAgICAgIHNlbGVjdG9yID0gaHJlZkF0dHJpYnV0ZSAmJiBocmVmQXR0cmlidXRlICE9PSAnIycgPyBwYXJzZVNlbGVjdG9yKGhyZWZBdHRyaWJ1dGUudHJpbSgpKSA6IG51bGw7XG4gICAgfVxuICAgIHJldHVybiBzZWxlY3RvcjtcbiAgfTtcbiAgY29uc3QgU2VsZWN0b3JFbmdpbmUgPSB7XG4gICAgZmluZChzZWxlY3RvciwgZWxlbWVudCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkge1xuICAgICAgcmV0dXJuIFtdLmNvbmNhdCguLi5FbGVtZW50LnByb3RvdHlwZS5xdWVyeVNlbGVjdG9yQWxsLmNhbGwoZWxlbWVudCwgc2VsZWN0b3IpKTtcbiAgICB9LFxuICAgIGZpbmRPbmUoc2VsZWN0b3IsIGVsZW1lbnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBFbGVtZW50LnByb3RvdHlwZS5xdWVyeVNlbGVjdG9yLmNhbGwoZWxlbWVudCwgc2VsZWN0b3IpO1xuICAgIH0sXG4gICAgY2hpbGRyZW4oZWxlbWVudCwgc2VsZWN0b3IpIHtcbiAgICAgIHJldHVybiBbXS5jb25jYXQoLi4uZWxlbWVudC5jaGlsZHJlbikuZmlsdGVyKGNoaWxkID0+IGNoaWxkLm1hdGNoZXMoc2VsZWN0b3IpKTtcbiAgICB9LFxuICAgIHBhcmVudHMoZWxlbWVudCwgc2VsZWN0b3IpIHtcbiAgICAgIGNvbnN0IHBhcmVudHMgPSBbXTtcbiAgICAgIGxldCBhbmNlc3RvciA9IGVsZW1lbnQucGFyZW50Tm9kZS5jbG9zZXN0KHNlbGVjdG9yKTtcbiAgICAgIHdoaWxlIChhbmNlc3Rvcikge1xuICAgICAgICBwYXJlbnRzLnB1c2goYW5jZXN0b3IpO1xuICAgICAgICBhbmNlc3RvciA9IGFuY2VzdG9yLnBhcmVudE5vZGUuY2xvc2VzdChzZWxlY3Rvcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50cztcbiAgICB9LFxuICAgIHByZXYoZWxlbWVudCwgc2VsZWN0b3IpIHtcbiAgICAgIGxldCBwcmV2aW91cyA9IGVsZW1lbnQucHJldmlvdXNFbGVtZW50U2libGluZztcbiAgICAgIHdoaWxlIChwcmV2aW91cykge1xuICAgICAgICBpZiAocHJldmlvdXMubWF0Y2hlcyhzZWxlY3RvcikpIHtcbiAgICAgICAgICByZXR1cm4gW3ByZXZpb3VzXTtcbiAgICAgICAgfVxuICAgICAgICBwcmV2aW91cyA9IHByZXZpb3VzLnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gICAgICB9XG4gICAgICByZXR1cm4gW107XG4gICAgfSxcbiAgICAvLyBUT0RPOiB0aGlzIGlzIG5vdyB1bnVzZWQ7IHJlbW92ZSBsYXRlciBhbG9uZyB3aXRoIHByZXYoKVxuICAgIG5leHQoZWxlbWVudCwgc2VsZWN0b3IpIHtcbiAgICAgIGxldCBuZXh0ID0gZWxlbWVudC5uZXh0RWxlbWVudFNpYmxpbmc7XG4gICAgICB3aGlsZSAobmV4dCkge1xuICAgICAgICBpZiAobmV4dC5tYXRjaGVzKHNlbGVjdG9yKSkge1xuICAgICAgICAgIHJldHVybiBbbmV4dF07XG4gICAgICAgIH1cbiAgICAgICAgbmV4dCA9IG5leHQubmV4dEVsZW1lbnRTaWJsaW5nO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFtdO1xuICAgIH0sXG4gICAgZm9jdXNhYmxlQ2hpbGRyZW4oZWxlbWVudCkge1xuICAgICAgY29uc3QgZm9jdXNhYmxlcyA9IFsnYScsICdidXR0b24nLCAnaW5wdXQnLCAndGV4dGFyZWEnLCAnc2VsZWN0JywgJ2RldGFpbHMnLCAnW3RhYmluZGV4XScsICdbY29udGVudGVkaXRhYmxlPVwidHJ1ZVwiXSddLm1hcChzZWxlY3RvciA9PiBgJHtzZWxlY3Rvcn06bm90KFt0YWJpbmRleF49XCItXCJdKWApLmpvaW4oJywnKTtcbiAgICAgIHJldHVybiB0aGlzLmZpbmQoZm9jdXNhYmxlcywgZWxlbWVudCkuZmlsdGVyKGVsID0+ICFpc0Rpc2FibGVkKGVsKSAmJiBpc1Zpc2libGUoZWwpKTtcbiAgICB9LFxuICAgIGdldFNlbGVjdG9yRnJvbUVsZW1lbnQoZWxlbWVudCkge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBnZXRTZWxlY3RvcihlbGVtZW50KTtcbiAgICAgIGlmIChzZWxlY3Rvcikge1xuICAgICAgICByZXR1cm4gU2VsZWN0b3JFbmdpbmUuZmluZE9uZShzZWxlY3RvcikgPyBzZWxlY3RvciA6IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIGdldEVsZW1lbnRGcm9tU2VsZWN0b3IoZWxlbWVudCkge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBnZXRTZWxlY3RvcihlbGVtZW50KTtcbiAgICAgIHJldHVybiBzZWxlY3RvciA/IFNlbGVjdG9yRW5naW5lLmZpbmRPbmUoc2VsZWN0b3IpIDogbnVsbDtcbiAgICB9LFxuICAgIGdldE11bHRpcGxlRWxlbWVudHNGcm9tU2VsZWN0b3IoZWxlbWVudCkge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBnZXRTZWxlY3RvcihlbGVtZW50KTtcbiAgICAgIHJldHVybiBzZWxlY3RvciA/IFNlbGVjdG9yRW5naW5lLmZpbmQoc2VsZWN0b3IpIDogW107XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgdXRpbC9jb21wb25lbnQtZnVuY3Rpb25zLmpzXG4gICAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFpbi9MSUNFTlNFKVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICBjb25zdCBlbmFibGVEaXNtaXNzVHJpZ2dlciA9IChjb21wb25lbnQsIG1ldGhvZCA9ICdoaWRlJykgPT4ge1xuICAgIGNvbnN0IGNsaWNrRXZlbnQgPSBgY2xpY2suZGlzbWlzcyR7Y29tcG9uZW50LkVWRU5UX0tFWX1gO1xuICAgIGNvbnN0IG5hbWUgPSBjb21wb25lbnQuTkFNRTtcbiAgICBFdmVudEhhbmRsZXIub24oZG9jdW1lbnQsIGNsaWNrRXZlbnQsIGBbZGF0YS1icy1kaXNtaXNzPVwiJHtuYW1lfVwiXWAsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgaWYgKFsnQScsICdBUkVBJ10uaW5jbHVkZXModGhpcy50YWdOYW1lKSkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfVxuICAgICAgaWYgKGlzRGlzYWJsZWQodGhpcykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgdGFyZ2V0ID0gU2VsZWN0b3JFbmdpbmUuZ2V0RWxlbWVudEZyb21TZWxlY3Rvcih0aGlzKSB8fCB0aGlzLmNsb3Nlc3QoYC4ke25hbWV9YCk7XG4gICAgICBjb25zdCBpbnN0YW5jZSA9IGNvbXBvbmVudC5nZXRPckNyZWF0ZUluc3RhbmNlKHRhcmdldCk7XG5cbiAgICAgIC8vIE1ldGhvZCBhcmd1bWVudCBpcyBsZWZ0LCBmb3IgQWxlcnQgYW5kIG9ubHksIGFzIGl0IGRvZXNuJ3QgaW1wbGVtZW50IHRoZSAnaGlkZScgbWV0aG9kXG4gICAgICBpbnN0YW5jZVttZXRob2RdKCk7XG4gICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCBhbGVydC5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cblxuICAvKipcbiAgICogQ29uc3RhbnRzXG4gICAqL1xuXG4gIGNvbnN0IE5BTUUkZiA9ICdhbGVydCc7XG4gIGNvbnN0IERBVEFfS0VZJGEgPSAnYnMuYWxlcnQnO1xuICBjb25zdCBFVkVOVF9LRVkkYiA9IGAuJHtEQVRBX0tFWSRhfWA7XG4gIGNvbnN0IEVWRU5UX0NMT1NFID0gYGNsb3NlJHtFVkVOVF9LRVkkYn1gO1xuICBjb25zdCBFVkVOVF9DTE9TRUQgPSBgY2xvc2VkJHtFVkVOVF9LRVkkYn1gO1xuICBjb25zdCBDTEFTU19OQU1FX0ZBREUkNSA9ICdmYWRlJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9TSE9XJDggPSAnc2hvdyc7XG5cbiAgLyoqXG4gICAqIENsYXNzIGRlZmluaXRpb25cbiAgICovXG5cbiAgY2xhc3MgQWxlcnQgZXh0ZW5kcyBCYXNlQ29tcG9uZW50IHtcbiAgICAvLyBHZXR0ZXJzXG4gICAgc3RhdGljIGdldCBOQU1FKCkge1xuICAgICAgcmV0dXJuIE5BTUUkZjtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWNcbiAgICBjbG9zZSgpIHtcbiAgICAgIGNvbnN0IGNsb3NlRXZlbnQgPSBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCBFVkVOVF9DTE9TRSk7XG4gICAgICBpZiAoY2xvc2VFdmVudC5kZWZhdWx0UHJldmVudGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX1NIT1ckOCk7XG4gICAgICBjb25zdCBpc0FuaW1hdGVkID0gdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9GQURFJDUpO1xuICAgICAgdGhpcy5fcXVldWVDYWxsYmFjaygoKSA9PiB0aGlzLl9kZXN0cm95RWxlbWVudCgpLCB0aGlzLl9lbGVtZW50LCBpc0FuaW1hdGVkKTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlXG4gICAgX2Rlc3Ryb3lFbGVtZW50KCkge1xuICAgICAgdGhpcy5fZWxlbWVudC5yZW1vdmUoKTtcbiAgICAgIEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0NMT1NFRCk7XG4gICAgICB0aGlzLmRpc3Bvc2UoKTtcbiAgICB9XG5cbiAgICAvLyBTdGF0aWNcbiAgICBzdGF0aWMgalF1ZXJ5SW50ZXJmYWNlKGNvbmZpZykge1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBBbGVydC5nZXRPckNyZWF0ZUluc3RhbmNlKHRoaXMpO1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFbY29uZmlnXSA9PT0gdW5kZWZpbmVkIHx8IGNvbmZpZy5zdGFydHNXaXRoKCdfJykgfHwgY29uZmlnID09PSAnY29uc3RydWN0b3InKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgTm8gbWV0aG9kIG5hbWVkIFwiJHtjb25maWd9XCJgKTtcbiAgICAgICAgfVxuICAgICAgICBkYXRhW2NvbmZpZ10odGhpcyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGF0YSBBUEkgaW1wbGVtZW50YXRpb25cbiAgICovXG5cbiAgZW5hYmxlRGlzbWlzc1RyaWdnZXIoQWxlcnQsICdjbG9zZScpO1xuXG4gIC8qKlxuICAgKiBqUXVlcnlcbiAgICovXG5cbiAgZGVmaW5lSlF1ZXJ5UGx1Z2luKEFsZXJ0KTtcblxuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogQm9vdHN0cmFwIGJ1dHRvbi5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cblxuICAvKipcbiAgICogQ29uc3RhbnRzXG4gICAqL1xuXG4gIGNvbnN0IE5BTUUkZSA9ICdidXR0b24nO1xuICBjb25zdCBEQVRBX0tFWSQ5ID0gJ2JzLmJ1dHRvbic7XG4gIGNvbnN0IEVWRU5UX0tFWSRhID0gYC4ke0RBVEFfS0VZJDl9YDtcbiAgY29uc3QgREFUQV9BUElfS0VZJDYgPSAnLmRhdGEtYXBpJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9BQ1RJVkUkMyA9ICdhY3RpdmUnO1xuICBjb25zdCBTRUxFQ1RPUl9EQVRBX1RPR0dMRSQ1ID0gJ1tkYXRhLWJzLXRvZ2dsZT1cImJ1dHRvblwiXSc7XG4gIGNvbnN0IEVWRU5UX0NMSUNLX0RBVEFfQVBJJDYgPSBgY2xpY2ske0VWRU5UX0tFWSRhfSR7REFUQV9BUElfS0VZJDZ9YDtcblxuICAvKipcbiAgICogQ2xhc3MgZGVmaW5pdGlvblxuICAgKi9cblxuICBjbGFzcyBCdXR0b24gZXh0ZW5kcyBCYXNlQ29tcG9uZW50IHtcbiAgICAvLyBHZXR0ZXJzXG4gICAgc3RhdGljIGdldCBOQU1FKCkge1xuICAgICAgcmV0dXJuIE5BTUUkZTtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWNcbiAgICB0b2dnbGUoKSB7XG4gICAgICAvLyBUb2dnbGUgY2xhc3MgYW5kIHN5bmMgdGhlIGBhcmlhLXByZXNzZWRgIGF0dHJpYnV0ZSB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGAudG9nZ2xlKClgIG1ldGhvZFxuICAgICAgdGhpcy5fZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZShDTEFTU19OQU1FX0FDVElWRSQzKSk7XG4gICAgfVxuXG4gICAgLy8gU3RhdGljXG4gICAgc3RhdGljIGpRdWVyeUludGVyZmFjZShjb25maWcpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBkYXRhID0gQnV0dG9uLmdldE9yQ3JlYXRlSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIGlmIChjb25maWcgPT09ICd0b2dnbGUnKSB7XG4gICAgICAgICAgZGF0YVtjb25maWddKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEYXRhIEFQSSBpbXBsZW1lbnRhdGlvblxuICAgKi9cblxuICBFdmVudEhhbmRsZXIub24oZG9jdW1lbnQsIEVWRU5UX0NMSUNLX0RBVEFfQVBJJDYsIFNFTEVDVE9SX0RBVEFfVE9HR0xFJDUsIGV2ZW50ID0+IHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGNvbnN0IGJ1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KFNFTEVDVE9SX0RBVEFfVE9HR0xFJDUpO1xuICAgIGNvbnN0IGRhdGEgPSBCdXR0b24uZ2V0T3JDcmVhdGVJbnN0YW5jZShidXR0b24pO1xuICAgIGRhdGEudG9nZ2xlKCk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiBqUXVlcnlcbiAgICovXG5cbiAgZGVmaW5lSlF1ZXJ5UGx1Z2luKEJ1dHRvbik7XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCB1dGlsL3N3aXBlLmpzXG4gICAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFpbi9MSUNFTlNFKVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBDb25zdGFudHNcbiAgICovXG5cbiAgY29uc3QgTkFNRSRkID0gJ3N3aXBlJztcbiAgY29uc3QgRVZFTlRfS0VZJDkgPSAnLmJzLnN3aXBlJztcbiAgY29uc3QgRVZFTlRfVE9VQ0hTVEFSVCA9IGB0b3VjaHN0YXJ0JHtFVkVOVF9LRVkkOX1gO1xuICBjb25zdCBFVkVOVF9UT1VDSE1PVkUgPSBgdG91Y2htb3ZlJHtFVkVOVF9LRVkkOX1gO1xuICBjb25zdCBFVkVOVF9UT1VDSEVORCA9IGB0b3VjaGVuZCR7RVZFTlRfS0VZJDl9YDtcbiAgY29uc3QgRVZFTlRfUE9JTlRFUkRPV04gPSBgcG9pbnRlcmRvd24ke0VWRU5UX0tFWSQ5fWA7XG4gIGNvbnN0IEVWRU5UX1BPSU5URVJVUCA9IGBwb2ludGVydXAke0VWRU5UX0tFWSQ5fWA7XG4gIGNvbnN0IFBPSU5URVJfVFlQRV9UT1VDSCA9ICd0b3VjaCc7XG4gIGNvbnN0IFBPSU5URVJfVFlQRV9QRU4gPSAncGVuJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9QT0lOVEVSX0VWRU5UID0gJ3BvaW50ZXItZXZlbnQnO1xuICBjb25zdCBTV0lQRV9USFJFU0hPTEQgPSA0MDtcbiAgY29uc3QgRGVmYXVsdCRjID0ge1xuICAgIGVuZENhbGxiYWNrOiBudWxsLFxuICAgIGxlZnRDYWxsYmFjazogbnVsbCxcbiAgICByaWdodENhbGxiYWNrOiBudWxsXG4gIH07XG4gIGNvbnN0IERlZmF1bHRUeXBlJGMgPSB7XG4gICAgZW5kQ2FsbGJhY2s6ICcoZnVuY3Rpb258bnVsbCknLFxuICAgIGxlZnRDYWxsYmFjazogJyhmdW5jdGlvbnxudWxsKScsXG4gICAgcmlnaHRDYWxsYmFjazogJyhmdW5jdGlvbnxudWxsKSdcbiAgfTtcblxuICAvKipcbiAgICogQ2xhc3MgZGVmaW5pdGlvblxuICAgKi9cblxuICBjbGFzcyBTd2lwZSBleHRlbmRzIENvbmZpZyB7XG4gICAgY29uc3RydWN0b3IoZWxlbWVudCwgY29uZmlnKSB7XG4gICAgICBzdXBlcigpO1xuICAgICAgdGhpcy5fZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICBpZiAoIWVsZW1lbnQgfHwgIVN3aXBlLmlzU3VwcG9ydGVkKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5fY29uZmlnID0gdGhpcy5fZ2V0Q29uZmlnKGNvbmZpZyk7XG4gICAgICB0aGlzLl9kZWx0YVggPSAwO1xuICAgICAgdGhpcy5fc3VwcG9ydFBvaW50ZXJFdmVudHMgPSBCb29sZWFuKHdpbmRvdy5Qb2ludGVyRXZlbnQpO1xuICAgICAgdGhpcy5faW5pdEV2ZW50cygpO1xuICAgIH1cblxuICAgIC8vIEdldHRlcnNcbiAgICBzdGF0aWMgZ2V0IERlZmF1bHQoKSB7XG4gICAgICByZXR1cm4gRGVmYXVsdCRjO1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IERlZmF1bHRUeXBlKCkge1xuICAgICAgcmV0dXJuIERlZmF1bHRUeXBlJGM7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgTkFNRSgpIHtcbiAgICAgIHJldHVybiBOQU1FJGQ7XG4gICAgfVxuXG4gICAgLy8gUHVibGljXG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIEV2ZW50SGFuZGxlci5vZmYodGhpcy5fZWxlbWVudCwgRVZFTlRfS0VZJDkpO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGVcbiAgICBfc3RhcnQoZXZlbnQpIHtcbiAgICAgIGlmICghdGhpcy5fc3VwcG9ydFBvaW50ZXJFdmVudHMpIHtcbiAgICAgICAgdGhpcy5fZGVsdGFYID0gZXZlbnQudG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fZXZlbnRJc1BvaW50ZXJQZW5Ub3VjaChldmVudCkpIHtcbiAgICAgICAgdGhpcy5fZGVsdGFYID0gZXZlbnQuY2xpZW50WDtcbiAgICAgIH1cbiAgICB9XG4gICAgX2VuZChldmVudCkge1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SXNQb2ludGVyUGVuVG91Y2goZXZlbnQpKSB7XG4gICAgICAgIHRoaXMuX2RlbHRhWCA9IGV2ZW50LmNsaWVudFggLSB0aGlzLl9kZWx0YVg7XG4gICAgICB9XG4gICAgICB0aGlzLl9oYW5kbGVTd2lwZSgpO1xuICAgICAgZXhlY3V0ZSh0aGlzLl9jb25maWcuZW5kQ2FsbGJhY2spO1xuICAgIH1cbiAgICBfbW92ZShldmVudCkge1xuICAgICAgdGhpcy5fZGVsdGFYID0gZXZlbnQudG91Y2hlcyAmJiBldmVudC50b3VjaGVzLmxlbmd0aCA+IDEgPyAwIDogZXZlbnQudG91Y2hlc1swXS5jbGllbnRYIC0gdGhpcy5fZGVsdGFYO1xuICAgIH1cbiAgICBfaGFuZGxlU3dpcGUoKSB7XG4gICAgICBjb25zdCBhYnNEZWx0YVggPSBNYXRoLmFicyh0aGlzLl9kZWx0YVgpO1xuICAgICAgaWYgKGFic0RlbHRhWCA8PSBTV0lQRV9USFJFU0hPTEQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgZGlyZWN0aW9uID0gYWJzRGVsdGFYIC8gdGhpcy5fZGVsdGFYO1xuICAgICAgdGhpcy5fZGVsdGFYID0gMDtcbiAgICAgIGlmICghZGlyZWN0aW9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGV4ZWN1dGUoZGlyZWN0aW9uID4gMCA/IHRoaXMuX2NvbmZpZy5yaWdodENhbGxiYWNrIDogdGhpcy5fY29uZmlnLmxlZnRDYWxsYmFjayk7XG4gICAgfVxuICAgIF9pbml0RXZlbnRzKCkge1xuICAgICAgaWYgKHRoaXMuX3N1cHBvcnRQb2ludGVyRXZlbnRzKSB7XG4gICAgICAgIEV2ZW50SGFuZGxlci5vbih0aGlzLl9lbGVtZW50LCBFVkVOVF9QT0lOVEVSRE9XTiwgZXZlbnQgPT4gdGhpcy5fc3RhcnQoZXZlbnQpKTtcbiAgICAgICAgRXZlbnRIYW5kbGVyLm9uKHRoaXMuX2VsZW1lbnQsIEVWRU5UX1BPSU5URVJVUCwgZXZlbnQgPT4gdGhpcy5fZW5kKGV2ZW50KSk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX1BPSU5URVJfRVZFTlQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgRXZlbnRIYW5kbGVyLm9uKHRoaXMuX2VsZW1lbnQsIEVWRU5UX1RPVUNIU1RBUlQsIGV2ZW50ID0+IHRoaXMuX3N0YXJ0KGV2ZW50KSk7XG4gICAgICAgIEV2ZW50SGFuZGxlci5vbih0aGlzLl9lbGVtZW50LCBFVkVOVF9UT1VDSE1PVkUsIGV2ZW50ID0+IHRoaXMuX21vdmUoZXZlbnQpKTtcbiAgICAgICAgRXZlbnRIYW5kbGVyLm9uKHRoaXMuX2VsZW1lbnQsIEVWRU5UX1RPVUNIRU5ELCBldmVudCA9PiB0aGlzLl9lbmQoZXZlbnQpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX2V2ZW50SXNQb2ludGVyUGVuVG91Y2goZXZlbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdXBwb3J0UG9pbnRlckV2ZW50cyAmJiAoZXZlbnQucG9pbnRlclR5cGUgPT09IFBPSU5URVJfVFlQRV9QRU4gfHwgZXZlbnQucG9pbnRlclR5cGUgPT09IFBPSU5URVJfVFlQRV9UT1VDSCk7XG4gICAgfVxuXG4gICAgLy8gU3RhdGljXG4gICAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgICAgcmV0dXJuICdvbnRvdWNoc3RhcnQnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCB8fCBuYXZpZ2F0b3IubWF4VG91Y2hQb2ludHMgPiAwO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgY2Fyb3VzZWwuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50c1xuICAgKi9cblxuICBjb25zdCBOQU1FJGMgPSAnY2Fyb3VzZWwnO1xuICBjb25zdCBEQVRBX0tFWSQ4ID0gJ2JzLmNhcm91c2VsJztcbiAgY29uc3QgRVZFTlRfS0VZJDggPSBgLiR7REFUQV9LRVkkOH1gO1xuICBjb25zdCBEQVRBX0FQSV9LRVkkNSA9ICcuZGF0YS1hcGknO1xuICBjb25zdCBBUlJPV19MRUZUX0tFWSQxID0gJ0Fycm93TGVmdCc7XG4gIGNvbnN0IEFSUk9XX1JJR0hUX0tFWSQxID0gJ0Fycm93UmlnaHQnO1xuICBjb25zdCBUT1VDSEVWRU5UX0NPTVBBVF9XQUlUID0gNTAwOyAvLyBUaW1lIGZvciBtb3VzZSBjb21wYXQgZXZlbnRzIHRvIGZpcmUgYWZ0ZXIgdG91Y2hcblxuICBjb25zdCBPUkRFUl9ORVhUID0gJ25leHQnO1xuICBjb25zdCBPUkRFUl9QUkVWID0gJ3ByZXYnO1xuICBjb25zdCBESVJFQ1RJT05fTEVGVCA9ICdsZWZ0JztcbiAgY29uc3QgRElSRUNUSU9OX1JJR0hUID0gJ3JpZ2h0JztcbiAgY29uc3QgRVZFTlRfU0xJREUgPSBgc2xpZGUke0VWRU5UX0tFWSQ4fWA7XG4gIGNvbnN0IEVWRU5UX1NMSUQgPSBgc2xpZCR7RVZFTlRfS0VZJDh9YDtcbiAgY29uc3QgRVZFTlRfS0VZRE9XTiQxID0gYGtleWRvd24ke0VWRU5UX0tFWSQ4fWA7XG4gIGNvbnN0IEVWRU5UX01PVVNFRU5URVIkMSA9IGBtb3VzZWVudGVyJHtFVkVOVF9LRVkkOH1gO1xuICBjb25zdCBFVkVOVF9NT1VTRUxFQVZFJDEgPSBgbW91c2VsZWF2ZSR7RVZFTlRfS0VZJDh9YDtcbiAgY29uc3QgRVZFTlRfRFJBR19TVEFSVCA9IGBkcmFnc3RhcnQke0VWRU5UX0tFWSQ4fWA7XG4gIGNvbnN0IEVWRU5UX0xPQURfREFUQV9BUEkkMyA9IGBsb2FkJHtFVkVOVF9LRVkkOH0ke0RBVEFfQVBJX0tFWSQ1fWA7XG4gIGNvbnN0IEVWRU5UX0NMSUNLX0RBVEFfQVBJJDUgPSBgY2xpY2ske0VWRU5UX0tFWSQ4fSR7REFUQV9BUElfS0VZJDV9YDtcbiAgY29uc3QgQ0xBU1NfTkFNRV9DQVJPVVNFTCA9ICdjYXJvdXNlbCc7XG4gIGNvbnN0IENMQVNTX05BTUVfQUNUSVZFJDIgPSAnYWN0aXZlJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9TTElERSA9ICdzbGlkZSc7XG4gIGNvbnN0IENMQVNTX05BTUVfRU5EID0gJ2Nhcm91c2VsLWl0ZW0tZW5kJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9TVEFSVCA9ICdjYXJvdXNlbC1pdGVtLXN0YXJ0JztcbiAgY29uc3QgQ0xBU1NfTkFNRV9ORVhUID0gJ2Nhcm91c2VsLWl0ZW0tbmV4dCc7XG4gIGNvbnN0IENMQVNTX05BTUVfUFJFViA9ICdjYXJvdXNlbC1pdGVtLXByZXYnO1xuICBjb25zdCBTRUxFQ1RPUl9BQ1RJVkUgPSAnLmFjdGl2ZSc7XG4gIGNvbnN0IFNFTEVDVE9SX0lURU0gPSAnLmNhcm91c2VsLWl0ZW0nO1xuICBjb25zdCBTRUxFQ1RPUl9BQ1RJVkVfSVRFTSA9IFNFTEVDVE9SX0FDVElWRSArIFNFTEVDVE9SX0lURU07XG4gIGNvbnN0IFNFTEVDVE9SX0lURU1fSU1HID0gJy5jYXJvdXNlbC1pdGVtIGltZyc7XG4gIGNvbnN0IFNFTEVDVE9SX0lORElDQVRPUlMgPSAnLmNhcm91c2VsLWluZGljYXRvcnMnO1xuICBjb25zdCBTRUxFQ1RPUl9EQVRBX1NMSURFID0gJ1tkYXRhLWJzLXNsaWRlXSwgW2RhdGEtYnMtc2xpZGUtdG9dJztcbiAgY29uc3QgU0VMRUNUT1JfREFUQV9SSURFID0gJ1tkYXRhLWJzLXJpZGU9XCJjYXJvdXNlbFwiXSc7XG4gIGNvbnN0IEtFWV9UT19ESVJFQ1RJT04gPSB7XG4gICAgW0FSUk9XX0xFRlRfS0VZJDFdOiBESVJFQ1RJT05fUklHSFQsXG4gICAgW0FSUk9XX1JJR0hUX0tFWSQxXTogRElSRUNUSU9OX0xFRlRcbiAgfTtcbiAgY29uc3QgRGVmYXVsdCRiID0ge1xuICAgIGludGVydmFsOiA1MDAwLFxuICAgIGtleWJvYXJkOiB0cnVlLFxuICAgIHBhdXNlOiAnaG92ZXInLFxuICAgIHJpZGU6IGZhbHNlLFxuICAgIHRvdWNoOiB0cnVlLFxuICAgIHdyYXA6IHRydWVcbiAgfTtcbiAgY29uc3QgRGVmYXVsdFR5cGUkYiA9IHtcbiAgICBpbnRlcnZhbDogJyhudW1iZXJ8Ym9vbGVhbiknLFxuICAgIC8vIFRPRE86djYgcmVtb3ZlIGJvb2xlYW4gc3VwcG9ydFxuICAgIGtleWJvYXJkOiAnYm9vbGVhbicsXG4gICAgcGF1c2U6ICcoc3RyaW5nfGJvb2xlYW4pJyxcbiAgICByaWRlOiAnKGJvb2xlYW58c3RyaW5nKScsXG4gICAgdG91Y2g6ICdib29sZWFuJyxcbiAgICB3cmFwOiAnYm9vbGVhbidcbiAgfTtcblxuICAvKipcbiAgICogQ2xhc3MgZGVmaW5pdGlvblxuICAgKi9cblxuICBjbGFzcyBDYXJvdXNlbCBleHRlbmRzIEJhc2VDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgc3VwZXIoZWxlbWVudCwgY29uZmlnKTtcbiAgICAgIHRoaXMuX2ludGVydmFsID0gbnVsbDtcbiAgICAgIHRoaXMuX2FjdGl2ZUVsZW1lbnQgPSBudWxsO1xuICAgICAgdGhpcy5faXNTbGlkaW5nID0gZmFsc2U7XG4gICAgICB0aGlzLnRvdWNoVGltZW91dCA9IG51bGw7XG4gICAgICB0aGlzLl9zd2lwZUhlbHBlciA9IG51bGw7XG4gICAgICB0aGlzLl9pbmRpY2F0b3JzRWxlbWVudCA9IFNlbGVjdG9yRW5naW5lLmZpbmRPbmUoU0VMRUNUT1JfSU5ESUNBVE9SUywgdGhpcy5fZWxlbWVudCk7XG4gICAgICB0aGlzLl9hZGRFdmVudExpc3RlbmVycygpO1xuICAgICAgaWYgKHRoaXMuX2NvbmZpZy5yaWRlID09PSBDTEFTU19OQU1FX0NBUk9VU0VMKSB7XG4gICAgICAgIHRoaXMuY3ljbGUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHZXR0ZXJzXG4gICAgc3RhdGljIGdldCBEZWZhdWx0KCkge1xuICAgICAgcmV0dXJuIERlZmF1bHQkYjtcbiAgICB9XG4gICAgc3RhdGljIGdldCBEZWZhdWx0VHlwZSgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0VHlwZSRiO1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IE5BTUUoKSB7XG4gICAgICByZXR1cm4gTkFNRSRjO1xuICAgIH1cblxuICAgIC8vIFB1YmxpY1xuICAgIG5leHQoKSB7XG4gICAgICB0aGlzLl9zbGlkZShPUkRFUl9ORVhUKTtcbiAgICB9XG4gICAgbmV4dFdoZW5WaXNpYmxlKCkge1xuICAgICAgLy8gRklYTUUgVE9ETyB1c2UgYGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZWBcbiAgICAgIC8vIERvbid0IGNhbGwgbmV4dCB3aGVuIHRoZSBwYWdlIGlzbid0IHZpc2libGVcbiAgICAgIC8vIG9yIHRoZSBjYXJvdXNlbCBvciBpdHMgcGFyZW50IGlzbid0IHZpc2libGVcbiAgICAgIGlmICghZG9jdW1lbnQuaGlkZGVuICYmIGlzVmlzaWJsZSh0aGlzLl9lbGVtZW50KSkge1xuICAgICAgICB0aGlzLm5leHQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcHJldigpIHtcbiAgICAgIHRoaXMuX3NsaWRlKE9SREVSX1BSRVYpO1xuICAgIH1cbiAgICBwYXVzZSgpIHtcbiAgICAgIGlmICh0aGlzLl9pc1NsaWRpbmcpIHtcbiAgICAgICAgdHJpZ2dlclRyYW5zaXRpb25FbmQodGhpcy5fZWxlbWVudCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jbGVhckludGVydmFsKCk7XG4gICAgfVxuICAgIGN5Y2xlKCkge1xuICAgICAgdGhpcy5fY2xlYXJJbnRlcnZhbCgpO1xuICAgICAgdGhpcy5fdXBkYXRlSW50ZXJ2YWwoKTtcbiAgICAgIHRoaXMuX2ludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy5uZXh0V2hlblZpc2libGUoKSwgdGhpcy5fY29uZmlnLmludGVydmFsKTtcbiAgICB9XG4gICAgX21heWJlRW5hYmxlQ3ljbGUoKSB7XG4gICAgICBpZiAoIXRoaXMuX2NvbmZpZy5yaWRlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9pc1NsaWRpbmcpIHtcbiAgICAgICAgRXZlbnRIYW5kbGVyLm9uZSh0aGlzLl9lbGVtZW50LCBFVkVOVF9TTElELCAoKSA9PiB0aGlzLmN5Y2xlKCkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLmN5Y2xlKCk7XG4gICAgfVxuICAgIHRvKGluZGV4KSB7XG4gICAgICBjb25zdCBpdGVtcyA9IHRoaXMuX2dldEl0ZW1zKCk7XG4gICAgICBpZiAoaW5kZXggPiBpdGVtcy5sZW5ndGggLSAxIHx8IGluZGV4IDwgMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5faXNTbGlkaW5nKSB7XG4gICAgICAgIEV2ZW50SGFuZGxlci5vbmUodGhpcy5fZWxlbWVudCwgRVZFTlRfU0xJRCwgKCkgPT4gdGhpcy50byhpbmRleCkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBhY3RpdmVJbmRleCA9IHRoaXMuX2dldEl0ZW1JbmRleCh0aGlzLl9nZXRBY3RpdmUoKSk7XG4gICAgICBpZiAoYWN0aXZlSW5kZXggPT09IGluZGV4KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG9yZGVyID0gaW5kZXggPiBhY3RpdmVJbmRleCA/IE9SREVSX05FWFQgOiBPUkRFUl9QUkVWO1xuICAgICAgdGhpcy5fc2xpZGUob3JkZXIsIGl0ZW1zW2luZGV4XSk7XG4gICAgfVxuICAgIGRpc3Bvc2UoKSB7XG4gICAgICBpZiAodGhpcy5fc3dpcGVIZWxwZXIpIHtcbiAgICAgICAgdGhpcy5fc3dpcGVIZWxwZXIuZGlzcG9zZSgpO1xuICAgICAgfVxuICAgICAgc3VwZXIuZGlzcG9zZSgpO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGVcbiAgICBfY29uZmlnQWZ0ZXJNZXJnZShjb25maWcpIHtcbiAgICAgIGNvbmZpZy5kZWZhdWx0SW50ZXJ2YWwgPSBjb25maWcuaW50ZXJ2YWw7XG4gICAgICByZXR1cm4gY29uZmlnO1xuICAgIH1cbiAgICBfYWRkRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgICBpZiAodGhpcy5fY29uZmlnLmtleWJvYXJkKSB7XG4gICAgICAgIEV2ZW50SGFuZGxlci5vbih0aGlzLl9lbGVtZW50LCBFVkVOVF9LRVlET1dOJDEsIGV2ZW50ID0+IHRoaXMuX2tleWRvd24oZXZlbnQpKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9jb25maWcucGF1c2UgPT09ICdob3ZlcicpIHtcbiAgICAgICAgRXZlbnRIYW5kbGVyLm9uKHRoaXMuX2VsZW1lbnQsIEVWRU5UX01PVVNFRU5URVIkMSwgKCkgPT4gdGhpcy5wYXVzZSgpKTtcbiAgICAgICAgRXZlbnRIYW5kbGVyLm9uKHRoaXMuX2VsZW1lbnQsIEVWRU5UX01PVVNFTEVBVkUkMSwgKCkgPT4gdGhpcy5fbWF5YmVFbmFibGVDeWNsZSgpKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9jb25maWcudG91Y2ggJiYgU3dpcGUuaXNTdXBwb3J0ZWQoKSkge1xuICAgICAgICB0aGlzLl9hZGRUb3VjaEV2ZW50TGlzdGVuZXJzKCk7XG4gICAgICB9XG4gICAgfVxuICAgIF9hZGRUb3VjaEV2ZW50TGlzdGVuZXJzKCkge1xuICAgICAgZm9yIChjb25zdCBpbWcgb2YgU2VsZWN0b3JFbmdpbmUuZmluZChTRUxFQ1RPUl9JVEVNX0lNRywgdGhpcy5fZWxlbWVudCkpIHtcbiAgICAgICAgRXZlbnRIYW5kbGVyLm9uKGltZywgRVZFTlRfRFJBR19TVEFSVCwgZXZlbnQgPT4gZXZlbnQucHJldmVudERlZmF1bHQoKSk7XG4gICAgICB9XG4gICAgICBjb25zdCBlbmRDYWxsQmFjayA9ICgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbmZpZy5wYXVzZSAhPT0gJ2hvdmVyJykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGl0J3MgYSB0b3VjaC1lbmFibGVkIGRldmljZSwgbW91c2VlbnRlci9sZWF2ZSBhcmUgZmlyZWQgYXNcbiAgICAgICAgLy8gcGFydCBvZiB0aGUgbW91c2UgY29tcGF0aWJpbGl0eSBldmVudHMgb24gZmlyc3QgdGFwIC0gdGhlIGNhcm91c2VsXG4gICAgICAgIC8vIHdvdWxkIHN0b3AgY3ljbGluZyB1bnRpbCB1c2VyIHRhcHBlZCBvdXQgb2YgaXQ7XG4gICAgICAgIC8vIGhlcmUsIHdlIGxpc3RlbiBmb3IgdG91Y2hlbmQsIGV4cGxpY2l0bHkgcGF1c2UgdGhlIGNhcm91c2VsXG4gICAgICAgIC8vIChhcyBpZiBpdCdzIHRoZSBzZWNvbmQgdGltZSB3ZSB0YXAgb24gaXQsIG1vdXNlZW50ZXIgY29tcGF0IGV2ZW50XG4gICAgICAgIC8vIGlzIE5PVCBmaXJlZCkgYW5kIGFmdGVyIGEgdGltZW91dCAodG8gYWxsb3cgZm9yIG1vdXNlIGNvbXBhdGliaWxpdHlcbiAgICAgICAgLy8gZXZlbnRzIHRvIGZpcmUpIHdlIGV4cGxpY2l0bHkgcmVzdGFydCBjeWNsaW5nXG5cbiAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICBpZiAodGhpcy50b3VjaFRpbWVvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50b3VjaFRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudG91Y2hUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLl9tYXliZUVuYWJsZUN5Y2xlKCksIFRPVUNIRVZFTlRfQ09NUEFUX1dBSVQgKyB0aGlzLl9jb25maWcuaW50ZXJ2YWwpO1xuICAgICAgfTtcbiAgICAgIGNvbnN0IHN3aXBlQ29uZmlnID0ge1xuICAgICAgICBsZWZ0Q2FsbGJhY2s6ICgpID0+IHRoaXMuX3NsaWRlKHRoaXMuX2RpcmVjdGlvblRvT3JkZXIoRElSRUNUSU9OX0xFRlQpKSxcbiAgICAgICAgcmlnaHRDYWxsYmFjazogKCkgPT4gdGhpcy5fc2xpZGUodGhpcy5fZGlyZWN0aW9uVG9PcmRlcihESVJFQ1RJT05fUklHSFQpKSxcbiAgICAgICAgZW5kQ2FsbGJhY2s6IGVuZENhbGxCYWNrXG4gICAgICB9O1xuICAgICAgdGhpcy5fc3dpcGVIZWxwZXIgPSBuZXcgU3dpcGUodGhpcy5fZWxlbWVudCwgc3dpcGVDb25maWcpO1xuICAgIH1cbiAgICBfa2V5ZG93bihldmVudCkge1xuICAgICAgaWYgKC9pbnB1dHx0ZXh0YXJlYS9pLnRlc3QoZXZlbnQudGFyZ2V0LnRhZ05hbWUpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IEtFWV9UT19ESVJFQ1RJT05bZXZlbnQua2V5XTtcbiAgICAgIGlmIChkaXJlY3Rpb24pIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5fc2xpZGUodGhpcy5fZGlyZWN0aW9uVG9PcmRlcihkaXJlY3Rpb24pKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX2dldEl0ZW1JbmRleChlbGVtZW50KSB7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0SXRlbXMoKS5pbmRleE9mKGVsZW1lbnQpO1xuICAgIH1cbiAgICBfc2V0QWN0aXZlSW5kaWNhdG9yRWxlbWVudChpbmRleCkge1xuICAgICAgaWYgKCF0aGlzLl9pbmRpY2F0b3JzRWxlbWVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBhY3RpdmVJbmRpY2F0b3IgPSBTZWxlY3RvckVuZ2luZS5maW5kT25lKFNFTEVDVE9SX0FDVElWRSwgdGhpcy5faW5kaWNhdG9yc0VsZW1lbnQpO1xuICAgICAgYWN0aXZlSW5kaWNhdG9yLmNsYXNzTGlzdC5yZW1vdmUoQ0xBU1NfTkFNRV9BQ1RJVkUkMik7XG4gICAgICBhY3RpdmVJbmRpY2F0b3IucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWN1cnJlbnQnKTtcbiAgICAgIGNvbnN0IG5ld0FjdGl2ZUluZGljYXRvciA9IFNlbGVjdG9yRW5naW5lLmZpbmRPbmUoYFtkYXRhLWJzLXNsaWRlLXRvPVwiJHtpbmRleH1cIl1gLCB0aGlzLl9pbmRpY2F0b3JzRWxlbWVudCk7XG4gICAgICBpZiAobmV3QWN0aXZlSW5kaWNhdG9yKSB7XG4gICAgICAgIG5ld0FjdGl2ZUluZGljYXRvci5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfQUNUSVZFJDIpO1xuICAgICAgICBuZXdBY3RpdmVJbmRpY2F0b3Iuc2V0QXR0cmlidXRlKCdhcmlhLWN1cnJlbnQnLCAndHJ1ZScpO1xuICAgICAgfVxuICAgIH1cbiAgICBfdXBkYXRlSW50ZXJ2YWwoKSB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5fYWN0aXZlRWxlbWVudCB8fCB0aGlzLl9nZXRBY3RpdmUoKTtcbiAgICAgIGlmICghZWxlbWVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBlbGVtZW50SW50ZXJ2YWwgPSBOdW1iZXIucGFyc2VJbnQoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtYnMtaW50ZXJ2YWwnKSwgMTApO1xuICAgICAgdGhpcy5fY29uZmlnLmludGVydmFsID0gZWxlbWVudEludGVydmFsIHx8IHRoaXMuX2NvbmZpZy5kZWZhdWx0SW50ZXJ2YWw7XG4gICAgfVxuICAgIF9zbGlkZShvcmRlciwgZWxlbWVudCA9IG51bGwpIHtcbiAgICAgIGlmICh0aGlzLl9pc1NsaWRpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgYWN0aXZlRWxlbWVudCA9IHRoaXMuX2dldEFjdGl2ZSgpO1xuICAgICAgY29uc3QgaXNOZXh0ID0gb3JkZXIgPT09IE9SREVSX05FWFQ7XG4gICAgICBjb25zdCBuZXh0RWxlbWVudCA9IGVsZW1lbnQgfHwgZ2V0TmV4dEFjdGl2ZUVsZW1lbnQodGhpcy5fZ2V0SXRlbXMoKSwgYWN0aXZlRWxlbWVudCwgaXNOZXh0LCB0aGlzLl9jb25maWcud3JhcCk7XG4gICAgICBpZiAobmV4dEVsZW1lbnQgPT09IGFjdGl2ZUVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgbmV4dEVsZW1lbnRJbmRleCA9IHRoaXMuX2dldEl0ZW1JbmRleChuZXh0RWxlbWVudCk7XG4gICAgICBjb25zdCB0cmlnZ2VyRXZlbnQgPSBldmVudE5hbWUgPT4ge1xuICAgICAgICByZXR1cm4gRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgZXZlbnROYW1lLCB7XG4gICAgICAgICAgcmVsYXRlZFRhcmdldDogbmV4dEVsZW1lbnQsXG4gICAgICAgICAgZGlyZWN0aW9uOiB0aGlzLl9vcmRlclRvRGlyZWN0aW9uKG9yZGVyKSxcbiAgICAgICAgICBmcm9tOiB0aGlzLl9nZXRJdGVtSW5kZXgoYWN0aXZlRWxlbWVudCksXG4gICAgICAgICAgdG86IG5leHRFbGVtZW50SW5kZXhcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgY29uc3Qgc2xpZGVFdmVudCA9IHRyaWdnZXJFdmVudChFVkVOVF9TTElERSk7XG4gICAgICBpZiAoc2xpZGVFdmVudC5kZWZhdWx0UHJldmVudGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghYWN0aXZlRWxlbWVudCB8fCAhbmV4dEVsZW1lbnQpIHtcbiAgICAgICAgLy8gU29tZSB3ZWlyZG5lc3MgaXMgaGFwcGVuaW5nLCBzbyB3ZSBiYWlsXG4gICAgICAgIC8vIFRPRE86IGNoYW5nZSB0ZXN0cyB0aGF0IHVzZSBlbXB0eSBkaXZzIHRvIGF2b2lkIHRoaXMgY2hlY2tcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgaXNDeWNsaW5nID0gQm9vbGVhbih0aGlzLl9pbnRlcnZhbCk7XG4gICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICB0aGlzLl9pc1NsaWRpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fc2V0QWN0aXZlSW5kaWNhdG9yRWxlbWVudChuZXh0RWxlbWVudEluZGV4KTtcbiAgICAgIHRoaXMuX2FjdGl2ZUVsZW1lbnQgPSBuZXh0RWxlbWVudDtcbiAgICAgIGNvbnN0IGRpcmVjdGlvbmFsQ2xhc3NOYW1lID0gaXNOZXh0ID8gQ0xBU1NfTkFNRV9TVEFSVCA6IENMQVNTX05BTUVfRU5EO1xuICAgICAgY29uc3Qgb3JkZXJDbGFzc05hbWUgPSBpc05leHQgPyBDTEFTU19OQU1FX05FWFQgOiBDTEFTU19OQU1FX1BSRVY7XG4gICAgICBuZXh0RWxlbWVudC5jbGFzc0xpc3QuYWRkKG9yZGVyQ2xhc3NOYW1lKTtcbiAgICAgIHJlZmxvdyhuZXh0RWxlbWVudCk7XG4gICAgICBhY3RpdmVFbGVtZW50LmNsYXNzTGlzdC5hZGQoZGlyZWN0aW9uYWxDbGFzc05hbWUpO1xuICAgICAgbmV4dEVsZW1lbnQuY2xhc3NMaXN0LmFkZChkaXJlY3Rpb25hbENsYXNzTmFtZSk7XG4gICAgICBjb25zdCBjb21wbGV0ZUNhbGxCYWNrID0gKCkgPT4ge1xuICAgICAgICBuZXh0RWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKGRpcmVjdGlvbmFsQ2xhc3NOYW1lLCBvcmRlckNsYXNzTmFtZSk7XG4gICAgICAgIG5leHRFbGVtZW50LmNsYXNzTGlzdC5hZGQoQ0xBU1NfTkFNRV9BQ1RJVkUkMik7XG4gICAgICAgIGFjdGl2ZUVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX0FDVElWRSQyLCBvcmRlckNsYXNzTmFtZSwgZGlyZWN0aW9uYWxDbGFzc05hbWUpO1xuICAgICAgICB0aGlzLl9pc1NsaWRpbmcgPSBmYWxzZTtcbiAgICAgICAgdHJpZ2dlckV2ZW50KEVWRU5UX1NMSUQpO1xuICAgICAgfTtcbiAgICAgIHRoaXMuX3F1ZXVlQ2FsbGJhY2soY29tcGxldGVDYWxsQmFjaywgYWN0aXZlRWxlbWVudCwgdGhpcy5faXNBbmltYXRlZCgpKTtcbiAgICAgIGlmIChpc0N5Y2xpbmcpIHtcbiAgICAgICAgdGhpcy5jeWNsZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBfaXNBbmltYXRlZCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5jb250YWlucyhDTEFTU19OQU1FX1NMSURFKTtcbiAgICB9XG4gICAgX2dldEFjdGl2ZSgpIHtcbiAgICAgIHJldHVybiBTZWxlY3RvckVuZ2luZS5maW5kT25lKFNFTEVDVE9SX0FDVElWRV9JVEVNLCB0aGlzLl9lbGVtZW50KTtcbiAgICB9XG4gICAgX2dldEl0ZW1zKCkge1xuICAgICAgcmV0dXJuIFNlbGVjdG9yRW5naW5lLmZpbmQoU0VMRUNUT1JfSVRFTSwgdGhpcy5fZWxlbWVudCk7XG4gICAgfVxuICAgIF9jbGVhckludGVydmFsKCkge1xuICAgICAgaWYgKHRoaXMuX2ludGVydmFsKSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5faW50ZXJ2YWwpO1xuICAgICAgICB0aGlzLl9pbnRlcnZhbCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIF9kaXJlY3Rpb25Ub09yZGVyKGRpcmVjdGlvbikge1xuICAgICAgaWYgKGlzUlRMKCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcmVjdGlvbiA9PT0gRElSRUNUSU9OX0xFRlQgPyBPUkRFUl9QUkVWIDogT1JERVJfTkVYVDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkaXJlY3Rpb24gPT09IERJUkVDVElPTl9MRUZUID8gT1JERVJfTkVYVCA6IE9SREVSX1BSRVY7XG4gICAgfVxuICAgIF9vcmRlclRvRGlyZWN0aW9uKG9yZGVyKSB7XG4gICAgICBpZiAoaXNSVEwoKSkge1xuICAgICAgICByZXR1cm4gb3JkZXIgPT09IE9SREVSX1BSRVYgPyBESVJFQ1RJT05fTEVGVCA6IERJUkVDVElPTl9SSUdIVDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvcmRlciA9PT0gT1JERVJfUFJFViA/IERJUkVDVElPTl9SSUdIVCA6IERJUkVDVElPTl9MRUZUO1xuICAgIH1cblxuICAgIC8vIFN0YXRpY1xuICAgIHN0YXRpYyBqUXVlcnlJbnRlcmZhY2UoY29uZmlnKSB7XG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IENhcm91c2VsLmdldE9yQ3JlYXRlSW5zdGFuY2UodGhpcywgY29uZmlnKTtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgZGF0YS50byhjb25maWcpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBpZiAoZGF0YVtjb25maWddID09PSB1bmRlZmluZWQgfHwgY29uZmlnLnN0YXJ0c1dpdGgoJ18nKSB8fCBjb25maWcgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYE5vIG1ldGhvZCBuYW1lZCBcIiR7Y29uZmlnfVwiYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRhdGFbY29uZmlnXSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGF0YSBBUEkgaW1wbGVtZW50YXRpb25cbiAgICovXG5cbiAgRXZlbnRIYW5kbGVyLm9uKGRvY3VtZW50LCBFVkVOVF9DTElDS19EQVRBX0FQSSQ1LCBTRUxFQ1RPUl9EQVRBX1NMSURFLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICBjb25zdCB0YXJnZXQgPSBTZWxlY3RvckVuZ2luZS5nZXRFbGVtZW50RnJvbVNlbGVjdG9yKHRoaXMpO1xuICAgIGlmICghdGFyZ2V0IHx8ICF0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKENMQVNTX05BTUVfQ0FST1VTRUwpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgY29uc3QgY2Fyb3VzZWwgPSBDYXJvdXNlbC5nZXRPckNyZWF0ZUluc3RhbmNlKHRhcmdldCk7XG4gICAgY29uc3Qgc2xpZGVJbmRleCA9IHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLWJzLXNsaWRlLXRvJyk7XG4gICAgaWYgKHNsaWRlSW5kZXgpIHtcbiAgICAgIGNhcm91c2VsLnRvKHNsaWRlSW5kZXgpO1xuICAgICAgY2Fyb3VzZWwuX21heWJlRW5hYmxlQ3ljbGUoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKE1hbmlwdWxhdG9yLmdldERhdGFBdHRyaWJ1dGUodGhpcywgJ3NsaWRlJykgPT09ICduZXh0Jykge1xuICAgICAgY2Fyb3VzZWwubmV4dCgpO1xuICAgICAgY2Fyb3VzZWwuX21heWJlRW5hYmxlQ3ljbGUoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2Fyb3VzZWwucHJldigpO1xuICAgIGNhcm91c2VsLl9tYXliZUVuYWJsZUN5Y2xlKCk7XG4gIH0pO1xuICBFdmVudEhhbmRsZXIub24od2luZG93LCBFVkVOVF9MT0FEX0RBVEFfQVBJJDMsICgpID0+IHtcbiAgICBjb25zdCBjYXJvdXNlbHMgPSBTZWxlY3RvckVuZ2luZS5maW5kKFNFTEVDVE9SX0RBVEFfUklERSk7XG4gICAgZm9yIChjb25zdCBjYXJvdXNlbCBvZiBjYXJvdXNlbHMpIHtcbiAgICAgIENhcm91c2VsLmdldE9yQ3JlYXRlSW5zdGFuY2UoY2Fyb3VzZWwpO1xuICAgIH1cbiAgfSk7XG5cbiAgLyoqXG4gICAqIGpRdWVyeVxuICAgKi9cblxuICBkZWZpbmVKUXVlcnlQbHVnaW4oQ2Fyb3VzZWwpO1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgY29sbGFwc2UuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50c1xuICAgKi9cblxuICBjb25zdCBOQU1FJGIgPSAnY29sbGFwc2UnO1xuICBjb25zdCBEQVRBX0tFWSQ3ID0gJ2JzLmNvbGxhcHNlJztcbiAgY29uc3QgRVZFTlRfS0VZJDcgPSBgLiR7REFUQV9LRVkkN31gO1xuICBjb25zdCBEQVRBX0FQSV9LRVkkNCA9ICcuZGF0YS1hcGknO1xuICBjb25zdCBFVkVOVF9TSE9XJDYgPSBgc2hvdyR7RVZFTlRfS0VZJDd9YDtcbiAgY29uc3QgRVZFTlRfU0hPV04kNiA9IGBzaG93biR7RVZFTlRfS0VZJDd9YDtcbiAgY29uc3QgRVZFTlRfSElERSQ2ID0gYGhpZGUke0VWRU5UX0tFWSQ3fWA7XG4gIGNvbnN0IEVWRU5UX0hJRERFTiQ2ID0gYGhpZGRlbiR7RVZFTlRfS0VZJDd9YDtcbiAgY29uc3QgRVZFTlRfQ0xJQ0tfREFUQV9BUEkkNCA9IGBjbGljayR7RVZFTlRfS0VZJDd9JHtEQVRBX0FQSV9LRVkkNH1gO1xuICBjb25zdCBDTEFTU19OQU1FX1NIT1ckNyA9ICdzaG93JztcbiAgY29uc3QgQ0xBU1NfTkFNRV9DT0xMQVBTRSA9ICdjb2xsYXBzZSc7XG4gIGNvbnN0IENMQVNTX05BTUVfQ09MTEFQU0lORyA9ICdjb2xsYXBzaW5nJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9DT0xMQVBTRUQgPSAnY29sbGFwc2VkJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9ERUVQRVJfQ0hJTERSRU4gPSBgOnNjb3BlIC4ke0NMQVNTX05BTUVfQ09MTEFQU0V9IC4ke0NMQVNTX05BTUVfQ09MTEFQU0V9YDtcbiAgY29uc3QgQ0xBU1NfTkFNRV9IT1JJWk9OVEFMID0gJ2NvbGxhcHNlLWhvcml6b250YWwnO1xuICBjb25zdCBXSURUSCA9ICd3aWR0aCc7XG4gIGNvbnN0IEhFSUdIVCA9ICdoZWlnaHQnO1xuICBjb25zdCBTRUxFQ1RPUl9BQ1RJVkVTID0gJy5jb2xsYXBzZS5zaG93LCAuY29sbGFwc2UuY29sbGFwc2luZyc7XG4gIGNvbnN0IFNFTEVDVE9SX0RBVEFfVE9HR0xFJDQgPSAnW2RhdGEtYnMtdG9nZ2xlPVwiY29sbGFwc2VcIl0nO1xuICBjb25zdCBEZWZhdWx0JGEgPSB7XG4gICAgcGFyZW50OiBudWxsLFxuICAgIHRvZ2dsZTogdHJ1ZVxuICB9O1xuICBjb25zdCBEZWZhdWx0VHlwZSRhID0ge1xuICAgIHBhcmVudDogJyhudWxsfGVsZW1lbnQpJyxcbiAgICB0b2dnbGU6ICdib29sZWFuJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGFzcyBkZWZpbml0aW9uXG4gICAqL1xuXG4gIGNsYXNzIENvbGxhcHNlIGV4dGVuZHMgQmFzZUNvbXBvbmVudCB7XG4gICAgY29uc3RydWN0b3IoZWxlbWVudCwgY29uZmlnKSB7XG4gICAgICBzdXBlcihlbGVtZW50LCBjb25maWcpO1xuICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICB0aGlzLl90cmlnZ2VyQXJyYXkgPSBbXTtcbiAgICAgIGNvbnN0IHRvZ2dsZUxpc3QgPSBTZWxlY3RvckVuZ2luZS5maW5kKFNFTEVDVE9SX0RBVEFfVE9HR0xFJDQpO1xuICAgICAgZm9yIChjb25zdCBlbGVtIG9mIHRvZ2dsZUxpc3QpIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSBTZWxlY3RvckVuZ2luZS5nZXRTZWxlY3RvckZyb21FbGVtZW50KGVsZW0pO1xuICAgICAgICBjb25zdCBmaWx0ZXJFbGVtZW50ID0gU2VsZWN0b3JFbmdpbmUuZmluZChzZWxlY3RvcikuZmlsdGVyKGZvdW5kRWxlbWVudCA9PiBmb3VuZEVsZW1lbnQgPT09IHRoaXMuX2VsZW1lbnQpO1xuICAgICAgICBpZiAoc2VsZWN0b3IgIT09IG51bGwgJiYgZmlsdGVyRWxlbWVudC5sZW5ndGgpIHtcbiAgICAgICAgICB0aGlzLl90cmlnZ2VyQXJyYXkucHVzaChlbGVtKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5faW5pdGlhbGl6ZUNoaWxkcmVuKCk7XG4gICAgICBpZiAoIXRoaXMuX2NvbmZpZy5wYXJlbnQpIHtcbiAgICAgICAgdGhpcy5fYWRkQXJpYUFuZENvbGxhcHNlZENsYXNzKHRoaXMuX3RyaWdnZXJBcnJheSwgdGhpcy5faXNTaG93bigpKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9jb25maWcudG9nZ2xlKSB7XG4gICAgICAgIHRoaXMudG9nZ2xlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gR2V0dGVyc1xuICAgIHN0YXRpYyBnZXQgRGVmYXVsdCgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0JGE7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgRGVmYXVsdFR5cGUoKSB7XG4gICAgICByZXR1cm4gRGVmYXVsdFR5cGUkYTtcbiAgICB9XG4gICAgc3RhdGljIGdldCBOQU1FKCkge1xuICAgICAgcmV0dXJuIE5BTUUkYjtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWNcbiAgICB0b2dnbGUoKSB7XG4gICAgICBpZiAodGhpcy5faXNTaG93bigpKSB7XG4gICAgICAgIHRoaXMuaGlkZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zaG93KCk7XG4gICAgICB9XG4gICAgfVxuICAgIHNob3coKSB7XG4gICAgICBpZiAodGhpcy5faXNUcmFuc2l0aW9uaW5nIHx8IHRoaXMuX2lzU2hvd24oKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBsZXQgYWN0aXZlQ2hpbGRyZW4gPSBbXTtcblxuICAgICAgLy8gZmluZCBhY3RpdmUgY2hpbGRyZW5cbiAgICAgIGlmICh0aGlzLl9jb25maWcucGFyZW50KSB7XG4gICAgICAgIGFjdGl2ZUNoaWxkcmVuID0gdGhpcy5fZ2V0Rmlyc3RMZXZlbENoaWxkcmVuKFNFTEVDVE9SX0FDVElWRVMpLmZpbHRlcihlbGVtZW50ID0+IGVsZW1lbnQgIT09IHRoaXMuX2VsZW1lbnQpLm1hcChlbGVtZW50ID0+IENvbGxhcHNlLmdldE9yQ3JlYXRlSW5zdGFuY2UoZWxlbWVudCwge1xuICAgICAgICAgIHRvZ2dsZTogZmFsc2VcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgICAgaWYgKGFjdGl2ZUNoaWxkcmVuLmxlbmd0aCAmJiBhY3RpdmVDaGlsZHJlblswXS5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0YXJ0RXZlbnQgPSBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCBFVkVOVF9TSE9XJDYpO1xuICAgICAgaWYgKHN0YXJ0RXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGFjdGl2ZUluc3RhbmNlIG9mIGFjdGl2ZUNoaWxkcmVuKSB7XG4gICAgICAgIGFjdGl2ZUluc3RhbmNlLmhpZGUoKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpbWVuc2lvbiA9IHRoaXMuX2dldERpbWVuc2lvbigpO1xuICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKENMQVNTX05BTUVfQ09MTEFQU0UpO1xuICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfQ09MTEFQU0lORyk7XG4gICAgICB0aGlzLl9lbGVtZW50LnN0eWxlW2RpbWVuc2lvbl0gPSAwO1xuICAgICAgdGhpcy5fYWRkQXJpYUFuZENvbGxhcHNlZENsYXNzKHRoaXMuX3RyaWdnZXJBcnJheSwgdHJ1ZSk7XG4gICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSB0cnVlO1xuICAgICAgY29uc3QgY29tcGxldGUgPSAoKSA9PiB7XG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoQ0xBU1NfTkFNRV9DT0xMQVBTSU5HKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfQ09MTEFQU0UsIENMQVNTX05BTUVfU0hPVyQ3KTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZVtkaW1lbnNpb25dID0gJyc7XG4gICAgICAgIEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX1NIT1dOJDYpO1xuICAgICAgfTtcbiAgICAgIGNvbnN0IGNhcGl0YWxpemVkRGltZW5zaW9uID0gZGltZW5zaW9uWzBdLnRvVXBwZXJDYXNlKCkgKyBkaW1lbnNpb24uc2xpY2UoMSk7XG4gICAgICBjb25zdCBzY3JvbGxTaXplID0gYHNjcm9sbCR7Y2FwaXRhbGl6ZWREaW1lbnNpb259YDtcbiAgICAgIHRoaXMuX3F1ZXVlQ2FsbGJhY2soY29tcGxldGUsIHRoaXMuX2VsZW1lbnQsIHRydWUpO1xuICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZVtkaW1lbnNpb25dID0gYCR7dGhpcy5fZWxlbWVudFtzY3JvbGxTaXplXX1weGA7XG4gICAgfVxuICAgIGhpZGUoKSB7XG4gICAgICBpZiAodGhpcy5faXNUcmFuc2l0aW9uaW5nIHx8ICF0aGlzLl9pc1Nob3duKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3Qgc3RhcnRFdmVudCA9IEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0hJREUkNik7XG4gICAgICBpZiAoc3RhcnRFdmVudC5kZWZhdWx0UHJldmVudGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpbWVuc2lvbiA9IHRoaXMuX2dldERpbWVuc2lvbigpO1xuICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZVtkaW1lbnNpb25dID0gYCR7dGhpcy5fZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVtkaW1lbnNpb25dfXB4YDtcbiAgICAgIHJlZmxvdyh0aGlzLl9lbGVtZW50KTtcbiAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX0NPTExBUFNJTkcpO1xuICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKENMQVNTX05BTUVfQ09MTEFQU0UsIENMQVNTX05BTUVfU0hPVyQ3KTtcbiAgICAgIGZvciAoY29uc3QgdHJpZ2dlciBvZiB0aGlzLl90cmlnZ2VyQXJyYXkpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IFNlbGVjdG9yRW5naW5lLmdldEVsZW1lbnRGcm9tU2VsZWN0b3IodHJpZ2dlcik7XG4gICAgICAgIGlmIChlbGVtZW50ICYmICF0aGlzLl9pc1Nob3duKGVsZW1lbnQpKSB7XG4gICAgICAgICAgdGhpcy5fYWRkQXJpYUFuZENvbGxhcHNlZENsYXNzKFt0cmlnZ2VyXSwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSB0cnVlO1xuICAgICAgY29uc3QgY29tcGxldGUgPSAoKSA9PiB7XG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoQ0xBU1NfTkFNRV9DT0xMQVBTSU5HKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfQ09MTEFQU0UpO1xuICAgICAgICBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCBFVkVOVF9ISURERU4kNik7XG4gICAgICB9O1xuICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZVtkaW1lbnNpb25dID0gJyc7XG4gICAgICB0aGlzLl9xdWV1ZUNhbGxiYWNrKGNvbXBsZXRlLCB0aGlzLl9lbGVtZW50LCB0cnVlKTtcbiAgICB9XG4gICAgX2lzU2hvd24oZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgIHJldHVybiBlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucyhDTEFTU19OQU1FX1NIT1ckNyk7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZVxuICAgIF9jb25maWdBZnRlck1lcmdlKGNvbmZpZykge1xuICAgICAgY29uZmlnLnRvZ2dsZSA9IEJvb2xlYW4oY29uZmlnLnRvZ2dsZSk7IC8vIENvZXJjZSBzdHJpbmcgdmFsdWVzXG4gICAgICBjb25maWcucGFyZW50ID0gZ2V0RWxlbWVudChjb25maWcucGFyZW50KTtcbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfVxuICAgIF9nZXREaW1lbnNpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9IT1JJWk9OVEFMKSA/IFdJRFRIIDogSEVJR0hUO1xuICAgIH1cbiAgICBfaW5pdGlhbGl6ZUNoaWxkcmVuKCkge1xuICAgICAgaWYgKCF0aGlzLl9jb25maWcucGFyZW50KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fZ2V0Rmlyc3RMZXZlbENoaWxkcmVuKFNFTEVDVE9SX0RBVEFfVE9HR0xFJDQpO1xuICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIGNoaWxkcmVuKSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdGVkID0gU2VsZWN0b3JFbmdpbmUuZ2V0RWxlbWVudEZyb21TZWxlY3RvcihlbGVtZW50KTtcbiAgICAgICAgaWYgKHNlbGVjdGVkKSB7XG4gICAgICAgICAgdGhpcy5fYWRkQXJpYUFuZENvbGxhcHNlZENsYXNzKFtlbGVtZW50XSwgdGhpcy5faXNTaG93bihzZWxlY3RlZCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIF9nZXRGaXJzdExldmVsQ2hpbGRyZW4oc2VsZWN0b3IpIHtcbiAgICAgIGNvbnN0IGNoaWxkcmVuID0gU2VsZWN0b3JFbmdpbmUuZmluZChDTEFTU19OQU1FX0RFRVBFUl9DSElMRFJFTiwgdGhpcy5fY29uZmlnLnBhcmVudCk7XG4gICAgICAvLyByZW1vdmUgY2hpbGRyZW4gaWYgZ3JlYXRlciBkZXB0aFxuICAgICAgcmV0dXJuIFNlbGVjdG9yRW5naW5lLmZpbmQoc2VsZWN0b3IsIHRoaXMuX2NvbmZpZy5wYXJlbnQpLmZpbHRlcihlbGVtZW50ID0+ICFjaGlsZHJlbi5pbmNsdWRlcyhlbGVtZW50KSk7XG4gICAgfVxuICAgIF9hZGRBcmlhQW5kQ29sbGFwc2VkQ2xhc3ModHJpZ2dlckFycmF5LCBpc09wZW4pIHtcbiAgICAgIGlmICghdHJpZ2dlckFycmF5Lmxlbmd0aCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdHJpZ2dlckFycmF5KSB7XG4gICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZShDTEFTU19OQU1FX0NPTExBUFNFRCwgIWlzT3Blbik7XG4gICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgaXNPcGVuKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTdGF0aWNcbiAgICBzdGF0aWMgalF1ZXJ5SW50ZXJmYWNlKGNvbmZpZykge1xuICAgICAgY29uc3QgX2NvbmZpZyA9IHt9O1xuICAgICAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnICYmIC9zaG93fGhpZGUvLnRlc3QoY29uZmlnKSkge1xuICAgICAgICBfY29uZmlnLnRvZ2dsZSA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBDb2xsYXBzZS5nZXRPckNyZWF0ZUluc3RhbmNlKHRoaXMsIF9jb25maWcpO1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGRhdGFbY29uZmlnXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYE5vIG1ldGhvZCBuYW1lZCBcIiR7Y29uZmlnfVwiYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRhdGFbY29uZmlnXSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGF0YSBBUEkgaW1wbGVtZW50YXRpb25cbiAgICovXG5cbiAgRXZlbnRIYW5kbGVyLm9uKGRvY3VtZW50LCBFVkVOVF9DTElDS19EQVRBX0FQSSQ0LCBTRUxFQ1RPUl9EQVRBX1RPR0dMRSQ0LCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAvLyBwcmV2ZW50RGVmYXVsdCBvbmx5IGZvciA8YT4gZWxlbWVudHMgKHdoaWNoIGNoYW5nZSB0aGUgVVJMKSBub3QgaW5zaWRlIHRoZSBjb2xsYXBzaWJsZSBlbGVtZW50XG4gICAgaWYgKGV2ZW50LnRhcmdldC50YWdOYW1lID09PSAnQScgfHwgZXZlbnQuZGVsZWdhdGVUYXJnZXQgJiYgZXZlbnQuZGVsZWdhdGVUYXJnZXQudGFnTmFtZSA9PT0gJ0EnKSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgU2VsZWN0b3JFbmdpbmUuZ2V0TXVsdGlwbGVFbGVtZW50c0Zyb21TZWxlY3Rvcih0aGlzKSkge1xuICAgICAgQ29sbGFwc2UuZ2V0T3JDcmVhdGVJbnN0YW5jZShlbGVtZW50LCB7XG4gICAgICAgIHRvZ2dsZTogZmFsc2VcbiAgICAgIH0pLnRvZ2dsZSgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLyoqXG4gICAqIGpRdWVyeVxuICAgKi9cblxuICBkZWZpbmVKUXVlcnlQbHVnaW4oQ29sbGFwc2UpO1xuXG4gIHZhciB0b3AgPSAndG9wJztcbiAgdmFyIGJvdHRvbSA9ICdib3R0b20nO1xuICB2YXIgcmlnaHQgPSAncmlnaHQnO1xuICB2YXIgbGVmdCA9ICdsZWZ0JztcbiAgdmFyIGF1dG8gPSAnYXV0byc7XG4gIHZhciBiYXNlUGxhY2VtZW50cyA9IFt0b3AsIGJvdHRvbSwgcmlnaHQsIGxlZnRdO1xuICB2YXIgc3RhcnQgPSAnc3RhcnQnO1xuICB2YXIgZW5kID0gJ2VuZCc7XG4gIHZhciBjbGlwcGluZ1BhcmVudHMgPSAnY2xpcHBpbmdQYXJlbnRzJztcbiAgdmFyIHZpZXdwb3J0ID0gJ3ZpZXdwb3J0JztcbiAgdmFyIHBvcHBlciA9ICdwb3BwZXInO1xuICB2YXIgcmVmZXJlbmNlID0gJ3JlZmVyZW5jZSc7XG4gIHZhciB2YXJpYXRpb25QbGFjZW1lbnRzID0gLyojX19QVVJFX18qL2Jhc2VQbGFjZW1lbnRzLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBwbGFjZW1lbnQpIHtcbiAgICByZXR1cm4gYWNjLmNvbmNhdChbcGxhY2VtZW50ICsgXCItXCIgKyBzdGFydCwgcGxhY2VtZW50ICsgXCItXCIgKyBlbmRdKTtcbiAgfSwgW10pO1xuICB2YXIgcGxhY2VtZW50cyA9IC8qI19fUFVSRV9fKi9bXS5jb25jYXQoYmFzZVBsYWNlbWVudHMsIFthdXRvXSkucmVkdWNlKGZ1bmN0aW9uIChhY2MsIHBsYWNlbWVudCkge1xuICAgIHJldHVybiBhY2MuY29uY2F0KFtwbGFjZW1lbnQsIHBsYWNlbWVudCArIFwiLVwiICsgc3RhcnQsIHBsYWNlbWVudCArIFwiLVwiICsgZW5kXSk7XG4gIH0sIFtdKTsgLy8gbW9kaWZpZXJzIHRoYXQgbmVlZCB0byByZWFkIHRoZSBET01cblxuICB2YXIgYmVmb3JlUmVhZCA9ICdiZWZvcmVSZWFkJztcbiAgdmFyIHJlYWQgPSAncmVhZCc7XG4gIHZhciBhZnRlclJlYWQgPSAnYWZ0ZXJSZWFkJzsgLy8gcHVyZS1sb2dpYyBtb2RpZmllcnNcblxuICB2YXIgYmVmb3JlTWFpbiA9ICdiZWZvcmVNYWluJztcbiAgdmFyIG1haW4gPSAnbWFpbic7XG4gIHZhciBhZnRlck1haW4gPSAnYWZ0ZXJNYWluJzsgLy8gbW9kaWZpZXIgd2l0aCB0aGUgcHVycG9zZSB0byB3cml0ZSB0byB0aGUgRE9NIChvciB3cml0ZSBpbnRvIGEgZnJhbWV3b3JrIHN0YXRlKVxuXG4gIHZhciBiZWZvcmVXcml0ZSA9ICdiZWZvcmVXcml0ZSc7XG4gIHZhciB3cml0ZSA9ICd3cml0ZSc7XG4gIHZhciBhZnRlcldyaXRlID0gJ2FmdGVyV3JpdGUnO1xuICB2YXIgbW9kaWZpZXJQaGFzZXMgPSBbYmVmb3JlUmVhZCwgcmVhZCwgYWZ0ZXJSZWFkLCBiZWZvcmVNYWluLCBtYWluLCBhZnRlck1haW4sIGJlZm9yZVdyaXRlLCB3cml0ZSwgYWZ0ZXJXcml0ZV07XG5cbiAgZnVuY3Rpb24gZ2V0Tm9kZU5hbWUoZWxlbWVudCkge1xuICAgIHJldHVybiBlbGVtZW50ID8gKGVsZW1lbnQubm9kZU5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkgOiBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0V2luZG93KG5vZGUpIHtcbiAgICBpZiAobm9kZSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gd2luZG93O1xuICAgIH1cblxuICAgIGlmIChub2RlLnRvU3RyaW5nKCkgIT09ICdbb2JqZWN0IFdpbmRvd10nKSB7XG4gICAgICB2YXIgb3duZXJEb2N1bWVudCA9IG5vZGUub3duZXJEb2N1bWVudDtcbiAgICAgIHJldHVybiBvd25lckRvY3VtZW50ID8gb3duZXJEb2N1bWVudC5kZWZhdWx0VmlldyB8fCB3aW5kb3cgOiB3aW5kb3c7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBmdW5jdGlvbiBpc0VsZW1lbnQobm9kZSkge1xuICAgIHZhciBPd25FbGVtZW50ID0gZ2V0V2luZG93KG5vZGUpLkVsZW1lbnQ7XG4gICAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiBPd25FbGVtZW50IHx8IG5vZGUgaW5zdGFuY2VvZiBFbGVtZW50O1xuICB9XG5cbiAgZnVuY3Rpb24gaXNIVE1MRWxlbWVudChub2RlKSB7XG4gICAgdmFyIE93bkVsZW1lbnQgPSBnZXRXaW5kb3cobm9kZSkuSFRNTEVsZW1lbnQ7XG4gICAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiBPd25FbGVtZW50IHx8IG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzU2hhZG93Um9vdChub2RlKSB7XG4gICAgLy8gSUUgMTEgaGFzIG5vIFNoYWRvd1Jvb3RcbiAgICBpZiAodHlwZW9mIFNoYWRvd1Jvb3QgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIE93bkVsZW1lbnQgPSBnZXRXaW5kb3cobm9kZSkuU2hhZG93Um9vdDtcbiAgICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIE93bkVsZW1lbnQgfHwgbm9kZSBpbnN0YW5jZW9mIFNoYWRvd1Jvb3Q7XG4gIH1cblxuICAvLyBhbmQgYXBwbGllcyB0aGVtIHRvIHRoZSBIVE1MRWxlbWVudHMgc3VjaCBhcyBwb3BwZXIgYW5kIGFycm93XG5cbiAgZnVuY3Rpb24gYXBwbHlTdHlsZXMoX3JlZikge1xuICAgIHZhciBzdGF0ZSA9IF9yZWYuc3RhdGU7XG4gICAgT2JqZWN0LmtleXMoc3RhdGUuZWxlbWVudHMpLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIHZhciBzdHlsZSA9IHN0YXRlLnN0eWxlc1tuYW1lXSB8fCB7fTtcbiAgICAgIHZhciBhdHRyaWJ1dGVzID0gc3RhdGUuYXR0cmlidXRlc1tuYW1lXSB8fCB7fTtcbiAgICAgIHZhciBlbGVtZW50ID0gc3RhdGUuZWxlbWVudHNbbmFtZV07IC8vIGFycm93IGlzIG9wdGlvbmFsICsgdmlydHVhbCBlbGVtZW50c1xuXG4gICAgICBpZiAoIWlzSFRNTEVsZW1lbnQoZWxlbWVudCkgfHwgIWdldE5vZGVOYW1lKGVsZW1lbnQpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gLy8gRmxvdyBkb2Vzbid0IHN1cHBvcnQgdG8gZXh0ZW5kIHRoaXMgcHJvcGVydHksIGJ1dCBpdCdzIHRoZSBtb3N0XG4gICAgICAvLyBlZmZlY3RpdmUgd2F5IHRvIGFwcGx5IHN0eWxlcyB0byBhbiBIVE1MRWxlbWVudFxuICAgICAgLy8gJEZsb3dGaXhNZVtjYW5ub3Qtd3JpdGVdXG5cblxuICAgICAgT2JqZWN0LmFzc2lnbihlbGVtZW50LnN0eWxlLCBzdHlsZSk7XG4gICAgICBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IGF0dHJpYnV0ZXNbbmFtZV07XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBmYWxzZSkge1xuICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlID09PSB0cnVlID8gJycgOiB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZWZmZWN0JDIoX3JlZjIpIHtcbiAgICB2YXIgc3RhdGUgPSBfcmVmMi5zdGF0ZTtcbiAgICB2YXIgaW5pdGlhbFN0eWxlcyA9IHtcbiAgICAgIHBvcHBlcjoge1xuICAgICAgICBwb3NpdGlvbjogc3RhdGUub3B0aW9ucy5zdHJhdGVneSxcbiAgICAgICAgbGVmdDogJzAnLFxuICAgICAgICB0b3A6ICcwJyxcbiAgICAgICAgbWFyZ2luOiAnMCdcbiAgICAgIH0sXG4gICAgICBhcnJvdzoge1xuICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJ1xuICAgICAgfSxcbiAgICAgIHJlZmVyZW5jZToge31cbiAgICB9O1xuICAgIE9iamVjdC5hc3NpZ24oc3RhdGUuZWxlbWVudHMucG9wcGVyLnN0eWxlLCBpbml0aWFsU3R5bGVzLnBvcHBlcik7XG4gICAgc3RhdGUuc3R5bGVzID0gaW5pdGlhbFN0eWxlcztcblxuICAgIGlmIChzdGF0ZS5lbGVtZW50cy5hcnJvdykge1xuICAgICAgT2JqZWN0LmFzc2lnbihzdGF0ZS5lbGVtZW50cy5hcnJvdy5zdHlsZSwgaW5pdGlhbFN0eWxlcy5hcnJvdyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIE9iamVjdC5rZXlzKHN0YXRlLmVsZW1lbnRzKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHZhciBlbGVtZW50ID0gc3RhdGUuZWxlbWVudHNbbmFtZV07XG4gICAgICAgIHZhciBhdHRyaWJ1dGVzID0gc3RhdGUuYXR0cmlidXRlc1tuYW1lXSB8fCB7fTtcbiAgICAgICAgdmFyIHN0eWxlUHJvcGVydGllcyA9IE9iamVjdC5rZXlzKHN0YXRlLnN0eWxlcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSA/IHN0YXRlLnN0eWxlc1tuYW1lXSA6IGluaXRpYWxTdHlsZXNbbmFtZV0pOyAvLyBTZXQgYWxsIHZhbHVlcyB0byBhbiBlbXB0eSBzdHJpbmcgdG8gdW5zZXQgdGhlbVxuXG4gICAgICAgIHZhciBzdHlsZSA9IHN0eWxlUHJvcGVydGllcy5yZWR1Y2UoZnVuY3Rpb24gKHN0eWxlLCBwcm9wZXJ0eSkge1xuICAgICAgICAgIHN0eWxlW3Byb3BlcnR5XSA9ICcnO1xuICAgICAgICAgIHJldHVybiBzdHlsZTtcbiAgICAgICAgfSwge30pOyAvLyBhcnJvdyBpcyBvcHRpb25hbCArIHZpcnR1YWwgZWxlbWVudHNcblxuICAgICAgICBpZiAoIWlzSFRNTEVsZW1lbnQoZWxlbWVudCkgfHwgIWdldE5vZGVOYW1lKGVsZW1lbnQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgT2JqZWN0LmFzc2lnbihlbGVtZW50LnN0eWxlLCBzdHlsZSk7XG4gICAgICAgIE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZSkge1xuICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKGF0dHJpYnV0ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgaW1wb3J0L25vLXVudXNlZC1tb2R1bGVzXG5cblxuICBjb25zdCBhcHBseVN0eWxlcyQxID0ge1xuICAgIG5hbWU6ICdhcHBseVN0eWxlcycsXG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBwaGFzZTogJ3dyaXRlJyxcbiAgICBmbjogYXBwbHlTdHlsZXMsXG4gICAgZWZmZWN0OiBlZmZlY3QkMixcbiAgICByZXF1aXJlczogWydjb21wdXRlU3R5bGVzJ11cbiAgfTtcblxuICBmdW5jdGlvbiBnZXRCYXNlUGxhY2VtZW50KHBsYWNlbWVudCkge1xuICAgIHJldHVybiBwbGFjZW1lbnQuc3BsaXQoJy0nKVswXTtcbiAgfVxuXG4gIHZhciBtYXggPSBNYXRoLm1heDtcbiAgdmFyIG1pbiA9IE1hdGgubWluO1xuICB2YXIgcm91bmQgPSBNYXRoLnJvdW5kO1xuXG4gIGZ1bmN0aW9uIGdldFVBU3RyaW5nKCkge1xuICAgIHZhciB1YURhdGEgPSBuYXZpZ2F0b3IudXNlckFnZW50RGF0YTtcblxuICAgIGlmICh1YURhdGEgIT0gbnVsbCAmJiB1YURhdGEuYnJhbmRzICYmIEFycmF5LmlzQXJyYXkodWFEYXRhLmJyYW5kcykpIHtcbiAgICAgIHJldHVybiB1YURhdGEuYnJhbmRzLm1hcChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS5icmFuZCArIFwiL1wiICsgaXRlbS52ZXJzaW9uO1xuICAgICAgfSkuam9pbignICcpO1xuICAgIH1cblxuICAgIHJldHVybiBuYXZpZ2F0b3IudXNlckFnZW50O1xuICB9XG5cbiAgZnVuY3Rpb24gaXNMYXlvdXRWaWV3cG9ydCgpIHtcbiAgICByZXR1cm4gIS9eKCg/IWNocm9tZXxhbmRyb2lkKS4pKnNhZmFyaS9pLnRlc3QoZ2V0VUFTdHJpbmcoKSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRCb3VuZGluZ0NsaWVudFJlY3QoZWxlbWVudCwgaW5jbHVkZVNjYWxlLCBpc0ZpeGVkU3RyYXRlZ3kpIHtcbiAgICBpZiAoaW5jbHVkZVNjYWxlID09PSB2b2lkIDApIHtcbiAgICAgIGluY2x1ZGVTY2FsZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChpc0ZpeGVkU3RyYXRlZ3kgPT09IHZvaWQgMCkge1xuICAgICAgaXNGaXhlZFN0cmF0ZWd5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGNsaWVudFJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHZhciBzY2FsZVggPSAxO1xuICAgIHZhciBzY2FsZVkgPSAxO1xuXG4gICAgaWYgKGluY2x1ZGVTY2FsZSAmJiBpc0hUTUxFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICBzY2FsZVggPSBlbGVtZW50Lm9mZnNldFdpZHRoID4gMCA/IHJvdW5kKGNsaWVudFJlY3Qud2lkdGgpIC8gZWxlbWVudC5vZmZzZXRXaWR0aCB8fCAxIDogMTtcbiAgICAgIHNjYWxlWSA9IGVsZW1lbnQub2Zmc2V0SGVpZ2h0ID4gMCA/IHJvdW5kKGNsaWVudFJlY3QuaGVpZ2h0KSAvIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IHx8IDEgOiAxO1xuICAgIH1cblxuICAgIHZhciBfcmVmID0gaXNFbGVtZW50KGVsZW1lbnQpID8gZ2V0V2luZG93KGVsZW1lbnQpIDogd2luZG93LFxuICAgICAgICB2aXN1YWxWaWV3cG9ydCA9IF9yZWYudmlzdWFsVmlld3BvcnQ7XG5cbiAgICB2YXIgYWRkVmlzdWFsT2Zmc2V0cyA9ICFpc0xheW91dFZpZXdwb3J0KCkgJiYgaXNGaXhlZFN0cmF0ZWd5O1xuICAgIHZhciB4ID0gKGNsaWVudFJlY3QubGVmdCArIChhZGRWaXN1YWxPZmZzZXRzICYmIHZpc3VhbFZpZXdwb3J0ID8gdmlzdWFsVmlld3BvcnQub2Zmc2V0TGVmdCA6IDApKSAvIHNjYWxlWDtcbiAgICB2YXIgeSA9IChjbGllbnRSZWN0LnRvcCArIChhZGRWaXN1YWxPZmZzZXRzICYmIHZpc3VhbFZpZXdwb3J0ID8gdmlzdWFsVmlld3BvcnQub2Zmc2V0VG9wIDogMCkpIC8gc2NhbGVZO1xuICAgIHZhciB3aWR0aCA9IGNsaWVudFJlY3Qud2lkdGggLyBzY2FsZVg7XG4gICAgdmFyIGhlaWdodCA9IGNsaWVudFJlY3QuaGVpZ2h0IC8gc2NhbGVZO1xuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogd2lkdGgsXG4gICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgIHRvcDogeSxcbiAgICAgIHJpZ2h0OiB4ICsgd2lkdGgsXG4gICAgICBib3R0b206IHkgKyBoZWlnaHQsXG4gICAgICBsZWZ0OiB4LFxuICAgICAgeDogeCxcbiAgICAgIHk6IHlcbiAgICB9O1xuICB9XG5cbiAgLy8gbWVhbnMgaXQgZG9lc24ndCB0YWtlIGludG8gYWNjb3VudCB0cmFuc2Zvcm1zLlxuXG4gIGZ1bmN0aW9uIGdldExheW91dFJlY3QoZWxlbWVudCkge1xuICAgIHZhciBjbGllbnRSZWN0ID0gZ2V0Qm91bmRpbmdDbGllbnRSZWN0KGVsZW1lbnQpOyAvLyBVc2UgdGhlIGNsaWVudFJlY3Qgc2l6ZXMgaWYgaXQncyBub3QgYmVlbiB0cmFuc2Zvcm1lZC5cbiAgICAvLyBGaXhlcyBodHRwczovL2dpdGh1Yi5jb20vcG9wcGVyanMvcG9wcGVyLWNvcmUvaXNzdWVzLzEyMjNcblxuICAgIHZhciB3aWR0aCA9IGVsZW1lbnQub2Zmc2V0V2lkdGg7XG4gICAgdmFyIGhlaWdodCA9IGVsZW1lbnQub2Zmc2V0SGVpZ2h0O1xuXG4gICAgaWYgKE1hdGguYWJzKGNsaWVudFJlY3Qud2lkdGggLSB3aWR0aCkgPD0gMSkge1xuICAgICAgd2lkdGggPSBjbGllbnRSZWN0LndpZHRoO1xuICAgIH1cblxuICAgIGlmIChNYXRoLmFicyhjbGllbnRSZWN0LmhlaWdodCAtIGhlaWdodCkgPD0gMSkge1xuICAgICAgaGVpZ2h0ID0gY2xpZW50UmVjdC5oZWlnaHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IGVsZW1lbnQub2Zmc2V0TGVmdCxcbiAgICAgIHk6IGVsZW1lbnQub2Zmc2V0VG9wLFxuICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgaGVpZ2h0OiBoZWlnaHRcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gY29udGFpbnMocGFyZW50LCBjaGlsZCkge1xuICAgIHZhciByb290Tm9kZSA9IGNoaWxkLmdldFJvb3ROb2RlICYmIGNoaWxkLmdldFJvb3ROb2RlKCk7IC8vIEZpcnN0LCBhdHRlbXB0IHdpdGggZmFzdGVyIG5hdGl2ZSBtZXRob2RcblxuICAgIGlmIChwYXJlbnQuY29udGFpbnMoY2hpbGQpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IC8vIHRoZW4gZmFsbGJhY2sgdG8gY3VzdG9tIGltcGxlbWVudGF0aW9uIHdpdGggU2hhZG93IERPTSBzdXBwb3J0XG4gICAgZWxzZSBpZiAocm9vdE5vZGUgJiYgaXNTaGFkb3dSb290KHJvb3ROb2RlKSkge1xuICAgICAgICB2YXIgbmV4dCA9IGNoaWxkO1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICBpZiAobmV4dCAmJiBwYXJlbnQuaXNTYW1lTm9kZShuZXh0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfSAvLyAkRmxvd0ZpeE1lW3Byb3AtbWlzc2luZ106IG5lZWQgYSBiZXR0ZXIgd2F5IHRvIGhhbmRsZSB0aGlzLi4uXG5cblxuICAgICAgICAgIG5leHQgPSBuZXh0LnBhcmVudE5vZGUgfHwgbmV4dC5ob3N0O1xuICAgICAgICB9IHdoaWxlIChuZXh0KTtcbiAgICAgIH0gLy8gR2l2ZSB1cCwgdGhlIHJlc3VsdCBpcyBmYWxzZVxuXG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRDb21wdXRlZFN0eWxlJDEoZWxlbWVudCkge1xuICAgIHJldHVybiBnZXRXaW5kb3coZWxlbWVudCkuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzVGFibGVFbGVtZW50KGVsZW1lbnQpIHtcbiAgICByZXR1cm4gWyd0YWJsZScsICd0ZCcsICd0aCddLmluZGV4T2YoZ2V0Tm9kZU5hbWUoZWxlbWVudCkpID49IDA7XG4gIH1cblxuICBmdW5jdGlvbiBnZXREb2N1bWVudEVsZW1lbnQoZWxlbWVudCkge1xuICAgIC8vICRGbG93Rml4TWVbaW5jb21wYXRpYmxlLXJldHVybl06IGFzc3VtZSBib2R5IGlzIGFsd2F5cyBhdmFpbGFibGVcbiAgICByZXR1cm4gKChpc0VsZW1lbnQoZWxlbWVudCkgPyBlbGVtZW50Lm93bmVyRG9jdW1lbnQgOiAvLyAkRmxvd0ZpeE1lW3Byb3AtbWlzc2luZ11cbiAgICBlbGVtZW50LmRvY3VtZW50KSB8fCB3aW5kb3cuZG9jdW1lbnQpLmRvY3VtZW50RWxlbWVudDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFBhcmVudE5vZGUoZWxlbWVudCkge1xuICAgIGlmIChnZXROb2RlTmFtZShlbGVtZW50KSA9PT0gJ2h0bWwnKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG5cbiAgICByZXR1cm4gKC8vIHRoaXMgaXMgYSBxdWlja2VyIChidXQgbGVzcyB0eXBlIHNhZmUpIHdheSB0byBzYXZlIHF1aXRlIHNvbWUgYnl0ZXMgZnJvbSB0aGUgYnVuZGxlXG4gICAgICAvLyAkRmxvd0ZpeE1lW2luY29tcGF0aWJsZS1yZXR1cm5dXG4gICAgICAvLyAkRmxvd0ZpeE1lW3Byb3AtbWlzc2luZ11cbiAgICAgIGVsZW1lbnQuYXNzaWduZWRTbG90IHx8IC8vIHN0ZXAgaW50byB0aGUgc2hhZG93IERPTSBvZiB0aGUgcGFyZW50IG9mIGEgc2xvdHRlZCBub2RlXG4gICAgICBlbGVtZW50LnBhcmVudE5vZGUgfHwgKCAvLyBET00gRWxlbWVudCBkZXRlY3RlZFxuICAgICAgaXNTaGFkb3dSb290KGVsZW1lbnQpID8gZWxlbWVudC5ob3N0IDogbnVsbCkgfHwgLy8gU2hhZG93Um9vdCBkZXRlY3RlZFxuICAgICAgLy8gJEZsb3dGaXhNZVtpbmNvbXBhdGlibGUtY2FsbF06IEhUTUxFbGVtZW50IGlzIGEgTm9kZVxuICAgICAgZ2V0RG9jdW1lbnRFbGVtZW50KGVsZW1lbnQpIC8vIGZhbGxiYWNrXG5cbiAgICApO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0VHJ1ZU9mZnNldFBhcmVudChlbGVtZW50KSB7XG4gICAgaWYgKCFpc0hUTUxFbGVtZW50KGVsZW1lbnQpIHx8IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wb3BwZXJqcy9wb3BwZXItY29yZS9pc3N1ZXMvODM3XG4gICAgZ2V0Q29tcHV0ZWRTdHlsZSQxKGVsZW1lbnQpLnBvc2l0aW9uID09PSAnZml4ZWQnKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gZWxlbWVudC5vZmZzZXRQYXJlbnQ7XG4gIH0gLy8gYC5vZmZzZXRQYXJlbnRgIHJlcG9ydHMgYG51bGxgIGZvciBmaXhlZCBlbGVtZW50cywgd2hpbGUgYWJzb2x1dGUgZWxlbWVudHNcbiAgLy8gcmV0dXJuIHRoZSBjb250YWluaW5nIGJsb2NrXG5cblxuICBmdW5jdGlvbiBnZXRDb250YWluaW5nQmxvY2soZWxlbWVudCkge1xuICAgIHZhciBpc0ZpcmVmb3ggPSAvZmlyZWZveC9pLnRlc3QoZ2V0VUFTdHJpbmcoKSk7XG4gICAgdmFyIGlzSUUgPSAvVHJpZGVudC9pLnRlc3QoZ2V0VUFTdHJpbmcoKSk7XG5cbiAgICBpZiAoaXNJRSAmJiBpc0hUTUxFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICAvLyBJbiBJRSA5LCAxMCBhbmQgMTEgZml4ZWQgZWxlbWVudHMgY29udGFpbmluZyBibG9jayBpcyBhbHdheXMgZXN0YWJsaXNoZWQgYnkgdGhlIHZpZXdwb3J0XG4gICAgICB2YXIgZWxlbWVudENzcyA9IGdldENvbXB1dGVkU3R5bGUkMShlbGVtZW50KTtcblxuICAgICAgaWYgKGVsZW1lbnRDc3MucG9zaXRpb24gPT09ICdmaXhlZCcpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGN1cnJlbnROb2RlID0gZ2V0UGFyZW50Tm9kZShlbGVtZW50KTtcblxuICAgIGlmIChpc1NoYWRvd1Jvb3QoY3VycmVudE5vZGUpKSB7XG4gICAgICBjdXJyZW50Tm9kZSA9IGN1cnJlbnROb2RlLmhvc3Q7XG4gICAgfVxuXG4gICAgd2hpbGUgKGlzSFRNTEVsZW1lbnQoY3VycmVudE5vZGUpICYmIFsnaHRtbCcsICdib2R5J10uaW5kZXhPZihnZXROb2RlTmFtZShjdXJyZW50Tm9kZSkpIDwgMCkge1xuICAgICAgdmFyIGNzcyA9IGdldENvbXB1dGVkU3R5bGUkMShjdXJyZW50Tm9kZSk7IC8vIFRoaXMgaXMgbm9uLWV4aGF1c3RpdmUgYnV0IGNvdmVycyB0aGUgbW9zdCBjb21tb24gQ1NTIHByb3BlcnRpZXMgdGhhdFxuICAgICAgLy8gY3JlYXRlIGEgY29udGFpbmluZyBibG9jay5cbiAgICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0NTUy9Db250YWluaW5nX2Jsb2NrI2lkZW50aWZ5aW5nX3RoZV9jb250YWluaW5nX2Jsb2NrXG5cbiAgICAgIGlmIChjc3MudHJhbnNmb3JtICE9PSAnbm9uZScgfHwgY3NzLnBlcnNwZWN0aXZlICE9PSAnbm9uZScgfHwgY3NzLmNvbnRhaW4gPT09ICdwYWludCcgfHwgWyd0cmFuc2Zvcm0nLCAncGVyc3BlY3RpdmUnXS5pbmRleE9mKGNzcy53aWxsQ2hhbmdlKSAhPT0gLTEgfHwgaXNGaXJlZm94ICYmIGNzcy53aWxsQ2hhbmdlID09PSAnZmlsdGVyJyB8fCBpc0ZpcmVmb3ggJiYgY3NzLmZpbHRlciAmJiBjc3MuZmlsdGVyICE9PSAnbm9uZScpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnROb2RlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3VycmVudE5vZGUgPSBjdXJyZW50Tm9kZS5wYXJlbnROb2RlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9IC8vIEdldHMgdGhlIGNsb3Nlc3QgYW5jZXN0b3IgcG9zaXRpb25lZCBlbGVtZW50LiBIYW5kbGVzIHNvbWUgZWRnZSBjYXNlcyxcbiAgLy8gc3VjaCBhcyB0YWJsZSBhbmNlc3RvcnMgYW5kIGNyb3NzIGJyb3dzZXIgYnVncy5cblxuXG4gIGZ1bmN0aW9uIGdldE9mZnNldFBhcmVudChlbGVtZW50KSB7XG4gICAgdmFyIHdpbmRvdyA9IGdldFdpbmRvdyhlbGVtZW50KTtcbiAgICB2YXIgb2Zmc2V0UGFyZW50ID0gZ2V0VHJ1ZU9mZnNldFBhcmVudChlbGVtZW50KTtcblxuICAgIHdoaWxlIChvZmZzZXRQYXJlbnQgJiYgaXNUYWJsZUVsZW1lbnQob2Zmc2V0UGFyZW50KSAmJiBnZXRDb21wdXRlZFN0eWxlJDEob2Zmc2V0UGFyZW50KS5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIHtcbiAgICAgIG9mZnNldFBhcmVudCA9IGdldFRydWVPZmZzZXRQYXJlbnQob2Zmc2V0UGFyZW50KTtcbiAgICB9XG5cbiAgICBpZiAob2Zmc2V0UGFyZW50ICYmIChnZXROb2RlTmFtZShvZmZzZXRQYXJlbnQpID09PSAnaHRtbCcgfHwgZ2V0Tm9kZU5hbWUob2Zmc2V0UGFyZW50KSA9PT0gJ2JvZHknICYmIGdldENvbXB1dGVkU3R5bGUkMShvZmZzZXRQYXJlbnQpLnBvc2l0aW9uID09PSAnc3RhdGljJykpIHtcbiAgICAgIHJldHVybiB3aW5kb3c7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldFBhcmVudCB8fCBnZXRDb250YWluaW5nQmxvY2soZWxlbWVudCkgfHwgd2luZG93O1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TWFpbkF4aXNGcm9tUGxhY2VtZW50KHBsYWNlbWVudCkge1xuICAgIHJldHVybiBbJ3RvcCcsICdib3R0b20nXS5pbmRleE9mKHBsYWNlbWVudCkgPj0gMCA/ICd4JyA6ICd5JztcbiAgfVxuXG4gIGZ1bmN0aW9uIHdpdGhpbihtaW4kMSwgdmFsdWUsIG1heCQxKSB7XG4gICAgcmV0dXJuIG1heChtaW4kMSwgbWluKHZhbHVlLCBtYXgkMSkpO1xuICB9XG4gIGZ1bmN0aW9uIHdpdGhpbk1heENsYW1wKG1pbiwgdmFsdWUsIG1heCkge1xuICAgIHZhciB2ID0gd2l0aGluKG1pbiwgdmFsdWUsIG1heCk7XG4gICAgcmV0dXJuIHYgPiBtYXggPyBtYXggOiB2O1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0RnJlc2hTaWRlT2JqZWN0KCkge1xuICAgIHJldHVybiB7XG4gICAgICB0b3A6IDAsXG4gICAgICByaWdodDogMCxcbiAgICAgIGJvdHRvbTogMCxcbiAgICAgIGxlZnQ6IDBcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gbWVyZ2VQYWRkaW5nT2JqZWN0KHBhZGRpbmdPYmplY3QpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgZ2V0RnJlc2hTaWRlT2JqZWN0KCksIHBhZGRpbmdPYmplY3QpO1xuICB9XG5cbiAgZnVuY3Rpb24gZXhwYW5kVG9IYXNoTWFwKHZhbHVlLCBrZXlzKSB7XG4gICAgcmV0dXJuIGtleXMucmVkdWNlKGZ1bmN0aW9uIChoYXNoTWFwLCBrZXkpIHtcbiAgICAgIGhhc2hNYXBba2V5XSA9IHZhbHVlO1xuICAgICAgcmV0dXJuIGhhc2hNYXA7XG4gICAgfSwge30pO1xuICB9XG5cbiAgdmFyIHRvUGFkZGluZ09iamVjdCA9IGZ1bmN0aW9uIHRvUGFkZGluZ09iamVjdChwYWRkaW5nLCBzdGF0ZSkge1xuICAgIHBhZGRpbmcgPSB0eXBlb2YgcGFkZGluZyA9PT0gJ2Z1bmN0aW9uJyA/IHBhZGRpbmcoT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUucmVjdHMsIHtcbiAgICAgIHBsYWNlbWVudDogc3RhdGUucGxhY2VtZW50XG4gICAgfSkpIDogcGFkZGluZztcbiAgICByZXR1cm4gbWVyZ2VQYWRkaW5nT2JqZWN0KHR5cGVvZiBwYWRkaW5nICE9PSAnbnVtYmVyJyA/IHBhZGRpbmcgOiBleHBhbmRUb0hhc2hNYXAocGFkZGluZywgYmFzZVBsYWNlbWVudHMpKTtcbiAgfTtcblxuICBmdW5jdGlvbiBhcnJvdyhfcmVmKSB7XG4gICAgdmFyIF9zdGF0ZSRtb2RpZmllcnNEYXRhJDtcblxuICAgIHZhciBzdGF0ZSA9IF9yZWYuc3RhdGUsXG4gICAgICAgIG5hbWUgPSBfcmVmLm5hbWUsXG4gICAgICAgIG9wdGlvbnMgPSBfcmVmLm9wdGlvbnM7XG4gICAgdmFyIGFycm93RWxlbWVudCA9IHN0YXRlLmVsZW1lbnRzLmFycm93O1xuICAgIHZhciBwb3BwZXJPZmZzZXRzID0gc3RhdGUubW9kaWZpZXJzRGF0YS5wb3BwZXJPZmZzZXRzO1xuICAgIHZhciBiYXNlUGxhY2VtZW50ID0gZ2V0QmFzZVBsYWNlbWVudChzdGF0ZS5wbGFjZW1lbnQpO1xuICAgIHZhciBheGlzID0gZ2V0TWFpbkF4aXNGcm9tUGxhY2VtZW50KGJhc2VQbGFjZW1lbnQpO1xuICAgIHZhciBpc1ZlcnRpY2FsID0gW2xlZnQsIHJpZ2h0XS5pbmRleE9mKGJhc2VQbGFjZW1lbnQpID49IDA7XG4gICAgdmFyIGxlbiA9IGlzVmVydGljYWwgPyAnaGVpZ2h0JyA6ICd3aWR0aCc7XG5cbiAgICBpZiAoIWFycm93RWxlbWVudCB8fCAhcG9wcGVyT2Zmc2V0cykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBwYWRkaW5nT2JqZWN0ID0gdG9QYWRkaW5nT2JqZWN0KG9wdGlvbnMucGFkZGluZywgc3RhdGUpO1xuICAgIHZhciBhcnJvd1JlY3QgPSBnZXRMYXlvdXRSZWN0KGFycm93RWxlbWVudCk7XG4gICAgdmFyIG1pblByb3AgPSBheGlzID09PSAneScgPyB0b3AgOiBsZWZ0O1xuICAgIHZhciBtYXhQcm9wID0gYXhpcyA9PT0gJ3knID8gYm90dG9tIDogcmlnaHQ7XG4gICAgdmFyIGVuZERpZmYgPSBzdGF0ZS5yZWN0cy5yZWZlcmVuY2VbbGVuXSArIHN0YXRlLnJlY3RzLnJlZmVyZW5jZVtheGlzXSAtIHBvcHBlck9mZnNldHNbYXhpc10gLSBzdGF0ZS5yZWN0cy5wb3BwZXJbbGVuXTtcbiAgICB2YXIgc3RhcnREaWZmID0gcG9wcGVyT2Zmc2V0c1theGlzXSAtIHN0YXRlLnJlY3RzLnJlZmVyZW5jZVtheGlzXTtcbiAgICB2YXIgYXJyb3dPZmZzZXRQYXJlbnQgPSBnZXRPZmZzZXRQYXJlbnQoYXJyb3dFbGVtZW50KTtcbiAgICB2YXIgY2xpZW50U2l6ZSA9IGFycm93T2Zmc2V0UGFyZW50ID8gYXhpcyA9PT0gJ3knID8gYXJyb3dPZmZzZXRQYXJlbnQuY2xpZW50SGVpZ2h0IHx8IDAgOiBhcnJvd09mZnNldFBhcmVudC5jbGllbnRXaWR0aCB8fCAwIDogMDtcbiAgICB2YXIgY2VudGVyVG9SZWZlcmVuY2UgPSBlbmREaWZmIC8gMiAtIHN0YXJ0RGlmZiAvIDI7IC8vIE1ha2Ugc3VyZSB0aGUgYXJyb3cgZG9lc24ndCBvdmVyZmxvdyB0aGUgcG9wcGVyIGlmIHRoZSBjZW50ZXIgcG9pbnQgaXNcbiAgICAvLyBvdXRzaWRlIG9mIHRoZSBwb3BwZXIgYm91bmRzXG5cbiAgICB2YXIgbWluID0gcGFkZGluZ09iamVjdFttaW5Qcm9wXTtcbiAgICB2YXIgbWF4ID0gY2xpZW50U2l6ZSAtIGFycm93UmVjdFtsZW5dIC0gcGFkZGluZ09iamVjdFttYXhQcm9wXTtcbiAgICB2YXIgY2VudGVyID0gY2xpZW50U2l6ZSAvIDIgLSBhcnJvd1JlY3RbbGVuXSAvIDIgKyBjZW50ZXJUb1JlZmVyZW5jZTtcbiAgICB2YXIgb2Zmc2V0ID0gd2l0aGluKG1pbiwgY2VudGVyLCBtYXgpOyAvLyBQcmV2ZW50cyBicmVha2luZyBzeW50YXggaGlnaGxpZ2h0aW5nLi4uXG5cbiAgICB2YXIgYXhpc1Byb3AgPSBheGlzO1xuICAgIHN0YXRlLm1vZGlmaWVyc0RhdGFbbmFtZV0gPSAoX3N0YXRlJG1vZGlmaWVyc0RhdGEkID0ge30sIF9zdGF0ZSRtb2RpZmllcnNEYXRhJFtheGlzUHJvcF0gPSBvZmZzZXQsIF9zdGF0ZSRtb2RpZmllcnNEYXRhJC5jZW50ZXJPZmZzZXQgPSBvZmZzZXQgLSBjZW50ZXIsIF9zdGF0ZSRtb2RpZmllcnNEYXRhJCk7XG4gIH1cblxuICBmdW5jdGlvbiBlZmZlY3QkMShfcmVmMikge1xuICAgIHZhciBzdGF0ZSA9IF9yZWYyLnN0YXRlLFxuICAgICAgICBvcHRpb25zID0gX3JlZjIub3B0aW9ucztcbiAgICB2YXIgX29wdGlvbnMkZWxlbWVudCA9IG9wdGlvbnMuZWxlbWVudCxcbiAgICAgICAgYXJyb3dFbGVtZW50ID0gX29wdGlvbnMkZWxlbWVudCA9PT0gdm9pZCAwID8gJ1tkYXRhLXBvcHBlci1hcnJvd10nIDogX29wdGlvbnMkZWxlbWVudDtcblxuICAgIGlmIChhcnJvd0VsZW1lbnQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH0gLy8gQ1NTIHNlbGVjdG9yXG5cblxuICAgIGlmICh0eXBlb2YgYXJyb3dFbGVtZW50ID09PSAnc3RyaW5nJykge1xuICAgICAgYXJyb3dFbGVtZW50ID0gc3RhdGUuZWxlbWVudHMucG9wcGVyLnF1ZXJ5U2VsZWN0b3IoYXJyb3dFbGVtZW50KTtcblxuICAgICAgaWYgKCFhcnJvd0VsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghY29udGFpbnMoc3RhdGUuZWxlbWVudHMucG9wcGVyLCBhcnJvd0VsZW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc3RhdGUuZWxlbWVudHMuYXJyb3cgPSBhcnJvd0VsZW1lbnQ7XG4gIH0gLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby11bnVzZWQtbW9kdWxlc1xuXG5cbiAgY29uc3QgYXJyb3ckMSA9IHtcbiAgICBuYW1lOiAnYXJyb3cnLFxuICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgcGhhc2U6ICdtYWluJyxcbiAgICBmbjogYXJyb3csXG4gICAgZWZmZWN0OiBlZmZlY3QkMSxcbiAgICByZXF1aXJlczogWydwb3BwZXJPZmZzZXRzJ10sXG4gICAgcmVxdWlyZXNJZkV4aXN0czogWydwcmV2ZW50T3ZlcmZsb3cnXVxuICB9O1xuXG4gIGZ1bmN0aW9uIGdldFZhcmlhdGlvbihwbGFjZW1lbnQpIHtcbiAgICByZXR1cm4gcGxhY2VtZW50LnNwbGl0KCctJylbMV07XG4gIH1cblxuICB2YXIgdW5zZXRTaWRlcyA9IHtcbiAgICB0b3A6ICdhdXRvJyxcbiAgICByaWdodDogJ2F1dG8nLFxuICAgIGJvdHRvbTogJ2F1dG8nLFxuICAgIGxlZnQ6ICdhdXRvJ1xuICB9OyAvLyBSb3VuZCB0aGUgb2Zmc2V0cyB0byB0aGUgbmVhcmVzdCBzdWl0YWJsZSBzdWJwaXhlbCBiYXNlZCBvbiB0aGUgRFBSLlxuICAvLyBab29taW5nIGNhbiBjaGFuZ2UgdGhlIERQUiwgYnV0IGl0IHNlZW1zIHRvIHJlcG9ydCBhIHZhbHVlIHRoYXQgd2lsbFxuICAvLyBjbGVhbmx5IGRpdmlkZSB0aGUgdmFsdWVzIGludG8gdGhlIGFwcHJvcHJpYXRlIHN1YnBpeGVscy5cblxuICBmdW5jdGlvbiByb3VuZE9mZnNldHNCeURQUihfcmVmLCB3aW4pIHtcbiAgICB2YXIgeCA9IF9yZWYueCxcbiAgICAgICAgeSA9IF9yZWYueTtcbiAgICB2YXIgZHByID0gd2luLmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICByZXR1cm4ge1xuICAgICAgeDogcm91bmQoeCAqIGRwcikgLyBkcHIgfHwgMCxcbiAgICAgIHk6IHJvdW5kKHkgKiBkcHIpIC8gZHByIHx8IDBcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gbWFwVG9TdHlsZXMoX3JlZjIpIHtcbiAgICB2YXIgX09iamVjdCRhc3NpZ24yO1xuXG4gICAgdmFyIHBvcHBlciA9IF9yZWYyLnBvcHBlcixcbiAgICAgICAgcG9wcGVyUmVjdCA9IF9yZWYyLnBvcHBlclJlY3QsXG4gICAgICAgIHBsYWNlbWVudCA9IF9yZWYyLnBsYWNlbWVudCxcbiAgICAgICAgdmFyaWF0aW9uID0gX3JlZjIudmFyaWF0aW9uLFxuICAgICAgICBvZmZzZXRzID0gX3JlZjIub2Zmc2V0cyxcbiAgICAgICAgcG9zaXRpb24gPSBfcmVmMi5wb3NpdGlvbixcbiAgICAgICAgZ3B1QWNjZWxlcmF0aW9uID0gX3JlZjIuZ3B1QWNjZWxlcmF0aW9uLFxuICAgICAgICBhZGFwdGl2ZSA9IF9yZWYyLmFkYXB0aXZlLFxuICAgICAgICByb3VuZE9mZnNldHMgPSBfcmVmMi5yb3VuZE9mZnNldHMsXG4gICAgICAgIGlzRml4ZWQgPSBfcmVmMi5pc0ZpeGVkO1xuICAgIHZhciBfb2Zmc2V0cyR4ID0gb2Zmc2V0cy54LFxuICAgICAgICB4ID0gX29mZnNldHMkeCA9PT0gdm9pZCAwID8gMCA6IF9vZmZzZXRzJHgsXG4gICAgICAgIF9vZmZzZXRzJHkgPSBvZmZzZXRzLnksXG4gICAgICAgIHkgPSBfb2Zmc2V0cyR5ID09PSB2b2lkIDAgPyAwIDogX29mZnNldHMkeTtcblxuICAgIHZhciBfcmVmMyA9IHR5cGVvZiByb3VuZE9mZnNldHMgPT09ICdmdW5jdGlvbicgPyByb3VuZE9mZnNldHMoe1xuICAgICAgeDogeCxcbiAgICAgIHk6IHlcbiAgICB9KSA6IHtcbiAgICAgIHg6IHgsXG4gICAgICB5OiB5XG4gICAgfTtcblxuICAgIHggPSBfcmVmMy54O1xuICAgIHkgPSBfcmVmMy55O1xuICAgIHZhciBoYXNYID0gb2Zmc2V0cy5oYXNPd25Qcm9wZXJ0eSgneCcpO1xuICAgIHZhciBoYXNZID0gb2Zmc2V0cy5oYXNPd25Qcm9wZXJ0eSgneScpO1xuICAgIHZhciBzaWRlWCA9IGxlZnQ7XG4gICAgdmFyIHNpZGVZID0gdG9wO1xuICAgIHZhciB3aW4gPSB3aW5kb3c7XG5cbiAgICBpZiAoYWRhcHRpdmUpIHtcbiAgICAgIHZhciBvZmZzZXRQYXJlbnQgPSBnZXRPZmZzZXRQYXJlbnQocG9wcGVyKTtcbiAgICAgIHZhciBoZWlnaHRQcm9wID0gJ2NsaWVudEhlaWdodCc7XG4gICAgICB2YXIgd2lkdGhQcm9wID0gJ2NsaWVudFdpZHRoJztcblxuICAgICAgaWYgKG9mZnNldFBhcmVudCA9PT0gZ2V0V2luZG93KHBvcHBlcikpIHtcbiAgICAgICAgb2Zmc2V0UGFyZW50ID0gZ2V0RG9jdW1lbnRFbGVtZW50KHBvcHBlcik7XG5cbiAgICAgICAgaWYgKGdldENvbXB1dGVkU3R5bGUkMShvZmZzZXRQYXJlbnQpLnBvc2l0aW9uICE9PSAnc3RhdGljJyAmJiBwb3NpdGlvbiA9PT0gJ2Fic29sdXRlJykge1xuICAgICAgICAgIGhlaWdodFByb3AgPSAnc2Nyb2xsSGVpZ2h0JztcbiAgICAgICAgICB3aWR0aFByb3AgPSAnc2Nyb2xsV2lkdGgnO1xuICAgICAgICB9XG4gICAgICB9IC8vICRGbG93Rml4TWVbaW5jb21wYXRpYmxlLWNhc3RdOiBmb3JjZSB0eXBlIHJlZmluZW1lbnQsIHdlIGNvbXBhcmUgb2Zmc2V0UGFyZW50IHdpdGggd2luZG93IGFib3ZlLCBidXQgRmxvdyBkb2Vzbid0IGRldGVjdCBpdFxuXG5cbiAgICAgIG9mZnNldFBhcmVudCA9IG9mZnNldFBhcmVudDtcblxuICAgICAgaWYgKHBsYWNlbWVudCA9PT0gdG9wIHx8IChwbGFjZW1lbnQgPT09IGxlZnQgfHwgcGxhY2VtZW50ID09PSByaWdodCkgJiYgdmFyaWF0aW9uID09PSBlbmQpIHtcbiAgICAgICAgc2lkZVkgPSBib3R0b207XG4gICAgICAgIHZhciBvZmZzZXRZID0gaXNGaXhlZCAmJiBvZmZzZXRQYXJlbnQgPT09IHdpbiAmJiB3aW4udmlzdWFsVmlld3BvcnQgPyB3aW4udmlzdWFsVmlld3BvcnQuaGVpZ2h0IDogLy8gJEZsb3dGaXhNZVtwcm9wLW1pc3NpbmddXG4gICAgICAgIG9mZnNldFBhcmVudFtoZWlnaHRQcm9wXTtcbiAgICAgICAgeSAtPSBvZmZzZXRZIC0gcG9wcGVyUmVjdC5oZWlnaHQ7XG4gICAgICAgIHkgKj0gZ3B1QWNjZWxlcmF0aW9uID8gMSA6IC0xO1xuICAgICAgfVxuXG4gICAgICBpZiAocGxhY2VtZW50ID09PSBsZWZ0IHx8IChwbGFjZW1lbnQgPT09IHRvcCB8fCBwbGFjZW1lbnQgPT09IGJvdHRvbSkgJiYgdmFyaWF0aW9uID09PSBlbmQpIHtcbiAgICAgICAgc2lkZVggPSByaWdodDtcbiAgICAgICAgdmFyIG9mZnNldFggPSBpc0ZpeGVkICYmIG9mZnNldFBhcmVudCA9PT0gd2luICYmIHdpbi52aXN1YWxWaWV3cG9ydCA/IHdpbi52aXN1YWxWaWV3cG9ydC53aWR0aCA6IC8vICRGbG93Rml4TWVbcHJvcC1taXNzaW5nXVxuICAgICAgICBvZmZzZXRQYXJlbnRbd2lkdGhQcm9wXTtcbiAgICAgICAgeCAtPSBvZmZzZXRYIC0gcG9wcGVyUmVjdC53aWR0aDtcbiAgICAgICAgeCAqPSBncHVBY2NlbGVyYXRpb24gPyAxIDogLTE7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGNvbW1vblN0eWxlcyA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgcG9zaXRpb246IHBvc2l0aW9uXG4gICAgfSwgYWRhcHRpdmUgJiYgdW5zZXRTaWRlcyk7XG5cbiAgICB2YXIgX3JlZjQgPSByb3VuZE9mZnNldHMgPT09IHRydWUgPyByb3VuZE9mZnNldHNCeURQUih7XG4gICAgICB4OiB4LFxuICAgICAgeTogeVxuICAgIH0sIGdldFdpbmRvdyhwb3BwZXIpKSA6IHtcbiAgICAgIHg6IHgsXG4gICAgICB5OiB5XG4gICAgfTtcblxuICAgIHggPSBfcmVmNC54O1xuICAgIHkgPSBfcmVmNC55O1xuXG4gICAgaWYgKGdwdUFjY2VsZXJhdGlvbikge1xuICAgICAgdmFyIF9PYmplY3QkYXNzaWduO1xuXG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgY29tbW9uU3R5bGVzLCAoX09iamVjdCRhc3NpZ24gPSB7fSwgX09iamVjdCRhc3NpZ25bc2lkZVldID0gaGFzWSA/ICcwJyA6ICcnLCBfT2JqZWN0JGFzc2lnbltzaWRlWF0gPSBoYXNYID8gJzAnIDogJycsIF9PYmplY3QkYXNzaWduLnRyYW5zZm9ybSA9ICh3aW4uZGV2aWNlUGl4ZWxSYXRpbyB8fCAxKSA8PSAxID8gXCJ0cmFuc2xhdGUoXCIgKyB4ICsgXCJweCwgXCIgKyB5ICsgXCJweClcIiA6IFwidHJhbnNsYXRlM2QoXCIgKyB4ICsgXCJweCwgXCIgKyB5ICsgXCJweCwgMClcIiwgX09iamVjdCRhc3NpZ24pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgY29tbW9uU3R5bGVzLCAoX09iamVjdCRhc3NpZ24yID0ge30sIF9PYmplY3QkYXNzaWduMltzaWRlWV0gPSBoYXNZID8geSArIFwicHhcIiA6ICcnLCBfT2JqZWN0JGFzc2lnbjJbc2lkZVhdID0gaGFzWCA/IHggKyBcInB4XCIgOiAnJywgX09iamVjdCRhc3NpZ24yLnRyYW5zZm9ybSA9ICcnLCBfT2JqZWN0JGFzc2lnbjIpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbXB1dGVTdHlsZXMoX3JlZjUpIHtcbiAgICB2YXIgc3RhdGUgPSBfcmVmNS5zdGF0ZSxcbiAgICAgICAgb3B0aW9ucyA9IF9yZWY1Lm9wdGlvbnM7XG4gICAgdmFyIF9vcHRpb25zJGdwdUFjY2VsZXJhdCA9IG9wdGlvbnMuZ3B1QWNjZWxlcmF0aW9uLFxuICAgICAgICBncHVBY2NlbGVyYXRpb24gPSBfb3B0aW9ucyRncHVBY2NlbGVyYXQgPT09IHZvaWQgMCA/IHRydWUgOiBfb3B0aW9ucyRncHVBY2NlbGVyYXQsXG4gICAgICAgIF9vcHRpb25zJGFkYXB0aXZlID0gb3B0aW9ucy5hZGFwdGl2ZSxcbiAgICAgICAgYWRhcHRpdmUgPSBfb3B0aW9ucyRhZGFwdGl2ZSA9PT0gdm9pZCAwID8gdHJ1ZSA6IF9vcHRpb25zJGFkYXB0aXZlLFxuICAgICAgICBfb3B0aW9ucyRyb3VuZE9mZnNldHMgPSBvcHRpb25zLnJvdW5kT2Zmc2V0cyxcbiAgICAgICAgcm91bmRPZmZzZXRzID0gX29wdGlvbnMkcm91bmRPZmZzZXRzID09PSB2b2lkIDAgPyB0cnVlIDogX29wdGlvbnMkcm91bmRPZmZzZXRzO1xuICAgIHZhciBjb21tb25TdHlsZXMgPSB7XG4gICAgICBwbGFjZW1lbnQ6IGdldEJhc2VQbGFjZW1lbnQoc3RhdGUucGxhY2VtZW50KSxcbiAgICAgIHZhcmlhdGlvbjogZ2V0VmFyaWF0aW9uKHN0YXRlLnBsYWNlbWVudCksXG4gICAgICBwb3BwZXI6IHN0YXRlLmVsZW1lbnRzLnBvcHBlcixcbiAgICAgIHBvcHBlclJlY3Q6IHN0YXRlLnJlY3RzLnBvcHBlcixcbiAgICAgIGdwdUFjY2VsZXJhdGlvbjogZ3B1QWNjZWxlcmF0aW9uLFxuICAgICAgaXNGaXhlZDogc3RhdGUub3B0aW9ucy5zdHJhdGVneSA9PT0gJ2ZpeGVkJ1xuICAgIH07XG5cbiAgICBpZiAoc3RhdGUubW9kaWZpZXJzRGF0YS5wb3BwZXJPZmZzZXRzICE9IG51bGwpIHtcbiAgICAgIHN0YXRlLnN0eWxlcy5wb3BwZXIgPSBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZS5zdHlsZXMucG9wcGVyLCBtYXBUb1N0eWxlcyhPYmplY3QuYXNzaWduKHt9LCBjb21tb25TdHlsZXMsIHtcbiAgICAgICAgb2Zmc2V0czogc3RhdGUubW9kaWZpZXJzRGF0YS5wb3BwZXJPZmZzZXRzLFxuICAgICAgICBwb3NpdGlvbjogc3RhdGUub3B0aW9ucy5zdHJhdGVneSxcbiAgICAgICAgYWRhcHRpdmU6IGFkYXB0aXZlLFxuICAgICAgICByb3VuZE9mZnNldHM6IHJvdW5kT2Zmc2V0c1xuICAgICAgfSkpKTtcbiAgICB9XG5cbiAgICBpZiAoc3RhdGUubW9kaWZpZXJzRGF0YS5hcnJvdyAhPSBudWxsKSB7XG4gICAgICBzdGF0ZS5zdHlsZXMuYXJyb3cgPSBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZS5zdHlsZXMuYXJyb3csIG1hcFRvU3R5bGVzKE9iamVjdC5hc3NpZ24oe30sIGNvbW1vblN0eWxlcywge1xuICAgICAgICBvZmZzZXRzOiBzdGF0ZS5tb2RpZmllcnNEYXRhLmFycm93LFxuICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcbiAgICAgICAgYWRhcHRpdmU6IGZhbHNlLFxuICAgICAgICByb3VuZE9mZnNldHM6IHJvdW5kT2Zmc2V0c1xuICAgICAgfSkpKTtcbiAgICB9XG5cbiAgICBzdGF0ZS5hdHRyaWJ1dGVzLnBvcHBlciA9IE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLmF0dHJpYnV0ZXMucG9wcGVyLCB7XG4gICAgICAnZGF0YS1wb3BwZXItcGxhY2VtZW50Jzogc3RhdGUucGxhY2VtZW50XG4gICAgfSk7XG4gIH0gLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby11bnVzZWQtbW9kdWxlc1xuXG5cbiAgY29uc3QgY29tcHV0ZVN0eWxlcyQxID0ge1xuICAgIG5hbWU6ICdjb21wdXRlU3R5bGVzJyxcbiAgICBlbmFibGVkOiB0cnVlLFxuICAgIHBoYXNlOiAnYmVmb3JlV3JpdGUnLFxuICAgIGZuOiBjb21wdXRlU3R5bGVzLFxuICAgIGRhdGE6IHt9XG4gIH07XG5cbiAgdmFyIHBhc3NpdmUgPSB7XG4gICAgcGFzc2l2ZTogdHJ1ZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGVmZmVjdChfcmVmKSB7XG4gICAgdmFyIHN0YXRlID0gX3JlZi5zdGF0ZSxcbiAgICAgICAgaW5zdGFuY2UgPSBfcmVmLmluc3RhbmNlLFxuICAgICAgICBvcHRpb25zID0gX3JlZi5vcHRpb25zO1xuICAgIHZhciBfb3B0aW9ucyRzY3JvbGwgPSBvcHRpb25zLnNjcm9sbCxcbiAgICAgICAgc2Nyb2xsID0gX29wdGlvbnMkc2Nyb2xsID09PSB2b2lkIDAgPyB0cnVlIDogX29wdGlvbnMkc2Nyb2xsLFxuICAgICAgICBfb3B0aW9ucyRyZXNpemUgPSBvcHRpb25zLnJlc2l6ZSxcbiAgICAgICAgcmVzaXplID0gX29wdGlvbnMkcmVzaXplID09PSB2b2lkIDAgPyB0cnVlIDogX29wdGlvbnMkcmVzaXplO1xuICAgIHZhciB3aW5kb3cgPSBnZXRXaW5kb3coc3RhdGUuZWxlbWVudHMucG9wcGVyKTtcbiAgICB2YXIgc2Nyb2xsUGFyZW50cyA9IFtdLmNvbmNhdChzdGF0ZS5zY3JvbGxQYXJlbnRzLnJlZmVyZW5jZSwgc3RhdGUuc2Nyb2xsUGFyZW50cy5wb3BwZXIpO1xuXG4gICAgaWYgKHNjcm9sbCkge1xuICAgICAgc2Nyb2xsUGFyZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChzY3JvbGxQYXJlbnQpIHtcbiAgICAgICAgc2Nyb2xsUGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIGluc3RhbmNlLnVwZGF0ZSwgcGFzc2l2ZSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAocmVzaXplKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgaW5zdGFuY2UudXBkYXRlLCBwYXNzaXZlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNjcm9sbCkge1xuICAgICAgICBzY3JvbGxQYXJlbnRzLmZvckVhY2goZnVuY3Rpb24gKHNjcm9sbFBhcmVudCkge1xuICAgICAgICAgIHNjcm9sbFBhcmVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdzY3JvbGwnLCBpbnN0YW5jZS51cGRhdGUsIHBhc3NpdmUpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc2l6ZSkge1xuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncmVzaXplJywgaW5zdGFuY2UudXBkYXRlLCBwYXNzaXZlKTtcbiAgICAgIH1cbiAgICB9O1xuICB9IC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tdW51c2VkLW1vZHVsZXNcblxuXG4gIGNvbnN0IGV2ZW50TGlzdGVuZXJzID0ge1xuICAgIG5hbWU6ICdldmVudExpc3RlbmVycycsXG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBwaGFzZTogJ3dyaXRlJyxcbiAgICBmbjogZnVuY3Rpb24gZm4oKSB7fSxcbiAgICBlZmZlY3Q6IGVmZmVjdCxcbiAgICBkYXRhOiB7fVxuICB9O1xuXG4gIHZhciBoYXNoJDEgPSB7XG4gICAgbGVmdDogJ3JpZ2h0JyxcbiAgICByaWdodDogJ2xlZnQnLFxuICAgIGJvdHRvbTogJ3RvcCcsXG4gICAgdG9wOiAnYm90dG9tJ1xuICB9O1xuICBmdW5jdGlvbiBnZXRPcHBvc2l0ZVBsYWNlbWVudChwbGFjZW1lbnQpIHtcbiAgICByZXR1cm4gcGxhY2VtZW50LnJlcGxhY2UoL2xlZnR8cmlnaHR8Ym90dG9tfHRvcC9nLCBmdW5jdGlvbiAobWF0Y2hlZCkge1xuICAgICAgcmV0dXJuIGhhc2gkMVttYXRjaGVkXTtcbiAgICB9KTtcbiAgfVxuXG4gIHZhciBoYXNoID0ge1xuICAgIHN0YXJ0OiAnZW5kJyxcbiAgICBlbmQ6ICdzdGFydCdcbiAgfTtcbiAgZnVuY3Rpb24gZ2V0T3Bwb3NpdGVWYXJpYXRpb25QbGFjZW1lbnQocGxhY2VtZW50KSB7XG4gICAgcmV0dXJuIHBsYWNlbWVudC5yZXBsYWNlKC9zdGFydHxlbmQvZywgZnVuY3Rpb24gKG1hdGNoZWQpIHtcbiAgICAgIHJldHVybiBoYXNoW21hdGNoZWRdO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0V2luZG93U2Nyb2xsKG5vZGUpIHtcbiAgICB2YXIgd2luID0gZ2V0V2luZG93KG5vZGUpO1xuICAgIHZhciBzY3JvbGxMZWZ0ID0gd2luLnBhZ2VYT2Zmc2V0O1xuICAgIHZhciBzY3JvbGxUb3AgPSB3aW4ucGFnZVlPZmZzZXQ7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNjcm9sbExlZnQ6IHNjcm9sbExlZnQsXG4gICAgICBzY3JvbGxUb3A6IHNjcm9sbFRvcFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBnZXRXaW5kb3dTY3JvbGxCYXJYKGVsZW1lbnQpIHtcbiAgICAvLyBJZiA8aHRtbD4gaGFzIGEgQ1NTIHdpZHRoIGdyZWF0ZXIgdGhhbiB0aGUgdmlld3BvcnQsIHRoZW4gdGhpcyB3aWxsIGJlXG4gICAgLy8gaW5jb3JyZWN0IGZvciBSVEwuXG4gICAgLy8gUG9wcGVyIDEgaXMgYnJva2VuIGluIHRoaXMgY2FzZSBhbmQgbmV2ZXIgaGFkIGEgYnVnIHJlcG9ydCBzbyBsZXQncyBhc3N1bWVcbiAgICAvLyBpdCdzIG5vdCBhbiBpc3N1ZS4gSSBkb24ndCB0aGluayBhbnlvbmUgZXZlciBzcGVjaWZpZXMgd2lkdGggb24gPGh0bWw+XG4gICAgLy8gYW55d2F5LlxuICAgIC8vIEJyb3dzZXJzIHdoZXJlIHRoZSBsZWZ0IHNjcm9sbGJhciBkb2Vzbid0IGNhdXNlIGFuIGlzc3VlIHJlcG9ydCBgMGAgZm9yXG4gICAgLy8gdGhpcyAoZS5nLiBFZGdlIDIwMTksIElFMTEsIFNhZmFyaSlcbiAgICByZXR1cm4gZ2V0Qm91bmRpbmdDbGllbnRSZWN0KGdldERvY3VtZW50RWxlbWVudChlbGVtZW50KSkubGVmdCArIGdldFdpbmRvd1Njcm9sbChlbGVtZW50KS5zY3JvbGxMZWZ0O1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0Vmlld3BvcnRSZWN0KGVsZW1lbnQsIHN0cmF0ZWd5KSB7XG4gICAgdmFyIHdpbiA9IGdldFdpbmRvdyhlbGVtZW50KTtcbiAgICB2YXIgaHRtbCA9IGdldERvY3VtZW50RWxlbWVudChlbGVtZW50KTtcbiAgICB2YXIgdmlzdWFsVmlld3BvcnQgPSB3aW4udmlzdWFsVmlld3BvcnQ7XG4gICAgdmFyIHdpZHRoID0gaHRtbC5jbGllbnRXaWR0aDtcbiAgICB2YXIgaGVpZ2h0ID0gaHRtbC5jbGllbnRIZWlnaHQ7XG4gICAgdmFyIHggPSAwO1xuICAgIHZhciB5ID0gMDtcblxuICAgIGlmICh2aXN1YWxWaWV3cG9ydCkge1xuICAgICAgd2lkdGggPSB2aXN1YWxWaWV3cG9ydC53aWR0aDtcbiAgICAgIGhlaWdodCA9IHZpc3VhbFZpZXdwb3J0LmhlaWdodDtcbiAgICAgIHZhciBsYXlvdXRWaWV3cG9ydCA9IGlzTGF5b3V0Vmlld3BvcnQoKTtcblxuICAgICAgaWYgKGxheW91dFZpZXdwb3J0IHx8ICFsYXlvdXRWaWV3cG9ydCAmJiBzdHJhdGVneSA9PT0gJ2ZpeGVkJykge1xuICAgICAgICB4ID0gdmlzdWFsVmlld3BvcnQub2Zmc2V0TGVmdDtcbiAgICAgICAgeSA9IHZpc3VhbFZpZXdwb3J0Lm9mZnNldFRvcDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICB4OiB4ICsgZ2V0V2luZG93U2Nyb2xsQmFyWChlbGVtZW50KSxcbiAgICAgIHk6IHlcbiAgICB9O1xuICB9XG5cbiAgLy8gb2YgdGhlIGA8aHRtbD5gIGFuZCBgPGJvZHk+YCByZWN0IGJvdW5kcyBpZiBob3Jpem9udGFsbHkgc2Nyb2xsYWJsZVxuXG4gIGZ1bmN0aW9uIGdldERvY3VtZW50UmVjdChlbGVtZW50KSB7XG4gICAgdmFyIF9lbGVtZW50JG93bmVyRG9jdW1lbjtcblxuICAgIHZhciBodG1sID0gZ2V0RG9jdW1lbnRFbGVtZW50KGVsZW1lbnQpO1xuICAgIHZhciB3aW5TY3JvbGwgPSBnZXRXaW5kb3dTY3JvbGwoZWxlbWVudCk7XG4gICAgdmFyIGJvZHkgPSAoX2VsZW1lbnQkb3duZXJEb2N1bWVuID0gZWxlbWVudC5vd25lckRvY3VtZW50KSA9PSBudWxsID8gdm9pZCAwIDogX2VsZW1lbnQkb3duZXJEb2N1bWVuLmJvZHk7XG4gICAgdmFyIHdpZHRoID0gbWF4KGh0bWwuc2Nyb2xsV2lkdGgsIGh0bWwuY2xpZW50V2lkdGgsIGJvZHkgPyBib2R5LnNjcm9sbFdpZHRoIDogMCwgYm9keSA/IGJvZHkuY2xpZW50V2lkdGggOiAwKTtcbiAgICB2YXIgaGVpZ2h0ID0gbWF4KGh0bWwuc2Nyb2xsSGVpZ2h0LCBodG1sLmNsaWVudEhlaWdodCwgYm9keSA/IGJvZHkuc2Nyb2xsSGVpZ2h0IDogMCwgYm9keSA/IGJvZHkuY2xpZW50SGVpZ2h0IDogMCk7XG4gICAgdmFyIHggPSAtd2luU2Nyb2xsLnNjcm9sbExlZnQgKyBnZXRXaW5kb3dTY3JvbGxCYXJYKGVsZW1lbnQpO1xuICAgIHZhciB5ID0gLXdpblNjcm9sbC5zY3JvbGxUb3A7XG5cbiAgICBpZiAoZ2V0Q29tcHV0ZWRTdHlsZSQxKGJvZHkgfHwgaHRtbCkuZGlyZWN0aW9uID09PSAncnRsJykge1xuICAgICAgeCArPSBtYXgoaHRtbC5jbGllbnRXaWR0aCwgYm9keSA/IGJvZHkuY2xpZW50V2lkdGggOiAwKSAtIHdpZHRoO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogd2lkdGgsXG4gICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgIHg6IHgsXG4gICAgICB5OiB5XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzU2Nyb2xsUGFyZW50KGVsZW1lbnQpIHtcbiAgICAvLyBGaXJlZm94IHdhbnRzIHVzIHRvIGNoZWNrIGAteGAgYW5kIGAteWAgdmFyaWF0aW9ucyBhcyB3ZWxsXG4gICAgdmFyIF9nZXRDb21wdXRlZFN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZSQxKGVsZW1lbnQpLFxuICAgICAgICBvdmVyZmxvdyA9IF9nZXRDb21wdXRlZFN0eWxlLm92ZXJmbG93LFxuICAgICAgICBvdmVyZmxvd1ggPSBfZ2V0Q29tcHV0ZWRTdHlsZS5vdmVyZmxvd1gsXG4gICAgICAgIG92ZXJmbG93WSA9IF9nZXRDb21wdXRlZFN0eWxlLm92ZXJmbG93WTtcblxuICAgIHJldHVybiAvYXV0b3xzY3JvbGx8b3ZlcmxheXxoaWRkZW4vLnRlc3Qob3ZlcmZsb3cgKyBvdmVyZmxvd1kgKyBvdmVyZmxvd1gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0U2Nyb2xsUGFyZW50KG5vZGUpIHtcbiAgICBpZiAoWydodG1sJywgJ2JvZHknLCAnI2RvY3VtZW50J10uaW5kZXhPZihnZXROb2RlTmFtZShub2RlKSkgPj0gMCkge1xuICAgICAgLy8gJEZsb3dGaXhNZVtpbmNvbXBhdGlibGUtcmV0dXJuXTogYXNzdW1lIGJvZHkgaXMgYWx3YXlzIGF2YWlsYWJsZVxuICAgICAgcmV0dXJuIG5vZGUub3duZXJEb2N1bWVudC5ib2R5O1xuICAgIH1cblxuICAgIGlmIChpc0hUTUxFbGVtZW50KG5vZGUpICYmIGlzU2Nyb2xsUGFyZW50KG5vZGUpKSB7XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZ2V0U2Nyb2xsUGFyZW50KGdldFBhcmVudE5vZGUobm9kZSkpO1xuICB9XG5cbiAgLypcbiAgZ2l2ZW4gYSBET00gZWxlbWVudCwgcmV0dXJuIHRoZSBsaXN0IG9mIGFsbCBzY3JvbGwgcGFyZW50cywgdXAgdGhlIGxpc3Qgb2YgYW5jZXNvcnNcbiAgdW50aWwgd2UgZ2V0IHRvIHRoZSB0b3Agd2luZG93IG9iamVjdC4gVGhpcyBsaXN0IGlzIHdoYXQgd2UgYXR0YWNoIHNjcm9sbCBsaXN0ZW5lcnNcbiAgdG8sIGJlY2F1c2UgaWYgYW55IG9mIHRoZXNlIHBhcmVudCBlbGVtZW50cyBzY3JvbGwsIHdlJ2xsIG5lZWQgdG8gcmUtY2FsY3VsYXRlIHRoZVxuICByZWZlcmVuY2UgZWxlbWVudCdzIHBvc2l0aW9uLlxuICAqL1xuXG4gIGZ1bmN0aW9uIGxpc3RTY3JvbGxQYXJlbnRzKGVsZW1lbnQsIGxpc3QpIHtcbiAgICB2YXIgX2VsZW1lbnQkb3duZXJEb2N1bWVuO1xuXG4gICAgaWYgKGxpc3QgPT09IHZvaWQgMCkge1xuICAgICAgbGlzdCA9IFtdO1xuICAgIH1cblxuICAgIHZhciBzY3JvbGxQYXJlbnQgPSBnZXRTY3JvbGxQYXJlbnQoZWxlbWVudCk7XG4gICAgdmFyIGlzQm9keSA9IHNjcm9sbFBhcmVudCA9PT0gKChfZWxlbWVudCRvd25lckRvY3VtZW4gPSBlbGVtZW50Lm93bmVyRG9jdW1lbnQpID09IG51bGwgPyB2b2lkIDAgOiBfZWxlbWVudCRvd25lckRvY3VtZW4uYm9keSk7XG4gICAgdmFyIHdpbiA9IGdldFdpbmRvdyhzY3JvbGxQYXJlbnQpO1xuICAgIHZhciB0YXJnZXQgPSBpc0JvZHkgPyBbd2luXS5jb25jYXQod2luLnZpc3VhbFZpZXdwb3J0IHx8IFtdLCBpc1Njcm9sbFBhcmVudChzY3JvbGxQYXJlbnQpID8gc2Nyb2xsUGFyZW50IDogW10pIDogc2Nyb2xsUGFyZW50O1xuICAgIHZhciB1cGRhdGVkTGlzdCA9IGxpc3QuY29uY2F0KHRhcmdldCk7XG4gICAgcmV0dXJuIGlzQm9keSA/IHVwZGF0ZWRMaXN0IDogLy8gJEZsb3dGaXhNZVtpbmNvbXBhdGlibGUtY2FsbF06IGlzQm9keSB0ZWxscyB1cyB0YXJnZXQgd2lsbCBiZSBhbiBIVE1MRWxlbWVudCBoZXJlXG4gICAgdXBkYXRlZExpc3QuY29uY2F0KGxpc3RTY3JvbGxQYXJlbnRzKGdldFBhcmVudE5vZGUodGFyZ2V0KSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVjdFRvQ2xpZW50UmVjdChyZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHJlY3QsIHtcbiAgICAgIGxlZnQ6IHJlY3QueCxcbiAgICAgIHRvcDogcmVjdC55LFxuICAgICAgcmlnaHQ6IHJlY3QueCArIHJlY3Qud2lkdGgsXG4gICAgICBib3R0b206IHJlY3QueSArIHJlY3QuaGVpZ2h0XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRJbm5lckJvdW5kaW5nQ2xpZW50UmVjdChlbGVtZW50LCBzdHJhdGVneSkge1xuICAgIHZhciByZWN0ID0gZ2V0Qm91bmRpbmdDbGllbnRSZWN0KGVsZW1lbnQsIGZhbHNlLCBzdHJhdGVneSA9PT0gJ2ZpeGVkJyk7XG4gICAgcmVjdC50b3AgPSByZWN0LnRvcCArIGVsZW1lbnQuY2xpZW50VG9wO1xuICAgIHJlY3QubGVmdCA9IHJlY3QubGVmdCArIGVsZW1lbnQuY2xpZW50TGVmdDtcbiAgICByZWN0LmJvdHRvbSA9IHJlY3QudG9wICsgZWxlbWVudC5jbGllbnRIZWlnaHQ7XG4gICAgcmVjdC5yaWdodCA9IHJlY3QubGVmdCArIGVsZW1lbnQuY2xpZW50V2lkdGg7XG4gICAgcmVjdC53aWR0aCA9IGVsZW1lbnQuY2xpZW50V2lkdGg7XG4gICAgcmVjdC5oZWlnaHQgPSBlbGVtZW50LmNsaWVudEhlaWdodDtcbiAgICByZWN0LnggPSByZWN0LmxlZnQ7XG4gICAgcmVjdC55ID0gcmVjdC50b3A7XG4gICAgcmV0dXJuIHJlY3Q7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRDbGllbnRSZWN0RnJvbU1peGVkVHlwZShlbGVtZW50LCBjbGlwcGluZ1BhcmVudCwgc3RyYXRlZ3kpIHtcbiAgICByZXR1cm4gY2xpcHBpbmdQYXJlbnQgPT09IHZpZXdwb3J0ID8gcmVjdFRvQ2xpZW50UmVjdChnZXRWaWV3cG9ydFJlY3QoZWxlbWVudCwgc3RyYXRlZ3kpKSA6IGlzRWxlbWVudChjbGlwcGluZ1BhcmVudCkgPyBnZXRJbm5lckJvdW5kaW5nQ2xpZW50UmVjdChjbGlwcGluZ1BhcmVudCwgc3RyYXRlZ3kpIDogcmVjdFRvQ2xpZW50UmVjdChnZXREb2N1bWVudFJlY3QoZ2V0RG9jdW1lbnRFbGVtZW50KGVsZW1lbnQpKSk7XG4gIH0gLy8gQSBcImNsaXBwaW5nIHBhcmVudFwiIGlzIGFuIG92ZXJmbG93YWJsZSBjb250YWluZXIgd2l0aCB0aGUgY2hhcmFjdGVyaXN0aWMgb2ZcbiAgLy8gY2xpcHBpbmcgKG9yIGhpZGluZykgb3ZlcmZsb3dpbmcgZWxlbWVudHMgd2l0aCBhIHBvc2l0aW9uIGRpZmZlcmVudCBmcm9tXG4gIC8vIGBpbml0aWFsYFxuXG5cbiAgZnVuY3Rpb24gZ2V0Q2xpcHBpbmdQYXJlbnRzKGVsZW1lbnQpIHtcbiAgICB2YXIgY2xpcHBpbmdQYXJlbnRzID0gbGlzdFNjcm9sbFBhcmVudHMoZ2V0UGFyZW50Tm9kZShlbGVtZW50KSk7XG4gICAgdmFyIGNhbkVzY2FwZUNsaXBwaW5nID0gWydhYnNvbHV0ZScsICdmaXhlZCddLmluZGV4T2YoZ2V0Q29tcHV0ZWRTdHlsZSQxKGVsZW1lbnQpLnBvc2l0aW9uKSA+PSAwO1xuICAgIHZhciBjbGlwcGVyRWxlbWVudCA9IGNhbkVzY2FwZUNsaXBwaW5nICYmIGlzSFRNTEVsZW1lbnQoZWxlbWVudCkgPyBnZXRPZmZzZXRQYXJlbnQoZWxlbWVudCkgOiBlbGVtZW50O1xuXG4gICAgaWYgKCFpc0VsZW1lbnQoY2xpcHBlckVsZW1lbnQpKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfSAvLyAkRmxvd0ZpeE1lW2luY29tcGF0aWJsZS1yZXR1cm5dOiBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svZmxvdy9pc3N1ZXMvMTQxNFxuXG5cbiAgICByZXR1cm4gY2xpcHBpbmdQYXJlbnRzLmZpbHRlcihmdW5jdGlvbiAoY2xpcHBpbmdQYXJlbnQpIHtcbiAgICAgIHJldHVybiBpc0VsZW1lbnQoY2xpcHBpbmdQYXJlbnQpICYmIGNvbnRhaW5zKGNsaXBwaW5nUGFyZW50LCBjbGlwcGVyRWxlbWVudCkgJiYgZ2V0Tm9kZU5hbWUoY2xpcHBpbmdQYXJlbnQpICE9PSAnYm9keSc7XG4gICAgfSk7XG4gIH0gLy8gR2V0cyB0aGUgbWF4aW11bSBhcmVhIHRoYXQgdGhlIGVsZW1lbnQgaXMgdmlzaWJsZSBpbiBkdWUgdG8gYW55IG51bWJlciBvZlxuICAvLyBjbGlwcGluZyBwYXJlbnRzXG5cblxuICBmdW5jdGlvbiBnZXRDbGlwcGluZ1JlY3QoZWxlbWVudCwgYm91bmRhcnksIHJvb3RCb3VuZGFyeSwgc3RyYXRlZ3kpIHtcbiAgICB2YXIgbWFpbkNsaXBwaW5nUGFyZW50cyA9IGJvdW5kYXJ5ID09PSAnY2xpcHBpbmdQYXJlbnRzJyA/IGdldENsaXBwaW5nUGFyZW50cyhlbGVtZW50KSA6IFtdLmNvbmNhdChib3VuZGFyeSk7XG4gICAgdmFyIGNsaXBwaW5nUGFyZW50cyA9IFtdLmNvbmNhdChtYWluQ2xpcHBpbmdQYXJlbnRzLCBbcm9vdEJvdW5kYXJ5XSk7XG4gICAgdmFyIGZpcnN0Q2xpcHBpbmdQYXJlbnQgPSBjbGlwcGluZ1BhcmVudHNbMF07XG4gICAgdmFyIGNsaXBwaW5nUmVjdCA9IGNsaXBwaW5nUGFyZW50cy5yZWR1Y2UoZnVuY3Rpb24gKGFjY1JlY3QsIGNsaXBwaW5nUGFyZW50KSB7XG4gICAgICB2YXIgcmVjdCA9IGdldENsaWVudFJlY3RGcm9tTWl4ZWRUeXBlKGVsZW1lbnQsIGNsaXBwaW5nUGFyZW50LCBzdHJhdGVneSk7XG4gICAgICBhY2NSZWN0LnRvcCA9IG1heChyZWN0LnRvcCwgYWNjUmVjdC50b3ApO1xuICAgICAgYWNjUmVjdC5yaWdodCA9IG1pbihyZWN0LnJpZ2h0LCBhY2NSZWN0LnJpZ2h0KTtcbiAgICAgIGFjY1JlY3QuYm90dG9tID0gbWluKHJlY3QuYm90dG9tLCBhY2NSZWN0LmJvdHRvbSk7XG4gICAgICBhY2NSZWN0LmxlZnQgPSBtYXgocmVjdC5sZWZ0LCBhY2NSZWN0LmxlZnQpO1xuICAgICAgcmV0dXJuIGFjY1JlY3Q7XG4gICAgfSwgZ2V0Q2xpZW50UmVjdEZyb21NaXhlZFR5cGUoZWxlbWVudCwgZmlyc3RDbGlwcGluZ1BhcmVudCwgc3RyYXRlZ3kpKTtcbiAgICBjbGlwcGluZ1JlY3Qud2lkdGggPSBjbGlwcGluZ1JlY3QucmlnaHQgLSBjbGlwcGluZ1JlY3QubGVmdDtcbiAgICBjbGlwcGluZ1JlY3QuaGVpZ2h0ID0gY2xpcHBpbmdSZWN0LmJvdHRvbSAtIGNsaXBwaW5nUmVjdC50b3A7XG4gICAgY2xpcHBpbmdSZWN0LnggPSBjbGlwcGluZ1JlY3QubGVmdDtcbiAgICBjbGlwcGluZ1JlY3QueSA9IGNsaXBwaW5nUmVjdC50b3A7XG4gICAgcmV0dXJuIGNsaXBwaW5nUmVjdDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbXB1dGVPZmZzZXRzKF9yZWYpIHtcbiAgICB2YXIgcmVmZXJlbmNlID0gX3JlZi5yZWZlcmVuY2UsXG4gICAgICAgIGVsZW1lbnQgPSBfcmVmLmVsZW1lbnQsXG4gICAgICAgIHBsYWNlbWVudCA9IF9yZWYucGxhY2VtZW50O1xuICAgIHZhciBiYXNlUGxhY2VtZW50ID0gcGxhY2VtZW50ID8gZ2V0QmFzZVBsYWNlbWVudChwbGFjZW1lbnQpIDogbnVsbDtcbiAgICB2YXIgdmFyaWF0aW9uID0gcGxhY2VtZW50ID8gZ2V0VmFyaWF0aW9uKHBsYWNlbWVudCkgOiBudWxsO1xuICAgIHZhciBjb21tb25YID0gcmVmZXJlbmNlLnggKyByZWZlcmVuY2Uud2lkdGggLyAyIC0gZWxlbWVudC53aWR0aCAvIDI7XG4gICAgdmFyIGNvbW1vblkgPSByZWZlcmVuY2UueSArIHJlZmVyZW5jZS5oZWlnaHQgLyAyIC0gZWxlbWVudC5oZWlnaHQgLyAyO1xuICAgIHZhciBvZmZzZXRzO1xuXG4gICAgc3dpdGNoIChiYXNlUGxhY2VtZW50KSB7XG4gICAgICBjYXNlIHRvcDpcbiAgICAgICAgb2Zmc2V0cyA9IHtcbiAgICAgICAgICB4OiBjb21tb25YLFxuICAgICAgICAgIHk6IHJlZmVyZW5jZS55IC0gZWxlbWVudC5oZWlnaHRcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgYm90dG9tOlxuICAgICAgICBvZmZzZXRzID0ge1xuICAgICAgICAgIHg6IGNvbW1vblgsXG4gICAgICAgICAgeTogcmVmZXJlbmNlLnkgKyByZWZlcmVuY2UuaGVpZ2h0XG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIHJpZ2h0OlxuICAgICAgICBvZmZzZXRzID0ge1xuICAgICAgICAgIHg6IHJlZmVyZW5jZS54ICsgcmVmZXJlbmNlLndpZHRoLFxuICAgICAgICAgIHk6IGNvbW1vbllcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgbGVmdDpcbiAgICAgICAgb2Zmc2V0cyA9IHtcbiAgICAgICAgICB4OiByZWZlcmVuY2UueCAtIGVsZW1lbnQud2lkdGgsXG4gICAgICAgICAgeTogY29tbW9uWVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgb2Zmc2V0cyA9IHtcbiAgICAgICAgICB4OiByZWZlcmVuY2UueCxcbiAgICAgICAgICB5OiByZWZlcmVuY2UueVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBtYWluQXhpcyA9IGJhc2VQbGFjZW1lbnQgPyBnZXRNYWluQXhpc0Zyb21QbGFjZW1lbnQoYmFzZVBsYWNlbWVudCkgOiBudWxsO1xuXG4gICAgaWYgKG1haW5BeGlzICE9IG51bGwpIHtcbiAgICAgIHZhciBsZW4gPSBtYWluQXhpcyA9PT0gJ3knID8gJ2hlaWdodCcgOiAnd2lkdGgnO1xuXG4gICAgICBzd2l0Y2ggKHZhcmlhdGlvbikge1xuICAgICAgICBjYXNlIHN0YXJ0OlxuICAgICAgICAgIG9mZnNldHNbbWFpbkF4aXNdID0gb2Zmc2V0c1ttYWluQXhpc10gLSAocmVmZXJlbmNlW2xlbl0gLyAyIC0gZWxlbWVudFtsZW5dIC8gMik7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBlbmQ6XG4gICAgICAgICAgb2Zmc2V0c1ttYWluQXhpc10gPSBvZmZzZXRzW21haW5BeGlzXSArIChyZWZlcmVuY2VbbGVuXSAvIDIgLSBlbGVtZW50W2xlbl0gLyAyKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIGRldGVjdE92ZXJmbG93KHN0YXRlLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkge1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHZhciBfb3B0aW9ucyA9IG9wdGlvbnMsXG4gICAgICAgIF9vcHRpb25zJHBsYWNlbWVudCA9IF9vcHRpb25zLnBsYWNlbWVudCxcbiAgICAgICAgcGxhY2VtZW50ID0gX29wdGlvbnMkcGxhY2VtZW50ID09PSB2b2lkIDAgPyBzdGF0ZS5wbGFjZW1lbnQgOiBfb3B0aW9ucyRwbGFjZW1lbnQsXG4gICAgICAgIF9vcHRpb25zJHN0cmF0ZWd5ID0gX29wdGlvbnMuc3RyYXRlZ3ksXG4gICAgICAgIHN0cmF0ZWd5ID0gX29wdGlvbnMkc3RyYXRlZ3kgPT09IHZvaWQgMCA/IHN0YXRlLnN0cmF0ZWd5IDogX29wdGlvbnMkc3RyYXRlZ3ksXG4gICAgICAgIF9vcHRpb25zJGJvdW5kYXJ5ID0gX29wdGlvbnMuYm91bmRhcnksXG4gICAgICAgIGJvdW5kYXJ5ID0gX29wdGlvbnMkYm91bmRhcnkgPT09IHZvaWQgMCA/IGNsaXBwaW5nUGFyZW50cyA6IF9vcHRpb25zJGJvdW5kYXJ5LFxuICAgICAgICBfb3B0aW9ucyRyb290Qm91bmRhcnkgPSBfb3B0aW9ucy5yb290Qm91bmRhcnksXG4gICAgICAgIHJvb3RCb3VuZGFyeSA9IF9vcHRpb25zJHJvb3RCb3VuZGFyeSA9PT0gdm9pZCAwID8gdmlld3BvcnQgOiBfb3B0aW9ucyRyb290Qm91bmRhcnksXG4gICAgICAgIF9vcHRpb25zJGVsZW1lbnRDb250ZSA9IF9vcHRpb25zLmVsZW1lbnRDb250ZXh0LFxuICAgICAgICBlbGVtZW50Q29udGV4dCA9IF9vcHRpb25zJGVsZW1lbnRDb250ZSA9PT0gdm9pZCAwID8gcG9wcGVyIDogX29wdGlvbnMkZWxlbWVudENvbnRlLFxuICAgICAgICBfb3B0aW9ucyRhbHRCb3VuZGFyeSA9IF9vcHRpb25zLmFsdEJvdW5kYXJ5LFxuICAgICAgICBhbHRCb3VuZGFyeSA9IF9vcHRpb25zJGFsdEJvdW5kYXJ5ID09PSB2b2lkIDAgPyBmYWxzZSA6IF9vcHRpb25zJGFsdEJvdW5kYXJ5LFxuICAgICAgICBfb3B0aW9ucyRwYWRkaW5nID0gX29wdGlvbnMucGFkZGluZyxcbiAgICAgICAgcGFkZGluZyA9IF9vcHRpb25zJHBhZGRpbmcgPT09IHZvaWQgMCA/IDAgOiBfb3B0aW9ucyRwYWRkaW5nO1xuICAgIHZhciBwYWRkaW5nT2JqZWN0ID0gbWVyZ2VQYWRkaW5nT2JqZWN0KHR5cGVvZiBwYWRkaW5nICE9PSAnbnVtYmVyJyA/IHBhZGRpbmcgOiBleHBhbmRUb0hhc2hNYXAocGFkZGluZywgYmFzZVBsYWNlbWVudHMpKTtcbiAgICB2YXIgYWx0Q29udGV4dCA9IGVsZW1lbnRDb250ZXh0ID09PSBwb3BwZXIgPyByZWZlcmVuY2UgOiBwb3BwZXI7XG4gICAgdmFyIHBvcHBlclJlY3QgPSBzdGF0ZS5yZWN0cy5wb3BwZXI7XG4gICAgdmFyIGVsZW1lbnQgPSBzdGF0ZS5lbGVtZW50c1thbHRCb3VuZGFyeSA/IGFsdENvbnRleHQgOiBlbGVtZW50Q29udGV4dF07XG4gICAgdmFyIGNsaXBwaW5nQ2xpZW50UmVjdCA9IGdldENsaXBwaW5nUmVjdChpc0VsZW1lbnQoZWxlbWVudCkgPyBlbGVtZW50IDogZWxlbWVudC5jb250ZXh0RWxlbWVudCB8fCBnZXREb2N1bWVudEVsZW1lbnQoc3RhdGUuZWxlbWVudHMucG9wcGVyKSwgYm91bmRhcnksIHJvb3RCb3VuZGFyeSwgc3RyYXRlZ3kpO1xuICAgIHZhciByZWZlcmVuY2VDbGllbnRSZWN0ID0gZ2V0Qm91bmRpbmdDbGllbnRSZWN0KHN0YXRlLmVsZW1lbnRzLnJlZmVyZW5jZSk7XG4gICAgdmFyIHBvcHBlck9mZnNldHMgPSBjb21wdXRlT2Zmc2V0cyh7XG4gICAgICByZWZlcmVuY2U6IHJlZmVyZW5jZUNsaWVudFJlY3QsXG4gICAgICBlbGVtZW50OiBwb3BwZXJSZWN0LFxuICAgICAgc3RyYXRlZ3k6ICdhYnNvbHV0ZScsXG4gICAgICBwbGFjZW1lbnQ6IHBsYWNlbWVudFxuICAgIH0pO1xuICAgIHZhciBwb3BwZXJDbGllbnRSZWN0ID0gcmVjdFRvQ2xpZW50UmVjdChPYmplY3QuYXNzaWduKHt9LCBwb3BwZXJSZWN0LCBwb3BwZXJPZmZzZXRzKSk7XG4gICAgdmFyIGVsZW1lbnRDbGllbnRSZWN0ID0gZWxlbWVudENvbnRleHQgPT09IHBvcHBlciA/IHBvcHBlckNsaWVudFJlY3QgOiByZWZlcmVuY2VDbGllbnRSZWN0OyAvLyBwb3NpdGl2ZSA9IG92ZXJmbG93aW5nIHRoZSBjbGlwcGluZyByZWN0XG4gICAgLy8gMCBvciBuZWdhdGl2ZSA9IHdpdGhpbiB0aGUgY2xpcHBpbmcgcmVjdFxuXG4gICAgdmFyIG92ZXJmbG93T2Zmc2V0cyA9IHtcbiAgICAgIHRvcDogY2xpcHBpbmdDbGllbnRSZWN0LnRvcCAtIGVsZW1lbnRDbGllbnRSZWN0LnRvcCArIHBhZGRpbmdPYmplY3QudG9wLFxuICAgICAgYm90dG9tOiBlbGVtZW50Q2xpZW50UmVjdC5ib3R0b20gLSBjbGlwcGluZ0NsaWVudFJlY3QuYm90dG9tICsgcGFkZGluZ09iamVjdC5ib3R0b20sXG4gICAgICBsZWZ0OiBjbGlwcGluZ0NsaWVudFJlY3QubGVmdCAtIGVsZW1lbnRDbGllbnRSZWN0LmxlZnQgKyBwYWRkaW5nT2JqZWN0LmxlZnQsXG4gICAgICByaWdodDogZWxlbWVudENsaWVudFJlY3QucmlnaHQgLSBjbGlwcGluZ0NsaWVudFJlY3QucmlnaHQgKyBwYWRkaW5nT2JqZWN0LnJpZ2h0XG4gICAgfTtcbiAgICB2YXIgb2Zmc2V0RGF0YSA9IHN0YXRlLm1vZGlmaWVyc0RhdGEub2Zmc2V0OyAvLyBPZmZzZXRzIGNhbiBiZSBhcHBsaWVkIG9ubHkgdG8gdGhlIHBvcHBlciBlbGVtZW50XG5cbiAgICBpZiAoZWxlbWVudENvbnRleHQgPT09IHBvcHBlciAmJiBvZmZzZXREYXRhKSB7XG4gICAgICB2YXIgb2Zmc2V0ID0gb2Zmc2V0RGF0YVtwbGFjZW1lbnRdO1xuICAgICAgT2JqZWN0LmtleXMob3ZlcmZsb3dPZmZzZXRzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgdmFyIG11bHRpcGx5ID0gW3JpZ2h0LCBib3R0b21dLmluZGV4T2Yoa2V5KSA+PSAwID8gMSA6IC0xO1xuICAgICAgICB2YXIgYXhpcyA9IFt0b3AsIGJvdHRvbV0uaW5kZXhPZihrZXkpID49IDAgPyAneScgOiAneCc7XG4gICAgICAgIG92ZXJmbG93T2Zmc2V0c1trZXldICs9IG9mZnNldFtheGlzXSAqIG11bHRpcGx5O1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG92ZXJmbG93T2Zmc2V0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbXB1dGVBdXRvUGxhY2VtZW50KHN0YXRlLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkge1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHZhciBfb3B0aW9ucyA9IG9wdGlvbnMsXG4gICAgICAgIHBsYWNlbWVudCA9IF9vcHRpb25zLnBsYWNlbWVudCxcbiAgICAgICAgYm91bmRhcnkgPSBfb3B0aW9ucy5ib3VuZGFyeSxcbiAgICAgICAgcm9vdEJvdW5kYXJ5ID0gX29wdGlvbnMucm9vdEJvdW5kYXJ5LFxuICAgICAgICBwYWRkaW5nID0gX29wdGlvbnMucGFkZGluZyxcbiAgICAgICAgZmxpcFZhcmlhdGlvbnMgPSBfb3B0aW9ucy5mbGlwVmFyaWF0aW9ucyxcbiAgICAgICAgX29wdGlvbnMkYWxsb3dlZEF1dG9QID0gX29wdGlvbnMuYWxsb3dlZEF1dG9QbGFjZW1lbnRzLFxuICAgICAgICBhbGxvd2VkQXV0b1BsYWNlbWVudHMgPSBfb3B0aW9ucyRhbGxvd2VkQXV0b1AgPT09IHZvaWQgMCA/IHBsYWNlbWVudHMgOiBfb3B0aW9ucyRhbGxvd2VkQXV0b1A7XG4gICAgdmFyIHZhcmlhdGlvbiA9IGdldFZhcmlhdGlvbihwbGFjZW1lbnQpO1xuICAgIHZhciBwbGFjZW1lbnRzJDEgPSB2YXJpYXRpb24gPyBmbGlwVmFyaWF0aW9ucyA/IHZhcmlhdGlvblBsYWNlbWVudHMgOiB2YXJpYXRpb25QbGFjZW1lbnRzLmZpbHRlcihmdW5jdGlvbiAocGxhY2VtZW50KSB7XG4gICAgICByZXR1cm4gZ2V0VmFyaWF0aW9uKHBsYWNlbWVudCkgPT09IHZhcmlhdGlvbjtcbiAgICB9KSA6IGJhc2VQbGFjZW1lbnRzO1xuICAgIHZhciBhbGxvd2VkUGxhY2VtZW50cyA9IHBsYWNlbWVudHMkMS5maWx0ZXIoZnVuY3Rpb24gKHBsYWNlbWVudCkge1xuICAgICAgcmV0dXJuIGFsbG93ZWRBdXRvUGxhY2VtZW50cy5pbmRleE9mKHBsYWNlbWVudCkgPj0gMDtcbiAgICB9KTtcblxuICAgIGlmIChhbGxvd2VkUGxhY2VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGFsbG93ZWRQbGFjZW1lbnRzID0gcGxhY2VtZW50cyQxO1xuICAgIH0gLy8gJEZsb3dGaXhNZVtpbmNvbXBhdGlibGUtdHlwZV06IEZsb3cgc2VlbXMgdG8gaGF2ZSBwcm9ibGVtcyB3aXRoIHR3byBhcnJheSB1bmlvbnMuLi5cblxuXG4gICAgdmFyIG92ZXJmbG93cyA9IGFsbG93ZWRQbGFjZW1lbnRzLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBwbGFjZW1lbnQpIHtcbiAgICAgIGFjY1twbGFjZW1lbnRdID0gZGV0ZWN0T3ZlcmZsb3coc3RhdGUsIHtcbiAgICAgICAgcGxhY2VtZW50OiBwbGFjZW1lbnQsXG4gICAgICAgIGJvdW5kYXJ5OiBib3VuZGFyeSxcbiAgICAgICAgcm9vdEJvdW5kYXJ5OiByb290Qm91bmRhcnksXG4gICAgICAgIHBhZGRpbmc6IHBhZGRpbmdcbiAgICAgIH0pW2dldEJhc2VQbGFjZW1lbnQocGxhY2VtZW50KV07XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMob3ZlcmZsb3dzKS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gb3ZlcmZsb3dzW2FdIC0gb3ZlcmZsb3dzW2JdO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0RXhwYW5kZWRGYWxsYmFja1BsYWNlbWVudHMocGxhY2VtZW50KSB7XG4gICAgaWYgKGdldEJhc2VQbGFjZW1lbnQocGxhY2VtZW50KSA9PT0gYXV0bykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIHZhciBvcHBvc2l0ZVBsYWNlbWVudCA9IGdldE9wcG9zaXRlUGxhY2VtZW50KHBsYWNlbWVudCk7XG4gICAgcmV0dXJuIFtnZXRPcHBvc2l0ZVZhcmlhdGlvblBsYWNlbWVudChwbGFjZW1lbnQpLCBvcHBvc2l0ZVBsYWNlbWVudCwgZ2V0T3Bwb3NpdGVWYXJpYXRpb25QbGFjZW1lbnQob3Bwb3NpdGVQbGFjZW1lbnQpXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZsaXAoX3JlZikge1xuICAgIHZhciBzdGF0ZSA9IF9yZWYuc3RhdGUsXG4gICAgICAgIG9wdGlvbnMgPSBfcmVmLm9wdGlvbnMsXG4gICAgICAgIG5hbWUgPSBfcmVmLm5hbWU7XG5cbiAgICBpZiAoc3RhdGUubW9kaWZpZXJzRGF0YVtuYW1lXS5fc2tpcCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBfb3B0aW9ucyRtYWluQXhpcyA9IG9wdGlvbnMubWFpbkF4aXMsXG4gICAgICAgIGNoZWNrTWFpbkF4aXMgPSBfb3B0aW9ucyRtYWluQXhpcyA9PT0gdm9pZCAwID8gdHJ1ZSA6IF9vcHRpb25zJG1haW5BeGlzLFxuICAgICAgICBfb3B0aW9ucyRhbHRBeGlzID0gb3B0aW9ucy5hbHRBeGlzLFxuICAgICAgICBjaGVja0FsdEF4aXMgPSBfb3B0aW9ucyRhbHRBeGlzID09PSB2b2lkIDAgPyB0cnVlIDogX29wdGlvbnMkYWx0QXhpcyxcbiAgICAgICAgc3BlY2lmaWVkRmFsbGJhY2tQbGFjZW1lbnRzID0gb3B0aW9ucy5mYWxsYmFja1BsYWNlbWVudHMsXG4gICAgICAgIHBhZGRpbmcgPSBvcHRpb25zLnBhZGRpbmcsXG4gICAgICAgIGJvdW5kYXJ5ID0gb3B0aW9ucy5ib3VuZGFyeSxcbiAgICAgICAgcm9vdEJvdW5kYXJ5ID0gb3B0aW9ucy5yb290Qm91bmRhcnksXG4gICAgICAgIGFsdEJvdW5kYXJ5ID0gb3B0aW9ucy5hbHRCb3VuZGFyeSxcbiAgICAgICAgX29wdGlvbnMkZmxpcFZhcmlhdGlvID0gb3B0aW9ucy5mbGlwVmFyaWF0aW9ucyxcbiAgICAgICAgZmxpcFZhcmlhdGlvbnMgPSBfb3B0aW9ucyRmbGlwVmFyaWF0aW8gPT09IHZvaWQgMCA/IHRydWUgOiBfb3B0aW9ucyRmbGlwVmFyaWF0aW8sXG4gICAgICAgIGFsbG93ZWRBdXRvUGxhY2VtZW50cyA9IG9wdGlvbnMuYWxsb3dlZEF1dG9QbGFjZW1lbnRzO1xuICAgIHZhciBwcmVmZXJyZWRQbGFjZW1lbnQgPSBzdGF0ZS5vcHRpb25zLnBsYWNlbWVudDtcbiAgICB2YXIgYmFzZVBsYWNlbWVudCA9IGdldEJhc2VQbGFjZW1lbnQocHJlZmVycmVkUGxhY2VtZW50KTtcbiAgICB2YXIgaXNCYXNlUGxhY2VtZW50ID0gYmFzZVBsYWNlbWVudCA9PT0gcHJlZmVycmVkUGxhY2VtZW50O1xuICAgIHZhciBmYWxsYmFja1BsYWNlbWVudHMgPSBzcGVjaWZpZWRGYWxsYmFja1BsYWNlbWVudHMgfHwgKGlzQmFzZVBsYWNlbWVudCB8fCAhZmxpcFZhcmlhdGlvbnMgPyBbZ2V0T3Bwb3NpdGVQbGFjZW1lbnQocHJlZmVycmVkUGxhY2VtZW50KV0gOiBnZXRFeHBhbmRlZEZhbGxiYWNrUGxhY2VtZW50cyhwcmVmZXJyZWRQbGFjZW1lbnQpKTtcbiAgICB2YXIgcGxhY2VtZW50cyA9IFtwcmVmZXJyZWRQbGFjZW1lbnRdLmNvbmNhdChmYWxsYmFja1BsYWNlbWVudHMpLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBwbGFjZW1lbnQpIHtcbiAgICAgIHJldHVybiBhY2MuY29uY2F0KGdldEJhc2VQbGFjZW1lbnQocGxhY2VtZW50KSA9PT0gYXV0byA/IGNvbXB1dGVBdXRvUGxhY2VtZW50KHN0YXRlLCB7XG4gICAgICAgIHBsYWNlbWVudDogcGxhY2VtZW50LFxuICAgICAgICBib3VuZGFyeTogYm91bmRhcnksXG4gICAgICAgIHJvb3RCb3VuZGFyeTogcm9vdEJvdW5kYXJ5LFxuICAgICAgICBwYWRkaW5nOiBwYWRkaW5nLFxuICAgICAgICBmbGlwVmFyaWF0aW9uczogZmxpcFZhcmlhdGlvbnMsXG4gICAgICAgIGFsbG93ZWRBdXRvUGxhY2VtZW50czogYWxsb3dlZEF1dG9QbGFjZW1lbnRzXG4gICAgICB9KSA6IHBsYWNlbWVudCk7XG4gICAgfSwgW10pO1xuICAgIHZhciByZWZlcmVuY2VSZWN0ID0gc3RhdGUucmVjdHMucmVmZXJlbmNlO1xuICAgIHZhciBwb3BwZXJSZWN0ID0gc3RhdGUucmVjdHMucG9wcGVyO1xuICAgIHZhciBjaGVja3NNYXAgPSBuZXcgTWFwKCk7XG4gICAgdmFyIG1ha2VGYWxsYmFja0NoZWNrcyA9IHRydWU7XG4gICAgdmFyIGZpcnN0Rml0dGluZ1BsYWNlbWVudCA9IHBsYWNlbWVudHNbMF07XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBsYWNlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBwbGFjZW1lbnQgPSBwbGFjZW1lbnRzW2ldO1xuXG4gICAgICB2YXIgX2Jhc2VQbGFjZW1lbnQgPSBnZXRCYXNlUGxhY2VtZW50KHBsYWNlbWVudCk7XG5cbiAgICAgIHZhciBpc1N0YXJ0VmFyaWF0aW9uID0gZ2V0VmFyaWF0aW9uKHBsYWNlbWVudCkgPT09IHN0YXJ0O1xuICAgICAgdmFyIGlzVmVydGljYWwgPSBbdG9wLCBib3R0b21dLmluZGV4T2YoX2Jhc2VQbGFjZW1lbnQpID49IDA7XG4gICAgICB2YXIgbGVuID0gaXNWZXJ0aWNhbCA/ICd3aWR0aCcgOiAnaGVpZ2h0JztcbiAgICAgIHZhciBvdmVyZmxvdyA9IGRldGVjdE92ZXJmbG93KHN0YXRlLCB7XG4gICAgICAgIHBsYWNlbWVudDogcGxhY2VtZW50LFxuICAgICAgICBib3VuZGFyeTogYm91bmRhcnksXG4gICAgICAgIHJvb3RCb3VuZGFyeTogcm9vdEJvdW5kYXJ5LFxuICAgICAgICBhbHRCb3VuZGFyeTogYWx0Qm91bmRhcnksXG4gICAgICAgIHBhZGRpbmc6IHBhZGRpbmdcbiAgICAgIH0pO1xuICAgICAgdmFyIG1haW5WYXJpYXRpb25TaWRlID0gaXNWZXJ0aWNhbCA/IGlzU3RhcnRWYXJpYXRpb24gPyByaWdodCA6IGxlZnQgOiBpc1N0YXJ0VmFyaWF0aW9uID8gYm90dG9tIDogdG9wO1xuXG4gICAgICBpZiAocmVmZXJlbmNlUmVjdFtsZW5dID4gcG9wcGVyUmVjdFtsZW5dKSB7XG4gICAgICAgIG1haW5WYXJpYXRpb25TaWRlID0gZ2V0T3Bwb3NpdGVQbGFjZW1lbnQobWFpblZhcmlhdGlvblNpZGUpO1xuICAgICAgfVxuXG4gICAgICB2YXIgYWx0VmFyaWF0aW9uU2lkZSA9IGdldE9wcG9zaXRlUGxhY2VtZW50KG1haW5WYXJpYXRpb25TaWRlKTtcbiAgICAgIHZhciBjaGVja3MgPSBbXTtcblxuICAgICAgaWYgKGNoZWNrTWFpbkF4aXMpIHtcbiAgICAgICAgY2hlY2tzLnB1c2gob3ZlcmZsb3dbX2Jhc2VQbGFjZW1lbnRdIDw9IDApO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2hlY2tBbHRBeGlzKSB7XG4gICAgICAgIGNoZWNrcy5wdXNoKG92ZXJmbG93W21haW5WYXJpYXRpb25TaWRlXSA8PSAwLCBvdmVyZmxvd1thbHRWYXJpYXRpb25TaWRlXSA8PSAwKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNoZWNrcy5ldmVyeShmdW5jdGlvbiAoY2hlY2spIHtcbiAgICAgICAgcmV0dXJuIGNoZWNrO1xuICAgICAgfSkpIHtcbiAgICAgICAgZmlyc3RGaXR0aW5nUGxhY2VtZW50ID0gcGxhY2VtZW50O1xuICAgICAgICBtYWtlRmFsbGJhY2tDaGVja3MgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNoZWNrc01hcC5zZXQocGxhY2VtZW50LCBjaGVja3MpO1xuICAgIH1cblxuICAgIGlmIChtYWtlRmFsbGJhY2tDaGVja3MpIHtcbiAgICAgIC8vIGAyYCBtYXkgYmUgZGVzaXJlZCBpbiBzb21lIGNhc2VzIFx1MjAxMyByZXNlYXJjaCBsYXRlclxuICAgICAgdmFyIG51bWJlck9mQ2hlY2tzID0gZmxpcFZhcmlhdGlvbnMgPyAzIDogMTtcblxuICAgICAgdmFyIF9sb29wID0gZnVuY3Rpb24gX2xvb3AoX2kpIHtcbiAgICAgICAgdmFyIGZpdHRpbmdQbGFjZW1lbnQgPSBwbGFjZW1lbnRzLmZpbmQoZnVuY3Rpb24gKHBsYWNlbWVudCkge1xuICAgICAgICAgIHZhciBjaGVja3MgPSBjaGVja3NNYXAuZ2V0KHBsYWNlbWVudCk7XG5cbiAgICAgICAgICBpZiAoY2hlY2tzKSB7XG4gICAgICAgICAgICByZXR1cm4gY2hlY2tzLnNsaWNlKDAsIF9pKS5ldmVyeShmdW5jdGlvbiAoY2hlY2spIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGNoZWNrO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoZml0dGluZ1BsYWNlbWVudCkge1xuICAgICAgICAgIGZpcnN0Rml0dGluZ1BsYWNlbWVudCA9IGZpdHRpbmdQbGFjZW1lbnQ7XG4gICAgICAgICAgcmV0dXJuIFwiYnJlYWtcIjtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgZm9yICh2YXIgX2kgPSBudW1iZXJPZkNoZWNrczsgX2kgPiAwOyBfaS0tKSB7XG4gICAgICAgIHZhciBfcmV0ID0gX2xvb3AoX2kpO1xuXG4gICAgICAgIGlmIChfcmV0ID09PSBcImJyZWFrXCIpIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdGF0ZS5wbGFjZW1lbnQgIT09IGZpcnN0Rml0dGluZ1BsYWNlbWVudCkge1xuICAgICAgc3RhdGUubW9kaWZpZXJzRGF0YVtuYW1lXS5fc2tpcCA9IHRydWU7XG4gICAgICBzdGF0ZS5wbGFjZW1lbnQgPSBmaXJzdEZpdHRpbmdQbGFjZW1lbnQ7XG4gICAgICBzdGF0ZS5yZXNldCA9IHRydWU7XG4gICAgfVxuICB9IC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tdW51c2VkLW1vZHVsZXNcblxuXG4gIGNvbnN0IGZsaXAkMSA9IHtcbiAgICBuYW1lOiAnZmxpcCcsXG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBwaGFzZTogJ21haW4nLFxuICAgIGZuOiBmbGlwLFxuICAgIHJlcXVpcmVzSWZFeGlzdHM6IFsnb2Zmc2V0J10sXG4gICAgZGF0YToge1xuICAgICAgX3NraXA6IGZhbHNlXG4gICAgfVxuICB9O1xuXG4gIGZ1bmN0aW9uIGdldFNpZGVPZmZzZXRzKG92ZXJmbG93LCByZWN0LCBwcmV2ZW50ZWRPZmZzZXRzKSB7XG4gICAgaWYgKHByZXZlbnRlZE9mZnNldHMgPT09IHZvaWQgMCkge1xuICAgICAgcHJldmVudGVkT2Zmc2V0cyA9IHtcbiAgICAgICAgeDogMCxcbiAgICAgICAgeTogMFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG9wOiBvdmVyZmxvdy50b3AgLSByZWN0LmhlaWdodCAtIHByZXZlbnRlZE9mZnNldHMueSxcbiAgICAgIHJpZ2h0OiBvdmVyZmxvdy5yaWdodCAtIHJlY3Qud2lkdGggKyBwcmV2ZW50ZWRPZmZzZXRzLngsXG4gICAgICBib3R0b206IG92ZXJmbG93LmJvdHRvbSAtIHJlY3QuaGVpZ2h0ICsgcHJldmVudGVkT2Zmc2V0cy55LFxuICAgICAgbGVmdDogb3ZlcmZsb3cubGVmdCAtIHJlY3Qud2lkdGggLSBwcmV2ZW50ZWRPZmZzZXRzLnhcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gaXNBbnlTaWRlRnVsbHlDbGlwcGVkKG92ZXJmbG93KSB7XG4gICAgcmV0dXJuIFt0b3AsIHJpZ2h0LCBib3R0b20sIGxlZnRdLnNvbWUoZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgIHJldHVybiBvdmVyZmxvd1tzaWRlXSA+PSAwO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gaGlkZShfcmVmKSB7XG4gICAgdmFyIHN0YXRlID0gX3JlZi5zdGF0ZSxcbiAgICAgICAgbmFtZSA9IF9yZWYubmFtZTtcbiAgICB2YXIgcmVmZXJlbmNlUmVjdCA9IHN0YXRlLnJlY3RzLnJlZmVyZW5jZTtcbiAgICB2YXIgcG9wcGVyUmVjdCA9IHN0YXRlLnJlY3RzLnBvcHBlcjtcbiAgICB2YXIgcHJldmVudGVkT2Zmc2V0cyA9IHN0YXRlLm1vZGlmaWVyc0RhdGEucHJldmVudE92ZXJmbG93O1xuICAgIHZhciByZWZlcmVuY2VPdmVyZmxvdyA9IGRldGVjdE92ZXJmbG93KHN0YXRlLCB7XG4gICAgICBlbGVtZW50Q29udGV4dDogJ3JlZmVyZW5jZSdcbiAgICB9KTtcbiAgICB2YXIgcG9wcGVyQWx0T3ZlcmZsb3cgPSBkZXRlY3RPdmVyZmxvdyhzdGF0ZSwge1xuICAgICAgYWx0Qm91bmRhcnk6IHRydWVcbiAgICB9KTtcbiAgICB2YXIgcmVmZXJlbmNlQ2xpcHBpbmdPZmZzZXRzID0gZ2V0U2lkZU9mZnNldHMocmVmZXJlbmNlT3ZlcmZsb3csIHJlZmVyZW5jZVJlY3QpO1xuICAgIHZhciBwb3BwZXJFc2NhcGVPZmZzZXRzID0gZ2V0U2lkZU9mZnNldHMocG9wcGVyQWx0T3ZlcmZsb3csIHBvcHBlclJlY3QsIHByZXZlbnRlZE9mZnNldHMpO1xuICAgIHZhciBpc1JlZmVyZW5jZUhpZGRlbiA9IGlzQW55U2lkZUZ1bGx5Q2xpcHBlZChyZWZlcmVuY2VDbGlwcGluZ09mZnNldHMpO1xuICAgIHZhciBoYXNQb3BwZXJFc2NhcGVkID0gaXNBbnlTaWRlRnVsbHlDbGlwcGVkKHBvcHBlckVzY2FwZU9mZnNldHMpO1xuICAgIHN0YXRlLm1vZGlmaWVyc0RhdGFbbmFtZV0gPSB7XG4gICAgICByZWZlcmVuY2VDbGlwcGluZ09mZnNldHM6IHJlZmVyZW5jZUNsaXBwaW5nT2Zmc2V0cyxcbiAgICAgIHBvcHBlckVzY2FwZU9mZnNldHM6IHBvcHBlckVzY2FwZU9mZnNldHMsXG4gICAgICBpc1JlZmVyZW5jZUhpZGRlbjogaXNSZWZlcmVuY2VIaWRkZW4sXG4gICAgICBoYXNQb3BwZXJFc2NhcGVkOiBoYXNQb3BwZXJFc2NhcGVkXG4gICAgfTtcbiAgICBzdGF0ZS5hdHRyaWJ1dGVzLnBvcHBlciA9IE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLmF0dHJpYnV0ZXMucG9wcGVyLCB7XG4gICAgICAnZGF0YS1wb3BwZXItcmVmZXJlbmNlLWhpZGRlbic6IGlzUmVmZXJlbmNlSGlkZGVuLFxuICAgICAgJ2RhdGEtcG9wcGVyLWVzY2FwZWQnOiBoYXNQb3BwZXJFc2NhcGVkXG4gICAgfSk7XG4gIH0gLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby11bnVzZWQtbW9kdWxlc1xuXG5cbiAgY29uc3QgaGlkZSQxID0ge1xuICAgIG5hbWU6ICdoaWRlJyxcbiAgICBlbmFibGVkOiB0cnVlLFxuICAgIHBoYXNlOiAnbWFpbicsXG4gICAgcmVxdWlyZXNJZkV4aXN0czogWydwcmV2ZW50T3ZlcmZsb3cnXSxcbiAgICBmbjogaGlkZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRpc3RhbmNlQW5kU2tpZGRpbmdUb1hZKHBsYWNlbWVudCwgcmVjdHMsIG9mZnNldCkge1xuICAgIHZhciBiYXNlUGxhY2VtZW50ID0gZ2V0QmFzZVBsYWNlbWVudChwbGFjZW1lbnQpO1xuICAgIHZhciBpbnZlcnREaXN0YW5jZSA9IFtsZWZ0LCB0b3BdLmluZGV4T2YoYmFzZVBsYWNlbWVudCkgPj0gMCA/IC0xIDogMTtcblxuICAgIHZhciBfcmVmID0gdHlwZW9mIG9mZnNldCA9PT0gJ2Z1bmN0aW9uJyA/IG9mZnNldChPYmplY3QuYXNzaWduKHt9LCByZWN0cywge1xuICAgICAgcGxhY2VtZW50OiBwbGFjZW1lbnRcbiAgICB9KSkgOiBvZmZzZXQsXG4gICAgICAgIHNraWRkaW5nID0gX3JlZlswXSxcbiAgICAgICAgZGlzdGFuY2UgPSBfcmVmWzFdO1xuXG4gICAgc2tpZGRpbmcgPSBza2lkZGluZyB8fCAwO1xuICAgIGRpc3RhbmNlID0gKGRpc3RhbmNlIHx8IDApICogaW52ZXJ0RGlzdGFuY2U7XG4gICAgcmV0dXJuIFtsZWZ0LCByaWdodF0uaW5kZXhPZihiYXNlUGxhY2VtZW50KSA+PSAwID8ge1xuICAgICAgeDogZGlzdGFuY2UsXG4gICAgICB5OiBza2lkZGluZ1xuICAgIH0gOiB7XG4gICAgICB4OiBza2lkZGluZyxcbiAgICAgIHk6IGRpc3RhbmNlXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9mZnNldChfcmVmMikge1xuICAgIHZhciBzdGF0ZSA9IF9yZWYyLnN0YXRlLFxuICAgICAgICBvcHRpb25zID0gX3JlZjIub3B0aW9ucyxcbiAgICAgICAgbmFtZSA9IF9yZWYyLm5hbWU7XG4gICAgdmFyIF9vcHRpb25zJG9mZnNldCA9IG9wdGlvbnMub2Zmc2V0LFxuICAgICAgICBvZmZzZXQgPSBfb3B0aW9ucyRvZmZzZXQgPT09IHZvaWQgMCA/IFswLCAwXSA6IF9vcHRpb25zJG9mZnNldDtcbiAgICB2YXIgZGF0YSA9IHBsYWNlbWVudHMucmVkdWNlKGZ1bmN0aW9uIChhY2MsIHBsYWNlbWVudCkge1xuICAgICAgYWNjW3BsYWNlbWVudF0gPSBkaXN0YW5jZUFuZFNraWRkaW5nVG9YWShwbGFjZW1lbnQsIHN0YXRlLnJlY3RzLCBvZmZzZXQpO1xuICAgICAgcmV0dXJuIGFjYztcbiAgICB9LCB7fSk7XG4gICAgdmFyIF9kYXRhJHN0YXRlJHBsYWNlbWVudCA9IGRhdGFbc3RhdGUucGxhY2VtZW50XSxcbiAgICAgICAgeCA9IF9kYXRhJHN0YXRlJHBsYWNlbWVudC54LFxuICAgICAgICB5ID0gX2RhdGEkc3RhdGUkcGxhY2VtZW50Lnk7XG5cbiAgICBpZiAoc3RhdGUubW9kaWZpZXJzRGF0YS5wb3BwZXJPZmZzZXRzICE9IG51bGwpIHtcbiAgICAgIHN0YXRlLm1vZGlmaWVyc0RhdGEucG9wcGVyT2Zmc2V0cy54ICs9IHg7XG4gICAgICBzdGF0ZS5tb2RpZmllcnNEYXRhLnBvcHBlck9mZnNldHMueSArPSB5O1xuICAgIH1cblxuICAgIHN0YXRlLm1vZGlmaWVyc0RhdGFbbmFtZV0gPSBkYXRhO1xuICB9IC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tdW51c2VkLW1vZHVsZXNcblxuXG4gIGNvbnN0IG9mZnNldCQxID0ge1xuICAgIG5hbWU6ICdvZmZzZXQnLFxuICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgcGhhc2U6ICdtYWluJyxcbiAgICByZXF1aXJlczogWydwb3BwZXJPZmZzZXRzJ10sXG4gICAgZm46IG9mZnNldFxuICB9O1xuXG4gIGZ1bmN0aW9uIHBvcHBlck9mZnNldHMoX3JlZikge1xuICAgIHZhciBzdGF0ZSA9IF9yZWYuc3RhdGUsXG4gICAgICAgIG5hbWUgPSBfcmVmLm5hbWU7XG4gICAgLy8gT2Zmc2V0cyBhcmUgdGhlIGFjdHVhbCBwb3NpdGlvbiB0aGUgcG9wcGVyIG5lZWRzIHRvIGhhdmUgdG8gYmVcbiAgICAvLyBwcm9wZXJseSBwb3NpdGlvbmVkIG5lYXIgaXRzIHJlZmVyZW5jZSBlbGVtZW50XG4gICAgLy8gVGhpcyBpcyB0aGUgbW9zdCBiYXNpYyBwbGFjZW1lbnQsIGFuZCB3aWxsIGJlIGFkanVzdGVkIGJ5XG4gICAgLy8gdGhlIG1vZGlmaWVycyBpbiB0aGUgbmV4dCBzdGVwXG4gICAgc3RhdGUubW9kaWZpZXJzRGF0YVtuYW1lXSA9IGNvbXB1dGVPZmZzZXRzKHtcbiAgICAgIHJlZmVyZW5jZTogc3RhdGUucmVjdHMucmVmZXJlbmNlLFxuICAgICAgZWxlbWVudDogc3RhdGUucmVjdHMucG9wcGVyLFxuICAgICAgc3RyYXRlZ3k6ICdhYnNvbHV0ZScsXG4gICAgICBwbGFjZW1lbnQ6IHN0YXRlLnBsYWNlbWVudFxuICAgIH0pO1xuICB9IC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tdW51c2VkLW1vZHVsZXNcblxuXG4gIGNvbnN0IHBvcHBlck9mZnNldHMkMSA9IHtcbiAgICBuYW1lOiAncG9wcGVyT2Zmc2V0cycsXG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBwaGFzZTogJ3JlYWQnLFxuICAgIGZuOiBwb3BwZXJPZmZzZXRzLFxuICAgIGRhdGE6IHt9XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2V0QWx0QXhpcyhheGlzKSB7XG4gICAgcmV0dXJuIGF4aXMgPT09ICd4JyA/ICd5JyA6ICd4JztcbiAgfVxuXG4gIGZ1bmN0aW9uIHByZXZlbnRPdmVyZmxvdyhfcmVmKSB7XG4gICAgdmFyIHN0YXRlID0gX3JlZi5zdGF0ZSxcbiAgICAgICAgb3B0aW9ucyA9IF9yZWYub3B0aW9ucyxcbiAgICAgICAgbmFtZSA9IF9yZWYubmFtZTtcbiAgICB2YXIgX29wdGlvbnMkbWFpbkF4aXMgPSBvcHRpb25zLm1haW5BeGlzLFxuICAgICAgICBjaGVja01haW5BeGlzID0gX29wdGlvbnMkbWFpbkF4aXMgPT09IHZvaWQgMCA/IHRydWUgOiBfb3B0aW9ucyRtYWluQXhpcyxcbiAgICAgICAgX29wdGlvbnMkYWx0QXhpcyA9IG9wdGlvbnMuYWx0QXhpcyxcbiAgICAgICAgY2hlY2tBbHRBeGlzID0gX29wdGlvbnMkYWx0QXhpcyA9PT0gdm9pZCAwID8gZmFsc2UgOiBfb3B0aW9ucyRhbHRBeGlzLFxuICAgICAgICBib3VuZGFyeSA9IG9wdGlvbnMuYm91bmRhcnksXG4gICAgICAgIHJvb3RCb3VuZGFyeSA9IG9wdGlvbnMucm9vdEJvdW5kYXJ5LFxuICAgICAgICBhbHRCb3VuZGFyeSA9IG9wdGlvbnMuYWx0Qm91bmRhcnksXG4gICAgICAgIHBhZGRpbmcgPSBvcHRpb25zLnBhZGRpbmcsXG4gICAgICAgIF9vcHRpb25zJHRldGhlciA9IG9wdGlvbnMudGV0aGVyLFxuICAgICAgICB0ZXRoZXIgPSBfb3B0aW9ucyR0ZXRoZXIgPT09IHZvaWQgMCA/IHRydWUgOiBfb3B0aW9ucyR0ZXRoZXIsXG4gICAgICAgIF9vcHRpb25zJHRldGhlck9mZnNldCA9IG9wdGlvbnMudGV0aGVyT2Zmc2V0LFxuICAgICAgICB0ZXRoZXJPZmZzZXQgPSBfb3B0aW9ucyR0ZXRoZXJPZmZzZXQgPT09IHZvaWQgMCA/IDAgOiBfb3B0aW9ucyR0ZXRoZXJPZmZzZXQ7XG4gICAgdmFyIG92ZXJmbG93ID0gZGV0ZWN0T3ZlcmZsb3coc3RhdGUsIHtcbiAgICAgIGJvdW5kYXJ5OiBib3VuZGFyeSxcbiAgICAgIHJvb3RCb3VuZGFyeTogcm9vdEJvdW5kYXJ5LFxuICAgICAgcGFkZGluZzogcGFkZGluZyxcbiAgICAgIGFsdEJvdW5kYXJ5OiBhbHRCb3VuZGFyeVxuICAgIH0pO1xuICAgIHZhciBiYXNlUGxhY2VtZW50ID0gZ2V0QmFzZVBsYWNlbWVudChzdGF0ZS5wbGFjZW1lbnQpO1xuICAgIHZhciB2YXJpYXRpb24gPSBnZXRWYXJpYXRpb24oc3RhdGUucGxhY2VtZW50KTtcbiAgICB2YXIgaXNCYXNlUGxhY2VtZW50ID0gIXZhcmlhdGlvbjtcbiAgICB2YXIgbWFpbkF4aXMgPSBnZXRNYWluQXhpc0Zyb21QbGFjZW1lbnQoYmFzZVBsYWNlbWVudCk7XG4gICAgdmFyIGFsdEF4aXMgPSBnZXRBbHRBeGlzKG1haW5BeGlzKTtcbiAgICB2YXIgcG9wcGVyT2Zmc2V0cyA9IHN0YXRlLm1vZGlmaWVyc0RhdGEucG9wcGVyT2Zmc2V0cztcbiAgICB2YXIgcmVmZXJlbmNlUmVjdCA9IHN0YXRlLnJlY3RzLnJlZmVyZW5jZTtcbiAgICB2YXIgcG9wcGVyUmVjdCA9IHN0YXRlLnJlY3RzLnBvcHBlcjtcbiAgICB2YXIgdGV0aGVyT2Zmc2V0VmFsdWUgPSB0eXBlb2YgdGV0aGVyT2Zmc2V0ID09PSAnZnVuY3Rpb24nID8gdGV0aGVyT2Zmc2V0KE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLnJlY3RzLCB7XG4gICAgICBwbGFjZW1lbnQ6IHN0YXRlLnBsYWNlbWVudFxuICAgIH0pKSA6IHRldGhlck9mZnNldDtcbiAgICB2YXIgbm9ybWFsaXplZFRldGhlck9mZnNldFZhbHVlID0gdHlwZW9mIHRldGhlck9mZnNldFZhbHVlID09PSAnbnVtYmVyJyA/IHtcbiAgICAgIG1haW5BeGlzOiB0ZXRoZXJPZmZzZXRWYWx1ZSxcbiAgICAgIGFsdEF4aXM6IHRldGhlck9mZnNldFZhbHVlXG4gICAgfSA6IE9iamVjdC5hc3NpZ24oe1xuICAgICAgbWFpbkF4aXM6IDAsXG4gICAgICBhbHRBeGlzOiAwXG4gICAgfSwgdGV0aGVyT2Zmc2V0VmFsdWUpO1xuICAgIHZhciBvZmZzZXRNb2RpZmllclN0YXRlID0gc3RhdGUubW9kaWZpZXJzRGF0YS5vZmZzZXQgPyBzdGF0ZS5tb2RpZmllcnNEYXRhLm9mZnNldFtzdGF0ZS5wbGFjZW1lbnRdIDogbnVsbDtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIHg6IDAsXG4gICAgICB5OiAwXG4gICAgfTtcblxuICAgIGlmICghcG9wcGVyT2Zmc2V0cykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaGVja01haW5BeGlzKSB7XG4gICAgICB2YXIgX29mZnNldE1vZGlmaWVyU3RhdGUkO1xuXG4gICAgICB2YXIgbWFpblNpZGUgPSBtYWluQXhpcyA9PT0gJ3knID8gdG9wIDogbGVmdDtcbiAgICAgIHZhciBhbHRTaWRlID0gbWFpbkF4aXMgPT09ICd5JyA/IGJvdHRvbSA6IHJpZ2h0O1xuICAgICAgdmFyIGxlbiA9IG1haW5BeGlzID09PSAneScgPyAnaGVpZ2h0JyA6ICd3aWR0aCc7XG4gICAgICB2YXIgb2Zmc2V0ID0gcG9wcGVyT2Zmc2V0c1ttYWluQXhpc107XG4gICAgICB2YXIgbWluJDEgPSBvZmZzZXQgKyBvdmVyZmxvd1ttYWluU2lkZV07XG4gICAgICB2YXIgbWF4JDEgPSBvZmZzZXQgLSBvdmVyZmxvd1thbHRTaWRlXTtcbiAgICAgIHZhciBhZGRpdGl2ZSA9IHRldGhlciA/IC1wb3BwZXJSZWN0W2xlbl0gLyAyIDogMDtcbiAgICAgIHZhciBtaW5MZW4gPSB2YXJpYXRpb24gPT09IHN0YXJ0ID8gcmVmZXJlbmNlUmVjdFtsZW5dIDogcG9wcGVyUmVjdFtsZW5dO1xuICAgICAgdmFyIG1heExlbiA9IHZhcmlhdGlvbiA9PT0gc3RhcnQgPyAtcG9wcGVyUmVjdFtsZW5dIDogLXJlZmVyZW5jZVJlY3RbbGVuXTsgLy8gV2UgbmVlZCB0byBpbmNsdWRlIHRoZSBhcnJvdyBpbiB0aGUgY2FsY3VsYXRpb24gc28gdGhlIGFycm93IGRvZXNuJ3QgZ29cbiAgICAgIC8vIG91dHNpZGUgdGhlIHJlZmVyZW5jZSBib3VuZHNcblxuICAgICAgdmFyIGFycm93RWxlbWVudCA9IHN0YXRlLmVsZW1lbnRzLmFycm93O1xuICAgICAgdmFyIGFycm93UmVjdCA9IHRldGhlciAmJiBhcnJvd0VsZW1lbnQgPyBnZXRMYXlvdXRSZWN0KGFycm93RWxlbWVudCkgOiB7XG4gICAgICAgIHdpZHRoOiAwLFxuICAgICAgICBoZWlnaHQ6IDBcbiAgICAgIH07XG4gICAgICB2YXIgYXJyb3dQYWRkaW5nT2JqZWN0ID0gc3RhdGUubW9kaWZpZXJzRGF0YVsnYXJyb3cjcGVyc2lzdGVudCddID8gc3RhdGUubW9kaWZpZXJzRGF0YVsnYXJyb3cjcGVyc2lzdGVudCddLnBhZGRpbmcgOiBnZXRGcmVzaFNpZGVPYmplY3QoKTtcbiAgICAgIHZhciBhcnJvd1BhZGRpbmdNaW4gPSBhcnJvd1BhZGRpbmdPYmplY3RbbWFpblNpZGVdO1xuICAgICAgdmFyIGFycm93UGFkZGluZ01heCA9IGFycm93UGFkZGluZ09iamVjdFthbHRTaWRlXTsgLy8gSWYgdGhlIHJlZmVyZW5jZSBsZW5ndGggaXMgc21hbGxlciB0aGFuIHRoZSBhcnJvdyBsZW5ndGgsIHdlIGRvbid0IHdhbnRcbiAgICAgIC8vIHRvIGluY2x1ZGUgaXRzIGZ1bGwgc2l6ZSBpbiB0aGUgY2FsY3VsYXRpb24uIElmIHRoZSByZWZlcmVuY2UgaXMgc21hbGxcbiAgICAgIC8vIGFuZCBuZWFyIHRoZSBlZGdlIG9mIGEgYm91bmRhcnksIHRoZSBwb3BwZXIgY2FuIG92ZXJmbG93IGV2ZW4gaWYgdGhlXG4gICAgICAvLyByZWZlcmVuY2UgaXMgbm90IG92ZXJmbG93aW5nIGFzIHdlbGwgKGUuZy4gdmlydHVhbCBlbGVtZW50cyB3aXRoIG5vXG4gICAgICAvLyB3aWR0aCBvciBoZWlnaHQpXG5cbiAgICAgIHZhciBhcnJvd0xlbiA9IHdpdGhpbigwLCByZWZlcmVuY2VSZWN0W2xlbl0sIGFycm93UmVjdFtsZW5dKTtcbiAgICAgIHZhciBtaW5PZmZzZXQgPSBpc0Jhc2VQbGFjZW1lbnQgPyByZWZlcmVuY2VSZWN0W2xlbl0gLyAyIC0gYWRkaXRpdmUgLSBhcnJvd0xlbiAtIGFycm93UGFkZGluZ01pbiAtIG5vcm1hbGl6ZWRUZXRoZXJPZmZzZXRWYWx1ZS5tYWluQXhpcyA6IG1pbkxlbiAtIGFycm93TGVuIC0gYXJyb3dQYWRkaW5nTWluIC0gbm9ybWFsaXplZFRldGhlck9mZnNldFZhbHVlLm1haW5BeGlzO1xuICAgICAgdmFyIG1heE9mZnNldCA9IGlzQmFzZVBsYWNlbWVudCA/IC1yZWZlcmVuY2VSZWN0W2xlbl0gLyAyICsgYWRkaXRpdmUgKyBhcnJvd0xlbiArIGFycm93UGFkZGluZ01heCArIG5vcm1hbGl6ZWRUZXRoZXJPZmZzZXRWYWx1ZS5tYWluQXhpcyA6IG1heExlbiArIGFycm93TGVuICsgYXJyb3dQYWRkaW5nTWF4ICsgbm9ybWFsaXplZFRldGhlck9mZnNldFZhbHVlLm1haW5BeGlzO1xuICAgICAgdmFyIGFycm93T2Zmc2V0UGFyZW50ID0gc3RhdGUuZWxlbWVudHMuYXJyb3cgJiYgZ2V0T2Zmc2V0UGFyZW50KHN0YXRlLmVsZW1lbnRzLmFycm93KTtcbiAgICAgIHZhciBjbGllbnRPZmZzZXQgPSBhcnJvd09mZnNldFBhcmVudCA/IG1haW5BeGlzID09PSAneScgPyBhcnJvd09mZnNldFBhcmVudC5jbGllbnRUb3AgfHwgMCA6IGFycm93T2Zmc2V0UGFyZW50LmNsaWVudExlZnQgfHwgMCA6IDA7XG4gICAgICB2YXIgb2Zmc2V0TW9kaWZpZXJWYWx1ZSA9IChfb2Zmc2V0TW9kaWZpZXJTdGF0ZSQgPSBvZmZzZXRNb2RpZmllclN0YXRlID09IG51bGwgPyB2b2lkIDAgOiBvZmZzZXRNb2RpZmllclN0YXRlW21haW5BeGlzXSkgIT0gbnVsbCA/IF9vZmZzZXRNb2RpZmllclN0YXRlJCA6IDA7XG4gICAgICB2YXIgdGV0aGVyTWluID0gb2Zmc2V0ICsgbWluT2Zmc2V0IC0gb2Zmc2V0TW9kaWZpZXJWYWx1ZSAtIGNsaWVudE9mZnNldDtcbiAgICAgIHZhciB0ZXRoZXJNYXggPSBvZmZzZXQgKyBtYXhPZmZzZXQgLSBvZmZzZXRNb2RpZmllclZhbHVlO1xuICAgICAgdmFyIHByZXZlbnRlZE9mZnNldCA9IHdpdGhpbih0ZXRoZXIgPyBtaW4obWluJDEsIHRldGhlck1pbikgOiBtaW4kMSwgb2Zmc2V0LCB0ZXRoZXIgPyBtYXgobWF4JDEsIHRldGhlck1heCkgOiBtYXgkMSk7XG4gICAgICBwb3BwZXJPZmZzZXRzW21haW5BeGlzXSA9IHByZXZlbnRlZE9mZnNldDtcbiAgICAgIGRhdGFbbWFpbkF4aXNdID0gcHJldmVudGVkT2Zmc2V0IC0gb2Zmc2V0O1xuICAgIH1cblxuICAgIGlmIChjaGVja0FsdEF4aXMpIHtcbiAgICAgIHZhciBfb2Zmc2V0TW9kaWZpZXJTdGF0ZSQyO1xuXG4gICAgICB2YXIgX21haW5TaWRlID0gbWFpbkF4aXMgPT09ICd4JyA/IHRvcCA6IGxlZnQ7XG5cbiAgICAgIHZhciBfYWx0U2lkZSA9IG1haW5BeGlzID09PSAneCcgPyBib3R0b20gOiByaWdodDtcblxuICAgICAgdmFyIF9vZmZzZXQgPSBwb3BwZXJPZmZzZXRzW2FsdEF4aXNdO1xuXG4gICAgICB2YXIgX2xlbiA9IGFsdEF4aXMgPT09ICd5JyA/ICdoZWlnaHQnIDogJ3dpZHRoJztcblxuICAgICAgdmFyIF9taW4gPSBfb2Zmc2V0ICsgb3ZlcmZsb3dbX21haW5TaWRlXTtcblxuICAgICAgdmFyIF9tYXggPSBfb2Zmc2V0IC0gb3ZlcmZsb3dbX2FsdFNpZGVdO1xuXG4gICAgICB2YXIgaXNPcmlnaW5TaWRlID0gW3RvcCwgbGVmdF0uaW5kZXhPZihiYXNlUGxhY2VtZW50KSAhPT0gLTE7XG5cbiAgICAgIHZhciBfb2Zmc2V0TW9kaWZpZXJWYWx1ZSA9IChfb2Zmc2V0TW9kaWZpZXJTdGF0ZSQyID0gb2Zmc2V0TW9kaWZpZXJTdGF0ZSA9PSBudWxsID8gdm9pZCAwIDogb2Zmc2V0TW9kaWZpZXJTdGF0ZVthbHRBeGlzXSkgIT0gbnVsbCA/IF9vZmZzZXRNb2RpZmllclN0YXRlJDIgOiAwO1xuXG4gICAgICB2YXIgX3RldGhlck1pbiA9IGlzT3JpZ2luU2lkZSA/IF9taW4gOiBfb2Zmc2V0IC0gcmVmZXJlbmNlUmVjdFtfbGVuXSAtIHBvcHBlclJlY3RbX2xlbl0gLSBfb2Zmc2V0TW9kaWZpZXJWYWx1ZSArIG5vcm1hbGl6ZWRUZXRoZXJPZmZzZXRWYWx1ZS5hbHRBeGlzO1xuXG4gICAgICB2YXIgX3RldGhlck1heCA9IGlzT3JpZ2luU2lkZSA/IF9vZmZzZXQgKyByZWZlcmVuY2VSZWN0W19sZW5dICsgcG9wcGVyUmVjdFtfbGVuXSAtIF9vZmZzZXRNb2RpZmllclZhbHVlIC0gbm9ybWFsaXplZFRldGhlck9mZnNldFZhbHVlLmFsdEF4aXMgOiBfbWF4O1xuXG4gICAgICB2YXIgX3ByZXZlbnRlZE9mZnNldCA9IHRldGhlciAmJiBpc09yaWdpblNpZGUgPyB3aXRoaW5NYXhDbGFtcChfdGV0aGVyTWluLCBfb2Zmc2V0LCBfdGV0aGVyTWF4KSA6IHdpdGhpbih0ZXRoZXIgPyBfdGV0aGVyTWluIDogX21pbiwgX29mZnNldCwgdGV0aGVyID8gX3RldGhlck1heCA6IF9tYXgpO1xuXG4gICAgICBwb3BwZXJPZmZzZXRzW2FsdEF4aXNdID0gX3ByZXZlbnRlZE9mZnNldDtcbiAgICAgIGRhdGFbYWx0QXhpc10gPSBfcHJldmVudGVkT2Zmc2V0IC0gX29mZnNldDtcbiAgICB9XG5cbiAgICBzdGF0ZS5tb2RpZmllcnNEYXRhW25hbWVdID0gZGF0YTtcbiAgfSAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgaW1wb3J0L25vLXVudXNlZC1tb2R1bGVzXG5cblxuICBjb25zdCBwcmV2ZW50T3ZlcmZsb3ckMSA9IHtcbiAgICBuYW1lOiAncHJldmVudE92ZXJmbG93JyxcbiAgICBlbmFibGVkOiB0cnVlLFxuICAgIHBoYXNlOiAnbWFpbicsXG4gICAgZm46IHByZXZlbnRPdmVyZmxvdyxcbiAgICByZXF1aXJlc0lmRXhpc3RzOiBbJ29mZnNldCddXG4gIH07XG5cbiAgZnVuY3Rpb24gZ2V0SFRNTEVsZW1lbnRTY3JvbGwoZWxlbWVudCkge1xuICAgIHJldHVybiB7XG4gICAgICBzY3JvbGxMZWZ0OiBlbGVtZW50LnNjcm9sbExlZnQsXG4gICAgICBzY3JvbGxUb3A6IGVsZW1lbnQuc2Nyb2xsVG9wXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldE5vZGVTY3JvbGwobm9kZSkge1xuICAgIGlmIChub2RlID09PSBnZXRXaW5kb3cobm9kZSkgfHwgIWlzSFRNTEVsZW1lbnQobm9kZSkpIHtcbiAgICAgIHJldHVybiBnZXRXaW5kb3dTY3JvbGwobm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBnZXRIVE1MRWxlbWVudFNjcm9sbChub2RlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBpc0VsZW1lbnRTY2FsZWQoZWxlbWVudCkge1xuICAgIHZhciByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB2YXIgc2NhbGVYID0gcm91bmQocmVjdC53aWR0aCkgLyBlbGVtZW50Lm9mZnNldFdpZHRoIHx8IDE7XG4gICAgdmFyIHNjYWxlWSA9IHJvdW5kKHJlY3QuaGVpZ2h0KSAvIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IHx8IDE7XG4gICAgcmV0dXJuIHNjYWxlWCAhPT0gMSB8fCBzY2FsZVkgIT09IDE7XG4gIH0gLy8gUmV0dXJucyB0aGUgY29tcG9zaXRlIHJlY3Qgb2YgYW4gZWxlbWVudCByZWxhdGl2ZSB0byBpdHMgb2Zmc2V0UGFyZW50LlxuICAvLyBDb21wb3NpdGUgbWVhbnMgaXQgdGFrZXMgaW50byBhY2NvdW50IHRyYW5zZm9ybXMgYXMgd2VsbCBhcyBsYXlvdXQuXG5cblxuICBmdW5jdGlvbiBnZXRDb21wb3NpdGVSZWN0KGVsZW1lbnRPclZpcnR1YWxFbGVtZW50LCBvZmZzZXRQYXJlbnQsIGlzRml4ZWQpIHtcbiAgICBpZiAoaXNGaXhlZCA9PT0gdm9pZCAwKSB7XG4gICAgICBpc0ZpeGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGlzT2Zmc2V0UGFyZW50QW5FbGVtZW50ID0gaXNIVE1MRWxlbWVudChvZmZzZXRQYXJlbnQpO1xuICAgIHZhciBvZmZzZXRQYXJlbnRJc1NjYWxlZCA9IGlzSFRNTEVsZW1lbnQob2Zmc2V0UGFyZW50KSAmJiBpc0VsZW1lbnRTY2FsZWQob2Zmc2V0UGFyZW50KTtcbiAgICB2YXIgZG9jdW1lbnRFbGVtZW50ID0gZ2V0RG9jdW1lbnRFbGVtZW50KG9mZnNldFBhcmVudCk7XG4gICAgdmFyIHJlY3QgPSBnZXRCb3VuZGluZ0NsaWVudFJlY3QoZWxlbWVudE9yVmlydHVhbEVsZW1lbnQsIG9mZnNldFBhcmVudElzU2NhbGVkLCBpc0ZpeGVkKTtcbiAgICB2YXIgc2Nyb2xsID0ge1xuICAgICAgc2Nyb2xsTGVmdDogMCxcbiAgICAgIHNjcm9sbFRvcDogMFxuICAgIH07XG4gICAgdmFyIG9mZnNldHMgPSB7XG4gICAgICB4OiAwLFxuICAgICAgeTogMFxuICAgIH07XG5cbiAgICBpZiAoaXNPZmZzZXRQYXJlbnRBbkVsZW1lbnQgfHwgIWlzT2Zmc2V0UGFyZW50QW5FbGVtZW50ICYmICFpc0ZpeGVkKSB7XG4gICAgICBpZiAoZ2V0Tm9kZU5hbWUob2Zmc2V0UGFyZW50KSAhPT0gJ2JvZHknIHx8IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wb3BwZXJqcy9wb3BwZXItY29yZS9pc3N1ZXMvMTA3OFxuICAgICAgaXNTY3JvbGxQYXJlbnQoZG9jdW1lbnRFbGVtZW50KSkge1xuICAgICAgICBzY3JvbGwgPSBnZXROb2RlU2Nyb2xsKG9mZnNldFBhcmVudCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0hUTUxFbGVtZW50KG9mZnNldFBhcmVudCkpIHtcbiAgICAgICAgb2Zmc2V0cyA9IGdldEJvdW5kaW5nQ2xpZW50UmVjdChvZmZzZXRQYXJlbnQsIHRydWUpO1xuICAgICAgICBvZmZzZXRzLnggKz0gb2Zmc2V0UGFyZW50LmNsaWVudExlZnQ7XG4gICAgICAgIG9mZnNldHMueSArPSBvZmZzZXRQYXJlbnQuY2xpZW50VG9wO1xuICAgICAgfSBlbHNlIGlmIChkb2N1bWVudEVsZW1lbnQpIHtcbiAgICAgICAgb2Zmc2V0cy54ID0gZ2V0V2luZG93U2Nyb2xsQmFyWChkb2N1bWVudEVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB4OiByZWN0LmxlZnQgKyBzY3JvbGwuc2Nyb2xsTGVmdCAtIG9mZnNldHMueCxcbiAgICAgIHk6IHJlY3QudG9wICsgc2Nyb2xsLnNjcm9sbFRvcCAtIG9mZnNldHMueSxcbiAgICAgIHdpZHRoOiByZWN0LndpZHRoLFxuICAgICAgaGVpZ2h0OiByZWN0LmhlaWdodFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBvcmRlcihtb2RpZmllcnMpIHtcbiAgICB2YXIgbWFwID0gbmV3IE1hcCgpO1xuICAgIHZhciB2aXNpdGVkID0gbmV3IFNldCgpO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBtb2RpZmllcnMuZm9yRWFjaChmdW5jdGlvbiAobW9kaWZpZXIpIHtcbiAgICAgIG1hcC5zZXQobW9kaWZpZXIubmFtZSwgbW9kaWZpZXIpO1xuICAgIH0pOyAvLyBPbiB2aXNpdGluZyBvYmplY3QsIGNoZWNrIGZvciBpdHMgZGVwZW5kZW5jaWVzIGFuZCB2aXNpdCB0aGVtIHJlY3Vyc2l2ZWx5XG5cbiAgICBmdW5jdGlvbiBzb3J0KG1vZGlmaWVyKSB7XG4gICAgICB2aXNpdGVkLmFkZChtb2RpZmllci5uYW1lKTtcbiAgICAgIHZhciByZXF1aXJlcyA9IFtdLmNvbmNhdChtb2RpZmllci5yZXF1aXJlcyB8fCBbXSwgbW9kaWZpZXIucmVxdWlyZXNJZkV4aXN0cyB8fCBbXSk7XG4gICAgICByZXF1aXJlcy5mb3JFYWNoKGZ1bmN0aW9uIChkZXApIHtcbiAgICAgICAgaWYgKCF2aXNpdGVkLmhhcyhkZXApKSB7XG4gICAgICAgICAgdmFyIGRlcE1vZGlmaWVyID0gbWFwLmdldChkZXApO1xuXG4gICAgICAgICAgaWYgKGRlcE1vZGlmaWVyKSB7XG4gICAgICAgICAgICBzb3J0KGRlcE1vZGlmaWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmVzdWx0LnB1c2gobW9kaWZpZXIpO1xuICAgIH1cblxuICAgIG1vZGlmaWVycy5mb3JFYWNoKGZ1bmN0aW9uIChtb2RpZmllcikge1xuICAgICAgaWYgKCF2aXNpdGVkLmhhcyhtb2RpZmllci5uYW1lKSkge1xuICAgICAgICAvLyBjaGVjayBmb3IgdmlzaXRlZCBvYmplY3RcbiAgICAgICAgc29ydChtb2RpZmllcik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9yZGVyTW9kaWZpZXJzKG1vZGlmaWVycykge1xuICAgIC8vIG9yZGVyIGJhc2VkIG9uIGRlcGVuZGVuY2llc1xuICAgIHZhciBvcmRlcmVkTW9kaWZpZXJzID0gb3JkZXIobW9kaWZpZXJzKTsgLy8gb3JkZXIgYmFzZWQgb24gcGhhc2VcblxuICAgIHJldHVybiBtb2RpZmllclBoYXNlcy5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgcGhhc2UpIHtcbiAgICAgIHJldHVybiBhY2MuY29uY2F0KG9yZGVyZWRNb2RpZmllcnMuZmlsdGVyKGZ1bmN0aW9uIChtb2RpZmllcikge1xuICAgICAgICByZXR1cm4gbW9kaWZpZXIucGhhc2UgPT09IHBoYXNlO1xuICAgICAgfSkpO1xuICAgIH0sIFtdKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlYm91bmNlKGZuKSB7XG4gICAgdmFyIHBlbmRpbmc7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghcGVuZGluZykge1xuICAgICAgICBwZW5kaW5nID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICBQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHBlbmRpbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXNvbHZlKGZuKCkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBlbmRpbmc7XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1lcmdlQnlOYW1lKG1vZGlmaWVycykge1xuICAgIHZhciBtZXJnZWQgPSBtb2RpZmllcnMucmVkdWNlKGZ1bmN0aW9uIChtZXJnZWQsIGN1cnJlbnQpIHtcbiAgICAgIHZhciBleGlzdGluZyA9IG1lcmdlZFtjdXJyZW50Lm5hbWVdO1xuICAgICAgbWVyZ2VkW2N1cnJlbnQubmFtZV0gPSBleGlzdGluZyA/IE9iamVjdC5hc3NpZ24oe30sIGV4aXN0aW5nLCBjdXJyZW50LCB7XG4gICAgICAgIG9wdGlvbnM6IE9iamVjdC5hc3NpZ24oe30sIGV4aXN0aW5nLm9wdGlvbnMsIGN1cnJlbnQub3B0aW9ucyksXG4gICAgICAgIGRhdGE6IE9iamVjdC5hc3NpZ24oe30sIGV4aXN0aW5nLmRhdGEsIGN1cnJlbnQuZGF0YSlcbiAgICAgIH0pIDogY3VycmVudDtcbiAgICAgIHJldHVybiBtZXJnZWQ7XG4gICAgfSwge30pOyAvLyBJRTExIGRvZXMgbm90IHN1cHBvcnQgT2JqZWN0LnZhbHVlc1xuXG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKG1lcmdlZCkubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIHJldHVybiBtZXJnZWRba2V5XTtcbiAgICB9KTtcbiAgfVxuXG4gIHZhciBERUZBVUxUX09QVElPTlMgPSB7XG4gICAgcGxhY2VtZW50OiAnYm90dG9tJyxcbiAgICBtb2RpZmllcnM6IFtdLFxuICAgIHN0cmF0ZWd5OiAnYWJzb2x1dGUnXG4gIH07XG5cbiAgZnVuY3Rpb24gYXJlVmFsaWRFbGVtZW50cygpIHtcbiAgICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IG5ldyBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgIGFyZ3NbX2tleV0gPSBhcmd1bWVudHNbX2tleV07XG4gICAgfVxuXG4gICAgcmV0dXJuICFhcmdzLnNvbWUoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgIHJldHVybiAhKGVsZW1lbnQgJiYgdHlwZW9mIGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0ID09PSAnZnVuY3Rpb24nKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvcHBlckdlbmVyYXRvcihnZW5lcmF0b3JPcHRpb25zKSB7XG4gICAgaWYgKGdlbmVyYXRvck9wdGlvbnMgPT09IHZvaWQgMCkge1xuICAgICAgZ2VuZXJhdG9yT3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHZhciBfZ2VuZXJhdG9yT3B0aW9ucyA9IGdlbmVyYXRvck9wdGlvbnMsXG4gICAgICAgIF9nZW5lcmF0b3JPcHRpb25zJGRlZiA9IF9nZW5lcmF0b3JPcHRpb25zLmRlZmF1bHRNb2RpZmllcnMsXG4gICAgICAgIGRlZmF1bHRNb2RpZmllcnMgPSBfZ2VuZXJhdG9yT3B0aW9ucyRkZWYgPT09IHZvaWQgMCA/IFtdIDogX2dlbmVyYXRvck9wdGlvbnMkZGVmLFxuICAgICAgICBfZ2VuZXJhdG9yT3B0aW9ucyRkZWYyID0gX2dlbmVyYXRvck9wdGlvbnMuZGVmYXVsdE9wdGlvbnMsXG4gICAgICAgIGRlZmF1bHRPcHRpb25zID0gX2dlbmVyYXRvck9wdGlvbnMkZGVmMiA9PT0gdm9pZCAwID8gREVGQVVMVF9PUFRJT05TIDogX2dlbmVyYXRvck9wdGlvbnMkZGVmMjtcbiAgICByZXR1cm4gZnVuY3Rpb24gY3JlYXRlUG9wcGVyKHJlZmVyZW5jZSwgcG9wcGVyLCBvcHRpb25zKSB7XG4gICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7XG4gICAgICAgIG9wdGlvbnMgPSBkZWZhdWx0T3B0aW9ucztcbiAgICAgIH1cblxuICAgICAgdmFyIHN0YXRlID0ge1xuICAgICAgICBwbGFjZW1lbnQ6ICdib3R0b20nLFxuICAgICAgICBvcmRlcmVkTW9kaWZpZXJzOiBbXSxcbiAgICAgICAgb3B0aW9uczogT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9PUFRJT05TLCBkZWZhdWx0T3B0aW9ucyksXG4gICAgICAgIG1vZGlmaWVyc0RhdGE6IHt9LFxuICAgICAgICBlbGVtZW50czoge1xuICAgICAgICAgIHJlZmVyZW5jZTogcmVmZXJlbmNlLFxuICAgICAgICAgIHBvcHBlcjogcG9wcGVyXG4gICAgICAgIH0sXG4gICAgICAgIGF0dHJpYnV0ZXM6IHt9LFxuICAgICAgICBzdHlsZXM6IHt9XG4gICAgICB9O1xuICAgICAgdmFyIGVmZmVjdENsZWFudXBGbnMgPSBbXTtcbiAgICAgIHZhciBpc0Rlc3Ryb3llZCA9IGZhbHNlO1xuICAgICAgdmFyIGluc3RhbmNlID0ge1xuICAgICAgICBzdGF0ZTogc3RhdGUsXG4gICAgICAgIHNldE9wdGlvbnM6IGZ1bmN0aW9uIHNldE9wdGlvbnMoc2V0T3B0aW9uc0FjdGlvbikge1xuICAgICAgICAgIHZhciBvcHRpb25zID0gdHlwZW9mIHNldE9wdGlvbnNBY3Rpb24gPT09ICdmdW5jdGlvbicgPyBzZXRPcHRpb25zQWN0aW9uKHN0YXRlLm9wdGlvbnMpIDogc2V0T3B0aW9uc0FjdGlvbjtcbiAgICAgICAgICBjbGVhbnVwTW9kaWZpZXJFZmZlY3RzKCk7XG4gICAgICAgICAgc3RhdGUub3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBzdGF0ZS5vcHRpb25zLCBvcHRpb25zKTtcbiAgICAgICAgICBzdGF0ZS5zY3JvbGxQYXJlbnRzID0ge1xuICAgICAgICAgICAgcmVmZXJlbmNlOiBpc0VsZW1lbnQocmVmZXJlbmNlKSA/IGxpc3RTY3JvbGxQYXJlbnRzKHJlZmVyZW5jZSkgOiByZWZlcmVuY2UuY29udGV4dEVsZW1lbnQgPyBsaXN0U2Nyb2xsUGFyZW50cyhyZWZlcmVuY2UuY29udGV4dEVsZW1lbnQpIDogW10sXG4gICAgICAgICAgICBwb3BwZXI6IGxpc3RTY3JvbGxQYXJlbnRzKHBvcHBlcilcbiAgICAgICAgICB9OyAvLyBPcmRlcnMgdGhlIG1vZGlmaWVycyBiYXNlZCBvbiB0aGVpciBkZXBlbmRlbmNpZXMgYW5kIGBwaGFzZWBcbiAgICAgICAgICAvLyBwcm9wZXJ0aWVzXG5cbiAgICAgICAgICB2YXIgb3JkZXJlZE1vZGlmaWVycyA9IG9yZGVyTW9kaWZpZXJzKG1lcmdlQnlOYW1lKFtdLmNvbmNhdChkZWZhdWx0TW9kaWZpZXJzLCBzdGF0ZS5vcHRpb25zLm1vZGlmaWVycykpKTsgLy8gU3RyaXAgb3V0IGRpc2FibGVkIG1vZGlmaWVyc1xuXG4gICAgICAgICAgc3RhdGUub3JkZXJlZE1vZGlmaWVycyA9IG9yZGVyZWRNb2RpZmllcnMuZmlsdGVyKGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICByZXR1cm4gbS5lbmFibGVkO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJ1bk1vZGlmaWVyRWZmZWN0cygpO1xuICAgICAgICAgIHJldHVybiBpbnN0YW5jZS51cGRhdGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgLy8gU3luYyB1cGRhdGUgXHUyMDEzIGl0IHdpbGwgYWx3YXlzIGJlIGV4ZWN1dGVkLCBldmVuIGlmIG5vdCBuZWNlc3NhcnkuIFRoaXNcbiAgICAgICAgLy8gaXMgdXNlZnVsIGZvciBsb3cgZnJlcXVlbmN5IHVwZGF0ZXMgd2hlcmUgc3luYyBiZWhhdmlvciBzaW1wbGlmaWVzIHRoZVxuICAgICAgICAvLyBsb2dpYy5cbiAgICAgICAgLy8gRm9yIGhpZ2ggZnJlcXVlbmN5IHVwZGF0ZXMgKGUuZy4gYHJlc2l6ZWAgYW5kIGBzY3JvbGxgIGV2ZW50cyksIGFsd2F5c1xuICAgICAgICAvLyBwcmVmZXIgdGhlIGFzeW5jIFBvcHBlciN1cGRhdGUgbWV0aG9kXG4gICAgICAgIGZvcmNlVXBkYXRlOiBmdW5jdGlvbiBmb3JjZVVwZGF0ZSgpIHtcbiAgICAgICAgICBpZiAoaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgX3N0YXRlJGVsZW1lbnRzID0gc3RhdGUuZWxlbWVudHMsXG4gICAgICAgICAgICAgIHJlZmVyZW5jZSA9IF9zdGF0ZSRlbGVtZW50cy5yZWZlcmVuY2UsXG4gICAgICAgICAgICAgIHBvcHBlciA9IF9zdGF0ZSRlbGVtZW50cy5wb3BwZXI7IC8vIERvbid0IHByb2NlZWQgaWYgYHJlZmVyZW5jZWAgb3IgYHBvcHBlcmAgYXJlIG5vdCB2YWxpZCBlbGVtZW50c1xuICAgICAgICAgIC8vIGFueW1vcmVcblxuICAgICAgICAgIGlmICghYXJlVmFsaWRFbGVtZW50cyhyZWZlcmVuY2UsIHBvcHBlcikpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9IC8vIFN0b3JlIHRoZSByZWZlcmVuY2UgYW5kIHBvcHBlciByZWN0cyB0byBiZSByZWFkIGJ5IG1vZGlmaWVyc1xuXG5cbiAgICAgICAgICBzdGF0ZS5yZWN0cyA9IHtcbiAgICAgICAgICAgIHJlZmVyZW5jZTogZ2V0Q29tcG9zaXRlUmVjdChyZWZlcmVuY2UsIGdldE9mZnNldFBhcmVudChwb3BwZXIpLCBzdGF0ZS5vcHRpb25zLnN0cmF0ZWd5ID09PSAnZml4ZWQnKSxcbiAgICAgICAgICAgIHBvcHBlcjogZ2V0TGF5b3V0UmVjdChwb3BwZXIpXG4gICAgICAgICAgfTsgLy8gTW9kaWZpZXJzIGhhdmUgdGhlIGFiaWxpdHkgdG8gcmVzZXQgdGhlIGN1cnJlbnQgdXBkYXRlIGN5Y2xlLiBUaGVcbiAgICAgICAgICAvLyBtb3N0IGNvbW1vbiB1c2UgY2FzZSBmb3IgdGhpcyBpcyB0aGUgYGZsaXBgIG1vZGlmaWVyIGNoYW5naW5nIHRoZVxuICAgICAgICAgIC8vIHBsYWNlbWVudCwgd2hpY2ggdGhlbiBuZWVkcyB0byByZS1ydW4gYWxsIHRoZSBtb2RpZmllcnMsIGJlY2F1c2UgdGhlXG4gICAgICAgICAgLy8gbG9naWMgd2FzIHByZXZpb3VzbHkgcmFuIGZvciB0aGUgcHJldmlvdXMgcGxhY2VtZW50IGFuZCBpcyB0aGVyZWZvcmVcbiAgICAgICAgICAvLyBzdGFsZS9pbmNvcnJlY3RcblxuICAgICAgICAgIHN0YXRlLnJlc2V0ID0gZmFsc2U7XG4gICAgICAgICAgc3RhdGUucGxhY2VtZW50ID0gc3RhdGUub3B0aW9ucy5wbGFjZW1lbnQ7IC8vIE9uIGVhY2ggdXBkYXRlIGN5Y2xlLCB0aGUgYG1vZGlmaWVyc0RhdGFgIHByb3BlcnR5IGZvciBlYWNoIG1vZGlmaWVyXG4gICAgICAgICAgLy8gaXMgZmlsbGVkIHdpdGggdGhlIGluaXRpYWwgZGF0YSBzcGVjaWZpZWQgYnkgdGhlIG1vZGlmaWVyLiBUaGlzIG1lYW5zXG4gICAgICAgICAgLy8gaXQgZG9lc24ndCBwZXJzaXN0IGFuZCBpcyBmcmVzaCBvbiBlYWNoIHVwZGF0ZS5cbiAgICAgICAgICAvLyBUbyBlbnN1cmUgcGVyc2lzdGVudCBkYXRhLCB1c2UgYCR7bmFtZX0jcGVyc2lzdGVudGBcblxuICAgICAgICAgIHN0YXRlLm9yZGVyZWRNb2RpZmllcnMuZm9yRWFjaChmdW5jdGlvbiAobW9kaWZpZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZS5tb2RpZmllcnNEYXRhW21vZGlmaWVyLm5hbWVdID0gT2JqZWN0LmFzc2lnbih7fSwgbW9kaWZpZXIuZGF0YSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgc3RhdGUub3JkZXJlZE1vZGlmaWVycy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGlmIChzdGF0ZS5yZXNldCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICBzdGF0ZS5yZXNldCA9IGZhbHNlO1xuICAgICAgICAgICAgICBpbmRleCA9IC0xO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIF9zdGF0ZSRvcmRlcmVkTW9kaWZpZSA9IHN0YXRlLm9yZGVyZWRNb2RpZmllcnNbaW5kZXhdLFxuICAgICAgICAgICAgICAgIGZuID0gX3N0YXRlJG9yZGVyZWRNb2RpZmllLmZuLFxuICAgICAgICAgICAgICAgIF9zdGF0ZSRvcmRlcmVkTW9kaWZpZTIgPSBfc3RhdGUkb3JkZXJlZE1vZGlmaWUub3B0aW9ucyxcbiAgICAgICAgICAgICAgICBfb3B0aW9ucyA9IF9zdGF0ZSRvcmRlcmVkTW9kaWZpZTIgPT09IHZvaWQgMCA/IHt9IDogX3N0YXRlJG9yZGVyZWRNb2RpZmllMixcbiAgICAgICAgICAgICAgICBuYW1lID0gX3N0YXRlJG9yZGVyZWRNb2RpZmllLm5hbWU7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgc3RhdGUgPSBmbih7XG4gICAgICAgICAgICAgICAgc3RhdGU6IHN0YXRlLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IF9vcHRpb25zLFxuICAgICAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICAgICAgaW5zdGFuY2U6IGluc3RhbmNlXG4gICAgICAgICAgICAgIH0pIHx8IHN0YXRlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgLy8gQXN5bmMgYW5kIG9wdGltaXN0aWNhbGx5IG9wdGltaXplZCB1cGRhdGUgXHUyMDEzIGl0IHdpbGwgbm90IGJlIGV4ZWN1dGVkIGlmXG4gICAgICAgIC8vIG5vdCBuZWNlc3NhcnkgKGRlYm91bmNlZCB0byBydW4gYXQgbW9zdCBvbmNlLXBlci10aWNrKVxuICAgICAgICB1cGRhdGU6IGRlYm91bmNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICAgIGluc3RhbmNlLmZvcmNlVXBkYXRlKCk7XG4gICAgICAgICAgICByZXNvbHZlKHN0YXRlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSksXG4gICAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgICAgICAgY2xlYW51cE1vZGlmaWVyRWZmZWN0cygpO1xuICAgICAgICAgIGlzRGVzdHJveWVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgaWYgKCFhcmVWYWxpZEVsZW1lbnRzKHJlZmVyZW5jZSwgcG9wcGVyKSkge1xuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICB9XG5cbiAgICAgIGluc3RhbmNlLnNldE9wdGlvbnMob3B0aW9ucykudGhlbihmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgaWYgKCFpc0Rlc3Ryb3llZCAmJiBvcHRpb25zLm9uRmlyc3RVcGRhdGUpIHtcbiAgICAgICAgICBvcHRpb25zLm9uRmlyc3RVcGRhdGUoc3RhdGUpO1xuICAgICAgICB9XG4gICAgICB9KTsgLy8gTW9kaWZpZXJzIGhhdmUgdGhlIGFiaWxpdHkgdG8gZXhlY3V0ZSBhcmJpdHJhcnkgY29kZSBiZWZvcmUgdGhlIGZpcnN0XG4gICAgICAvLyB1cGRhdGUgY3ljbGUgcnVucy4gVGhleSB3aWxsIGJlIGV4ZWN1dGVkIGluIHRoZSBzYW1lIG9yZGVyIGFzIHRoZSB1cGRhdGVcbiAgICAgIC8vIGN5Y2xlLiBUaGlzIGlzIHVzZWZ1bCB3aGVuIGEgbW9kaWZpZXIgYWRkcyBzb21lIHBlcnNpc3RlbnQgZGF0YSB0aGF0XG4gICAgICAvLyBvdGhlciBtb2RpZmllcnMgbmVlZCB0byB1c2UsIGJ1dCB0aGUgbW9kaWZpZXIgaXMgcnVuIGFmdGVyIHRoZSBkZXBlbmRlbnRcbiAgICAgIC8vIG9uZS5cblxuICAgICAgZnVuY3Rpb24gcnVuTW9kaWZpZXJFZmZlY3RzKCkge1xuICAgICAgICBzdGF0ZS5vcmRlcmVkTW9kaWZpZXJzLmZvckVhY2goZnVuY3Rpb24gKF9yZWYpIHtcbiAgICAgICAgICB2YXIgbmFtZSA9IF9yZWYubmFtZSxcbiAgICAgICAgICAgICAgX3JlZiRvcHRpb25zID0gX3JlZi5vcHRpb25zLFxuICAgICAgICAgICAgICBvcHRpb25zID0gX3JlZiRvcHRpb25zID09PSB2b2lkIDAgPyB7fSA6IF9yZWYkb3B0aW9ucyxcbiAgICAgICAgICAgICAgZWZmZWN0ID0gX3JlZi5lZmZlY3Q7XG5cbiAgICAgICAgICBpZiAodHlwZW9mIGVmZmVjdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdmFyIGNsZWFudXBGbiA9IGVmZmVjdCh7XG4gICAgICAgICAgICAgIHN0YXRlOiBzdGF0ZSxcbiAgICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgaW5zdGFuY2U6IGluc3RhbmNlLFxuICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIG5vb3BGbiA9IGZ1bmN0aW9uIG5vb3BGbigpIHt9O1xuXG4gICAgICAgICAgICBlZmZlY3RDbGVhbnVwRm5zLnB1c2goY2xlYW51cEZuIHx8IG5vb3BGbik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gY2xlYW51cE1vZGlmaWVyRWZmZWN0cygpIHtcbiAgICAgICAgZWZmZWN0Q2xlYW51cEZucy5mb3JFYWNoKGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgIHJldHVybiBmbigpO1xuICAgICAgICB9KTtcbiAgICAgICAgZWZmZWN0Q2xlYW51cEZucyA9IFtdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfTtcbiAgfVxuICB2YXIgY3JlYXRlUG9wcGVyJDIgPSAvKiNfX1BVUkVfXyovcG9wcGVyR2VuZXJhdG9yKCk7IC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tdW51c2VkLW1vZHVsZXNcblxuICB2YXIgZGVmYXVsdE1vZGlmaWVycyQxID0gW2V2ZW50TGlzdGVuZXJzLCBwb3BwZXJPZmZzZXRzJDEsIGNvbXB1dGVTdHlsZXMkMSwgYXBwbHlTdHlsZXMkMV07XG4gIHZhciBjcmVhdGVQb3BwZXIkMSA9IC8qI19fUFVSRV9fKi9wb3BwZXJHZW5lcmF0b3Ioe1xuICAgIGRlZmF1bHRNb2RpZmllcnM6IGRlZmF1bHRNb2RpZmllcnMkMVxuICB9KTsgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby11bnVzZWQtbW9kdWxlc1xuXG4gIHZhciBkZWZhdWx0TW9kaWZpZXJzID0gW2V2ZW50TGlzdGVuZXJzLCBwb3BwZXJPZmZzZXRzJDEsIGNvbXB1dGVTdHlsZXMkMSwgYXBwbHlTdHlsZXMkMSwgb2Zmc2V0JDEsIGZsaXAkMSwgcHJldmVudE92ZXJmbG93JDEsIGFycm93JDEsIGhpZGUkMV07XG4gIHZhciBjcmVhdGVQb3BwZXIgPSAvKiNfX1BVUkVfXyovcG9wcGVyR2VuZXJhdG9yKHtcbiAgICBkZWZhdWx0TW9kaWZpZXJzOiBkZWZhdWx0TW9kaWZpZXJzXG4gIH0pOyAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgaW1wb3J0L25vLXVudXNlZC1tb2R1bGVzXG5cbiAgY29uc3QgUG9wcGVyID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoLyojX19QVVJFX18qL09iamVjdC5kZWZpbmVQcm9wZXJ0eSh7XG4gICAgX19wcm90b19fOiBudWxsLFxuICAgIGFmdGVyTWFpbixcbiAgICBhZnRlclJlYWQsXG4gICAgYWZ0ZXJXcml0ZSxcbiAgICBhcHBseVN0eWxlczogYXBwbHlTdHlsZXMkMSxcbiAgICBhcnJvdzogYXJyb3ckMSxcbiAgICBhdXRvLFxuICAgIGJhc2VQbGFjZW1lbnRzLFxuICAgIGJlZm9yZU1haW4sXG4gICAgYmVmb3JlUmVhZCxcbiAgICBiZWZvcmVXcml0ZSxcbiAgICBib3R0b20sXG4gICAgY2xpcHBpbmdQYXJlbnRzLFxuICAgIGNvbXB1dGVTdHlsZXM6IGNvbXB1dGVTdHlsZXMkMSxcbiAgICBjcmVhdGVQb3BwZXIsXG4gICAgY3JlYXRlUG9wcGVyQmFzZTogY3JlYXRlUG9wcGVyJDIsXG4gICAgY3JlYXRlUG9wcGVyTGl0ZTogY3JlYXRlUG9wcGVyJDEsXG4gICAgZGV0ZWN0T3ZlcmZsb3csXG4gICAgZW5kLFxuICAgIGV2ZW50TGlzdGVuZXJzLFxuICAgIGZsaXA6IGZsaXAkMSxcbiAgICBoaWRlOiBoaWRlJDEsXG4gICAgbGVmdCxcbiAgICBtYWluLFxuICAgIG1vZGlmaWVyUGhhc2VzLFxuICAgIG9mZnNldDogb2Zmc2V0JDEsXG4gICAgcGxhY2VtZW50cyxcbiAgICBwb3BwZXIsXG4gICAgcG9wcGVyR2VuZXJhdG9yLFxuICAgIHBvcHBlck9mZnNldHM6IHBvcHBlck9mZnNldHMkMSxcbiAgICBwcmV2ZW50T3ZlcmZsb3c6IHByZXZlbnRPdmVyZmxvdyQxLFxuICAgIHJlYWQsXG4gICAgcmVmZXJlbmNlLFxuICAgIHJpZ2h0LFxuICAgIHN0YXJ0LFxuICAgIHRvcCxcbiAgICB2YXJpYXRpb25QbGFjZW1lbnRzLFxuICAgIHZpZXdwb3J0LFxuICAgIHdyaXRlXG4gIH0sIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSkpO1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgZHJvcGRvd24uanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50c1xuICAgKi9cblxuICBjb25zdCBOQU1FJGEgPSAnZHJvcGRvd24nO1xuICBjb25zdCBEQVRBX0tFWSQ2ID0gJ2JzLmRyb3Bkb3duJztcbiAgY29uc3QgRVZFTlRfS0VZJDYgPSBgLiR7REFUQV9LRVkkNn1gO1xuICBjb25zdCBEQVRBX0FQSV9LRVkkMyA9ICcuZGF0YS1hcGknO1xuICBjb25zdCBFU0NBUEVfS0VZJDIgPSAnRXNjYXBlJztcbiAgY29uc3QgVEFCX0tFWSQxID0gJ1RhYic7XG4gIGNvbnN0IEFSUk9XX1VQX0tFWSQxID0gJ0Fycm93VXAnO1xuICBjb25zdCBBUlJPV19ET1dOX0tFWSQxID0gJ0Fycm93RG93bic7XG4gIGNvbnN0IFJJR0hUX01PVVNFX0JVVFRPTiA9IDI7IC8vIE1vdXNlRXZlbnQuYnV0dG9uIHZhbHVlIGZvciB0aGUgc2Vjb25kYXJ5IGJ1dHRvbiwgdXN1YWxseSB0aGUgcmlnaHQgYnV0dG9uXG5cbiAgY29uc3QgRVZFTlRfSElERSQ1ID0gYGhpZGUke0VWRU5UX0tFWSQ2fWA7XG4gIGNvbnN0IEVWRU5UX0hJRERFTiQ1ID0gYGhpZGRlbiR7RVZFTlRfS0VZJDZ9YDtcbiAgY29uc3QgRVZFTlRfU0hPVyQ1ID0gYHNob3cke0VWRU5UX0tFWSQ2fWA7XG4gIGNvbnN0IEVWRU5UX1NIT1dOJDUgPSBgc2hvd24ke0VWRU5UX0tFWSQ2fWA7XG4gIGNvbnN0IEVWRU5UX0NMSUNLX0RBVEFfQVBJJDMgPSBgY2xpY2ske0VWRU5UX0tFWSQ2fSR7REFUQV9BUElfS0VZJDN9YDtcbiAgY29uc3QgRVZFTlRfS0VZRE9XTl9EQVRBX0FQSSA9IGBrZXlkb3duJHtFVkVOVF9LRVkkNn0ke0RBVEFfQVBJX0tFWSQzfWA7XG4gIGNvbnN0IEVWRU5UX0tFWVVQX0RBVEFfQVBJID0gYGtleXVwJHtFVkVOVF9LRVkkNn0ke0RBVEFfQVBJX0tFWSQzfWA7XG4gIGNvbnN0IENMQVNTX05BTUVfU0hPVyQ2ID0gJ3Nob3cnO1xuICBjb25zdCBDTEFTU19OQU1FX0RST1BVUCA9ICdkcm9wdXAnO1xuICBjb25zdCBDTEFTU19OQU1FX0RST1BFTkQgPSAnZHJvcGVuZCc7XG4gIGNvbnN0IENMQVNTX05BTUVfRFJPUFNUQVJUID0gJ2Ryb3BzdGFydCc7XG4gIGNvbnN0IENMQVNTX05BTUVfRFJPUFVQX0NFTlRFUiA9ICdkcm9wdXAtY2VudGVyJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9EUk9QRE9XTl9DRU5URVIgPSAnZHJvcGRvd24tY2VudGVyJztcbiAgY29uc3QgU0VMRUNUT1JfREFUQV9UT0dHTEUkMyA9ICdbZGF0YS1icy10b2dnbGU9XCJkcm9wZG93blwiXTpub3QoLmRpc2FibGVkKTpub3QoOmRpc2FibGVkKSc7XG4gIGNvbnN0IFNFTEVDVE9SX0RBVEFfVE9HR0xFX1NIT1dOID0gYCR7U0VMRUNUT1JfREFUQV9UT0dHTEUkM30uJHtDTEFTU19OQU1FX1NIT1ckNn1gO1xuICBjb25zdCBTRUxFQ1RPUl9NRU5VID0gJy5kcm9wZG93bi1tZW51JztcbiAgY29uc3QgU0VMRUNUT1JfTkFWQkFSID0gJy5uYXZiYXInO1xuICBjb25zdCBTRUxFQ1RPUl9OQVZCQVJfTkFWID0gJy5uYXZiYXItbmF2JztcbiAgY29uc3QgU0VMRUNUT1JfVklTSUJMRV9JVEVNUyA9ICcuZHJvcGRvd24tbWVudSAuZHJvcGRvd24taXRlbTpub3QoLmRpc2FibGVkKTpub3QoOmRpc2FibGVkKSc7XG4gIGNvbnN0IFBMQUNFTUVOVF9UT1AgPSBpc1JUTCgpID8gJ3RvcC1lbmQnIDogJ3RvcC1zdGFydCc7XG4gIGNvbnN0IFBMQUNFTUVOVF9UT1BFTkQgPSBpc1JUTCgpID8gJ3RvcC1zdGFydCcgOiAndG9wLWVuZCc7XG4gIGNvbnN0IFBMQUNFTUVOVF9CT1RUT00gPSBpc1JUTCgpID8gJ2JvdHRvbS1lbmQnIDogJ2JvdHRvbS1zdGFydCc7XG4gIGNvbnN0IFBMQUNFTUVOVF9CT1RUT01FTkQgPSBpc1JUTCgpID8gJ2JvdHRvbS1zdGFydCcgOiAnYm90dG9tLWVuZCc7XG4gIGNvbnN0IFBMQUNFTUVOVF9SSUdIVCA9IGlzUlRMKCkgPyAnbGVmdC1zdGFydCcgOiAncmlnaHQtc3RhcnQnO1xuICBjb25zdCBQTEFDRU1FTlRfTEVGVCA9IGlzUlRMKCkgPyAncmlnaHQtc3RhcnQnIDogJ2xlZnQtc3RhcnQnO1xuICBjb25zdCBQTEFDRU1FTlRfVE9QQ0VOVEVSID0gJ3RvcCc7XG4gIGNvbnN0IFBMQUNFTUVOVF9CT1RUT01DRU5URVIgPSAnYm90dG9tJztcbiAgY29uc3QgRGVmYXVsdCQ5ID0ge1xuICAgIGF1dG9DbG9zZTogdHJ1ZSxcbiAgICBib3VuZGFyeTogJ2NsaXBwaW5nUGFyZW50cycsXG4gICAgZGlzcGxheTogJ2R5bmFtaWMnLFxuICAgIG9mZnNldDogWzAsIDJdLFxuICAgIHBvcHBlckNvbmZpZzogbnVsbCxcbiAgICByZWZlcmVuY2U6ICd0b2dnbGUnXG4gIH07XG4gIGNvbnN0IERlZmF1bHRUeXBlJDkgPSB7XG4gICAgYXV0b0Nsb3NlOiAnKGJvb2xlYW58c3RyaW5nKScsXG4gICAgYm91bmRhcnk6ICcoc3RyaW5nfGVsZW1lbnQpJyxcbiAgICBkaXNwbGF5OiAnc3RyaW5nJyxcbiAgICBvZmZzZXQ6ICcoYXJyYXl8c3RyaW5nfGZ1bmN0aW9uKScsXG4gICAgcG9wcGVyQ29uZmlnOiAnKG51bGx8b2JqZWN0fGZ1bmN0aW9uKScsXG4gICAgcmVmZXJlbmNlOiAnKHN0cmluZ3xlbGVtZW50fG9iamVjdCknXG4gIH07XG5cbiAgLyoqXG4gICAqIENsYXNzIGRlZmluaXRpb25cbiAgICovXG5cbiAgY2xhc3MgRHJvcGRvd24gZXh0ZW5kcyBCYXNlQ29tcG9uZW50IHtcbiAgICBjb25zdHJ1Y3RvcihlbGVtZW50LCBjb25maWcpIHtcbiAgICAgIHN1cGVyKGVsZW1lbnQsIGNvbmZpZyk7XG4gICAgICB0aGlzLl9wb3BwZXIgPSBudWxsO1xuICAgICAgdGhpcy5fcGFyZW50ID0gdGhpcy5fZWxlbWVudC5wYXJlbnROb2RlOyAvLyBkcm9wZG93biB3cmFwcGVyXG4gICAgICAvLyBUT0RPOiB2NiByZXZlcnQgIzM3MDExICYgY2hhbmdlIG1hcmt1cCBodHRwczovL2dldGJvb3RzdHJhcC5jb20vZG9jcy81LjMvZm9ybXMvaW5wdXQtZ3JvdXAvXG4gICAgICB0aGlzLl9tZW51ID0gU2VsZWN0b3JFbmdpbmUubmV4dCh0aGlzLl9lbGVtZW50LCBTRUxFQ1RPUl9NRU5VKVswXSB8fCBTZWxlY3RvckVuZ2luZS5wcmV2KHRoaXMuX2VsZW1lbnQsIFNFTEVDVE9SX01FTlUpWzBdIHx8IFNlbGVjdG9yRW5naW5lLmZpbmRPbmUoU0VMRUNUT1JfTUVOVSwgdGhpcy5fcGFyZW50KTtcbiAgICAgIHRoaXMuX2luTmF2YmFyID0gdGhpcy5fZGV0ZWN0TmF2YmFyKCk7XG4gICAgfVxuXG4gICAgLy8gR2V0dGVyc1xuICAgIHN0YXRpYyBnZXQgRGVmYXVsdCgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0JDk7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgRGVmYXVsdFR5cGUoKSB7XG4gICAgICByZXR1cm4gRGVmYXVsdFR5cGUkOTtcbiAgICB9XG4gICAgc3RhdGljIGdldCBOQU1FKCkge1xuICAgICAgcmV0dXJuIE5BTUUkYTtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWNcbiAgICB0b2dnbGUoKSB7XG4gICAgICByZXR1cm4gdGhpcy5faXNTaG93bigpID8gdGhpcy5oaWRlKCkgOiB0aGlzLnNob3coKTtcbiAgICB9XG4gICAgc2hvdygpIHtcbiAgICAgIGlmIChpc0Rpc2FibGVkKHRoaXMuX2VsZW1lbnQpIHx8IHRoaXMuX2lzU2hvd24oKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCByZWxhdGVkVGFyZ2V0ID0ge1xuICAgICAgICByZWxhdGVkVGFyZ2V0OiB0aGlzLl9lbGVtZW50XG4gICAgICB9O1xuICAgICAgY29uc3Qgc2hvd0V2ZW50ID0gRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfU0hPVyQ1LCByZWxhdGVkVGFyZ2V0KTtcbiAgICAgIGlmIChzaG93RXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl9jcmVhdGVQb3BwZXIoKTtcblxuICAgICAgLy8gSWYgdGhpcyBpcyBhIHRvdWNoLWVuYWJsZWQgZGV2aWNlIHdlIGFkZCBleHRyYVxuICAgICAgLy8gZW1wdHkgbW91c2VvdmVyIGxpc3RlbmVycyB0byB0aGUgYm9keSdzIGltbWVkaWF0ZSBjaGlsZHJlbjtcbiAgICAgIC8vIG9ubHkgbmVlZGVkIGJlY2F1c2Ugb2YgYnJva2VuIGV2ZW50IGRlbGVnYXRpb24gb24gaU9TXG4gICAgICAvLyBodHRwczovL3d3dy5xdWlya3Ntb2RlLm9yZy9ibG9nL2FyY2hpdmVzLzIwMTQvMDIvbW91c2VfZXZlbnRfYnViLmh0bWxcbiAgICAgIGlmICgnb250b3VjaHN0YXJ0JyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgIXRoaXMuX3BhcmVudC5jbG9zZXN0KFNFTEVDVE9SX05BVkJBUl9OQVYpKSB7XG4gICAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBbXS5jb25jYXQoLi4uZG9jdW1lbnQuYm9keS5jaGlsZHJlbikpIHtcbiAgICAgICAgICBFdmVudEhhbmRsZXIub24oZWxlbWVudCwgJ21vdXNlb3ZlcicsIG5vb3ApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLl9lbGVtZW50LmZvY3VzKCk7XG4gICAgICB0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIHRydWUpO1xuICAgICAgdGhpcy5fbWVudS5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfU0hPVyQ2KTtcbiAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX1NIT1ckNik7XG4gICAgICBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCBFVkVOVF9TSE9XTiQ1LCByZWxhdGVkVGFyZ2V0KTtcbiAgICB9XG4gICAgaGlkZSgpIHtcbiAgICAgIGlmIChpc0Rpc2FibGVkKHRoaXMuX2VsZW1lbnQpIHx8ICF0aGlzLl9pc1Nob3duKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgcmVsYXRlZFRhcmdldCA9IHtcbiAgICAgICAgcmVsYXRlZFRhcmdldDogdGhpcy5fZWxlbWVudFxuICAgICAgfTtcbiAgICAgIHRoaXMuX2NvbXBsZXRlSGlkZShyZWxhdGVkVGFyZ2V0KTtcbiAgICB9XG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIGlmICh0aGlzLl9wb3BwZXIpIHtcbiAgICAgICAgdGhpcy5fcG9wcGVyLmRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICAgIHN1cGVyLmRpc3Bvc2UoKTtcbiAgICB9XG4gICAgdXBkYXRlKCkge1xuICAgICAgdGhpcy5faW5OYXZiYXIgPSB0aGlzLl9kZXRlY3ROYXZiYXIoKTtcbiAgICAgIGlmICh0aGlzLl9wb3BwZXIpIHtcbiAgICAgICAgdGhpcy5fcG9wcGVyLnVwZGF0ZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFByaXZhdGVcbiAgICBfY29tcGxldGVIaWRlKHJlbGF0ZWRUYXJnZXQpIHtcbiAgICAgIGNvbnN0IGhpZGVFdmVudCA9IEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0hJREUkNSwgcmVsYXRlZFRhcmdldCk7XG4gICAgICBpZiAoaGlkZUV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGlzIGlzIGEgdG91Y2gtZW5hYmxlZCBkZXZpY2Ugd2UgcmVtb3ZlIHRoZSBleHRyYVxuICAgICAgLy8gZW1wdHkgbW91c2VvdmVyIGxpc3RlbmVycyB3ZSBhZGRlZCBmb3IgaU9TIHN1cHBvcnRcbiAgICAgIGlmICgnb250b3VjaHN0YXJ0JyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpIHtcbiAgICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIFtdLmNvbmNhdCguLi5kb2N1bWVudC5ib2R5LmNoaWxkcmVuKSkge1xuICAgICAgICAgIEV2ZW50SGFuZGxlci5vZmYoZWxlbWVudCwgJ21vdXNlb3ZlcicsIG5vb3ApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fcG9wcGVyKSB7XG4gICAgICAgIHRoaXMuX3BvcHBlci5kZXN0cm95KCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9tZW51LmNsYXNzTGlzdC5yZW1vdmUoQ0xBU1NfTkFNRV9TSE9XJDYpO1xuICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKENMQVNTX05BTUVfU0hPVyQ2KTtcbiAgICAgIHRoaXMuX2VsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG4gICAgICBNYW5pcHVsYXRvci5yZW1vdmVEYXRhQXR0cmlidXRlKHRoaXMuX21lbnUsICdwb3BwZXInKTtcbiAgICAgIEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0hJRERFTiQ1LCByZWxhdGVkVGFyZ2V0KTtcbiAgICB9XG4gICAgX2dldENvbmZpZyhjb25maWcpIHtcbiAgICAgIGNvbmZpZyA9IHN1cGVyLl9nZXRDb25maWcoY29uZmlnKTtcbiAgICAgIGlmICh0eXBlb2YgY29uZmlnLnJlZmVyZW5jZSA9PT0gJ29iamVjdCcgJiYgIWlzRWxlbWVudCQxKGNvbmZpZy5yZWZlcmVuY2UpICYmIHR5cGVvZiBjb25maWcucmVmZXJlbmNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBQb3BwZXIgdmlydHVhbCBlbGVtZW50cyByZXF1aXJlIGEgZ2V0Qm91bmRpbmdDbGllbnRSZWN0IG1ldGhvZFxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke05BTUUkYS50b1VwcGVyQ2FzZSgpfTogT3B0aW9uIFwicmVmZXJlbmNlXCIgcHJvdmlkZWQgdHlwZSBcIm9iamVjdFwiIHdpdGhvdXQgYSByZXF1aXJlZCBcImdldEJvdW5kaW5nQ2xpZW50UmVjdFwiIG1ldGhvZC5gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfVxuICAgIF9jcmVhdGVQb3BwZXIoKSB7XG4gICAgICBpZiAodHlwZW9mIFBvcHBlciA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQm9vdHN0cmFwXFwncyBkcm9wZG93bnMgcmVxdWlyZSBQb3BwZXIgKGh0dHBzOi8vcG9wcGVyLmpzLm9yZyknKTtcbiAgICAgIH1cbiAgICAgIGxldCByZWZlcmVuY2VFbGVtZW50ID0gdGhpcy5fZWxlbWVudDtcbiAgICAgIGlmICh0aGlzLl9jb25maWcucmVmZXJlbmNlID09PSAncGFyZW50Jykge1xuICAgICAgICByZWZlcmVuY2VFbGVtZW50ID0gdGhpcy5fcGFyZW50O1xuICAgICAgfSBlbHNlIGlmIChpc0VsZW1lbnQkMSh0aGlzLl9jb25maWcucmVmZXJlbmNlKSkge1xuICAgICAgICByZWZlcmVuY2VFbGVtZW50ID0gZ2V0RWxlbWVudCh0aGlzLl9jb25maWcucmVmZXJlbmNlKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMuX2NvbmZpZy5yZWZlcmVuY2UgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJlZmVyZW5jZUVsZW1lbnQgPSB0aGlzLl9jb25maWcucmVmZXJlbmNlO1xuICAgICAgfVxuICAgICAgY29uc3QgcG9wcGVyQ29uZmlnID0gdGhpcy5fZ2V0UG9wcGVyQ29uZmlnKCk7XG4gICAgICB0aGlzLl9wb3BwZXIgPSBjcmVhdGVQb3BwZXIocmVmZXJlbmNlRWxlbWVudCwgdGhpcy5fbWVudSwgcG9wcGVyQ29uZmlnKTtcbiAgICB9XG4gICAgX2lzU2hvd24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWVudS5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9TSE9XJDYpO1xuICAgIH1cbiAgICBfZ2V0UGxhY2VtZW50KCkge1xuICAgICAgY29uc3QgcGFyZW50RHJvcGRvd24gPSB0aGlzLl9wYXJlbnQ7XG4gICAgICBpZiAocGFyZW50RHJvcGRvd24uY2xhc3NMaXN0LmNvbnRhaW5zKENMQVNTX05BTUVfRFJPUEVORCkpIHtcbiAgICAgICAgcmV0dXJuIFBMQUNFTUVOVF9SSUdIVDtcbiAgICAgIH1cbiAgICAgIGlmIChwYXJlbnREcm9wZG93bi5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9EUk9QU1RBUlQpKSB7XG4gICAgICAgIHJldHVybiBQTEFDRU1FTlRfTEVGVDtcbiAgICAgIH1cbiAgICAgIGlmIChwYXJlbnREcm9wZG93bi5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9EUk9QVVBfQ0VOVEVSKSkge1xuICAgICAgICByZXR1cm4gUExBQ0VNRU5UX1RPUENFTlRFUjtcbiAgICAgIH1cbiAgICAgIGlmIChwYXJlbnREcm9wZG93bi5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9EUk9QRE9XTl9DRU5URVIpKSB7XG4gICAgICAgIHJldHVybiBQTEFDRU1FTlRfQk9UVE9NQ0VOVEVSO1xuICAgICAgfVxuXG4gICAgICAvLyBXZSBuZWVkIHRvIHRyaW0gdGhlIHZhbHVlIGJlY2F1c2UgY3VzdG9tIHByb3BlcnRpZXMgY2FuIGFsc28gaW5jbHVkZSBzcGFjZXNcbiAgICAgIGNvbnN0IGlzRW5kID0gZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLl9tZW51KS5nZXRQcm9wZXJ0eVZhbHVlKCctLWJzLXBvc2l0aW9uJykudHJpbSgpID09PSAnZW5kJztcbiAgICAgIGlmIChwYXJlbnREcm9wZG93bi5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9EUk9QVVApKSB7XG4gICAgICAgIHJldHVybiBpc0VuZCA/IFBMQUNFTUVOVF9UT1BFTkQgOiBQTEFDRU1FTlRfVE9QO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGlzRW5kID8gUExBQ0VNRU5UX0JPVFRPTUVORCA6IFBMQUNFTUVOVF9CT1RUT007XG4gICAgfVxuICAgIF9kZXRlY3ROYXZiYXIoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZWxlbWVudC5jbG9zZXN0KFNFTEVDVE9SX05BVkJBUikgIT09IG51bGw7XG4gICAgfVxuICAgIF9nZXRPZmZzZXQoKSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIG9mZnNldFxuICAgICAgfSA9IHRoaXMuX2NvbmZpZztcbiAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gb2Zmc2V0LnNwbGl0KCcsJykubWFwKHZhbHVlID0+IE51bWJlci5wYXJzZUludCh2YWx1ZSwgMTApKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiBwb3BwZXJEYXRhID0+IG9mZnNldChwb3BwZXJEYXRhLCB0aGlzLl9lbGVtZW50KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgfVxuICAgIF9nZXRQb3BwZXJDb25maWcoKSB7XG4gICAgICBjb25zdCBkZWZhdWx0QnNQb3BwZXJDb25maWcgPSB7XG4gICAgICAgIHBsYWNlbWVudDogdGhpcy5fZ2V0UGxhY2VtZW50KCksXG4gICAgICAgIG1vZGlmaWVyczogW3tcbiAgICAgICAgICBuYW1lOiAncHJldmVudE92ZXJmbG93JyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBib3VuZGFyeTogdGhpcy5fY29uZmlnLmJvdW5kYXJ5XG4gICAgICAgICAgfVxuICAgICAgICB9LCB7XG4gICAgICAgICAgbmFtZTogJ29mZnNldCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgb2Zmc2V0OiB0aGlzLl9nZXRPZmZzZXQoKVxuICAgICAgICAgIH1cbiAgICAgICAgfV1cbiAgICAgIH07XG5cbiAgICAgIC8vIERpc2FibGUgUG9wcGVyIGlmIHdlIGhhdmUgYSBzdGF0aWMgZGlzcGxheSBvciBEcm9wZG93biBpcyBpbiBOYXZiYXJcbiAgICAgIGlmICh0aGlzLl9pbk5hdmJhciB8fCB0aGlzLl9jb25maWcuZGlzcGxheSA9PT0gJ3N0YXRpYycpIHtcbiAgICAgICAgTWFuaXB1bGF0b3Iuc2V0RGF0YUF0dHJpYnV0ZSh0aGlzLl9tZW51LCAncG9wcGVyJywgJ3N0YXRpYycpOyAvLyBUT0RPOiB2NiByZW1vdmVcbiAgICAgICAgZGVmYXVsdEJzUG9wcGVyQ29uZmlnLm1vZGlmaWVycyA9IFt7XG4gICAgICAgICAgbmFtZTogJ2FwcGx5U3R5bGVzJyxcbiAgICAgICAgICBlbmFibGVkOiBmYWxzZVxuICAgICAgICB9XTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLmRlZmF1bHRCc1BvcHBlckNvbmZpZyxcbiAgICAgICAgLi4uZXhlY3V0ZSh0aGlzLl9jb25maWcucG9wcGVyQ29uZmlnLCBbZGVmYXVsdEJzUG9wcGVyQ29uZmlnXSlcbiAgICAgIH07XG4gICAgfVxuICAgIF9zZWxlY3RNZW51SXRlbSh7XG4gICAgICBrZXksXG4gICAgICB0YXJnZXRcbiAgICB9KSB7XG4gICAgICBjb25zdCBpdGVtcyA9IFNlbGVjdG9yRW5naW5lLmZpbmQoU0VMRUNUT1JfVklTSUJMRV9JVEVNUywgdGhpcy5fbWVudSkuZmlsdGVyKGVsZW1lbnQgPT4gaXNWaXNpYmxlKGVsZW1lbnQpKTtcbiAgICAgIGlmICghaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gaWYgdGFyZ2V0IGlzbid0IGluY2x1ZGVkIGluIGl0ZW1zIChlLmcuIHdoZW4gZXhwYW5kaW5nIHRoZSBkcm9wZG93bilcbiAgICAgIC8vIGFsbG93IGN5Y2xpbmcgdG8gZ2V0IHRoZSBsYXN0IGl0ZW0gaW4gY2FzZSBrZXkgZXF1YWxzIEFSUk9XX1VQX0tFWVxuICAgICAgZ2V0TmV4dEFjdGl2ZUVsZW1lbnQoaXRlbXMsIHRhcmdldCwga2V5ID09PSBBUlJPV19ET1dOX0tFWSQxLCAhaXRlbXMuaW5jbHVkZXModGFyZ2V0KSkuZm9jdXMoKTtcbiAgICB9XG5cbiAgICAvLyBTdGF0aWNcbiAgICBzdGF0aWMgalF1ZXJ5SW50ZXJmYWNlKGNvbmZpZykge1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBEcm9wZG93bi5nZXRPckNyZWF0ZUluc3RhbmNlKHRoaXMsIGNvbmZpZyk7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGRhdGFbY29uZmlnXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBObyBtZXRob2QgbmFtZWQgXCIke2NvbmZpZ31cImApO1xuICAgICAgICB9XG4gICAgICAgIGRhdGFbY29uZmlnXSgpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHN0YXRpYyBjbGVhck1lbnVzKGV2ZW50KSB7XG4gICAgICBpZiAoZXZlbnQuYnV0dG9uID09PSBSSUdIVF9NT1VTRV9CVVRUT04gfHwgZXZlbnQudHlwZSA9PT0gJ2tleXVwJyAmJiBldmVudC5rZXkgIT09IFRBQl9LRVkkMSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBvcGVuVG9nZ2xlcyA9IFNlbGVjdG9yRW5naW5lLmZpbmQoU0VMRUNUT1JfREFUQV9UT0dHTEVfU0hPV04pO1xuICAgICAgZm9yIChjb25zdCB0b2dnbGUgb2Ygb3BlblRvZ2dsZXMpIHtcbiAgICAgICAgY29uc3QgY29udGV4dCA9IERyb3Bkb3duLmdldEluc3RhbmNlKHRvZ2dsZSk7XG4gICAgICAgIGlmICghY29udGV4dCB8fCBjb250ZXh0Ll9jb25maWcuYXV0b0Nsb3NlID09PSBmYWxzZSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbXBvc2VkUGF0aCA9IGV2ZW50LmNvbXBvc2VkUGF0aCgpO1xuICAgICAgICBjb25zdCBpc01lbnVUYXJnZXQgPSBjb21wb3NlZFBhdGguaW5jbHVkZXMoY29udGV4dC5fbWVudSk7XG4gICAgICAgIGlmIChjb21wb3NlZFBhdGguaW5jbHVkZXMoY29udGV4dC5fZWxlbWVudCkgfHwgY29udGV4dC5fY29uZmlnLmF1dG9DbG9zZSA9PT0gJ2luc2lkZScgJiYgIWlzTWVudVRhcmdldCB8fCBjb250ZXh0Ll9jb25maWcuYXV0b0Nsb3NlID09PSAnb3V0c2lkZScgJiYgaXNNZW51VGFyZ2V0KSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUYWIgbmF2aWdhdGlvbiB0aHJvdWdoIHRoZSBkcm9wZG93biBtZW51IG9yIGV2ZW50cyBmcm9tIGNvbnRhaW5lZCBpbnB1dHMgc2hvdWxkbid0IGNsb3NlIHRoZSBtZW51XG4gICAgICAgIGlmIChjb250ZXh0Ll9tZW51LmNvbnRhaW5zKGV2ZW50LnRhcmdldCkgJiYgKGV2ZW50LnR5cGUgPT09ICdrZXl1cCcgJiYgZXZlbnQua2V5ID09PSBUQUJfS0VZJDEgfHwgL2lucHV0fHNlbGVjdHxvcHRpb258dGV4dGFyZWF8Zm9ybS9pLnRlc3QoZXZlbnQudGFyZ2V0LnRhZ05hbWUpKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlbGF0ZWRUYXJnZXQgPSB7XG4gICAgICAgICAgcmVsYXRlZFRhcmdldDogY29udGV4dC5fZWxlbWVudFxuICAgICAgICB9O1xuICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2NsaWNrJykge1xuICAgICAgICAgIHJlbGF0ZWRUYXJnZXQuY2xpY2tFdmVudCA9IGV2ZW50O1xuICAgICAgICB9XG4gICAgICAgIGNvbnRleHQuX2NvbXBsZXRlSGlkZShyZWxhdGVkVGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RhdGljIGRhdGFBcGlLZXlkb3duSGFuZGxlcihldmVudCkge1xuICAgICAgLy8gSWYgbm90IGFuIFVQIHwgRE9XTiB8IEVTQ0FQRSBrZXkgPT4gbm90IGEgZHJvcGRvd24gY29tbWFuZFxuICAgICAgLy8gSWYgaW5wdXQvdGV4dGFyZWEgJiYgaWYga2V5IGlzIG90aGVyIHRoYW4gRVNDQVBFID0+IG5vdCBhIGRyb3Bkb3duIGNvbW1hbmRcblxuICAgICAgY29uc3QgaXNJbnB1dCA9IC9pbnB1dHx0ZXh0YXJlYS9pLnRlc3QoZXZlbnQudGFyZ2V0LnRhZ05hbWUpO1xuICAgICAgY29uc3QgaXNFc2NhcGVFdmVudCA9IGV2ZW50LmtleSA9PT0gRVNDQVBFX0tFWSQyO1xuICAgICAgY29uc3QgaXNVcE9yRG93bkV2ZW50ID0gW0FSUk9XX1VQX0tFWSQxLCBBUlJPV19ET1dOX0tFWSQxXS5pbmNsdWRlcyhldmVudC5rZXkpO1xuICAgICAgaWYgKCFpc1VwT3JEb3duRXZlbnQgJiYgIWlzRXNjYXBlRXZlbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGlzSW5wdXQgJiYgIWlzRXNjYXBlRXZlbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgLy8gVE9ETzogdjYgcmV2ZXJ0ICMzNzAxMSAmIGNoYW5nZSBtYXJrdXAgaHR0cHM6Ly9nZXRib290c3RyYXAuY29tL2RvY3MvNS4zL2Zvcm1zL2lucHV0LWdyb3VwL1xuICAgICAgY29uc3QgZ2V0VG9nZ2xlQnV0dG9uID0gdGhpcy5tYXRjaGVzKFNFTEVDVE9SX0RBVEFfVE9HR0xFJDMpID8gdGhpcyA6IFNlbGVjdG9yRW5naW5lLnByZXYodGhpcywgU0VMRUNUT1JfREFUQV9UT0dHTEUkMylbMF0gfHwgU2VsZWN0b3JFbmdpbmUubmV4dCh0aGlzLCBTRUxFQ1RPUl9EQVRBX1RPR0dMRSQzKVswXSB8fCBTZWxlY3RvckVuZ2luZS5maW5kT25lKFNFTEVDVE9SX0RBVEFfVE9HR0xFJDMsIGV2ZW50LmRlbGVnYXRlVGFyZ2V0LnBhcmVudE5vZGUpO1xuICAgICAgY29uc3QgaW5zdGFuY2UgPSBEcm9wZG93bi5nZXRPckNyZWF0ZUluc3RhbmNlKGdldFRvZ2dsZUJ1dHRvbik7XG4gICAgICBpZiAoaXNVcE9yRG93bkV2ZW50KSB7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBpbnN0YW5jZS5zaG93KCk7XG4gICAgICAgIGluc3RhbmNlLl9zZWxlY3RNZW51SXRlbShldmVudCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChpbnN0YW5jZS5faXNTaG93bigpKSB7XG4gICAgICAgIC8vIGVsc2UgaXMgZXNjYXBlIGFuZCB3ZSBjaGVjayBpZiBpdCBpcyBzaG93blxuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgaW5zdGFuY2UuaGlkZSgpO1xuICAgICAgICBnZXRUb2dnbGVCdXR0b24uZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGF0YSBBUEkgaW1wbGVtZW50YXRpb25cbiAgICovXG5cbiAgRXZlbnRIYW5kbGVyLm9uKGRvY3VtZW50LCBFVkVOVF9LRVlET1dOX0RBVEFfQVBJLCBTRUxFQ1RPUl9EQVRBX1RPR0dMRSQzLCBEcm9wZG93bi5kYXRhQXBpS2V5ZG93bkhhbmRsZXIpO1xuICBFdmVudEhhbmRsZXIub24oZG9jdW1lbnQsIEVWRU5UX0tFWURPV05fREFUQV9BUEksIFNFTEVDVE9SX01FTlUsIERyb3Bkb3duLmRhdGFBcGlLZXlkb3duSGFuZGxlcik7XG4gIEV2ZW50SGFuZGxlci5vbihkb2N1bWVudCwgRVZFTlRfQ0xJQ0tfREFUQV9BUEkkMywgRHJvcGRvd24uY2xlYXJNZW51cyk7XG4gIEV2ZW50SGFuZGxlci5vbihkb2N1bWVudCwgRVZFTlRfS0VZVVBfREFUQV9BUEksIERyb3Bkb3duLmNsZWFyTWVudXMpO1xuICBFdmVudEhhbmRsZXIub24oZG9jdW1lbnQsIEVWRU5UX0NMSUNLX0RBVEFfQVBJJDMsIFNFTEVDVE9SX0RBVEFfVE9HR0xFJDMsIGZ1bmN0aW9uIChldmVudCkge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgRHJvcGRvd24uZ2V0T3JDcmVhdGVJbnN0YW5jZSh0aGlzKS50b2dnbGUoKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIGpRdWVyeVxuICAgKi9cblxuICBkZWZpbmVKUXVlcnlQbHVnaW4oRHJvcGRvd24pO1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgdXRpbC9iYWNrZHJvcC5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cblxuICAvKipcbiAgICogQ29uc3RhbnRzXG4gICAqL1xuXG4gIGNvbnN0IE5BTUUkOSA9ICdiYWNrZHJvcCc7XG4gIGNvbnN0IENMQVNTX05BTUVfRkFERSQ0ID0gJ2ZhZGUnO1xuICBjb25zdCBDTEFTU19OQU1FX1NIT1ckNSA9ICdzaG93JztcbiAgY29uc3QgRVZFTlRfTU9VU0VET1dOID0gYG1vdXNlZG93bi5icy4ke05BTUUkOX1gO1xuICBjb25zdCBEZWZhdWx0JDggPSB7XG4gICAgY2xhc3NOYW1lOiAnbW9kYWwtYmFja2Ryb3AnLFxuICAgIGNsaWNrQ2FsbGJhY2s6IG51bGwsXG4gICAgaXNBbmltYXRlZDogZmFsc2UsXG4gICAgaXNWaXNpYmxlOiB0cnVlLFxuICAgIC8vIGlmIGZhbHNlLCB3ZSB1c2UgdGhlIGJhY2tkcm9wIGhlbHBlciB3aXRob3V0IGFkZGluZyBhbnkgZWxlbWVudCB0byB0aGUgZG9tXG4gICAgcm9vdEVsZW1lbnQ6ICdib2R5JyAvLyBnaXZlIHRoZSBjaG9pY2UgdG8gcGxhY2UgYmFja2Ryb3AgdW5kZXIgZGlmZmVyZW50IGVsZW1lbnRzXG4gIH07XG5cbiAgY29uc3QgRGVmYXVsdFR5cGUkOCA9IHtcbiAgICBjbGFzc05hbWU6ICdzdHJpbmcnLFxuICAgIGNsaWNrQ2FsbGJhY2s6ICcoZnVuY3Rpb258bnVsbCknLFxuICAgIGlzQW5pbWF0ZWQ6ICdib29sZWFuJyxcbiAgICBpc1Zpc2libGU6ICdib29sZWFuJyxcbiAgICByb290RWxlbWVudDogJyhlbGVtZW50fHN0cmluZyknXG4gIH07XG5cbiAgLyoqXG4gICAqIENsYXNzIGRlZmluaXRpb25cbiAgICovXG5cbiAgY2xhc3MgQmFja2Ryb3AgZXh0ZW5kcyBDb25maWcge1xuICAgIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgICAgc3VwZXIoKTtcbiAgICAgIHRoaXMuX2NvbmZpZyA9IHRoaXMuX2dldENvbmZpZyhjb25maWcpO1xuICAgICAgdGhpcy5faXNBcHBlbmRlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5fZWxlbWVudCA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gR2V0dGVyc1xuICAgIHN0YXRpYyBnZXQgRGVmYXVsdCgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0JDg7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgRGVmYXVsdFR5cGUoKSB7XG4gICAgICByZXR1cm4gRGVmYXVsdFR5cGUkODtcbiAgICB9XG4gICAgc3RhdGljIGdldCBOQU1FKCkge1xuICAgICAgcmV0dXJuIE5BTUUkOTtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWNcbiAgICBzaG93KGNhbGxiYWNrKSB7XG4gICAgICBpZiAoIXRoaXMuX2NvbmZpZy5pc1Zpc2libGUpIHtcbiAgICAgICAgZXhlY3V0ZShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2FwcGVuZCgpO1xuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2dldEVsZW1lbnQoKTtcbiAgICAgIGlmICh0aGlzLl9jb25maWcuaXNBbmltYXRlZCkge1xuICAgICAgICByZWZsb3coZWxlbWVudCk7XG4gICAgICB9XG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoQ0xBU1NfTkFNRV9TSE9XJDUpO1xuICAgICAgdGhpcy5fZW11bGF0ZUFuaW1hdGlvbigoKSA9PiB7XG4gICAgICAgIGV4ZWN1dGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGhpZGUoY2FsbGJhY2spIHtcbiAgICAgIGlmICghdGhpcy5fY29uZmlnLmlzVmlzaWJsZSkge1xuICAgICAgICBleGVjdXRlKGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5fZ2V0RWxlbWVudCgpLmNsYXNzTGlzdC5yZW1vdmUoQ0xBU1NfTkFNRV9TSE9XJDUpO1xuICAgICAgdGhpcy5fZW11bGF0ZUFuaW1hdGlvbigoKSA9PiB7XG4gICAgICAgIHRoaXMuZGlzcG9zZSgpO1xuICAgICAgICBleGVjdXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBkaXNwb3NlKCkge1xuICAgICAgaWYgKCF0aGlzLl9pc0FwcGVuZGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIEV2ZW50SGFuZGxlci5vZmYodGhpcy5fZWxlbWVudCwgRVZFTlRfTU9VU0VET1dOKTtcbiAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlKCk7XG4gICAgICB0aGlzLl9pc0FwcGVuZGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZVxuICAgIF9nZXRFbGVtZW50KCkge1xuICAgICAgaWYgKCF0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgIGNvbnN0IGJhY2tkcm9wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTmFtZSA9IHRoaXMuX2NvbmZpZy5jbGFzc05hbWU7XG4gICAgICAgIGlmICh0aGlzLl9jb25maWcuaXNBbmltYXRlZCkge1xuICAgICAgICAgIGJhY2tkcm9wLmNsYXNzTGlzdC5hZGQoQ0xBU1NfTkFNRV9GQURFJDQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBiYWNrZHJvcDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9lbGVtZW50O1xuICAgIH1cbiAgICBfY29uZmlnQWZ0ZXJNZXJnZShjb25maWcpIHtcbiAgICAgIC8vIHVzZSBnZXRFbGVtZW50KCkgd2l0aCB0aGUgZGVmYXVsdCBcImJvZHlcIiB0byBnZXQgYSBmcmVzaCBFbGVtZW50IG9uIGVhY2ggaW5zdGFudGlhdGlvblxuICAgICAgY29uZmlnLnJvb3RFbGVtZW50ID0gZ2V0RWxlbWVudChjb25maWcucm9vdEVsZW1lbnQpO1xuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG4gICAgX2FwcGVuZCgpIHtcbiAgICAgIGlmICh0aGlzLl9pc0FwcGVuZGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9nZXRFbGVtZW50KCk7XG4gICAgICB0aGlzLl9jb25maWcucm9vdEVsZW1lbnQuYXBwZW5kKGVsZW1lbnQpO1xuICAgICAgRXZlbnRIYW5kbGVyLm9uKGVsZW1lbnQsIEVWRU5UX01PVVNFRE9XTiwgKCkgPT4ge1xuICAgICAgICBleGVjdXRlKHRoaXMuX2NvbmZpZy5jbGlja0NhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5faXNBcHBlbmRlZCA9IHRydWU7XG4gICAgfVxuICAgIF9lbXVsYXRlQW5pbWF0aW9uKGNhbGxiYWNrKSB7XG4gICAgICBleGVjdXRlQWZ0ZXJUcmFuc2l0aW9uKGNhbGxiYWNrLCB0aGlzLl9nZXRFbGVtZW50KCksIHRoaXMuX2NvbmZpZy5pc0FuaW1hdGVkKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogQm9vdHN0cmFwIHV0aWwvZm9jdXN0cmFwLmpzXG4gICAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFpbi9MSUNFTlNFKVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBDb25zdGFudHNcbiAgICovXG5cbiAgY29uc3QgTkFNRSQ4ID0gJ2ZvY3VzdHJhcCc7XG4gIGNvbnN0IERBVEFfS0VZJDUgPSAnYnMuZm9jdXN0cmFwJztcbiAgY29uc3QgRVZFTlRfS0VZJDUgPSBgLiR7REFUQV9LRVkkNX1gO1xuICBjb25zdCBFVkVOVF9GT0NVU0lOJDIgPSBgZm9jdXNpbiR7RVZFTlRfS0VZJDV9YDtcbiAgY29uc3QgRVZFTlRfS0VZRE9XTl9UQUIgPSBga2V5ZG93bi50YWIke0VWRU5UX0tFWSQ1fWA7XG4gIGNvbnN0IFRBQl9LRVkgPSAnVGFiJztcbiAgY29uc3QgVEFCX05BVl9GT1JXQVJEID0gJ2ZvcndhcmQnO1xuICBjb25zdCBUQUJfTkFWX0JBQ0tXQVJEID0gJ2JhY2t3YXJkJztcbiAgY29uc3QgRGVmYXVsdCQ3ID0ge1xuICAgIGF1dG9mb2N1czogdHJ1ZSxcbiAgICB0cmFwRWxlbWVudDogbnVsbCAvLyBUaGUgZWxlbWVudCB0byB0cmFwIGZvY3VzIGluc2lkZSBvZlxuICB9O1xuXG4gIGNvbnN0IERlZmF1bHRUeXBlJDcgPSB7XG4gICAgYXV0b2ZvY3VzOiAnYm9vbGVhbicsXG4gICAgdHJhcEVsZW1lbnQ6ICdlbGVtZW50J1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGFzcyBkZWZpbml0aW9uXG4gICAqL1xuXG4gIGNsYXNzIEZvY3VzVHJhcCBleHRlbmRzIENvbmZpZyB7XG4gICAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgICBzdXBlcigpO1xuICAgICAgdGhpcy5fY29uZmlnID0gdGhpcy5fZ2V0Q29uZmlnKGNvbmZpZyk7XG4gICAgICB0aGlzLl9pc0FjdGl2ZSA9IGZhbHNlO1xuICAgICAgdGhpcy5fbGFzdFRhYk5hdkRpcmVjdGlvbiA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gR2V0dGVyc1xuICAgIHN0YXRpYyBnZXQgRGVmYXVsdCgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0JDc7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgRGVmYXVsdFR5cGUoKSB7XG4gICAgICByZXR1cm4gRGVmYXVsdFR5cGUkNztcbiAgICB9XG4gICAgc3RhdGljIGdldCBOQU1FKCkge1xuICAgICAgcmV0dXJuIE5BTUUkODtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWNcbiAgICBhY3RpdmF0ZSgpIHtcbiAgICAgIGlmICh0aGlzLl9pc0FjdGl2ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fY29uZmlnLmF1dG9mb2N1cykge1xuICAgICAgICB0aGlzLl9jb25maWcudHJhcEVsZW1lbnQuZm9jdXMoKTtcbiAgICAgIH1cbiAgICAgIEV2ZW50SGFuZGxlci5vZmYoZG9jdW1lbnQsIEVWRU5UX0tFWSQ1KTsgLy8gZ3VhcmQgYWdhaW5zdCBpbmZpbml0ZSBmb2N1cyBsb29wXG4gICAgICBFdmVudEhhbmRsZXIub24oZG9jdW1lbnQsIEVWRU5UX0ZPQ1VTSU4kMiwgZXZlbnQgPT4gdGhpcy5faGFuZGxlRm9jdXNpbihldmVudCkpO1xuICAgICAgRXZlbnRIYW5kbGVyLm9uKGRvY3VtZW50LCBFVkVOVF9LRVlET1dOX1RBQiwgZXZlbnQgPT4gdGhpcy5faGFuZGxlS2V5ZG93bihldmVudCkpO1xuICAgICAgdGhpcy5faXNBY3RpdmUgPSB0cnVlO1xuICAgIH1cbiAgICBkZWFjdGl2YXRlKCkge1xuICAgICAgaWYgKCF0aGlzLl9pc0FjdGl2ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl9pc0FjdGl2ZSA9IGZhbHNlO1xuICAgICAgRXZlbnRIYW5kbGVyLm9mZihkb2N1bWVudCwgRVZFTlRfS0VZJDUpO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGVcbiAgICBfaGFuZGxlRm9jdXNpbihldmVudCkge1xuICAgICAgY29uc3Qge1xuICAgICAgICB0cmFwRWxlbWVudFxuICAgICAgfSA9IHRoaXMuX2NvbmZpZztcbiAgICAgIGlmIChldmVudC50YXJnZXQgPT09IGRvY3VtZW50IHx8IGV2ZW50LnRhcmdldCA9PT0gdHJhcEVsZW1lbnQgfHwgdHJhcEVsZW1lbnQuY29udGFpbnMoZXZlbnQudGFyZ2V0KSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBlbGVtZW50cyA9IFNlbGVjdG9yRW5naW5lLmZvY3VzYWJsZUNoaWxkcmVuKHRyYXBFbGVtZW50KTtcbiAgICAgIGlmIChlbGVtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdHJhcEVsZW1lbnQuZm9jdXMoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fbGFzdFRhYk5hdkRpcmVjdGlvbiA9PT0gVEFCX05BVl9CQUNLV0FSRCkge1xuICAgICAgICBlbGVtZW50c1tlbGVtZW50cy5sZW5ndGggLSAxXS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWxlbWVudHNbMF0uZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX2hhbmRsZUtleWRvd24oZXZlbnQpIHtcbiAgICAgIGlmIChldmVudC5rZXkgIT09IFRBQl9LRVkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5fbGFzdFRhYk5hdkRpcmVjdGlvbiA9IGV2ZW50LnNoaWZ0S2V5ID8gVEFCX05BVl9CQUNLV0FSRCA6IFRBQl9OQVZfRk9SV0FSRDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogQm9vdHN0cmFwIHV0aWwvc2Nyb2xsQmFyLmpzXG4gICAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFpbi9MSUNFTlNFKVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBDb25zdGFudHNcbiAgICovXG5cbiAgY29uc3QgU0VMRUNUT1JfRklYRURfQ09OVEVOVCA9ICcuZml4ZWQtdG9wLCAuZml4ZWQtYm90dG9tLCAuaXMtZml4ZWQsIC5zdGlja3ktdG9wJztcbiAgY29uc3QgU0VMRUNUT1JfU1RJQ0tZX0NPTlRFTlQgPSAnLnN0aWNreS10b3AnO1xuICBjb25zdCBQUk9QRVJUWV9QQURESU5HID0gJ3BhZGRpbmctcmlnaHQnO1xuICBjb25zdCBQUk9QRVJUWV9NQVJHSU4gPSAnbWFyZ2luLXJpZ2h0JztcblxuICAvKipcbiAgICogQ2xhc3MgZGVmaW5pdGlvblxuICAgKi9cblxuICBjbGFzcyBTY3JvbGxCYXJIZWxwZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgdGhpcy5fZWxlbWVudCA9IGRvY3VtZW50LmJvZHk7XG4gICAgfVxuXG4gICAgLy8gUHVibGljXG4gICAgZ2V0V2lkdGgoKSB7XG4gICAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2luZG93L2lubmVyV2lkdGgjdXNhZ2Vfbm90ZXNcbiAgICAgIGNvbnN0IGRvY3VtZW50V2lkdGggPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGg7XG4gICAgICByZXR1cm4gTWF0aC5hYnMod2luZG93LmlubmVyV2lkdGggLSBkb2N1bWVudFdpZHRoKTtcbiAgICB9XG4gICAgaGlkZSgpIHtcbiAgICAgIGNvbnN0IHdpZHRoID0gdGhpcy5nZXRXaWR0aCgpO1xuICAgICAgdGhpcy5fZGlzYWJsZU92ZXJGbG93KCk7XG4gICAgICAvLyBnaXZlIHBhZGRpbmcgdG8gZWxlbWVudCB0byBiYWxhbmNlIHRoZSBoaWRkZW4gc2Nyb2xsYmFyIHdpZHRoXG4gICAgICB0aGlzLl9zZXRFbGVtZW50QXR0cmlidXRlcyh0aGlzLl9lbGVtZW50LCBQUk9QRVJUWV9QQURESU5HLCBjYWxjdWxhdGVkVmFsdWUgPT4gY2FsY3VsYXRlZFZhbHVlICsgd2lkdGgpO1xuICAgICAgLy8gdHJpY2s6IFdlIGFkanVzdCBwb3NpdGl2ZSBwYWRkaW5nUmlnaHQgYW5kIG5lZ2F0aXZlIG1hcmdpblJpZ2h0IHRvIHN0aWNreS10b3AgZWxlbWVudHMgdG8ga2VlcCBzaG93aW5nIGZ1bGx3aWR0aFxuICAgICAgdGhpcy5fc2V0RWxlbWVudEF0dHJpYnV0ZXMoU0VMRUNUT1JfRklYRURfQ09OVEVOVCwgUFJPUEVSVFlfUEFERElORywgY2FsY3VsYXRlZFZhbHVlID0+IGNhbGN1bGF0ZWRWYWx1ZSArIHdpZHRoKTtcbiAgICAgIHRoaXMuX3NldEVsZW1lbnRBdHRyaWJ1dGVzKFNFTEVDVE9SX1NUSUNLWV9DT05URU5ULCBQUk9QRVJUWV9NQVJHSU4sIGNhbGN1bGF0ZWRWYWx1ZSA9PiBjYWxjdWxhdGVkVmFsdWUgLSB3aWR0aCk7XG4gICAgfVxuICAgIHJlc2V0KCkge1xuICAgICAgdGhpcy5fcmVzZXRFbGVtZW50QXR0cmlidXRlcyh0aGlzLl9lbGVtZW50LCAnb3ZlcmZsb3cnKTtcbiAgICAgIHRoaXMuX3Jlc2V0RWxlbWVudEF0dHJpYnV0ZXModGhpcy5fZWxlbWVudCwgUFJPUEVSVFlfUEFERElORyk7XG4gICAgICB0aGlzLl9yZXNldEVsZW1lbnRBdHRyaWJ1dGVzKFNFTEVDVE9SX0ZJWEVEX0NPTlRFTlQsIFBST1BFUlRZX1BBRERJTkcpO1xuICAgICAgdGhpcy5fcmVzZXRFbGVtZW50QXR0cmlidXRlcyhTRUxFQ1RPUl9TVElDS1lfQ09OVEVOVCwgUFJPUEVSVFlfTUFSR0lOKTtcbiAgICB9XG4gICAgaXNPdmVyZmxvd2luZygpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFdpZHRoKCkgPiAwO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGVcbiAgICBfZGlzYWJsZU92ZXJGbG93KCkge1xuICAgICAgdGhpcy5fc2F2ZUluaXRpYWxBdHRyaWJ1dGUodGhpcy5fZWxlbWVudCwgJ292ZXJmbG93Jyk7XG4gICAgICB0aGlzLl9lbGVtZW50LnN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XG4gICAgfVxuICAgIF9zZXRFbGVtZW50QXR0cmlidXRlcyhzZWxlY3Rvciwgc3R5bGVQcm9wZXJ0eSwgY2FsbGJhY2spIHtcbiAgICAgIGNvbnN0IHNjcm9sbGJhcldpZHRoID0gdGhpcy5nZXRXaWR0aCgpO1xuICAgICAgY29uc3QgbWFuaXB1bGF0aW9uQ2FsbEJhY2sgPSBlbGVtZW50ID0+IHtcbiAgICAgICAgaWYgKGVsZW1lbnQgIT09IHRoaXMuX2VsZW1lbnQgJiYgd2luZG93LmlubmVyV2lkdGggPiBlbGVtZW50LmNsaWVudFdpZHRoICsgc2Nyb2xsYmFyV2lkdGgpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc2F2ZUluaXRpYWxBdHRyaWJ1dGUoZWxlbWVudCwgc3R5bGVQcm9wZXJ0eSk7XG4gICAgICAgIGNvbnN0IGNhbGN1bGF0ZWRWYWx1ZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpLmdldFByb3BlcnR5VmFsdWUoc3R5bGVQcm9wZXJ0eSk7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoc3R5bGVQcm9wZXJ0eSwgYCR7Y2FsbGJhY2soTnVtYmVyLnBhcnNlRmxvYXQoY2FsY3VsYXRlZFZhbHVlKSl9cHhgKTtcbiAgICAgIH07XG4gICAgICB0aGlzLl9hcHBseU1hbmlwdWxhdGlvbkNhbGxiYWNrKHNlbGVjdG9yLCBtYW5pcHVsYXRpb25DYWxsQmFjayk7XG4gICAgfVxuICAgIF9zYXZlSW5pdGlhbEF0dHJpYnV0ZShlbGVtZW50LCBzdHlsZVByb3BlcnR5KSB7XG4gICAgICBjb25zdCBhY3R1YWxWYWx1ZSA9IGVsZW1lbnQuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZShzdHlsZVByb3BlcnR5KTtcbiAgICAgIGlmIChhY3R1YWxWYWx1ZSkge1xuICAgICAgICBNYW5pcHVsYXRvci5zZXREYXRhQXR0cmlidXRlKGVsZW1lbnQsIHN0eWxlUHJvcGVydHksIGFjdHVhbFZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX3Jlc2V0RWxlbWVudEF0dHJpYnV0ZXMoc2VsZWN0b3IsIHN0eWxlUHJvcGVydHkpIHtcbiAgICAgIGNvbnN0IG1hbmlwdWxhdGlvbkNhbGxCYWNrID0gZWxlbWVudCA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gTWFuaXB1bGF0b3IuZ2V0RGF0YUF0dHJpYnV0ZShlbGVtZW50LCBzdHlsZVByb3BlcnR5KTtcbiAgICAgICAgLy8gV2Ugb25seSB3YW50IHRvIHJlbW92ZSB0aGUgcHJvcGVydHkgaWYgdGhlIHZhbHVlIGlzIGBudWxsYDsgdGhlIHZhbHVlIGNhbiBhbHNvIGJlIHplcm9cbiAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgZWxlbWVudC5zdHlsZS5yZW1vdmVQcm9wZXJ0eShzdHlsZVByb3BlcnR5KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgTWFuaXB1bGF0b3IucmVtb3ZlRGF0YUF0dHJpYnV0ZShlbGVtZW50LCBzdHlsZVByb3BlcnR5KTtcbiAgICAgICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShzdHlsZVByb3BlcnR5LCB2YWx1ZSk7XG4gICAgICB9O1xuICAgICAgdGhpcy5fYXBwbHlNYW5pcHVsYXRpb25DYWxsYmFjayhzZWxlY3RvciwgbWFuaXB1bGF0aW9uQ2FsbEJhY2spO1xuICAgIH1cbiAgICBfYXBwbHlNYW5pcHVsYXRpb25DYWxsYmFjayhzZWxlY3RvciwgY2FsbEJhY2spIHtcbiAgICAgIGlmIChpc0VsZW1lbnQkMShzZWxlY3RvcikpIHtcbiAgICAgICAgY2FsbEJhY2soc2VsZWN0b3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHNlbCBvZiBTZWxlY3RvckVuZ2luZS5maW5kKHNlbGVjdG9yLCB0aGlzLl9lbGVtZW50KSkge1xuICAgICAgICBjYWxsQmFjayhzZWwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgbW9kYWwuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50c1xuICAgKi9cblxuICBjb25zdCBOQU1FJDcgPSAnbW9kYWwnO1xuICBjb25zdCBEQVRBX0tFWSQ0ID0gJ2JzLm1vZGFsJztcbiAgY29uc3QgRVZFTlRfS0VZJDQgPSBgLiR7REFUQV9LRVkkNH1gO1xuICBjb25zdCBEQVRBX0FQSV9LRVkkMiA9ICcuZGF0YS1hcGknO1xuICBjb25zdCBFU0NBUEVfS0VZJDEgPSAnRXNjYXBlJztcbiAgY29uc3QgRVZFTlRfSElERSQ0ID0gYGhpZGUke0VWRU5UX0tFWSQ0fWA7XG4gIGNvbnN0IEVWRU5UX0hJREVfUFJFVkVOVEVEJDEgPSBgaGlkZVByZXZlbnRlZCR7RVZFTlRfS0VZJDR9YDtcbiAgY29uc3QgRVZFTlRfSElEREVOJDQgPSBgaGlkZGVuJHtFVkVOVF9LRVkkNH1gO1xuICBjb25zdCBFVkVOVF9TSE9XJDQgPSBgc2hvdyR7RVZFTlRfS0VZJDR9YDtcbiAgY29uc3QgRVZFTlRfU0hPV04kNCA9IGBzaG93biR7RVZFTlRfS0VZJDR9YDtcbiAgY29uc3QgRVZFTlRfUkVTSVpFJDEgPSBgcmVzaXplJHtFVkVOVF9LRVkkNH1gO1xuICBjb25zdCBFVkVOVF9DTElDS19ESVNNSVNTID0gYGNsaWNrLmRpc21pc3Mke0VWRU5UX0tFWSQ0fWA7XG4gIGNvbnN0IEVWRU5UX01PVVNFRE9XTl9ESVNNSVNTID0gYG1vdXNlZG93bi5kaXNtaXNzJHtFVkVOVF9LRVkkNH1gO1xuICBjb25zdCBFVkVOVF9LRVlET1dOX0RJU01JU1MkMSA9IGBrZXlkb3duLmRpc21pc3Mke0VWRU5UX0tFWSQ0fWA7XG4gIGNvbnN0IEVWRU5UX0NMSUNLX0RBVEFfQVBJJDIgPSBgY2xpY2ske0VWRU5UX0tFWSQ0fSR7REFUQV9BUElfS0VZJDJ9YDtcbiAgY29uc3QgQ0xBU1NfTkFNRV9PUEVOID0gJ21vZGFsLW9wZW4nO1xuICBjb25zdCBDTEFTU19OQU1FX0ZBREUkMyA9ICdmYWRlJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9TSE9XJDQgPSAnc2hvdyc7XG4gIGNvbnN0IENMQVNTX05BTUVfU1RBVElDID0gJ21vZGFsLXN0YXRpYyc7XG4gIGNvbnN0IE9QRU5fU0VMRUNUT1IkMSA9ICcubW9kYWwuc2hvdyc7XG4gIGNvbnN0IFNFTEVDVE9SX0RJQUxPRyA9ICcubW9kYWwtZGlhbG9nJztcbiAgY29uc3QgU0VMRUNUT1JfTU9EQUxfQk9EWSA9ICcubW9kYWwtYm9keSc7XG4gIGNvbnN0IFNFTEVDVE9SX0RBVEFfVE9HR0xFJDIgPSAnW2RhdGEtYnMtdG9nZ2xlPVwibW9kYWxcIl0nO1xuICBjb25zdCBEZWZhdWx0JDYgPSB7XG4gICAgYmFja2Ryb3A6IHRydWUsXG4gICAgZm9jdXM6IHRydWUsXG4gICAga2V5Ym9hcmQ6IHRydWVcbiAgfTtcbiAgY29uc3QgRGVmYXVsdFR5cGUkNiA9IHtcbiAgICBiYWNrZHJvcDogJyhib29sZWFufHN0cmluZyknLFxuICAgIGZvY3VzOiAnYm9vbGVhbicsXG4gICAga2V5Ym9hcmQ6ICdib29sZWFuJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGFzcyBkZWZpbml0aW9uXG4gICAqL1xuXG4gIGNsYXNzIE1vZGFsIGV4dGVuZHMgQmFzZUNvbXBvbmVudCB7XG4gICAgY29uc3RydWN0b3IoZWxlbWVudCwgY29uZmlnKSB7XG4gICAgICBzdXBlcihlbGVtZW50LCBjb25maWcpO1xuICAgICAgdGhpcy5fZGlhbG9nID0gU2VsZWN0b3JFbmdpbmUuZmluZE9uZShTRUxFQ1RPUl9ESUFMT0csIHRoaXMuX2VsZW1lbnQpO1xuICAgICAgdGhpcy5fYmFja2Ryb3AgPSB0aGlzLl9pbml0aWFsaXplQmFja0Ryb3AoKTtcbiAgICAgIHRoaXMuX2ZvY3VzdHJhcCA9IHRoaXMuX2luaXRpYWxpemVGb2N1c1RyYXAoKTtcbiAgICAgIHRoaXMuX2lzU2hvd24gPSBmYWxzZTtcbiAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IGZhbHNlO1xuICAgICAgdGhpcy5fc2Nyb2xsQmFyID0gbmV3IFNjcm9sbEJhckhlbHBlcigpO1xuICAgICAgdGhpcy5fYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgICB9XG5cbiAgICAvLyBHZXR0ZXJzXG4gICAgc3RhdGljIGdldCBEZWZhdWx0KCkge1xuICAgICAgcmV0dXJuIERlZmF1bHQkNjtcbiAgICB9XG4gICAgc3RhdGljIGdldCBEZWZhdWx0VHlwZSgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0VHlwZSQ2O1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IE5BTUUoKSB7XG4gICAgICByZXR1cm4gTkFNRSQ3O1xuICAgIH1cblxuICAgIC8vIFB1YmxpY1xuICAgIHRvZ2dsZShyZWxhdGVkVGFyZ2V0KSB7XG4gICAgICByZXR1cm4gdGhpcy5faXNTaG93biA/IHRoaXMuaGlkZSgpIDogdGhpcy5zaG93KHJlbGF0ZWRUYXJnZXQpO1xuICAgIH1cbiAgICBzaG93KHJlbGF0ZWRUYXJnZXQpIHtcbiAgICAgIGlmICh0aGlzLl9pc1Nob3duIHx8IHRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBzaG93RXZlbnQgPSBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCBFVkVOVF9TSE9XJDQsIHtcbiAgICAgICAgcmVsYXRlZFRhcmdldFxuICAgICAgfSk7XG4gICAgICBpZiAoc2hvd0V2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5faXNTaG93biA9IHRydWU7XG4gICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fc2Nyb2xsQmFyLmhpZGUoKTtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX09QRU4pO1xuICAgICAgdGhpcy5fYWRqdXN0RGlhbG9nKCk7XG4gICAgICB0aGlzLl9iYWNrZHJvcC5zaG93KCgpID0+IHRoaXMuX3Nob3dFbGVtZW50KHJlbGF0ZWRUYXJnZXQpKTtcbiAgICB9XG4gICAgaGlkZSgpIHtcbiAgICAgIGlmICghdGhpcy5faXNTaG93biB8fCB0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgaGlkZUV2ZW50ID0gRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfSElERSQ0KTtcbiAgICAgIGlmIChoaWRlRXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl9pc1Nob3duID0gZmFsc2U7XG4gICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZm9jdXN0cmFwLmRlYWN0aXZhdGUoKTtcbiAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX1NIT1ckNCk7XG4gICAgICB0aGlzLl9xdWV1ZUNhbGxiYWNrKCgpID0+IHRoaXMuX2hpZGVNb2RhbCgpLCB0aGlzLl9lbGVtZW50LCB0aGlzLl9pc0FuaW1hdGVkKCkpO1xuICAgIH1cbiAgICBkaXNwb3NlKCkge1xuICAgICAgRXZlbnRIYW5kbGVyLm9mZih3aW5kb3csIEVWRU5UX0tFWSQ0KTtcbiAgICAgIEV2ZW50SGFuZGxlci5vZmYodGhpcy5fZGlhbG9nLCBFVkVOVF9LRVkkNCk7XG4gICAgICB0aGlzLl9iYWNrZHJvcC5kaXNwb3NlKCk7XG4gICAgICB0aGlzLl9mb2N1c3RyYXAuZGVhY3RpdmF0ZSgpO1xuICAgICAgc3VwZXIuZGlzcG9zZSgpO1xuICAgIH1cbiAgICBoYW5kbGVVcGRhdGUoKSB7XG4gICAgICB0aGlzLl9hZGp1c3REaWFsb2coKTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlXG4gICAgX2luaXRpYWxpemVCYWNrRHJvcCgpIHtcbiAgICAgIHJldHVybiBuZXcgQmFja2Ryb3Aoe1xuICAgICAgICBpc1Zpc2libGU6IEJvb2xlYW4odGhpcy5fY29uZmlnLmJhY2tkcm9wKSxcbiAgICAgICAgLy8gJ3N0YXRpYycgb3B0aW9uIHdpbGwgYmUgdHJhbnNsYXRlZCB0byB0cnVlLCBhbmQgYm9vbGVhbnMgd2lsbCBrZWVwIHRoZWlyIHZhbHVlLFxuICAgICAgICBpc0FuaW1hdGVkOiB0aGlzLl9pc0FuaW1hdGVkKClcbiAgICAgIH0pO1xuICAgIH1cbiAgICBfaW5pdGlhbGl6ZUZvY3VzVHJhcCgpIHtcbiAgICAgIHJldHVybiBuZXcgRm9jdXNUcmFwKHtcbiAgICAgICAgdHJhcEVsZW1lbnQ6IHRoaXMuX2VsZW1lbnRcbiAgICAgIH0pO1xuICAgIH1cbiAgICBfc2hvd0VsZW1lbnQocmVsYXRlZFRhcmdldCkge1xuICAgICAgLy8gdHJ5IHRvIGFwcGVuZCBkeW5hbWljIG1vZGFsXG4gICAgICBpZiAoIWRvY3VtZW50LmJvZHkuY29udGFpbnModGhpcy5fZWxlbWVudCkpIHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmQodGhpcy5fZWxlbWVudCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgdGhpcy5fZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJyk7XG4gICAgICB0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1tb2RhbCcsIHRydWUpO1xuICAgICAgdGhpcy5fZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZGlhbG9nJyk7XG4gICAgICB0aGlzLl9lbGVtZW50LnNjcm9sbFRvcCA9IDA7XG4gICAgICBjb25zdCBtb2RhbEJvZHkgPSBTZWxlY3RvckVuZ2luZS5maW5kT25lKFNFTEVDVE9SX01PREFMX0JPRFksIHRoaXMuX2RpYWxvZyk7XG4gICAgICBpZiAobW9kYWxCb2R5KSB7XG4gICAgICAgIG1vZGFsQm9keS5zY3JvbGxUb3AgPSAwO1xuICAgICAgfVxuICAgICAgcmVmbG93KHRoaXMuX2VsZW1lbnQpO1xuICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfU0hPVyQ0KTtcbiAgICAgIGNvbnN0IHRyYW5zaXRpb25Db21wbGV0ZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbmZpZy5mb2N1cykge1xuICAgICAgICAgIHRoaXMuX2ZvY3VzdHJhcC5hY3RpdmF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IGZhbHNlO1xuICAgICAgICBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCBFVkVOVF9TSE9XTiQ0LCB7XG4gICAgICAgICAgcmVsYXRlZFRhcmdldFxuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICB0aGlzLl9xdWV1ZUNhbGxiYWNrKHRyYW5zaXRpb25Db21wbGV0ZSwgdGhpcy5fZGlhbG9nLCB0aGlzLl9pc0FuaW1hdGVkKCkpO1xuICAgIH1cbiAgICBfYWRkRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgICBFdmVudEhhbmRsZXIub24odGhpcy5fZWxlbWVudCwgRVZFTlRfS0VZRE9XTl9ESVNNSVNTJDEsIGV2ZW50ID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmtleSAhPT0gRVNDQVBFX0tFWSQxKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9jb25maWcua2V5Ym9hcmQpIHtcbiAgICAgICAgICB0aGlzLmhpZGUoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdHJpZ2dlckJhY2tkcm9wVHJhbnNpdGlvbigpO1xuICAgICAgfSk7XG4gICAgICBFdmVudEhhbmRsZXIub24od2luZG93LCBFVkVOVF9SRVNJWkUkMSwgKCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5faXNTaG93biAmJiAhdGhpcy5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgICAgdGhpcy5fYWRqdXN0RGlhbG9nKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgRXZlbnRIYW5kbGVyLm9uKHRoaXMuX2VsZW1lbnQsIEVWRU5UX01PVVNFRE9XTl9ESVNNSVNTLCBldmVudCA9PiB7XG4gICAgICAgIC8vIGEgYmFkIHRyaWNrIHRvIHNlZ3JlZ2F0ZSBjbGlja3MgdGhhdCBtYXkgc3RhcnQgaW5zaWRlIGRpYWxvZyBidXQgZW5kIG91dHNpZGUsIGFuZCBhdm9pZCBsaXN0ZW4gdG8gc2Nyb2xsYmFyIGNsaWNrc1xuICAgICAgICBFdmVudEhhbmRsZXIub25lKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0NMSUNLX0RJU01JU1MsIGV2ZW50MiA9PiB7XG4gICAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQgIT09IGV2ZW50LnRhcmdldCB8fCB0aGlzLl9lbGVtZW50ICE9PSBldmVudDIudGFyZ2V0KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLl9jb25maWcuYmFja2Ryb3AgPT09ICdzdGF0aWMnKSB7XG4gICAgICAgICAgICB0aGlzLl90cmlnZ2VyQmFja2Ryb3BUcmFuc2l0aW9uKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLl9jb25maWcuYmFja2Ryb3ApIHtcbiAgICAgICAgICAgIHRoaXMuaGlkZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgX2hpZGVNb2RhbCgpIHtcbiAgICAgIHRoaXMuX2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIHRoaXMuX2VsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsIHRydWUpO1xuICAgICAgdGhpcy5fZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtbW9kYWwnKTtcbiAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdyb2xlJyk7XG4gICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSBmYWxzZTtcbiAgICAgIHRoaXMuX2JhY2tkcm9wLmhpZGUoKCkgPT4ge1xuICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoQ0xBU1NfTkFNRV9PUEVOKTtcbiAgICAgICAgdGhpcy5fcmVzZXRBZGp1c3RtZW50cygpO1xuICAgICAgICB0aGlzLl9zY3JvbGxCYXIucmVzZXQoKTtcbiAgICAgICAgRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfSElEREVOJDQpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIF9pc0FuaW1hdGVkKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKENMQVNTX05BTUVfRkFERSQzKTtcbiAgICB9XG4gICAgX3RyaWdnZXJCYWNrZHJvcFRyYW5zaXRpb24oKSB7XG4gICAgICBjb25zdCBoaWRlRXZlbnQgPSBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCBFVkVOVF9ISURFX1BSRVZFTlRFRCQxKTtcbiAgICAgIGlmIChoaWRlRXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBpc01vZGFsT3ZlcmZsb3dpbmcgPSB0aGlzLl9lbGVtZW50LnNjcm9sbEhlaWdodCA+IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQ7XG4gICAgICBjb25zdCBpbml0aWFsT3ZlcmZsb3dZID0gdGhpcy5fZWxlbWVudC5zdHlsZS5vdmVyZmxvd1k7XG4gICAgICAvLyByZXR1cm4gaWYgdGhlIGZvbGxvd2luZyBiYWNrZ3JvdW5kIHRyYW5zaXRpb24gaGFzbid0IHlldCBjb21wbGV0ZWRcbiAgICAgIGlmIChpbml0aWFsT3ZlcmZsb3dZID09PSAnaGlkZGVuJyB8fCB0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5jb250YWlucyhDTEFTU19OQU1FX1NUQVRJQykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCFpc01vZGFsT3ZlcmZsb3dpbmcpIHtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZS5vdmVyZmxvd1kgPSAnaGlkZGVuJztcbiAgICAgIH1cbiAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX1NUQVRJQyk7XG4gICAgICB0aGlzLl9xdWV1ZUNhbGxiYWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKENMQVNTX05BTUVfU1RBVElDKTtcbiAgICAgICAgdGhpcy5fcXVldWVDYWxsYmFjaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZS5vdmVyZmxvd1kgPSBpbml0aWFsT3ZlcmZsb3dZO1xuICAgICAgICB9LCB0aGlzLl9kaWFsb2cpO1xuICAgICAgfSwgdGhpcy5fZGlhbG9nKTtcbiAgICAgIHRoaXMuX2VsZW1lbnQuZm9jdXMoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZm9sbG93aW5nIG1ldGhvZHMgYXJlIHVzZWQgdG8gaGFuZGxlIG92ZXJmbG93aW5nIG1vZGFsc1xuICAgICAqL1xuXG4gICAgX2FkanVzdERpYWxvZygpIHtcbiAgICAgIGNvbnN0IGlzTW9kYWxPdmVyZmxvd2luZyA9IHRoaXMuX2VsZW1lbnQuc2Nyb2xsSGVpZ2h0ID4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodDtcbiAgICAgIGNvbnN0IHNjcm9sbGJhcldpZHRoID0gdGhpcy5fc2Nyb2xsQmFyLmdldFdpZHRoKCk7XG4gICAgICBjb25zdCBpc0JvZHlPdmVyZmxvd2luZyA9IHNjcm9sbGJhcldpZHRoID4gMDtcbiAgICAgIGlmIChpc0JvZHlPdmVyZmxvd2luZyAmJiAhaXNNb2RhbE92ZXJmbG93aW5nKSB7XG4gICAgICAgIGNvbnN0IHByb3BlcnR5ID0gaXNSVEwoKSA/ICdwYWRkaW5nTGVmdCcgOiAncGFkZGluZ1JpZ2h0JztcbiAgICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZVtwcm9wZXJ0eV0gPSBgJHtzY3JvbGxiYXJXaWR0aH1weGA7XG4gICAgICB9XG4gICAgICBpZiAoIWlzQm9keU92ZXJmbG93aW5nICYmIGlzTW9kYWxPdmVyZmxvd2luZykge1xuICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IGlzUlRMKCkgPyAncGFkZGluZ1JpZ2h0JyA6ICdwYWRkaW5nTGVmdCc7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuc3R5bGVbcHJvcGVydHldID0gYCR7c2Nyb2xsYmFyV2lkdGh9cHhgO1xuICAgICAgfVxuICAgIH1cbiAgICBfcmVzZXRBZGp1c3RtZW50cygpIHtcbiAgICAgIHRoaXMuX2VsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSAnJztcbiAgICAgIHRoaXMuX2VsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gJyc7XG4gICAgfVxuXG4gICAgLy8gU3RhdGljXG4gICAgc3RhdGljIGpRdWVyeUludGVyZmFjZShjb25maWcsIHJlbGF0ZWRUYXJnZXQpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBkYXRhID0gTW9kYWwuZ2V0T3JDcmVhdGVJbnN0YW5jZSh0aGlzLCBjb25maWcpO1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhW2NvbmZpZ10gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgTm8gbWV0aG9kIG5hbWVkIFwiJHtjb25maWd9XCJgKTtcbiAgICAgICAgfVxuICAgICAgICBkYXRhW2NvbmZpZ10ocmVsYXRlZFRhcmdldCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGF0YSBBUEkgaW1wbGVtZW50YXRpb25cbiAgICovXG5cbiAgRXZlbnRIYW5kbGVyLm9uKGRvY3VtZW50LCBFVkVOVF9DTElDS19EQVRBX0FQSSQyLCBTRUxFQ1RPUl9EQVRBX1RPR0dMRSQyLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICBjb25zdCB0YXJnZXQgPSBTZWxlY3RvckVuZ2luZS5nZXRFbGVtZW50RnJvbVNlbGVjdG9yKHRoaXMpO1xuICAgIGlmIChbJ0EnLCAnQVJFQSddLmluY2x1ZGVzKHRoaXMudGFnTmFtZSkpIHtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICAgIEV2ZW50SGFuZGxlci5vbmUodGFyZ2V0LCBFVkVOVF9TSE9XJDQsIHNob3dFdmVudCA9PiB7XG4gICAgICBpZiAoc2hvd0V2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHtcbiAgICAgICAgLy8gb25seSByZWdpc3RlciBmb2N1cyByZXN0b3JlciBpZiBtb2RhbCB3aWxsIGFjdHVhbGx5IGdldCBzaG93blxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBFdmVudEhhbmRsZXIub25lKHRhcmdldCwgRVZFTlRfSElEREVOJDQsICgpID0+IHtcbiAgICAgICAgaWYgKGlzVmlzaWJsZSh0aGlzKSkge1xuICAgICAgICAgIHRoaXMuZm9jdXMoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBhdm9pZCBjb25mbGljdCB3aGVuIGNsaWNraW5nIG1vZGFsIHRvZ2dsZXIgd2hpbGUgYW5vdGhlciBvbmUgaXMgb3BlblxuICAgIGNvbnN0IGFscmVhZHlPcGVuID0gU2VsZWN0b3JFbmdpbmUuZmluZE9uZShPUEVOX1NFTEVDVE9SJDEpO1xuICAgIGlmIChhbHJlYWR5T3Blbikge1xuICAgICAgTW9kYWwuZ2V0SW5zdGFuY2UoYWxyZWFkeU9wZW4pLmhpZGUoKTtcbiAgICB9XG4gICAgY29uc3QgZGF0YSA9IE1vZGFsLmdldE9yQ3JlYXRlSW5zdGFuY2UodGFyZ2V0KTtcbiAgICBkYXRhLnRvZ2dsZSh0aGlzKTtcbiAgfSk7XG4gIGVuYWJsZURpc21pc3NUcmlnZ2VyKE1vZGFsKTtcblxuICAvKipcbiAgICogalF1ZXJ5XG4gICAqL1xuXG4gIGRlZmluZUpRdWVyeVBsdWdpbihNb2RhbCk7XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCBvZmZjYW52YXMuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50c1xuICAgKi9cblxuICBjb25zdCBOQU1FJDYgPSAnb2ZmY2FudmFzJztcbiAgY29uc3QgREFUQV9LRVkkMyA9ICdicy5vZmZjYW52YXMnO1xuICBjb25zdCBFVkVOVF9LRVkkMyA9IGAuJHtEQVRBX0tFWSQzfWA7XG4gIGNvbnN0IERBVEFfQVBJX0tFWSQxID0gJy5kYXRhLWFwaSc7XG4gIGNvbnN0IEVWRU5UX0xPQURfREFUQV9BUEkkMiA9IGBsb2FkJHtFVkVOVF9LRVkkM30ke0RBVEFfQVBJX0tFWSQxfWA7XG4gIGNvbnN0IEVTQ0FQRV9LRVkgPSAnRXNjYXBlJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9TSE9XJDMgPSAnc2hvdyc7XG4gIGNvbnN0IENMQVNTX05BTUVfU0hPV0lORyQxID0gJ3Nob3dpbmcnO1xuICBjb25zdCBDTEFTU19OQU1FX0hJRElORyA9ICdoaWRpbmcnO1xuICBjb25zdCBDTEFTU19OQU1FX0JBQ0tEUk9QID0gJ29mZmNhbnZhcy1iYWNrZHJvcCc7XG4gIGNvbnN0IE9QRU5fU0VMRUNUT1IgPSAnLm9mZmNhbnZhcy5zaG93JztcbiAgY29uc3QgRVZFTlRfU0hPVyQzID0gYHNob3cke0VWRU5UX0tFWSQzfWA7XG4gIGNvbnN0IEVWRU5UX1NIT1dOJDMgPSBgc2hvd24ke0VWRU5UX0tFWSQzfWA7XG4gIGNvbnN0IEVWRU5UX0hJREUkMyA9IGBoaWRlJHtFVkVOVF9LRVkkM31gO1xuICBjb25zdCBFVkVOVF9ISURFX1BSRVZFTlRFRCA9IGBoaWRlUHJldmVudGVkJHtFVkVOVF9LRVkkM31gO1xuICBjb25zdCBFVkVOVF9ISURERU4kMyA9IGBoaWRkZW4ke0VWRU5UX0tFWSQzfWA7XG4gIGNvbnN0IEVWRU5UX1JFU0laRSA9IGByZXNpemUke0VWRU5UX0tFWSQzfWA7XG4gIGNvbnN0IEVWRU5UX0NMSUNLX0RBVEFfQVBJJDEgPSBgY2xpY2ske0VWRU5UX0tFWSQzfSR7REFUQV9BUElfS0VZJDF9YDtcbiAgY29uc3QgRVZFTlRfS0VZRE9XTl9ESVNNSVNTID0gYGtleWRvd24uZGlzbWlzcyR7RVZFTlRfS0VZJDN9YDtcbiAgY29uc3QgU0VMRUNUT1JfREFUQV9UT0dHTEUkMSA9ICdbZGF0YS1icy10b2dnbGU9XCJvZmZjYW52YXNcIl0nO1xuICBjb25zdCBEZWZhdWx0JDUgPSB7XG4gICAgYmFja2Ryb3A6IHRydWUsXG4gICAga2V5Ym9hcmQ6IHRydWUsXG4gICAgc2Nyb2xsOiBmYWxzZVxuICB9O1xuICBjb25zdCBEZWZhdWx0VHlwZSQ1ID0ge1xuICAgIGJhY2tkcm9wOiAnKGJvb2xlYW58c3RyaW5nKScsXG4gICAga2V5Ym9hcmQ6ICdib29sZWFuJyxcbiAgICBzY3JvbGw6ICdib29sZWFuJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGFzcyBkZWZpbml0aW9uXG4gICAqL1xuXG4gIGNsYXNzIE9mZmNhbnZhcyBleHRlbmRzIEJhc2VDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgc3VwZXIoZWxlbWVudCwgY29uZmlnKTtcbiAgICAgIHRoaXMuX2lzU2hvd24gPSBmYWxzZTtcbiAgICAgIHRoaXMuX2JhY2tkcm9wID0gdGhpcy5faW5pdGlhbGl6ZUJhY2tEcm9wKCk7XG4gICAgICB0aGlzLl9mb2N1c3RyYXAgPSB0aGlzLl9pbml0aWFsaXplRm9jdXNUcmFwKCk7XG4gICAgICB0aGlzLl9hZGRFdmVudExpc3RlbmVycygpO1xuICAgIH1cblxuICAgIC8vIEdldHRlcnNcbiAgICBzdGF0aWMgZ2V0IERlZmF1bHQoKSB7XG4gICAgICByZXR1cm4gRGVmYXVsdCQ1O1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IERlZmF1bHRUeXBlKCkge1xuICAgICAgcmV0dXJuIERlZmF1bHRUeXBlJDU7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgTkFNRSgpIHtcbiAgICAgIHJldHVybiBOQU1FJDY7XG4gICAgfVxuXG4gICAgLy8gUHVibGljXG4gICAgdG9nZ2xlKHJlbGF0ZWRUYXJnZXQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pc1Nob3duID8gdGhpcy5oaWRlKCkgOiB0aGlzLnNob3cocmVsYXRlZFRhcmdldCk7XG4gICAgfVxuICAgIHNob3cocmVsYXRlZFRhcmdldCkge1xuICAgICAgaWYgKHRoaXMuX2lzU2hvd24pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3Qgc2hvd0V2ZW50ID0gRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfU0hPVyQzLCB7XG4gICAgICAgIHJlbGF0ZWRUYXJnZXRcbiAgICAgIH0pO1xuICAgICAgaWYgKHNob3dFdmVudC5kZWZhdWx0UHJldmVudGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2lzU2hvd24gPSB0cnVlO1xuICAgICAgdGhpcy5fYmFja2Ryb3Auc2hvdygpO1xuICAgICAgaWYgKCF0aGlzLl9jb25maWcuc2Nyb2xsKSB7XG4gICAgICAgIG5ldyBTY3JvbGxCYXJIZWxwZXIoKS5oaWRlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1tb2RhbCcsIHRydWUpO1xuICAgICAgdGhpcy5fZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZGlhbG9nJyk7XG4gICAgICB0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5hZGQoQ0xBU1NfTkFNRV9TSE9XSU5HJDEpO1xuICAgICAgY29uc3QgY29tcGxldGVDYWxsQmFjayA9ICgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb25maWcuc2Nyb2xsIHx8IHRoaXMuX2NvbmZpZy5iYWNrZHJvcCkge1xuICAgICAgICAgIHRoaXMuX2ZvY3VzdHJhcC5hY3RpdmF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX1NIT1ckMyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX1NIT1dJTkckMSk7XG4gICAgICAgIEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX1NIT1dOJDMsIHtcbiAgICAgICAgICByZWxhdGVkVGFyZ2V0XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIHRoaXMuX3F1ZXVlQ2FsbGJhY2soY29tcGxldGVDYWxsQmFjaywgdGhpcy5fZWxlbWVudCwgdHJ1ZSk7XG4gICAgfVxuICAgIGhpZGUoKSB7XG4gICAgICBpZiAoIXRoaXMuX2lzU2hvd24pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgaGlkZUV2ZW50ID0gRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfSElERSQzKTtcbiAgICAgIGlmIChoaWRlRXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl9mb2N1c3RyYXAuZGVhY3RpdmF0ZSgpO1xuICAgICAgdGhpcy5fZWxlbWVudC5ibHVyKCk7XG4gICAgICB0aGlzLl9pc1Nob3duID0gZmFsc2U7XG4gICAgICB0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5hZGQoQ0xBU1NfTkFNRV9ISURJTkcpO1xuICAgICAgdGhpcy5fYmFja2Ryb3AuaGlkZSgpO1xuICAgICAgY29uc3QgY29tcGxldGVDYWxsYmFjayA9ICgpID0+IHtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKENMQVNTX05BTUVfU0hPVyQzLCBDTEFTU19OQU1FX0hJRElORyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdhcmlhLW1vZGFsJyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdyb2xlJyk7XG4gICAgICAgIGlmICghdGhpcy5fY29uZmlnLnNjcm9sbCkge1xuICAgICAgICAgIG5ldyBTY3JvbGxCYXJIZWxwZXIoKS5yZXNldCgpO1xuICAgICAgICB9XG4gICAgICAgIEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0hJRERFTiQzKTtcbiAgICAgIH07XG4gICAgICB0aGlzLl9xdWV1ZUNhbGxiYWNrKGNvbXBsZXRlQ2FsbGJhY2ssIHRoaXMuX2VsZW1lbnQsIHRydWUpO1xuICAgIH1cbiAgICBkaXNwb3NlKCkge1xuICAgICAgdGhpcy5fYmFja2Ryb3AuZGlzcG9zZSgpO1xuICAgICAgdGhpcy5fZm9jdXN0cmFwLmRlYWN0aXZhdGUoKTtcbiAgICAgIHN1cGVyLmRpc3Bvc2UoKTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlXG4gICAgX2luaXRpYWxpemVCYWNrRHJvcCgpIHtcbiAgICAgIGNvbnN0IGNsaWNrQ2FsbGJhY2sgPSAoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLl9jb25maWcuYmFja2Ryb3AgPT09ICdzdGF0aWMnKSB7XG4gICAgICAgICAgRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfSElERV9QUkVWRU5URUQpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmhpZGUoKTtcbiAgICAgIH07XG5cbiAgICAgIC8vICdzdGF0aWMnIG9wdGlvbiB3aWxsIGJlIHRyYW5zbGF0ZWQgdG8gdHJ1ZSwgYW5kIGJvb2xlYW5zIHdpbGwga2VlcCB0aGVpciB2YWx1ZVxuICAgICAgY29uc3QgaXNWaXNpYmxlID0gQm9vbGVhbih0aGlzLl9jb25maWcuYmFja2Ryb3ApO1xuICAgICAgcmV0dXJuIG5ldyBCYWNrZHJvcCh7XG4gICAgICAgIGNsYXNzTmFtZTogQ0xBU1NfTkFNRV9CQUNLRFJPUCxcbiAgICAgICAgaXNWaXNpYmxlLFxuICAgICAgICBpc0FuaW1hdGVkOiB0cnVlLFxuICAgICAgICByb290RWxlbWVudDogdGhpcy5fZWxlbWVudC5wYXJlbnROb2RlLFxuICAgICAgICBjbGlja0NhbGxiYWNrOiBpc1Zpc2libGUgPyBjbGlja0NhbGxiYWNrIDogbnVsbFxuICAgICAgfSk7XG4gICAgfVxuICAgIF9pbml0aWFsaXplRm9jdXNUcmFwKCkge1xuICAgICAgcmV0dXJuIG5ldyBGb2N1c1RyYXAoe1xuICAgICAgICB0cmFwRWxlbWVudDogdGhpcy5fZWxlbWVudFxuICAgICAgfSk7XG4gICAgfVxuICAgIF9hZGRFdmVudExpc3RlbmVycygpIHtcbiAgICAgIEV2ZW50SGFuZGxlci5vbih0aGlzLl9lbGVtZW50LCBFVkVOVF9LRVlET1dOX0RJU01JU1MsIGV2ZW50ID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmtleSAhPT0gRVNDQVBFX0tFWSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fY29uZmlnLmtleWJvYXJkKSB7XG4gICAgICAgICAgdGhpcy5oaWRlKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0hJREVfUFJFVkVOVEVEKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFN0YXRpY1xuICAgIHN0YXRpYyBqUXVlcnlJbnRlcmZhY2UoY29uZmlnKSB7XG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IE9mZmNhbnZhcy5nZXRPckNyZWF0ZUluc3RhbmNlKHRoaXMsIGNvbmZpZyk7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YVtjb25maWddID09PSB1bmRlZmluZWQgfHwgY29uZmlnLnN0YXJ0c1dpdGgoJ18nKSB8fCBjb25maWcgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBObyBtZXRob2QgbmFtZWQgXCIke2NvbmZpZ31cImApO1xuICAgICAgICB9XG4gICAgICAgIGRhdGFbY29uZmlnXSh0aGlzKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEYXRhIEFQSSBpbXBsZW1lbnRhdGlvblxuICAgKi9cblxuICBFdmVudEhhbmRsZXIub24oZG9jdW1lbnQsIEVWRU5UX0NMSUNLX0RBVEFfQVBJJDEsIFNFTEVDVE9SX0RBVEFfVE9HR0xFJDEsIGZ1bmN0aW9uIChldmVudCkge1xuICAgIGNvbnN0IHRhcmdldCA9IFNlbGVjdG9yRW5naW5lLmdldEVsZW1lbnRGcm9tU2VsZWN0b3IodGhpcyk7XG4gICAgaWYgKFsnQScsICdBUkVBJ10uaW5jbHVkZXModGhpcy50YWdOYW1lKSkge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gICAgaWYgKGlzRGlzYWJsZWQodGhpcykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLm9uZSh0YXJnZXQsIEVWRU5UX0hJRERFTiQzLCAoKSA9PiB7XG4gICAgICAvLyBmb2N1cyBvbiB0cmlnZ2VyIHdoZW4gaXQgaXMgY2xvc2VkXG4gICAgICBpZiAoaXNWaXNpYmxlKHRoaXMpKSB7XG4gICAgICAgIHRoaXMuZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGF2b2lkIGNvbmZsaWN0IHdoZW4gY2xpY2tpbmcgYSB0b2dnbGVyIG9mIGFuIG9mZmNhbnZhcywgd2hpbGUgYW5vdGhlciBpcyBvcGVuXG4gICAgY29uc3QgYWxyZWFkeU9wZW4gPSBTZWxlY3RvckVuZ2luZS5maW5kT25lKE9QRU5fU0VMRUNUT1IpO1xuICAgIGlmIChhbHJlYWR5T3BlbiAmJiBhbHJlYWR5T3BlbiAhPT0gdGFyZ2V0KSB7XG4gICAgICBPZmZjYW52YXMuZ2V0SW5zdGFuY2UoYWxyZWFkeU9wZW4pLmhpZGUoKTtcbiAgICB9XG4gICAgY29uc3QgZGF0YSA9IE9mZmNhbnZhcy5nZXRPckNyZWF0ZUluc3RhbmNlKHRhcmdldCk7XG4gICAgZGF0YS50b2dnbGUodGhpcyk7XG4gIH0pO1xuICBFdmVudEhhbmRsZXIub24od2luZG93LCBFVkVOVF9MT0FEX0RBVEFfQVBJJDIsICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIFNlbGVjdG9yRW5naW5lLmZpbmQoT1BFTl9TRUxFQ1RPUikpIHtcbiAgICAgIE9mZmNhbnZhcy5nZXRPckNyZWF0ZUluc3RhbmNlKHNlbGVjdG9yKS5zaG93KCk7XG4gICAgfVxuICB9KTtcbiAgRXZlbnRIYW5kbGVyLm9uKHdpbmRvdywgRVZFTlRfUkVTSVpFLCAoKSA9PiB7XG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIFNlbGVjdG9yRW5naW5lLmZpbmQoJ1thcmlhLW1vZGFsXVtjbGFzcyo9c2hvd11bY2xhc3MqPW9mZmNhbnZhcy1dJykpIHtcbiAgICAgIGlmIChnZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpLnBvc2l0aW9uICE9PSAnZml4ZWQnKSB7XG4gICAgICAgIE9mZmNhbnZhcy5nZXRPckNyZWF0ZUluc3RhbmNlKGVsZW1lbnQpLmhpZGUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBlbmFibGVEaXNtaXNzVHJpZ2dlcihPZmZjYW52YXMpO1xuXG4gIC8qKlxuICAgKiBqUXVlcnlcbiAgICovXG5cbiAgZGVmaW5lSlF1ZXJ5UGx1Z2luKE9mZmNhbnZhcyk7XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCB1dGlsL3Nhbml0aXplci5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cbiAgLy8ganMtZG9jcy1zdGFydCBhbGxvdy1saXN0XG4gIGNvbnN0IEFSSUFfQVRUUklCVVRFX1BBVFRFUk4gPSAvXmFyaWEtW1xcdy1dKiQvaTtcbiAgY29uc3QgRGVmYXVsdEFsbG93bGlzdCA9IHtcbiAgICAvLyBHbG9iYWwgYXR0cmlidXRlcyBhbGxvd2VkIG9uIGFueSBzdXBwbGllZCBlbGVtZW50IGJlbG93LlxuICAgICcqJzogWydjbGFzcycsICdkaXInLCAnaWQnLCAnbGFuZycsICdyb2xlJywgQVJJQV9BVFRSSUJVVEVfUEFUVEVSTl0sXG4gICAgYTogWyd0YXJnZXQnLCAnaHJlZicsICd0aXRsZScsICdyZWwnXSxcbiAgICBhcmVhOiBbXSxcbiAgICBiOiBbXSxcbiAgICBicjogW10sXG4gICAgY29sOiBbXSxcbiAgICBjb2RlOiBbXSxcbiAgICBkaXY6IFtdLFxuICAgIGVtOiBbXSxcbiAgICBocjogW10sXG4gICAgaDE6IFtdLFxuICAgIGgyOiBbXSxcbiAgICBoMzogW10sXG4gICAgaDQ6IFtdLFxuICAgIGg1OiBbXSxcbiAgICBoNjogW10sXG4gICAgaTogW10sXG4gICAgaW1nOiBbJ3NyYycsICdzcmNzZXQnLCAnYWx0JywgJ3RpdGxlJywgJ3dpZHRoJywgJ2hlaWdodCddLFxuICAgIGxpOiBbXSxcbiAgICBvbDogW10sXG4gICAgcDogW10sXG4gICAgcHJlOiBbXSxcbiAgICBzOiBbXSxcbiAgICBzbWFsbDogW10sXG4gICAgc3BhbjogW10sXG4gICAgc3ViOiBbXSxcbiAgICBzdXA6IFtdLFxuICAgIHN0cm9uZzogW10sXG4gICAgdTogW10sXG4gICAgdWw6IFtdXG4gIH07XG4gIC8vIGpzLWRvY3MtZW5kIGFsbG93LWxpc3RcblxuICBjb25zdCB1cmlBdHRyaWJ1dGVzID0gbmV3IFNldChbJ2JhY2tncm91bmQnLCAnY2l0ZScsICdocmVmJywgJ2l0ZW10eXBlJywgJ2xvbmdkZXNjJywgJ3Bvc3RlcicsICdzcmMnLCAneGxpbms6aHJlZiddKTtcblxuICAvKipcbiAgICogQSBwYXR0ZXJuIHRoYXQgcmVjb2duaXplcyBVUkxzIHRoYXQgYXJlIHNhZmUgd3J0LiBYU1MgaW4gVVJMIG5hdmlnYXRpb25cbiAgICogY29udGV4dHMuXG4gICAqXG4gICAqIFNob3V0LW91dCB0byBBbmd1bGFyIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvYmxvYi8xNS4yLjgvcGFja2FnZXMvY29yZS9zcmMvc2FuaXRpemF0aW9uL3VybF9zYW5pdGl6ZXIudHMjTDM4XG4gICAqL1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdW5pY29ybi9iZXR0ZXItcmVnZXhcbiAgY29uc3QgU0FGRV9VUkxfUEFUVEVSTiA9IC9eKD8hamF2YXNjcmlwdDopKD86W2EtejAtOSsuLV0rOnxbXiY6Lz8jXSooPzpbLz8jXXwkKSkvaTtcbiAgY29uc3QgYWxsb3dlZEF0dHJpYnV0ZSA9IChhdHRyaWJ1dGUsIGFsbG93ZWRBdHRyaWJ1dGVMaXN0KSA9PiB7XG4gICAgY29uc3QgYXR0cmlidXRlTmFtZSA9IGF0dHJpYnV0ZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChhbGxvd2VkQXR0cmlidXRlTGlzdC5pbmNsdWRlcyhhdHRyaWJ1dGVOYW1lKSkge1xuICAgICAgaWYgKHVyaUF0dHJpYnV0ZXMuaGFzKGF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgIHJldHVybiBCb29sZWFuKFNBRkVfVVJMX1BBVFRFUk4udGVzdChhdHRyaWJ1dGUubm9kZVZhbHVlKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBhIHJlZ3VsYXIgZXhwcmVzc2lvbiB2YWxpZGF0ZXMgdGhlIGF0dHJpYnV0ZS5cbiAgICByZXR1cm4gYWxsb3dlZEF0dHJpYnV0ZUxpc3QuZmlsdGVyKGF0dHJpYnV0ZVJlZ2V4ID0+IGF0dHJpYnV0ZVJlZ2V4IGluc3RhbmNlb2YgUmVnRXhwKS5zb21lKHJlZ2V4ID0+IHJlZ2V4LnRlc3QoYXR0cmlidXRlTmFtZSkpO1xuICB9O1xuICBmdW5jdGlvbiBzYW5pdGl6ZUh0bWwodW5zYWZlSHRtbCwgYWxsb3dMaXN0LCBzYW5pdGl6ZUZ1bmN0aW9uKSB7XG4gICAgaWYgKCF1bnNhZmVIdG1sLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHVuc2FmZUh0bWw7XG4gICAgfVxuICAgIGlmIChzYW5pdGl6ZUZ1bmN0aW9uICYmIHR5cGVvZiBzYW5pdGl6ZUZ1bmN0aW9uID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gc2FuaXRpemVGdW5jdGlvbih1bnNhZmVIdG1sKTtcbiAgICB9XG4gICAgY29uc3QgZG9tUGFyc2VyID0gbmV3IHdpbmRvdy5ET01QYXJzZXIoKTtcbiAgICBjb25zdCBjcmVhdGVkRG9jdW1lbnQgPSBkb21QYXJzZXIucGFyc2VGcm9tU3RyaW5nKHVuc2FmZUh0bWwsICd0ZXh0L2h0bWwnKTtcbiAgICBjb25zdCBlbGVtZW50cyA9IFtdLmNvbmNhdCguLi5jcmVhdGVkRG9jdW1lbnQuYm9keS5xdWVyeVNlbGVjdG9yQWxsKCcqJykpO1xuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuICAgICAgY29uc3QgZWxlbWVudE5hbWUgPSBlbGVtZW50Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIU9iamVjdC5rZXlzKGFsbG93TGlzdCkuaW5jbHVkZXMoZWxlbWVudE5hbWUpKSB7XG4gICAgICAgIGVsZW1lbnQucmVtb3ZlKCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgYXR0cmlidXRlTGlzdCA9IFtdLmNvbmNhdCguLi5lbGVtZW50LmF0dHJpYnV0ZXMpO1xuICAgICAgY29uc3QgYWxsb3dlZEF0dHJpYnV0ZXMgPSBbXS5jb25jYXQoYWxsb3dMaXN0WycqJ10gfHwgW10sIGFsbG93TGlzdFtlbGVtZW50TmFtZV0gfHwgW10pO1xuICAgICAgZm9yIChjb25zdCBhdHRyaWJ1dGUgb2YgYXR0cmlidXRlTGlzdCkge1xuICAgICAgICBpZiAoIWFsbG93ZWRBdHRyaWJ1dGUoYXR0cmlidXRlLCBhbGxvd2VkQXR0cmlidXRlcykpIHtcbiAgICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShhdHRyaWJ1dGUubm9kZU5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVkRG9jdW1lbnQuYm9keS5pbm5lckhUTUw7XG4gIH1cblxuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogQm9vdHN0cmFwIHV0aWwvdGVtcGxhdGUtZmFjdG9yeS5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cblxuICAvKipcbiAgICogQ29uc3RhbnRzXG4gICAqL1xuXG4gIGNvbnN0IE5BTUUkNSA9ICdUZW1wbGF0ZUZhY3RvcnknO1xuICBjb25zdCBEZWZhdWx0JDQgPSB7XG4gICAgYWxsb3dMaXN0OiBEZWZhdWx0QWxsb3dsaXN0LFxuICAgIGNvbnRlbnQ6IHt9LFxuICAgIC8vIHsgc2VsZWN0b3IgOiB0ZXh0ICwgIHNlbGVjdG9yMiA6IHRleHQyICwgfVxuICAgIGV4dHJhQ2xhc3M6ICcnLFxuICAgIGh0bWw6IGZhbHNlLFxuICAgIHNhbml0aXplOiB0cnVlLFxuICAgIHNhbml0aXplRm46IG51bGwsXG4gICAgdGVtcGxhdGU6ICc8ZGl2PjwvZGl2PidcbiAgfTtcbiAgY29uc3QgRGVmYXVsdFR5cGUkNCA9IHtcbiAgICBhbGxvd0xpc3Q6ICdvYmplY3QnLFxuICAgIGNvbnRlbnQ6ICdvYmplY3QnLFxuICAgIGV4dHJhQ2xhc3M6ICcoc3RyaW5nfGZ1bmN0aW9uKScsXG4gICAgaHRtbDogJ2Jvb2xlYW4nLFxuICAgIHNhbml0aXplOiAnYm9vbGVhbicsXG4gICAgc2FuaXRpemVGbjogJyhudWxsfGZ1bmN0aW9uKScsXG4gICAgdGVtcGxhdGU6ICdzdHJpbmcnXG4gIH07XG4gIGNvbnN0IERlZmF1bHRDb250ZW50VHlwZSA9IHtcbiAgICBlbnRyeTogJyhzdHJpbmd8ZWxlbWVudHxmdW5jdGlvbnxudWxsKScsXG4gICAgc2VsZWN0b3I6ICcoc3RyaW5nfGVsZW1lbnQpJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGFzcyBkZWZpbml0aW9uXG4gICAqL1xuXG4gIGNsYXNzIFRlbXBsYXRlRmFjdG9yeSBleHRlbmRzIENvbmZpZyB7XG4gICAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgICBzdXBlcigpO1xuICAgICAgdGhpcy5fY29uZmlnID0gdGhpcy5fZ2V0Q29uZmlnKGNvbmZpZyk7XG4gICAgfVxuXG4gICAgLy8gR2V0dGVyc1xuICAgIHN0YXRpYyBnZXQgRGVmYXVsdCgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0JDQ7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgRGVmYXVsdFR5cGUoKSB7XG4gICAgICByZXR1cm4gRGVmYXVsdFR5cGUkNDtcbiAgICB9XG4gICAgc3RhdGljIGdldCBOQU1FKCkge1xuICAgICAgcmV0dXJuIE5BTUUkNTtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWNcbiAgICBnZXRDb250ZW50KCkge1xuICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fY29uZmlnLmNvbnRlbnQpLm1hcChjb25maWcgPT4gdGhpcy5fcmVzb2x2ZVBvc3NpYmxlRnVuY3Rpb24oY29uZmlnKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgIH1cbiAgICBoYXNDb250ZW50KCkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0Q29udGVudCgpLmxlbmd0aCA+IDA7XG4gICAgfVxuICAgIGNoYW5nZUNvbnRlbnQoY29udGVudCkge1xuICAgICAgdGhpcy5fY2hlY2tDb250ZW50KGNvbnRlbnQpO1xuICAgICAgdGhpcy5fY29uZmlnLmNvbnRlbnQgPSB7XG4gICAgICAgIC4uLnRoaXMuX2NvbmZpZy5jb250ZW50LFxuICAgICAgICAuLi5jb250ZW50XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHRvSHRtbCgpIHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgdGVtcGxhdGVXcmFwcGVyLmlubmVySFRNTCA9IHRoaXMuX21heWJlU2FuaXRpemUodGhpcy5fY29uZmlnLnRlbXBsYXRlKTtcbiAgICAgIGZvciAoY29uc3QgW3NlbGVjdG9yLCB0ZXh0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9jb25maWcuY29udGVudCkpIHtcbiAgICAgICAgdGhpcy5fc2V0Q29udGVudCh0ZW1wbGF0ZVdyYXBwZXIsIHRleHQsIHNlbGVjdG9yKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRlbXBsYXRlID0gdGVtcGxhdGVXcmFwcGVyLmNoaWxkcmVuWzBdO1xuICAgICAgY29uc3QgZXh0cmFDbGFzcyA9IHRoaXMuX3Jlc29sdmVQb3NzaWJsZUZ1bmN0aW9uKHRoaXMuX2NvbmZpZy5leHRyYUNsYXNzKTtcbiAgICAgIGlmIChleHRyYUNsYXNzKSB7XG4gICAgICAgIHRlbXBsYXRlLmNsYXNzTGlzdC5hZGQoLi4uZXh0cmFDbGFzcy5zcGxpdCgnICcpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlXG4gICAgX3R5cGVDaGVja0NvbmZpZyhjb25maWcpIHtcbiAgICAgIHN1cGVyLl90eXBlQ2hlY2tDb25maWcoY29uZmlnKTtcbiAgICAgIHRoaXMuX2NoZWNrQ29udGVudChjb25maWcuY29udGVudCk7XG4gICAgfVxuICAgIF9jaGVja0NvbnRlbnQoYXJnKSB7XG4gICAgICBmb3IgKGNvbnN0IFtzZWxlY3RvciwgY29udGVudF0gb2YgT2JqZWN0LmVudHJpZXMoYXJnKSkge1xuICAgICAgICBzdXBlci5fdHlwZUNoZWNrQ29uZmlnKHtcbiAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICBlbnRyeTogY29udGVudFxuICAgICAgICB9LCBEZWZhdWx0Q29udGVudFR5cGUpO1xuICAgICAgfVxuICAgIH1cbiAgICBfc2V0Q29udGVudCh0ZW1wbGF0ZSwgY29udGVudCwgc2VsZWN0b3IpIHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudCA9IFNlbGVjdG9yRW5naW5lLmZpbmRPbmUoc2VsZWN0b3IsIHRlbXBsYXRlKTtcbiAgICAgIGlmICghdGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnRlbnQgPSB0aGlzLl9yZXNvbHZlUG9zc2libGVGdW5jdGlvbihjb250ZW50KTtcbiAgICAgIGlmICghY29udGVudCkge1xuICAgICAgICB0ZW1wbGF0ZUVsZW1lbnQucmVtb3ZlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChpc0VsZW1lbnQkMShjb250ZW50KSkge1xuICAgICAgICB0aGlzLl9wdXRFbGVtZW50SW5UZW1wbGF0ZShnZXRFbGVtZW50KGNvbnRlbnQpLCB0ZW1wbGF0ZUVsZW1lbnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fY29uZmlnLmh0bWwpIHtcbiAgICAgICAgdGVtcGxhdGVFbGVtZW50LmlubmVySFRNTCA9IHRoaXMuX21heWJlU2FuaXRpemUoY29udGVudCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRlbXBsYXRlRWxlbWVudC50ZXh0Q29udGVudCA9IGNvbnRlbnQ7XG4gICAgfVxuICAgIF9tYXliZVNhbml0aXplKGFyZykge1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbmZpZy5zYW5pdGl6ZSA/IHNhbml0aXplSHRtbChhcmcsIHRoaXMuX2NvbmZpZy5hbGxvd0xpc3QsIHRoaXMuX2NvbmZpZy5zYW5pdGl6ZUZuKSA6IGFyZztcbiAgICB9XG4gICAgX3Jlc29sdmVQb3NzaWJsZUZ1bmN0aW9uKGFyZykge1xuICAgICAgcmV0dXJuIGV4ZWN1dGUoYXJnLCBbdGhpc10pO1xuICAgIH1cbiAgICBfcHV0RWxlbWVudEluVGVtcGxhdGUoZWxlbWVudCwgdGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICBpZiAodGhpcy5fY29uZmlnLmh0bWwpIHtcbiAgICAgICAgdGVtcGxhdGVFbGVtZW50LmlubmVySFRNTCA9ICcnO1xuICAgICAgICB0ZW1wbGF0ZUVsZW1lbnQuYXBwZW5kKGVsZW1lbnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0ZW1wbGF0ZUVsZW1lbnQudGV4dENvbnRlbnQgPSBlbGVtZW50LnRleHRDb250ZW50O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgdG9vbHRpcC5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cblxuICAvKipcbiAgICogQ29uc3RhbnRzXG4gICAqL1xuXG4gIGNvbnN0IE5BTUUkNCA9ICd0b29sdGlwJztcbiAgY29uc3QgRElTQUxMT1dFRF9BVFRSSUJVVEVTID0gbmV3IFNldChbJ3Nhbml0aXplJywgJ2FsbG93TGlzdCcsICdzYW5pdGl6ZUZuJ10pO1xuICBjb25zdCBDTEFTU19OQU1FX0ZBREUkMiA9ICdmYWRlJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9NT0RBTCA9ICdtb2RhbCc7XG4gIGNvbnN0IENMQVNTX05BTUVfU0hPVyQyID0gJ3Nob3cnO1xuICBjb25zdCBTRUxFQ1RPUl9UT09MVElQX0lOTkVSID0gJy50b29sdGlwLWlubmVyJztcbiAgY29uc3QgU0VMRUNUT1JfTU9EQUwgPSBgLiR7Q0xBU1NfTkFNRV9NT0RBTH1gO1xuICBjb25zdCBFVkVOVF9NT0RBTF9ISURFID0gJ2hpZGUuYnMubW9kYWwnO1xuICBjb25zdCBUUklHR0VSX0hPVkVSID0gJ2hvdmVyJztcbiAgY29uc3QgVFJJR0dFUl9GT0NVUyA9ICdmb2N1cyc7XG4gIGNvbnN0IFRSSUdHRVJfQ0xJQ0sgPSAnY2xpY2snO1xuICBjb25zdCBUUklHR0VSX01BTlVBTCA9ICdtYW51YWwnO1xuICBjb25zdCBFVkVOVF9ISURFJDIgPSAnaGlkZSc7XG4gIGNvbnN0IEVWRU5UX0hJRERFTiQyID0gJ2hpZGRlbic7XG4gIGNvbnN0IEVWRU5UX1NIT1ckMiA9ICdzaG93JztcbiAgY29uc3QgRVZFTlRfU0hPV04kMiA9ICdzaG93bic7XG4gIGNvbnN0IEVWRU5UX0lOU0VSVEVEID0gJ2luc2VydGVkJztcbiAgY29uc3QgRVZFTlRfQ0xJQ0skMSA9ICdjbGljayc7XG4gIGNvbnN0IEVWRU5UX0ZPQ1VTSU4kMSA9ICdmb2N1c2luJztcbiAgY29uc3QgRVZFTlRfRk9DVVNPVVQkMSA9ICdmb2N1c291dCc7XG4gIGNvbnN0IEVWRU5UX01PVVNFRU5URVIgPSAnbW91c2VlbnRlcic7XG4gIGNvbnN0IEVWRU5UX01PVVNFTEVBVkUgPSAnbW91c2VsZWF2ZSc7XG4gIGNvbnN0IEF0dGFjaG1lbnRNYXAgPSB7XG4gICAgQVVUTzogJ2F1dG8nLFxuICAgIFRPUDogJ3RvcCcsXG4gICAgUklHSFQ6IGlzUlRMKCkgPyAnbGVmdCcgOiAncmlnaHQnLFxuICAgIEJPVFRPTTogJ2JvdHRvbScsXG4gICAgTEVGVDogaXNSVEwoKSA/ICdyaWdodCcgOiAnbGVmdCdcbiAgfTtcbiAgY29uc3QgRGVmYXVsdCQzID0ge1xuICAgIGFsbG93TGlzdDogRGVmYXVsdEFsbG93bGlzdCxcbiAgICBhbmltYXRpb246IHRydWUsXG4gICAgYm91bmRhcnk6ICdjbGlwcGluZ1BhcmVudHMnLFxuICAgIGNvbnRhaW5lcjogZmFsc2UsXG4gICAgY3VzdG9tQ2xhc3M6ICcnLFxuICAgIGRlbGF5OiAwLFxuICAgIGZhbGxiYWNrUGxhY2VtZW50czogWyd0b3AnLCAncmlnaHQnLCAnYm90dG9tJywgJ2xlZnQnXSxcbiAgICBodG1sOiBmYWxzZSxcbiAgICBvZmZzZXQ6IFswLCA2XSxcbiAgICBwbGFjZW1lbnQ6ICd0b3AnLFxuICAgIHBvcHBlckNvbmZpZzogbnVsbCxcbiAgICBzYW5pdGl6ZTogdHJ1ZSxcbiAgICBzYW5pdGl6ZUZuOiBudWxsLFxuICAgIHNlbGVjdG9yOiBmYWxzZSxcbiAgICB0ZW1wbGF0ZTogJzxkaXYgY2xhc3M9XCJ0b29sdGlwXCIgcm9sZT1cInRvb2x0aXBcIj4nICsgJzxkaXYgY2xhc3M9XCJ0b29sdGlwLWFycm93XCI+PC9kaXY+JyArICc8ZGl2IGNsYXNzPVwidG9vbHRpcC1pbm5lclwiPjwvZGl2PicgKyAnPC9kaXY+JyxcbiAgICB0aXRsZTogJycsXG4gICAgdHJpZ2dlcjogJ2hvdmVyIGZvY3VzJ1xuICB9O1xuICBjb25zdCBEZWZhdWx0VHlwZSQzID0ge1xuICAgIGFsbG93TGlzdDogJ29iamVjdCcsXG4gICAgYW5pbWF0aW9uOiAnYm9vbGVhbicsXG4gICAgYm91bmRhcnk6ICcoc3RyaW5nfGVsZW1lbnQpJyxcbiAgICBjb250YWluZXI6ICcoc3RyaW5nfGVsZW1lbnR8Ym9vbGVhbiknLFxuICAgIGN1c3RvbUNsYXNzOiAnKHN0cmluZ3xmdW5jdGlvbiknLFxuICAgIGRlbGF5OiAnKG51bWJlcnxvYmplY3QpJyxcbiAgICBmYWxsYmFja1BsYWNlbWVudHM6ICdhcnJheScsXG4gICAgaHRtbDogJ2Jvb2xlYW4nLFxuICAgIG9mZnNldDogJyhhcnJheXxzdHJpbmd8ZnVuY3Rpb24pJyxcbiAgICBwbGFjZW1lbnQ6ICcoc3RyaW5nfGZ1bmN0aW9uKScsXG4gICAgcG9wcGVyQ29uZmlnOiAnKG51bGx8b2JqZWN0fGZ1bmN0aW9uKScsXG4gICAgc2FuaXRpemU6ICdib29sZWFuJyxcbiAgICBzYW5pdGl6ZUZuOiAnKG51bGx8ZnVuY3Rpb24pJyxcbiAgICBzZWxlY3RvcjogJyhzdHJpbmd8Ym9vbGVhbiknLFxuICAgIHRlbXBsYXRlOiAnc3RyaW5nJyxcbiAgICB0aXRsZTogJyhzdHJpbmd8ZWxlbWVudHxmdW5jdGlvbiknLFxuICAgIHRyaWdnZXI6ICdzdHJpbmcnXG4gIH07XG5cbiAgLyoqXG4gICAqIENsYXNzIGRlZmluaXRpb25cbiAgICovXG5cbiAgY2xhc3MgVG9vbHRpcCBleHRlbmRzIEJhc2VDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgaWYgKHR5cGVvZiBQb3BwZXIgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Jvb3RzdHJhcFxcJ3MgdG9vbHRpcHMgcmVxdWlyZSBQb3BwZXIgKGh0dHBzOi8vcG9wcGVyLmpzLm9yZyknKTtcbiAgICAgIH1cbiAgICAgIHN1cGVyKGVsZW1lbnQsIGNvbmZpZyk7XG5cbiAgICAgIC8vIFByaXZhdGVcbiAgICAgIHRoaXMuX2lzRW5hYmxlZCA9IHRydWU7XG4gICAgICB0aGlzLl90aW1lb3V0ID0gMDtcbiAgICAgIHRoaXMuX2lzSG92ZXJlZCA9IG51bGw7XG4gICAgICB0aGlzLl9hY3RpdmVUcmlnZ2VyID0ge307XG4gICAgICB0aGlzLl9wb3BwZXIgPSBudWxsO1xuICAgICAgdGhpcy5fdGVtcGxhdGVGYWN0b3J5ID0gbnVsbDtcbiAgICAgIHRoaXMuX25ld0NvbnRlbnQgPSBudWxsO1xuXG4gICAgICAvLyBQcm90ZWN0ZWRcbiAgICAgIHRoaXMudGlwID0gbnVsbDtcbiAgICAgIHRoaXMuX3NldExpc3RlbmVycygpO1xuICAgICAgaWYgKCF0aGlzLl9jb25maWcuc2VsZWN0b3IpIHtcbiAgICAgICAgdGhpcy5fZml4VGl0bGUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHZXR0ZXJzXG4gICAgc3RhdGljIGdldCBEZWZhdWx0KCkge1xuICAgICAgcmV0dXJuIERlZmF1bHQkMztcbiAgICB9XG4gICAgc3RhdGljIGdldCBEZWZhdWx0VHlwZSgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0VHlwZSQzO1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IE5BTUUoKSB7XG4gICAgICByZXR1cm4gTkFNRSQ0O1xuICAgIH1cblxuICAgIC8vIFB1YmxpY1xuICAgIGVuYWJsZSgpIHtcbiAgICAgIHRoaXMuX2lzRW5hYmxlZCA9IHRydWU7XG4gICAgfVxuICAgIGRpc2FibGUoKSB7XG4gICAgICB0aGlzLl9pc0VuYWJsZWQgPSBmYWxzZTtcbiAgICB9XG4gICAgdG9nZ2xlRW5hYmxlZCgpIHtcbiAgICAgIHRoaXMuX2lzRW5hYmxlZCA9ICF0aGlzLl9pc0VuYWJsZWQ7XG4gICAgfVxuICAgIHRvZ2dsZSgpIHtcbiAgICAgIGlmICghdGhpcy5faXNFbmFibGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2FjdGl2ZVRyaWdnZXIuY2xpY2sgPSAhdGhpcy5fYWN0aXZlVHJpZ2dlci5jbGljaztcbiAgICAgIGlmICh0aGlzLl9pc1Nob3duKCkpIHtcbiAgICAgICAgdGhpcy5fbGVhdmUoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5fZW50ZXIoKTtcbiAgICB9XG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aW1lb3V0KTtcbiAgICAgIEV2ZW50SGFuZGxlci5vZmYodGhpcy5fZWxlbWVudC5jbG9zZXN0KFNFTEVDVE9SX01PREFMKSwgRVZFTlRfTU9EQUxfSElERSwgdGhpcy5faGlkZU1vZGFsSGFuZGxlcik7XG4gICAgICBpZiAodGhpcy5fZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtYnMtb3JpZ2luYWwtdGl0bGUnKSkge1xuICAgICAgICB0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgndGl0bGUnLCB0aGlzLl9lbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1icy1vcmlnaW5hbC10aXRsZScpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2Rpc3Bvc2VQb3BwZXIoKTtcbiAgICAgIHN1cGVyLmRpc3Bvc2UoKTtcbiAgICB9XG4gICAgc2hvdygpIHtcbiAgICAgIGlmICh0aGlzLl9lbGVtZW50LnN0eWxlLmRpc3BsYXkgPT09ICdub25lJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSB1c2Ugc2hvdyBvbiB2aXNpYmxlIGVsZW1lbnRzJyk7XG4gICAgICB9XG4gICAgICBpZiAoISh0aGlzLl9pc1dpdGhDb250ZW50KCkgJiYgdGhpcy5faXNFbmFibGVkKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBzaG93RXZlbnQgPSBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCB0aGlzLmNvbnN0cnVjdG9yLmV2ZW50TmFtZShFVkVOVF9TSE9XJDIpKTtcbiAgICAgIGNvbnN0IHNoYWRvd1Jvb3QgPSBmaW5kU2hhZG93Um9vdCh0aGlzLl9lbGVtZW50KTtcbiAgICAgIGNvbnN0IGlzSW5UaGVEb20gPSAoc2hhZG93Um9vdCB8fCB0aGlzLl9lbGVtZW50Lm93bmVyRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5jb250YWlucyh0aGlzLl9lbGVtZW50KTtcbiAgICAgIGlmIChzaG93RXZlbnQuZGVmYXVsdFByZXZlbnRlZCB8fCAhaXNJblRoZURvbSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFRPRE86IHY2IHJlbW92ZSB0aGlzIG9yIG1ha2UgaXQgb3B0aW9uYWxcbiAgICAgIHRoaXMuX2Rpc3Bvc2VQb3BwZXIoKTtcbiAgICAgIGNvbnN0IHRpcCA9IHRoaXMuX2dldFRpcEVsZW1lbnQoKTtcbiAgICAgIHRoaXMuX2VsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWRlc2NyaWJlZGJ5JywgdGlwLmdldEF0dHJpYnV0ZSgnaWQnKSk7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGNvbnRhaW5lclxuICAgICAgfSA9IHRoaXMuX2NvbmZpZztcbiAgICAgIGlmICghdGhpcy5fZWxlbWVudC5vd25lckRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyh0aGlzLnRpcCkpIHtcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZCh0aXApO1xuICAgICAgICBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCB0aGlzLmNvbnN0cnVjdG9yLmV2ZW50TmFtZShFVkVOVF9JTlNFUlRFRCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5fcG9wcGVyID0gdGhpcy5fY3JlYXRlUG9wcGVyKHRpcCk7XG4gICAgICB0aXAuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX1NIT1ckMik7XG5cbiAgICAgIC8vIElmIHRoaXMgaXMgYSB0b3VjaC1lbmFibGVkIGRldmljZSB3ZSBhZGQgZXh0cmFcbiAgICAgIC8vIGVtcHR5IG1vdXNlb3ZlciBsaXN0ZW5lcnMgdG8gdGhlIGJvZHkncyBpbW1lZGlhdGUgY2hpbGRyZW47XG4gICAgICAvLyBvbmx5IG5lZWRlZCBiZWNhdXNlIG9mIGJyb2tlbiBldmVudCBkZWxlZ2F0aW9uIG9uIGlPU1xuICAgICAgLy8gaHR0cHM6Ly93d3cucXVpcmtzbW9kZS5vcmcvYmxvZy9hcmNoaXZlcy8yMDE0LzAyL21vdXNlX2V2ZW50X2J1Yi5odG1sXG4gICAgICBpZiAoJ29udG91Y2hzdGFydCcgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KSB7XG4gICAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBbXS5jb25jYXQoLi4uZG9jdW1lbnQuYm9keS5jaGlsZHJlbikpIHtcbiAgICAgICAgICBFdmVudEhhbmRsZXIub24oZWxlbWVudCwgJ21vdXNlb3ZlcicsIG5vb3ApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBjb21wbGV0ZSA9ICgpID0+IHtcbiAgICAgICAgRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgdGhpcy5jb25zdHJ1Y3Rvci5ldmVudE5hbWUoRVZFTlRfU0hPV04kMikpO1xuICAgICAgICBpZiAodGhpcy5faXNIb3ZlcmVkID09PSBmYWxzZSkge1xuICAgICAgICAgIHRoaXMuX2xlYXZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faXNIb3ZlcmVkID0gZmFsc2U7XG4gICAgICB9O1xuICAgICAgdGhpcy5fcXVldWVDYWxsYmFjayhjb21wbGV0ZSwgdGhpcy50aXAsIHRoaXMuX2lzQW5pbWF0ZWQoKSk7XG4gICAgfVxuICAgIGhpZGUoKSB7XG4gICAgICBpZiAoIXRoaXMuX2lzU2hvd24oKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBoaWRlRXZlbnQgPSBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCB0aGlzLmNvbnN0cnVjdG9yLmV2ZW50TmFtZShFVkVOVF9ISURFJDIpKTtcbiAgICAgIGlmIChoaWRlRXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCB0aXAgPSB0aGlzLl9nZXRUaXBFbGVtZW50KCk7XG4gICAgICB0aXAuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX1NIT1ckMik7XG5cbiAgICAgIC8vIElmIHRoaXMgaXMgYSB0b3VjaC1lbmFibGVkIGRldmljZSB3ZSByZW1vdmUgdGhlIGV4dHJhXG4gICAgICAvLyBlbXB0eSBtb3VzZW92ZXIgbGlzdGVuZXJzIHdlIGFkZGVkIGZvciBpT1Mgc3VwcG9ydFxuICAgICAgaWYgKCdvbnRvdWNoc3RhcnQnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkge1xuICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgW10uY29uY2F0KC4uLmRvY3VtZW50LmJvZHkuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgRXZlbnRIYW5kbGVyLm9mZihlbGVtZW50LCAnbW91c2VvdmVyJywgbm9vcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX2FjdGl2ZVRyaWdnZXJbVFJJR0dFUl9DTElDS10gPSBmYWxzZTtcbiAgICAgIHRoaXMuX2FjdGl2ZVRyaWdnZXJbVFJJR0dFUl9GT0NVU10gPSBmYWxzZTtcbiAgICAgIHRoaXMuX2FjdGl2ZVRyaWdnZXJbVFJJR0dFUl9IT1ZFUl0gPSBmYWxzZTtcbiAgICAgIHRoaXMuX2lzSG92ZXJlZCA9IG51bGw7IC8vIGl0IGlzIGEgdHJpY2sgdG8gc3VwcG9ydCBtYW51YWwgdHJpZ2dlcmluZ1xuXG4gICAgICBjb25zdCBjb21wbGV0ZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2lzV2l0aEFjdGl2ZVRyaWdnZXIoKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX2lzSG92ZXJlZCkge1xuICAgICAgICAgIHRoaXMuX2Rpc3Bvc2VQb3BwZXIoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1kZXNjcmliZWRieScpO1xuICAgICAgICBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCB0aGlzLmNvbnN0cnVjdG9yLmV2ZW50TmFtZShFVkVOVF9ISURERU4kMikpO1xuICAgICAgfTtcbiAgICAgIHRoaXMuX3F1ZXVlQ2FsbGJhY2soY29tcGxldGUsIHRoaXMudGlwLCB0aGlzLl9pc0FuaW1hdGVkKCkpO1xuICAgIH1cbiAgICB1cGRhdGUoKSB7XG4gICAgICBpZiAodGhpcy5fcG9wcGVyKSB7XG4gICAgICAgIHRoaXMuX3BvcHBlci51cGRhdGUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBQcm90ZWN0ZWRcbiAgICBfaXNXaXRoQ29udGVudCgpIHtcbiAgICAgIHJldHVybiBCb29sZWFuKHRoaXMuX2dldFRpdGxlKCkpO1xuICAgIH1cbiAgICBfZ2V0VGlwRWxlbWVudCgpIHtcbiAgICAgIGlmICghdGhpcy50aXApIHtcbiAgICAgICAgdGhpcy50aXAgPSB0aGlzLl9jcmVhdGVUaXBFbGVtZW50KHRoaXMuX25ld0NvbnRlbnQgfHwgdGhpcy5fZ2V0Q29udGVudEZvclRlbXBsYXRlKCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMudGlwO1xuICAgIH1cbiAgICBfY3JlYXRlVGlwRWxlbWVudChjb250ZW50KSB7XG4gICAgICBjb25zdCB0aXAgPSB0aGlzLl9nZXRUZW1wbGF0ZUZhY3RvcnkoY29udGVudCkudG9IdG1sKCk7XG5cbiAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIGNoZWNrIGluIHY2XG4gICAgICBpZiAoIXRpcCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRpcC5jbGFzc0xpc3QucmVtb3ZlKENMQVNTX05BTUVfRkFERSQyLCBDTEFTU19OQU1FX1NIT1ckMik7XG4gICAgICAvLyBUT0RPOiB2NiB0aGUgZm9sbG93aW5nIGNhbiBiZSBhY2hpZXZlZCB3aXRoIENTUyBvbmx5XG4gICAgICB0aXAuY2xhc3NMaXN0LmFkZChgYnMtJHt0aGlzLmNvbnN0cnVjdG9yLk5BTUV9LWF1dG9gKTtcbiAgICAgIGNvbnN0IHRpcElkID0gZ2V0VUlEKHRoaXMuY29uc3RydWN0b3IuTkFNRSkudG9TdHJpbmcoKTtcbiAgICAgIHRpcC5zZXRBdHRyaWJ1dGUoJ2lkJywgdGlwSWQpO1xuICAgICAgaWYgKHRoaXMuX2lzQW5pbWF0ZWQoKSkge1xuICAgICAgICB0aXAuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX0ZBREUkMik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGlwO1xuICAgIH1cbiAgICBzZXRDb250ZW50KGNvbnRlbnQpIHtcbiAgICAgIHRoaXMuX25ld0NvbnRlbnQgPSBjb250ZW50O1xuICAgICAgaWYgKHRoaXMuX2lzU2hvd24oKSkge1xuICAgICAgICB0aGlzLl9kaXNwb3NlUG9wcGVyKCk7XG4gICAgICAgIHRoaXMuc2hvdygpO1xuICAgICAgfVxuICAgIH1cbiAgICBfZ2V0VGVtcGxhdGVGYWN0b3J5KGNvbnRlbnQpIHtcbiAgICAgIGlmICh0aGlzLl90ZW1wbGF0ZUZhY3RvcnkpIHtcbiAgICAgICAgdGhpcy5fdGVtcGxhdGVGYWN0b3J5LmNoYW5nZUNvbnRlbnQoY29udGVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl90ZW1wbGF0ZUZhY3RvcnkgPSBuZXcgVGVtcGxhdGVGYWN0b3J5KHtcbiAgICAgICAgICAuLi50aGlzLl9jb25maWcsXG4gICAgICAgICAgLy8gdGhlIGBjb250ZW50YCB2YXIgaGFzIHRvIGJlIGFmdGVyIGB0aGlzLl9jb25maWdgXG4gICAgICAgICAgLy8gdG8gb3ZlcnJpZGUgY29uZmlnLmNvbnRlbnQgaW4gY2FzZSBvZiBwb3BvdmVyXG4gICAgICAgICAgY29udGVudCxcbiAgICAgICAgICBleHRyYUNsYXNzOiB0aGlzLl9yZXNvbHZlUG9zc2libGVGdW5jdGlvbih0aGlzLl9jb25maWcuY3VzdG9tQ2xhc3MpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX3RlbXBsYXRlRmFjdG9yeTtcbiAgICB9XG4gICAgX2dldENvbnRlbnRGb3JUZW1wbGF0ZSgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIFtTRUxFQ1RPUl9UT09MVElQX0lOTkVSXTogdGhpcy5fZ2V0VGl0bGUoKVxuICAgICAgfTtcbiAgICB9XG4gICAgX2dldFRpdGxlKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3Jlc29sdmVQb3NzaWJsZUZ1bmN0aW9uKHRoaXMuX2NvbmZpZy50aXRsZSkgfHwgdGhpcy5fZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtYnMtb3JpZ2luYWwtdGl0bGUnKTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlXG4gICAgX2luaXRpYWxpemVPbkRlbGVnYXRlZFRhcmdldChldmVudCkge1xuICAgICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuZ2V0T3JDcmVhdGVJbnN0YW5jZShldmVudC5kZWxlZ2F0ZVRhcmdldCwgdGhpcy5fZ2V0RGVsZWdhdGVDb25maWcoKSk7XG4gICAgfVxuICAgIF9pc0FuaW1hdGVkKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbmZpZy5hbmltYXRpb24gfHwgdGhpcy50aXAgJiYgdGhpcy50aXAuY2xhc3NMaXN0LmNvbnRhaW5zKENMQVNTX05BTUVfRkFERSQyKTtcbiAgICB9XG4gICAgX2lzU2hvd24oKSB7XG4gICAgICByZXR1cm4gdGhpcy50aXAgJiYgdGhpcy50aXAuY2xhc3NMaXN0LmNvbnRhaW5zKENMQVNTX05BTUVfU0hPVyQyKTtcbiAgICB9XG4gICAgX2NyZWF0ZVBvcHBlcih0aXApIHtcbiAgICAgIGNvbnN0IHBsYWNlbWVudCA9IGV4ZWN1dGUodGhpcy5fY29uZmlnLnBsYWNlbWVudCwgW3RoaXMsIHRpcCwgdGhpcy5fZWxlbWVudF0pO1xuICAgICAgY29uc3QgYXR0YWNobWVudCA9IEF0dGFjaG1lbnRNYXBbcGxhY2VtZW50LnRvVXBwZXJDYXNlKCldO1xuICAgICAgcmV0dXJuIGNyZWF0ZVBvcHBlcih0aGlzLl9lbGVtZW50LCB0aXAsIHRoaXMuX2dldFBvcHBlckNvbmZpZyhhdHRhY2htZW50KSk7XG4gICAgfVxuICAgIF9nZXRPZmZzZXQoKSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIG9mZnNldFxuICAgICAgfSA9IHRoaXMuX2NvbmZpZztcbiAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gb2Zmc2V0LnNwbGl0KCcsJykubWFwKHZhbHVlID0+IE51bWJlci5wYXJzZUludCh2YWx1ZSwgMTApKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiBwb3BwZXJEYXRhID0+IG9mZnNldChwb3BwZXJEYXRhLCB0aGlzLl9lbGVtZW50KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgfVxuICAgIF9yZXNvbHZlUG9zc2libGVGdW5jdGlvbihhcmcpIHtcbiAgICAgIHJldHVybiBleGVjdXRlKGFyZywgW3RoaXMuX2VsZW1lbnRdKTtcbiAgICB9XG4gICAgX2dldFBvcHBlckNvbmZpZyhhdHRhY2htZW50KSB7XG4gICAgICBjb25zdCBkZWZhdWx0QnNQb3BwZXJDb25maWcgPSB7XG4gICAgICAgIHBsYWNlbWVudDogYXR0YWNobWVudCxcbiAgICAgICAgbW9kaWZpZXJzOiBbe1xuICAgICAgICAgIG5hbWU6ICdmbGlwJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBmYWxsYmFja1BsYWNlbWVudHM6IHRoaXMuX2NvbmZpZy5mYWxsYmFja1BsYWNlbWVudHNcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHtcbiAgICAgICAgICBuYW1lOiAnb2Zmc2V0JyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBvZmZzZXQ6IHRoaXMuX2dldE9mZnNldCgpXG4gICAgICAgICAgfVxuICAgICAgICB9LCB7XG4gICAgICAgICAgbmFtZTogJ3ByZXZlbnRPdmVyZmxvdycsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgYm91bmRhcnk6IHRoaXMuX2NvbmZpZy5ib3VuZGFyeVxuICAgICAgICAgIH1cbiAgICAgICAgfSwge1xuICAgICAgICAgIG5hbWU6ICdhcnJvdycsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgZWxlbWVudDogYC4ke3RoaXMuY29uc3RydWN0b3IuTkFNRX0tYXJyb3dgXG4gICAgICAgICAgfVxuICAgICAgICB9LCB7XG4gICAgICAgICAgbmFtZTogJ3ByZVNldFBsYWNlbWVudCcsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBwaGFzZTogJ2JlZm9yZU1haW4nLFxuICAgICAgICAgIGZuOiBkYXRhID0+IHtcbiAgICAgICAgICAgIC8vIFByZS1zZXQgUG9wcGVyJ3MgcGxhY2VtZW50IGF0dHJpYnV0ZSBpbiBvcmRlciB0byByZWFkIHRoZSBhcnJvdyBzaXplcyBwcm9wZXJseS5cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgUG9wcGVyIG1peGVzIHVwIHRoZSB3aWR0aCBhbmQgaGVpZ2h0IGRpbWVuc2lvbnMgc2luY2UgdGhlIGluaXRpYWwgYXJyb3cgc3R5bGUgaXMgZm9yIHRvcCBwbGFjZW1lbnRcbiAgICAgICAgICAgIHRoaXMuX2dldFRpcEVsZW1lbnQoKS5zZXRBdHRyaWJ1dGUoJ2RhdGEtcG9wcGVyLXBsYWNlbWVudCcsIGRhdGEuc3RhdGUucGxhY2VtZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1dXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uZGVmYXVsdEJzUG9wcGVyQ29uZmlnLFxuICAgICAgICAuLi5leGVjdXRlKHRoaXMuX2NvbmZpZy5wb3BwZXJDb25maWcsIFtkZWZhdWx0QnNQb3BwZXJDb25maWddKVxuICAgICAgfTtcbiAgICB9XG4gICAgX3NldExpc3RlbmVycygpIHtcbiAgICAgIGNvbnN0IHRyaWdnZXJzID0gdGhpcy5fY29uZmlnLnRyaWdnZXIuc3BsaXQoJyAnKTtcbiAgICAgIGZvciAoY29uc3QgdHJpZ2dlciBvZiB0cmlnZ2Vycykge1xuICAgICAgICBpZiAodHJpZ2dlciA9PT0gJ2NsaWNrJykge1xuICAgICAgICAgIEV2ZW50SGFuZGxlci5vbih0aGlzLl9lbGVtZW50LCB0aGlzLmNvbnN0cnVjdG9yLmV2ZW50TmFtZShFVkVOVF9DTElDSyQxKSwgdGhpcy5fY29uZmlnLnNlbGVjdG9yLCBldmVudCA9PiB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5faW5pdGlhbGl6ZU9uRGVsZWdhdGVkVGFyZ2V0KGV2ZW50KTtcbiAgICAgICAgICAgIGNvbnRleHQudG9nZ2xlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHJpZ2dlciAhPT0gVFJJR0dFUl9NQU5VQUwpIHtcbiAgICAgICAgICBjb25zdCBldmVudEluID0gdHJpZ2dlciA9PT0gVFJJR0dFUl9IT1ZFUiA/IHRoaXMuY29uc3RydWN0b3IuZXZlbnROYW1lKEVWRU5UX01PVVNFRU5URVIpIDogdGhpcy5jb25zdHJ1Y3Rvci5ldmVudE5hbWUoRVZFTlRfRk9DVVNJTiQxKTtcbiAgICAgICAgICBjb25zdCBldmVudE91dCA9IHRyaWdnZXIgPT09IFRSSUdHRVJfSE9WRVIgPyB0aGlzLmNvbnN0cnVjdG9yLmV2ZW50TmFtZShFVkVOVF9NT1VTRUxFQVZFKSA6IHRoaXMuY29uc3RydWN0b3IuZXZlbnROYW1lKEVWRU5UX0ZPQ1VTT1VUJDEpO1xuICAgICAgICAgIEV2ZW50SGFuZGxlci5vbih0aGlzLl9lbGVtZW50LCBldmVudEluLCB0aGlzLl9jb25maWcuc2VsZWN0b3IsIGV2ZW50ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLl9pbml0aWFsaXplT25EZWxlZ2F0ZWRUYXJnZXQoZXZlbnQpO1xuICAgICAgICAgICAgY29udGV4dC5fYWN0aXZlVHJpZ2dlcltldmVudC50eXBlID09PSAnZm9jdXNpbicgPyBUUklHR0VSX0ZPQ1VTIDogVFJJR0dFUl9IT1ZFUl0gPSB0cnVlO1xuICAgICAgICAgICAgY29udGV4dC5fZW50ZXIoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBFdmVudEhhbmRsZXIub24odGhpcy5fZWxlbWVudCwgZXZlbnRPdXQsIHRoaXMuX2NvbmZpZy5zZWxlY3RvciwgZXZlbnQgPT4ge1xuICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IHRoaXMuX2luaXRpYWxpemVPbkRlbGVnYXRlZFRhcmdldChldmVudCk7XG4gICAgICAgICAgICBjb250ZXh0Ll9hY3RpdmVUcmlnZ2VyW2V2ZW50LnR5cGUgPT09ICdmb2N1c291dCcgPyBUUklHR0VSX0ZPQ1VTIDogVFJJR0dFUl9IT1ZFUl0gPSBjb250ZXh0Ll9lbGVtZW50LmNvbnRhaW5zKGV2ZW50LnJlbGF0ZWRUYXJnZXQpO1xuICAgICAgICAgICAgY29udGV4dC5fbGVhdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5faGlkZU1vZGFsSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICB0aGlzLmhpZGUoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIEV2ZW50SGFuZGxlci5vbih0aGlzLl9lbGVtZW50LmNsb3Nlc3QoU0VMRUNUT1JfTU9EQUwpLCBFVkVOVF9NT0RBTF9ISURFLCB0aGlzLl9oaWRlTW9kYWxIYW5kbGVyKTtcbiAgICB9XG4gICAgX2ZpeFRpdGxlKCkge1xuICAgICAgY29uc3QgdGl0bGUgPSB0aGlzLl9lbGVtZW50LmdldEF0dHJpYnV0ZSgndGl0bGUnKTtcbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLl9lbGVtZW50LmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpICYmICF0aGlzLl9lbGVtZW50LnRleHRDb250ZW50LnRyaW0oKSkge1xuICAgICAgICB0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRpdGxlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2VsZW1lbnQuc2V0QXR0cmlidXRlKCdkYXRhLWJzLW9yaWdpbmFsLXRpdGxlJywgdGl0bGUpOyAvLyBETyBOT1QgVVNFIElULiBJcyBvbmx5IGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICAgICAgdGhpcy5fZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ3RpdGxlJyk7XG4gICAgfVxuICAgIF9lbnRlcigpIHtcbiAgICAgIGlmICh0aGlzLl9pc1Nob3duKCkgfHwgdGhpcy5faXNIb3ZlcmVkKSB7XG4gICAgICAgIHRoaXMuX2lzSG92ZXJlZCA9IHRydWU7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2lzSG92ZXJlZCA9IHRydWU7XG4gICAgICB0aGlzLl9zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2lzSG92ZXJlZCkge1xuICAgICAgICAgIHRoaXMuc2hvdygpO1xuICAgICAgICB9XG4gICAgICB9LCB0aGlzLl9jb25maWcuZGVsYXkuc2hvdyk7XG4gICAgfVxuICAgIF9sZWF2ZSgpIHtcbiAgICAgIGlmICh0aGlzLl9pc1dpdGhBY3RpdmVUcmlnZ2VyKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5faXNIb3ZlcmVkID0gZmFsc2U7XG4gICAgICB0aGlzLl9zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9pc0hvdmVyZWQpIHtcbiAgICAgICAgICB0aGlzLmhpZGUoKTtcbiAgICAgICAgfVxuICAgICAgfSwgdGhpcy5fY29uZmlnLmRlbGF5LmhpZGUpO1xuICAgIH1cbiAgICBfc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGltZW91dCk7XG4gICAgICB0aGlzLl90aW1lb3V0ID0gc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KTtcbiAgICB9XG4gICAgX2lzV2l0aEFjdGl2ZVRyaWdnZXIoKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9hY3RpdmVUcmlnZ2VyKS5pbmNsdWRlcyh0cnVlKTtcbiAgICB9XG4gICAgX2dldENvbmZpZyhjb25maWcpIHtcbiAgICAgIGNvbnN0IGRhdGFBdHRyaWJ1dGVzID0gTWFuaXB1bGF0b3IuZ2V0RGF0YUF0dHJpYnV0ZXModGhpcy5fZWxlbWVudCk7XG4gICAgICBmb3IgKGNvbnN0IGRhdGFBdHRyaWJ1dGUgb2YgT2JqZWN0LmtleXMoZGF0YUF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIGlmIChESVNBTExPV0VEX0FUVFJJQlVURVMuaGFzKGRhdGFBdHRyaWJ1dGUpKSB7XG4gICAgICAgICAgZGVsZXRlIGRhdGFBdHRyaWJ1dGVzW2RhdGFBdHRyaWJ1dGVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25maWcgPSB7XG4gICAgICAgIC4uLmRhdGFBdHRyaWJ1dGVzLFxuICAgICAgICAuLi4odHlwZW9mIGNvbmZpZyA9PT0gJ29iamVjdCcgJiYgY29uZmlnID8gY29uZmlnIDoge30pXG4gICAgICB9O1xuICAgICAgY29uZmlnID0gdGhpcy5fbWVyZ2VDb25maWdPYmooY29uZmlnKTtcbiAgICAgIGNvbmZpZyA9IHRoaXMuX2NvbmZpZ0FmdGVyTWVyZ2UoY29uZmlnKTtcbiAgICAgIHRoaXMuX3R5cGVDaGVja0NvbmZpZyhjb25maWcpO1xuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG4gICAgX2NvbmZpZ0FmdGVyTWVyZ2UoY29uZmlnKSB7XG4gICAgICBjb25maWcuY29udGFpbmVyID0gY29uZmlnLmNvbnRhaW5lciA9PT0gZmFsc2UgPyBkb2N1bWVudC5ib2R5IDogZ2V0RWxlbWVudChjb25maWcuY29udGFpbmVyKTtcbiAgICAgIGlmICh0eXBlb2YgY29uZmlnLmRlbGF5ID09PSAnbnVtYmVyJykge1xuICAgICAgICBjb25maWcuZGVsYXkgPSB7XG4gICAgICAgICAgc2hvdzogY29uZmlnLmRlbGF5LFxuICAgICAgICAgIGhpZGU6IGNvbmZpZy5kZWxheVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBjb25maWcudGl0bGUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGNvbmZpZy50aXRsZSA9IGNvbmZpZy50aXRsZS50b1N0cmluZygpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBjb25maWcuY29udGVudCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgY29uZmlnLmNvbnRlbnQgPSBjb25maWcuY29udGVudC50b1N0cmluZygpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG4gICAgX2dldERlbGVnYXRlQ29uZmlnKCkge1xuICAgICAgY29uc3QgY29uZmlnID0ge307XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9jb25maWcpKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnN0cnVjdG9yLkRlZmF1bHRba2V5XSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICBjb25maWdba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25maWcuc2VsZWN0b3IgPSBmYWxzZTtcbiAgICAgIGNvbmZpZy50cmlnZ2VyID0gJ21hbnVhbCc7XG5cbiAgICAgIC8vIEluIHRoZSBmdXR1cmUgY2FuIGJlIHJlcGxhY2VkIHdpdGg6XG4gICAgICAvLyBjb25zdCBrZXlzV2l0aERpZmZlcmVudFZhbHVlcyA9IE9iamVjdC5lbnRyaWVzKHRoaXMuX2NvbmZpZykuZmlsdGVyKGVudHJ5ID0+IHRoaXMuY29uc3RydWN0b3IuRGVmYXVsdFtlbnRyeVswXV0gIT09IHRoaXMuX2NvbmZpZ1tlbnRyeVswXV0pXG4gICAgICAvLyBgT2JqZWN0LmZyb21FbnRyaWVzKGtleXNXaXRoRGlmZmVyZW50VmFsdWVzKWBcbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfVxuICAgIF9kaXNwb3NlUG9wcGVyKCkge1xuICAgICAgaWYgKHRoaXMuX3BvcHBlcikge1xuICAgICAgICB0aGlzLl9wb3BwZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9wb3BwZXIgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMudGlwKSB7XG4gICAgICAgIHRoaXMudGlwLnJlbW92ZSgpO1xuICAgICAgICB0aGlzLnRpcCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU3RhdGljXG4gICAgc3RhdGljIGpRdWVyeUludGVyZmFjZShjb25maWcpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBkYXRhID0gVG9vbHRpcC5nZXRPckNyZWF0ZUluc3RhbmNlKHRoaXMsIGNvbmZpZyk7XG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGRhdGFbY29uZmlnXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBObyBtZXRob2QgbmFtZWQgXCIke2NvbmZpZ31cImApO1xuICAgICAgICB9XG4gICAgICAgIGRhdGFbY29uZmlnXSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIGpRdWVyeVxuICAgKi9cblxuICBkZWZpbmVKUXVlcnlQbHVnaW4oVG9vbHRpcCk7XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCBwb3BvdmVyLmpzXG4gICAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFpbi9MSUNFTlNFKVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBDb25zdGFudHNcbiAgICovXG5cbiAgY29uc3QgTkFNRSQzID0gJ3BvcG92ZXInO1xuICBjb25zdCBTRUxFQ1RPUl9USVRMRSA9ICcucG9wb3Zlci1oZWFkZXInO1xuICBjb25zdCBTRUxFQ1RPUl9DT05URU5UID0gJy5wb3BvdmVyLWJvZHknO1xuICBjb25zdCBEZWZhdWx0JDIgPSB7XG4gICAgLi4uVG9vbHRpcC5EZWZhdWx0LFxuICAgIGNvbnRlbnQ6ICcnLFxuICAgIG9mZnNldDogWzAsIDhdLFxuICAgIHBsYWNlbWVudDogJ3JpZ2h0JyxcbiAgICB0ZW1wbGF0ZTogJzxkaXYgY2xhc3M9XCJwb3BvdmVyXCIgcm9sZT1cInRvb2x0aXBcIj4nICsgJzxkaXYgY2xhc3M9XCJwb3BvdmVyLWFycm93XCI+PC9kaXY+JyArICc8aDMgY2xhc3M9XCJwb3BvdmVyLWhlYWRlclwiPjwvaDM+JyArICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1ib2R5XCI+PC9kaXY+JyArICc8L2Rpdj4nLFxuICAgIHRyaWdnZXI6ICdjbGljaydcbiAgfTtcbiAgY29uc3QgRGVmYXVsdFR5cGUkMiA9IHtcbiAgICAuLi5Ub29sdGlwLkRlZmF1bHRUeXBlLFxuICAgIGNvbnRlbnQ6ICcobnVsbHxzdHJpbmd8ZWxlbWVudHxmdW5jdGlvbiknXG4gIH07XG5cbiAgLyoqXG4gICAqIENsYXNzIGRlZmluaXRpb25cbiAgICovXG5cbiAgY2xhc3MgUG9wb3ZlciBleHRlbmRzIFRvb2x0aXAge1xuICAgIC8vIEdldHRlcnNcbiAgICBzdGF0aWMgZ2V0IERlZmF1bHQoKSB7XG4gICAgICByZXR1cm4gRGVmYXVsdCQyO1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IERlZmF1bHRUeXBlKCkge1xuICAgICAgcmV0dXJuIERlZmF1bHRUeXBlJDI7XG4gICAgfVxuICAgIHN0YXRpYyBnZXQgTkFNRSgpIHtcbiAgICAgIHJldHVybiBOQU1FJDM7XG4gICAgfVxuXG4gICAgLy8gT3ZlcnJpZGVzXG4gICAgX2lzV2l0aENvbnRlbnQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0VGl0bGUoKSB8fCB0aGlzLl9nZXRDb250ZW50KCk7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZVxuICAgIF9nZXRDb250ZW50Rm9yVGVtcGxhdGUoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBbU0VMRUNUT1JfVElUTEVdOiB0aGlzLl9nZXRUaXRsZSgpLFxuICAgICAgICBbU0VMRUNUT1JfQ09OVEVOVF06IHRoaXMuX2dldENvbnRlbnQoKVxuICAgICAgfTtcbiAgICB9XG4gICAgX2dldENvbnRlbnQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcmVzb2x2ZVBvc3NpYmxlRnVuY3Rpb24odGhpcy5fY29uZmlnLmNvbnRlbnQpO1xuICAgIH1cblxuICAgIC8vIFN0YXRpY1xuICAgIHN0YXRpYyBqUXVlcnlJbnRlcmZhY2UoY29uZmlnKSB7XG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IFBvcG92ZXIuZ2V0T3JDcmVhdGVJbnN0YW5jZSh0aGlzLCBjb25maWcpO1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhW2NvbmZpZ10gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgTm8gbWV0aG9kIG5hbWVkIFwiJHtjb25maWd9XCJgKTtcbiAgICAgICAgfVxuICAgICAgICBkYXRhW2NvbmZpZ10oKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBqUXVlcnlcbiAgICovXG5cbiAgZGVmaW5lSlF1ZXJ5UGx1Z2luKFBvcG92ZXIpO1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBCb290c3RyYXAgc2Nyb2xsc3B5LmpzXG4gICAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFpbi9MSUNFTlNFKVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBDb25zdGFudHNcbiAgICovXG5cbiAgY29uc3QgTkFNRSQyID0gJ3Njcm9sbHNweSc7XG4gIGNvbnN0IERBVEFfS0VZJDIgPSAnYnMuc2Nyb2xsc3B5JztcbiAgY29uc3QgRVZFTlRfS0VZJDIgPSBgLiR7REFUQV9LRVkkMn1gO1xuICBjb25zdCBEQVRBX0FQSV9LRVkgPSAnLmRhdGEtYXBpJztcbiAgY29uc3QgRVZFTlRfQUNUSVZBVEUgPSBgYWN0aXZhdGUke0VWRU5UX0tFWSQyfWA7XG4gIGNvbnN0IEVWRU5UX0NMSUNLID0gYGNsaWNrJHtFVkVOVF9LRVkkMn1gO1xuICBjb25zdCBFVkVOVF9MT0FEX0RBVEFfQVBJJDEgPSBgbG9hZCR7RVZFTlRfS0VZJDJ9JHtEQVRBX0FQSV9LRVl9YDtcbiAgY29uc3QgQ0xBU1NfTkFNRV9EUk9QRE9XTl9JVEVNID0gJ2Ryb3Bkb3duLWl0ZW0nO1xuICBjb25zdCBDTEFTU19OQU1FX0FDVElWRSQxID0gJ2FjdGl2ZSc7XG4gIGNvbnN0IFNFTEVDVE9SX0RBVEFfU1BZID0gJ1tkYXRhLWJzLXNweT1cInNjcm9sbFwiXSc7XG4gIGNvbnN0IFNFTEVDVE9SX1RBUkdFVF9MSU5LUyA9ICdbaHJlZl0nO1xuICBjb25zdCBTRUxFQ1RPUl9OQVZfTElTVF9HUk9VUCA9ICcubmF2LCAubGlzdC1ncm91cCc7XG4gIGNvbnN0IFNFTEVDVE9SX05BVl9MSU5LUyA9ICcubmF2LWxpbmsnO1xuICBjb25zdCBTRUxFQ1RPUl9OQVZfSVRFTVMgPSAnLm5hdi1pdGVtJztcbiAgY29uc3QgU0VMRUNUT1JfTElTVF9JVEVNUyA9ICcubGlzdC1ncm91cC1pdGVtJztcbiAgY29uc3QgU0VMRUNUT1JfTElOS19JVEVNUyA9IGAke1NFTEVDVE9SX05BVl9MSU5LU30sICR7U0VMRUNUT1JfTkFWX0lURU1TfSA+ICR7U0VMRUNUT1JfTkFWX0xJTktTfSwgJHtTRUxFQ1RPUl9MSVNUX0lURU1TfWA7XG4gIGNvbnN0IFNFTEVDVE9SX0RST1BET1dOID0gJy5kcm9wZG93bic7XG4gIGNvbnN0IFNFTEVDVE9SX0RST1BET1dOX1RPR0dMRSQxID0gJy5kcm9wZG93bi10b2dnbGUnO1xuICBjb25zdCBEZWZhdWx0JDEgPSB7XG4gICAgb2Zmc2V0OiBudWxsLFxuICAgIC8vIFRPRE86IHY2IEBkZXByZWNhdGVkLCBrZWVwIGl0IGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSByZWFzb25zXG4gICAgcm9vdE1hcmdpbjogJzBweCAwcHggLTI1JScsXG4gICAgc21vb3RoU2Nyb2xsOiBmYWxzZSxcbiAgICB0YXJnZXQ6IG51bGwsXG4gICAgdGhyZXNob2xkOiBbMC4xLCAwLjUsIDFdXG4gIH07XG4gIGNvbnN0IERlZmF1bHRUeXBlJDEgPSB7XG4gICAgb2Zmc2V0OiAnKG51bWJlcnxudWxsKScsXG4gICAgLy8gVE9ETyB2NiBAZGVwcmVjYXRlZCwga2VlcCBpdCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgcmVhc29uc1xuICAgIHJvb3RNYXJnaW46ICdzdHJpbmcnLFxuICAgIHNtb290aFNjcm9sbDogJ2Jvb2xlYW4nLFxuICAgIHRhcmdldDogJ2VsZW1lbnQnLFxuICAgIHRocmVzaG9sZDogJ2FycmF5J1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGFzcyBkZWZpbml0aW9uXG4gICAqL1xuXG4gIGNsYXNzIFNjcm9sbFNweSBleHRlbmRzIEJhc2VDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgc3VwZXIoZWxlbWVudCwgY29uZmlnKTtcblxuICAgICAgLy8gdGhpcy5fZWxlbWVudCBpcyB0aGUgb2JzZXJ2YWJsZXNDb250YWluZXIgYW5kIGNvbmZpZy50YXJnZXQgdGhlIG1lbnUgbGlua3Mgd3JhcHBlclxuICAgICAgdGhpcy5fdGFyZ2V0TGlua3MgPSBuZXcgTWFwKCk7XG4gICAgICB0aGlzLl9vYnNlcnZhYmxlU2VjdGlvbnMgPSBuZXcgTWFwKCk7XG4gICAgICB0aGlzLl9yb290RWxlbWVudCA9IGdldENvbXB1dGVkU3R5bGUodGhpcy5fZWxlbWVudCkub3ZlcmZsb3dZID09PSAndmlzaWJsZScgPyBudWxsIDogdGhpcy5fZWxlbWVudDtcbiAgICAgIHRoaXMuX2FjdGl2ZVRhcmdldCA9IG51bGw7XG4gICAgICB0aGlzLl9vYnNlcnZlciA9IG51bGw7XG4gICAgICB0aGlzLl9wcmV2aW91c1Njcm9sbERhdGEgPSB7XG4gICAgICAgIHZpc2libGVFbnRyeVRvcDogMCxcbiAgICAgICAgcGFyZW50U2Nyb2xsVG9wOiAwXG4gICAgICB9O1xuICAgICAgdGhpcy5yZWZyZXNoKCk7IC8vIGluaXRpYWxpemVcbiAgICB9XG5cbiAgICAvLyBHZXR0ZXJzXG4gICAgc3RhdGljIGdldCBEZWZhdWx0KCkge1xuICAgICAgcmV0dXJuIERlZmF1bHQkMTtcbiAgICB9XG4gICAgc3RhdGljIGdldCBEZWZhdWx0VHlwZSgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0VHlwZSQxO1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IE5BTUUoKSB7XG4gICAgICByZXR1cm4gTkFNRSQyO1xuICAgIH1cblxuICAgIC8vIFB1YmxpY1xuICAgIHJlZnJlc2goKSB7XG4gICAgICB0aGlzLl9pbml0aWFsaXplVGFyZ2V0c0FuZE9ic2VydmFibGVzKCk7XG4gICAgICB0aGlzLl9tYXliZUVuYWJsZVNtb290aFNjcm9sbCgpO1xuICAgICAgaWYgKHRoaXMuX29ic2VydmVyKSB7XG4gICAgICAgIHRoaXMuX29ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX29ic2VydmVyID0gdGhpcy5fZ2V0TmV3T2JzZXJ2ZXIoKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiB0aGlzLl9vYnNlcnZhYmxlU2VjdGlvbnMudmFsdWVzKCkpIHtcbiAgICAgICAgdGhpcy5fb2JzZXJ2ZXIub2JzZXJ2ZShzZWN0aW9uKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIHRoaXMuX29ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHN1cGVyLmRpc3Bvc2UoKTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlXG4gICAgX2NvbmZpZ0FmdGVyTWVyZ2UoY29uZmlnKSB7XG4gICAgICAvLyBUT0RPOiBvbiB2NiB0YXJnZXQgc2hvdWxkIGJlIGdpdmVuIGV4cGxpY2l0bHkgJiByZW1vdmUgdGhlIHt0YXJnZXQ6ICdzcy10YXJnZXQnfSBjYXNlXG4gICAgICBjb25maWcudGFyZ2V0ID0gZ2V0RWxlbWVudChjb25maWcudGFyZ2V0KSB8fCBkb2N1bWVudC5ib2R5O1xuXG4gICAgICAvLyBUT0RPOiB2NiBPbmx5IGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSByZWFzb25zLiBVc2Ugcm9vdE1hcmdpbiBvbmx5XG4gICAgICBjb25maWcucm9vdE1hcmdpbiA9IGNvbmZpZy5vZmZzZXQgPyBgJHtjb25maWcub2Zmc2V0fXB4IDBweCAtMzAlYCA6IGNvbmZpZy5yb290TWFyZ2luO1xuICAgICAgaWYgKHR5cGVvZiBjb25maWcudGhyZXNob2xkID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25maWcudGhyZXNob2xkID0gY29uZmlnLnRocmVzaG9sZC5zcGxpdCgnLCcpLm1hcCh2YWx1ZSA9PiBOdW1iZXIucGFyc2VGbG9hdCh2YWx1ZSkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG4gICAgX21heWJlRW5hYmxlU21vb3RoU2Nyb2xsKCkge1xuICAgICAgaWYgKCF0aGlzLl9jb25maWcuc21vb3RoU2Nyb2xsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gdW5yZWdpc3RlciBhbnkgcHJldmlvdXMgbGlzdGVuZXJzXG4gICAgICBFdmVudEhhbmRsZXIub2ZmKHRoaXMuX2NvbmZpZy50YXJnZXQsIEVWRU5UX0NMSUNLKTtcbiAgICAgIEV2ZW50SGFuZGxlci5vbih0aGlzLl9jb25maWcudGFyZ2V0LCBFVkVOVF9DTElDSywgU0VMRUNUT1JfVEFSR0VUX0xJTktTLCBldmVudCA9PiB7XG4gICAgICAgIGNvbnN0IG9ic2VydmFibGVTZWN0aW9uID0gdGhpcy5fb2JzZXJ2YWJsZVNlY3Rpb25zLmdldChldmVudC50YXJnZXQuaGFzaCk7XG4gICAgICAgIGlmIChvYnNlcnZhYmxlU2VjdGlvbikge1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgY29uc3Qgcm9vdCA9IHRoaXMuX3Jvb3RFbGVtZW50IHx8IHdpbmRvdztcbiAgICAgICAgICBjb25zdCBoZWlnaHQgPSBvYnNlcnZhYmxlU2VjdGlvbi5vZmZzZXRUb3AgLSB0aGlzLl9lbGVtZW50Lm9mZnNldFRvcDtcbiAgICAgICAgICBpZiAocm9vdC5zY3JvbGxUbykge1xuICAgICAgICAgICAgcm9vdC5zY3JvbGxUbyh7XG4gICAgICAgICAgICAgIHRvcDogaGVpZ2h0LFxuICAgICAgICAgICAgICBiZWhhdmlvcjogJ3Ntb290aCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIENocm9tZSA2MCBkb2Vzbid0IHN1cHBvcnQgYHNjcm9sbFRvYFxuICAgICAgICAgIHJvb3Quc2Nyb2xsVG9wID0gaGVpZ2h0O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgX2dldE5ld09ic2VydmVyKCkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgcm9vdDogdGhpcy5fcm9vdEVsZW1lbnQsXG4gICAgICAgIHRocmVzaG9sZDogdGhpcy5fY29uZmlnLnRocmVzaG9sZCxcbiAgICAgICAgcm9vdE1hcmdpbjogdGhpcy5fY29uZmlnLnJvb3RNYXJnaW5cbiAgICAgIH07XG4gICAgICByZXR1cm4gbmV3IEludGVyc2VjdGlvbk9ic2VydmVyKGVudHJpZXMgPT4gdGhpcy5fb2JzZXJ2ZXJDYWxsYmFjayhlbnRyaWVzKSwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gVGhlIGxvZ2ljIG9mIHNlbGVjdGlvblxuICAgIF9vYnNlcnZlckNhbGxiYWNrKGVudHJpZXMpIHtcbiAgICAgIGNvbnN0IHRhcmdldEVsZW1lbnQgPSBlbnRyeSA9PiB0aGlzLl90YXJnZXRMaW5rcy5nZXQoYCMke2VudHJ5LnRhcmdldC5pZH1gKTtcbiAgICAgIGNvbnN0IGFjdGl2YXRlID0gZW50cnkgPT4ge1xuICAgICAgICB0aGlzLl9wcmV2aW91c1Njcm9sbERhdGEudmlzaWJsZUVudHJ5VG9wID0gZW50cnkudGFyZ2V0Lm9mZnNldFRvcDtcbiAgICAgICAgdGhpcy5fcHJvY2Vzcyh0YXJnZXRFbGVtZW50KGVudHJ5KSk7XG4gICAgICB9O1xuICAgICAgY29uc3QgcGFyZW50U2Nyb2xsVG9wID0gKHRoaXMuX3Jvb3RFbGVtZW50IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuc2Nyb2xsVG9wO1xuICAgICAgY29uc3QgdXNlclNjcm9sbHNEb3duID0gcGFyZW50U2Nyb2xsVG9wID49IHRoaXMuX3ByZXZpb3VzU2Nyb2xsRGF0YS5wYXJlbnRTY3JvbGxUb3A7XG4gICAgICB0aGlzLl9wcmV2aW91c1Njcm9sbERhdGEucGFyZW50U2Nyb2xsVG9wID0gcGFyZW50U2Nyb2xsVG9wO1xuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGlmICghZW50cnkuaXNJbnRlcnNlY3RpbmcpIHtcbiAgICAgICAgICB0aGlzLl9hY3RpdmVUYXJnZXQgPSBudWxsO1xuICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ2xhc3ModGFyZ2V0RWxlbWVudChlbnRyeSkpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVudHJ5SXNMb3dlclRoYW5QcmV2aW91cyA9IGVudHJ5LnRhcmdldC5vZmZzZXRUb3AgPj0gdGhpcy5fcHJldmlvdXNTY3JvbGxEYXRhLnZpc2libGVFbnRyeVRvcDtcbiAgICAgICAgLy8gaWYgd2UgYXJlIHNjcm9sbGluZyBkb3duLCBwaWNrIHRoZSBiaWdnZXIgb2Zmc2V0VG9wXG4gICAgICAgIGlmICh1c2VyU2Nyb2xsc0Rvd24gJiYgZW50cnlJc0xvd2VyVGhhblByZXZpb3VzKSB7XG4gICAgICAgICAgYWN0aXZhdGUoZW50cnkpO1xuICAgICAgICAgIC8vIGlmIHBhcmVudCBpc24ndCBzY3JvbGxlZCwgbGV0J3Mga2VlcCB0aGUgZmlyc3QgdmlzaWJsZSBpdGVtLCBicmVha2luZyB0aGUgaXRlcmF0aW9uXG4gICAgICAgICAgaWYgKCFwYXJlbnRTY3JvbGxUb3ApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB3ZSBhcmUgc2Nyb2xsaW5nIHVwLCBwaWNrIHRoZSBzbWFsbGVzdCBvZmZzZXRUb3BcbiAgICAgICAgaWYgKCF1c2VyU2Nyb2xsc0Rvd24gJiYgIWVudHJ5SXNMb3dlclRoYW5QcmV2aW91cykge1xuICAgICAgICAgIGFjdGl2YXRlKGVudHJ5KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBfaW5pdGlhbGl6ZVRhcmdldHNBbmRPYnNlcnZhYmxlcygpIHtcbiAgICAgIHRoaXMuX3RhcmdldExpbmtzID0gbmV3IE1hcCgpO1xuICAgICAgdGhpcy5fb2JzZXJ2YWJsZVNlY3Rpb25zID0gbmV3IE1hcCgpO1xuICAgICAgY29uc3QgdGFyZ2V0TGlua3MgPSBTZWxlY3RvckVuZ2luZS5maW5kKFNFTEVDVE9SX1RBUkdFVF9MSU5LUywgdGhpcy5fY29uZmlnLnRhcmdldCk7XG4gICAgICBmb3IgKGNvbnN0IGFuY2hvciBvZiB0YXJnZXRMaW5rcykge1xuICAgICAgICAvLyBlbnN1cmUgdGhhdCB0aGUgYW5jaG9yIGhhcyBhbiBpZCBhbmQgaXMgbm90IGRpc2FibGVkXG4gICAgICAgIGlmICghYW5jaG9yLmhhc2ggfHwgaXNEaXNhYmxlZChhbmNob3IpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2JzZXJ2YWJsZVNlY3Rpb24gPSBTZWxlY3RvckVuZ2luZS5maW5kT25lKGRlY29kZVVSSShhbmNob3IuaGFzaCksIHRoaXMuX2VsZW1lbnQpO1xuXG4gICAgICAgIC8vIGVuc3VyZSB0aGF0IHRoZSBvYnNlcnZhYmxlU2VjdGlvbiBleGlzdHMgJiBpcyB2aXNpYmxlXG4gICAgICAgIGlmIChpc1Zpc2libGUob2JzZXJ2YWJsZVNlY3Rpb24pKSB7XG4gICAgICAgICAgdGhpcy5fdGFyZ2V0TGlua3Muc2V0KGRlY29kZVVSSShhbmNob3IuaGFzaCksIGFuY2hvcik7XG4gICAgICAgICAgdGhpcy5fb2JzZXJ2YWJsZVNlY3Rpb25zLnNldChhbmNob3IuaGFzaCwgb2JzZXJ2YWJsZVNlY3Rpb24pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIF9wcm9jZXNzKHRhcmdldCkge1xuICAgICAgaWYgKHRoaXMuX2FjdGl2ZVRhcmdldCA9PT0gdGFyZ2V0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ2xhc3ModGhpcy5fY29uZmlnLnRhcmdldCk7XG4gICAgICB0aGlzLl9hY3RpdmVUYXJnZXQgPSB0YXJnZXQ7XG4gICAgICB0YXJnZXQuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX0FDVElWRSQxKTtcbiAgICAgIHRoaXMuX2FjdGl2YXRlUGFyZW50cyh0YXJnZXQpO1xuICAgICAgRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfQUNUSVZBVEUsIHtcbiAgICAgICAgcmVsYXRlZFRhcmdldDogdGFyZ2V0XG4gICAgICB9KTtcbiAgICB9XG4gICAgX2FjdGl2YXRlUGFyZW50cyh0YXJnZXQpIHtcbiAgICAgIC8vIEFjdGl2YXRlIGRyb3Bkb3duIHBhcmVudHNcbiAgICAgIGlmICh0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKENMQVNTX05BTUVfRFJPUERPV05fSVRFTSkpIHtcbiAgICAgICAgU2VsZWN0b3JFbmdpbmUuZmluZE9uZShTRUxFQ1RPUl9EUk9QRE9XTl9UT0dHTEUkMSwgdGFyZ2V0LmNsb3Nlc3QoU0VMRUNUT1JfRFJPUERPV04pKS5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfQUNUSVZFJDEpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGxpc3RHcm91cCBvZiBTZWxlY3RvckVuZ2luZS5wYXJlbnRzKHRhcmdldCwgU0VMRUNUT1JfTkFWX0xJU1RfR1JPVVApKSB7XG4gICAgICAgIC8vIFNldCB0cmlnZ2VyZWQgbGlua3MgcGFyZW50cyBhcyBhY3RpdmVcbiAgICAgICAgLy8gV2l0aCBib3RoIDx1bD4gYW5kIDxuYXY+IG1hcmt1cCBhIHBhcmVudCBpcyB0aGUgcHJldmlvdXMgc2libGluZyBvZiBhbnkgbmF2IGFuY2VzdG9yXG4gICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBTZWxlY3RvckVuZ2luZS5wcmV2KGxpc3RHcm91cCwgU0VMRUNUT1JfTElOS19JVEVNUykpIHtcbiAgICAgICAgICBpdGVtLmNsYXNzTGlzdC5hZGQoQ0xBU1NfTkFNRV9BQ1RJVkUkMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgX2NsZWFyQWN0aXZlQ2xhc3MocGFyZW50KSB7XG4gICAgICBwYXJlbnQuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX0FDVElWRSQxKTtcbiAgICAgIGNvbnN0IGFjdGl2ZU5vZGVzID0gU2VsZWN0b3JFbmdpbmUuZmluZChgJHtTRUxFQ1RPUl9UQVJHRVRfTElOS1N9LiR7Q0xBU1NfTkFNRV9BQ1RJVkUkMX1gLCBwYXJlbnQpO1xuICAgICAgZm9yIChjb25zdCBub2RlIG9mIGFjdGl2ZU5vZGVzKSB7XG4gICAgICAgIG5vZGUuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX0FDVElWRSQxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTdGF0aWNcbiAgICBzdGF0aWMgalF1ZXJ5SW50ZXJmYWNlKGNvbmZpZykge1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBTY3JvbGxTcHkuZ2V0T3JDcmVhdGVJbnN0YW5jZSh0aGlzLCBjb25maWcpO1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFbY29uZmlnXSA9PT0gdW5kZWZpbmVkIHx8IGNvbmZpZy5zdGFydHNXaXRoKCdfJykgfHwgY29uZmlnID09PSAnY29uc3RydWN0b3InKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgTm8gbWV0aG9kIG5hbWVkIFwiJHtjb25maWd9XCJgKTtcbiAgICAgICAgfVxuICAgICAgICBkYXRhW2NvbmZpZ10oKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEYXRhIEFQSSBpbXBsZW1lbnRhdGlvblxuICAgKi9cblxuICBFdmVudEhhbmRsZXIub24od2luZG93LCBFVkVOVF9MT0FEX0RBVEFfQVBJJDEsICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHNweSBvZiBTZWxlY3RvckVuZ2luZS5maW5kKFNFTEVDVE9SX0RBVEFfU1BZKSkge1xuICAgICAgU2Nyb2xsU3B5LmdldE9yQ3JlYXRlSW5zdGFuY2Uoc3B5KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8qKlxuICAgKiBqUXVlcnlcbiAgICovXG5cbiAgZGVmaW5lSlF1ZXJ5UGx1Z2luKFNjcm9sbFNweSk7XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCB0YWIuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50c1xuICAgKi9cblxuICBjb25zdCBOQU1FJDEgPSAndGFiJztcbiAgY29uc3QgREFUQV9LRVkkMSA9ICdicy50YWInO1xuICBjb25zdCBFVkVOVF9LRVkkMSA9IGAuJHtEQVRBX0tFWSQxfWA7XG4gIGNvbnN0IEVWRU5UX0hJREUkMSA9IGBoaWRlJHtFVkVOVF9LRVkkMX1gO1xuICBjb25zdCBFVkVOVF9ISURERU4kMSA9IGBoaWRkZW4ke0VWRU5UX0tFWSQxfWA7XG4gIGNvbnN0IEVWRU5UX1NIT1ckMSA9IGBzaG93JHtFVkVOVF9LRVkkMX1gO1xuICBjb25zdCBFVkVOVF9TSE9XTiQxID0gYHNob3duJHtFVkVOVF9LRVkkMX1gO1xuICBjb25zdCBFVkVOVF9DTElDS19EQVRBX0FQSSA9IGBjbGljayR7RVZFTlRfS0VZJDF9YDtcbiAgY29uc3QgRVZFTlRfS0VZRE9XTiA9IGBrZXlkb3duJHtFVkVOVF9LRVkkMX1gO1xuICBjb25zdCBFVkVOVF9MT0FEX0RBVEFfQVBJID0gYGxvYWQke0VWRU5UX0tFWSQxfWA7XG4gIGNvbnN0IEFSUk9XX0xFRlRfS0VZID0gJ0Fycm93TGVmdCc7XG4gIGNvbnN0IEFSUk9XX1JJR0hUX0tFWSA9ICdBcnJvd1JpZ2h0JztcbiAgY29uc3QgQVJST1dfVVBfS0VZID0gJ0Fycm93VXAnO1xuICBjb25zdCBBUlJPV19ET1dOX0tFWSA9ICdBcnJvd0Rvd24nO1xuICBjb25zdCBIT01FX0tFWSA9ICdIb21lJztcbiAgY29uc3QgRU5EX0tFWSA9ICdFbmQnO1xuICBjb25zdCBDTEFTU19OQU1FX0FDVElWRSA9ICdhY3RpdmUnO1xuICBjb25zdCBDTEFTU19OQU1FX0ZBREUkMSA9ICdmYWRlJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9TSE9XJDEgPSAnc2hvdyc7XG4gIGNvbnN0IENMQVNTX0RST1BET1dOID0gJ2Ryb3Bkb3duJztcbiAgY29uc3QgU0VMRUNUT1JfRFJPUERPV05fVE9HR0xFID0gJy5kcm9wZG93bi10b2dnbGUnO1xuICBjb25zdCBTRUxFQ1RPUl9EUk9QRE9XTl9NRU5VID0gJy5kcm9wZG93bi1tZW51JztcbiAgY29uc3QgTk9UX1NFTEVDVE9SX0RST1BET1dOX1RPR0dMRSA9IGA6bm90KCR7U0VMRUNUT1JfRFJPUERPV05fVE9HR0xFfSlgO1xuICBjb25zdCBTRUxFQ1RPUl9UQUJfUEFORUwgPSAnLmxpc3QtZ3JvdXAsIC5uYXYsIFtyb2xlPVwidGFibGlzdFwiXSc7XG4gIGNvbnN0IFNFTEVDVE9SX09VVEVSID0gJy5uYXYtaXRlbSwgLmxpc3QtZ3JvdXAtaXRlbSc7XG4gIGNvbnN0IFNFTEVDVE9SX0lOTkVSID0gYC5uYXYtbGluayR7Tk9UX1NFTEVDVE9SX0RST1BET1dOX1RPR0dMRX0sIC5saXN0LWdyb3VwLWl0ZW0ke05PVF9TRUxFQ1RPUl9EUk9QRE9XTl9UT0dHTEV9LCBbcm9sZT1cInRhYlwiXSR7Tk9UX1NFTEVDVE9SX0RST1BET1dOX1RPR0dMRX1gO1xuICBjb25zdCBTRUxFQ1RPUl9EQVRBX1RPR0dMRSA9ICdbZGF0YS1icy10b2dnbGU9XCJ0YWJcIl0sIFtkYXRhLWJzLXRvZ2dsZT1cInBpbGxcIl0sIFtkYXRhLWJzLXRvZ2dsZT1cImxpc3RcIl0nOyAvLyBUT0RPOiBjb3VsZCBvbmx5IGJlIGB0YWJgIGluIHY2XG4gIGNvbnN0IFNFTEVDVE9SX0lOTkVSX0VMRU0gPSBgJHtTRUxFQ1RPUl9JTk5FUn0sICR7U0VMRUNUT1JfREFUQV9UT0dHTEV9YDtcbiAgY29uc3QgU0VMRUNUT1JfREFUQV9UT0dHTEVfQUNUSVZFID0gYC4ke0NMQVNTX05BTUVfQUNUSVZFfVtkYXRhLWJzLXRvZ2dsZT1cInRhYlwiXSwgLiR7Q0xBU1NfTkFNRV9BQ1RJVkV9W2RhdGEtYnMtdG9nZ2xlPVwicGlsbFwiXSwgLiR7Q0xBU1NfTkFNRV9BQ1RJVkV9W2RhdGEtYnMtdG9nZ2xlPVwibGlzdFwiXWA7XG5cbiAgLyoqXG4gICAqIENsYXNzIGRlZmluaXRpb25cbiAgICovXG5cbiAgY2xhc3MgVGFiIGV4dGVuZHMgQmFzZUNvbXBvbmVudCB7XG4gICAgY29uc3RydWN0b3IoZWxlbWVudCkge1xuICAgICAgc3VwZXIoZWxlbWVudCk7XG4gICAgICB0aGlzLl9wYXJlbnQgPSB0aGlzLl9lbGVtZW50LmNsb3Nlc3QoU0VMRUNUT1JfVEFCX1BBTkVMKTtcbiAgICAgIGlmICghdGhpcy5fcGFyZW50KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgICAgLy8gVE9ETzogc2hvdWxkIHRocm93IGV4Y2VwdGlvbiBpbiB2NlxuICAgICAgICAvLyB0aHJvdyBuZXcgVHlwZUVycm9yKGAke2VsZW1lbnQub3V0ZXJIVE1MfSBoYXMgbm90IGEgdmFsaWQgcGFyZW50ICR7U0VMRUNUT1JfSU5ORVJfRUxFTX1gKVxuICAgICAgfVxuXG4gICAgICAvLyBTZXQgdXAgaW5pdGlhbCBhcmlhIGF0dHJpYnV0ZXNcbiAgICAgIHRoaXMuX3NldEluaXRpYWxBdHRyaWJ1dGVzKHRoaXMuX3BhcmVudCwgdGhpcy5fZ2V0Q2hpbGRyZW4oKSk7XG4gICAgICBFdmVudEhhbmRsZXIub24odGhpcy5fZWxlbWVudCwgRVZFTlRfS0VZRE9XTiwgZXZlbnQgPT4gdGhpcy5fa2V5ZG93bihldmVudCkpO1xuICAgIH1cblxuICAgIC8vIEdldHRlcnNcbiAgICBzdGF0aWMgZ2V0IE5BTUUoKSB7XG4gICAgICByZXR1cm4gTkFNRSQxO1xuICAgIH1cblxuICAgIC8vIFB1YmxpY1xuICAgIHNob3coKSB7XG4gICAgICAvLyBTaG93cyB0aGlzIGVsZW0gYW5kIGRlYWN0aXZhdGUgdGhlIGFjdGl2ZSBzaWJsaW5nIGlmIGV4aXN0c1xuICAgICAgY29uc3QgaW5uZXJFbGVtID0gdGhpcy5fZWxlbWVudDtcbiAgICAgIGlmICh0aGlzLl9lbGVtSXNBY3RpdmUoaW5uZXJFbGVtKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFNlYXJjaCBmb3IgYWN0aXZlIHRhYiBvbiBzYW1lIHBhcmVudCB0byBkZWFjdGl2YXRlIGl0XG4gICAgICBjb25zdCBhY3RpdmUgPSB0aGlzLl9nZXRBY3RpdmVFbGVtKCk7XG4gICAgICBjb25zdCBoaWRlRXZlbnQgPSBhY3RpdmUgPyBFdmVudEhhbmRsZXIudHJpZ2dlcihhY3RpdmUsIEVWRU5UX0hJREUkMSwge1xuICAgICAgICByZWxhdGVkVGFyZ2V0OiBpbm5lckVsZW1cbiAgICAgIH0pIDogbnVsbDtcbiAgICAgIGNvbnN0IHNob3dFdmVudCA9IEV2ZW50SGFuZGxlci50cmlnZ2VyKGlubmVyRWxlbSwgRVZFTlRfU0hPVyQxLCB7XG4gICAgICAgIHJlbGF0ZWRUYXJnZXQ6IGFjdGl2ZVxuICAgICAgfSk7XG4gICAgICBpZiAoc2hvd0V2ZW50LmRlZmF1bHRQcmV2ZW50ZWQgfHwgaGlkZUV2ZW50ICYmIGhpZGVFdmVudC5kZWZhdWx0UHJldmVudGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2RlYWN0aXZhdGUoYWN0aXZlLCBpbm5lckVsZW0pO1xuICAgICAgdGhpcy5fYWN0aXZhdGUoaW5uZXJFbGVtLCBhY3RpdmUpO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGVcbiAgICBfYWN0aXZhdGUoZWxlbWVudCwgcmVsYXRlZEVsZW0pIHtcbiAgICAgIGlmICghZWxlbWVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoQ0xBU1NfTkFNRV9BQ1RJVkUpO1xuICAgICAgdGhpcy5fYWN0aXZhdGUoU2VsZWN0b3JFbmdpbmUuZ2V0RWxlbWVudEZyb21TZWxlY3RvcihlbGVtZW50KSk7IC8vIFNlYXJjaCBhbmQgYWN0aXZhdGUvc2hvdyB0aGUgcHJvcGVyIHNlY3Rpb25cblxuICAgICAgY29uc3QgY29tcGxldGUgPSAoKSA9PiB7XG4gICAgICAgIGlmIChlbGVtZW50LmdldEF0dHJpYnV0ZSgncm9sZScpICE9PSAndGFiJykge1xuICAgICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FX1NIT1ckMSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCd0YWJpbmRleCcpO1xuICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsIHRydWUpO1xuICAgICAgICB0aGlzLl90b2dnbGVEcm9wRG93bihlbGVtZW50LCB0cnVlKTtcbiAgICAgICAgRXZlbnRIYW5kbGVyLnRyaWdnZXIoZWxlbWVudCwgRVZFTlRfU0hPV04kMSwge1xuICAgICAgICAgIHJlbGF0ZWRUYXJnZXQ6IHJlbGF0ZWRFbGVtXG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIHRoaXMuX3F1ZXVlQ2FsbGJhY2soY29tcGxldGUsIGVsZW1lbnQsIGVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKENMQVNTX05BTUVfRkFERSQxKSk7XG4gICAgfVxuICAgIF9kZWFjdGl2YXRlKGVsZW1lbnQsIHJlbGF0ZWRFbGVtKSB7XG4gICAgICBpZiAoIWVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKENMQVNTX05BTUVfQUNUSVZFKTtcbiAgICAgIGVsZW1lbnQuYmx1cigpO1xuICAgICAgdGhpcy5fZGVhY3RpdmF0ZShTZWxlY3RvckVuZ2luZS5nZXRFbGVtZW50RnJvbVNlbGVjdG9yKGVsZW1lbnQpKTsgLy8gU2VhcmNoIGFuZCBkZWFjdGl2YXRlIHRoZSBzaG93biBzZWN0aW9uIHRvb1xuXG4gICAgICBjb25zdCBjb21wbGV0ZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdyb2xlJykgIT09ICd0YWInKSB7XG4gICAgICAgICAgZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKENMQVNTX05BTUVfU0hPVyQxKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnLCBmYWxzZSk7XG4gICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICctMScpO1xuICAgICAgICB0aGlzLl90b2dnbGVEcm9wRG93bihlbGVtZW50LCBmYWxzZSk7XG4gICAgICAgIEV2ZW50SGFuZGxlci50cmlnZ2VyKGVsZW1lbnQsIEVWRU5UX0hJRERFTiQxLCB7XG4gICAgICAgICAgcmVsYXRlZFRhcmdldDogcmVsYXRlZEVsZW1cbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgdGhpcy5fcXVldWVDYWxsYmFjayhjb21wbGV0ZSwgZWxlbWVudCwgZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9GQURFJDEpKTtcbiAgICB9XG4gICAgX2tleWRvd24oZXZlbnQpIHtcbiAgICAgIGlmICghW0FSUk9XX0xFRlRfS0VZLCBBUlJPV19SSUdIVF9LRVksIEFSUk9XX1VQX0tFWSwgQVJST1dfRE9XTl9LRVksIEhPTUVfS0VZLCBFTkRfS0VZXS5pbmNsdWRlcyhldmVudC5rZXkpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpOyAvLyBzdG9wUHJvcGFnYXRpb24vcHJldmVudERlZmF1bHQgYm90aCBhZGRlZCB0byBzdXBwb3J0IHVwL2Rvd24ga2V5cyB3aXRob3V0IHNjcm9sbGluZyB0aGUgcGFnZVxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fZ2V0Q2hpbGRyZW4oKS5maWx0ZXIoZWxlbWVudCA9PiAhaXNEaXNhYmxlZChlbGVtZW50KSk7XG4gICAgICBsZXQgbmV4dEFjdGl2ZUVsZW1lbnQ7XG4gICAgICBpZiAoW0hPTUVfS0VZLCBFTkRfS0VZXS5pbmNsdWRlcyhldmVudC5rZXkpKSB7XG4gICAgICAgIG5leHRBY3RpdmVFbGVtZW50ID0gY2hpbGRyZW5bZXZlbnQua2V5ID09PSBIT01FX0tFWSA/IDAgOiBjaGlsZHJlbi5sZW5ndGggLSAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGlzTmV4dCA9IFtBUlJPV19SSUdIVF9LRVksIEFSUk9XX0RPV05fS0VZXS5pbmNsdWRlcyhldmVudC5rZXkpO1xuICAgICAgICBuZXh0QWN0aXZlRWxlbWVudCA9IGdldE5leHRBY3RpdmVFbGVtZW50KGNoaWxkcmVuLCBldmVudC50YXJnZXQsIGlzTmV4dCwgdHJ1ZSk7XG4gICAgICB9XG4gICAgICBpZiAobmV4dEFjdGl2ZUVsZW1lbnQpIHtcbiAgICAgICAgbmV4dEFjdGl2ZUVsZW1lbnQuZm9jdXMoe1xuICAgICAgICAgIHByZXZlbnRTY3JvbGw6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIFRhYi5nZXRPckNyZWF0ZUluc3RhbmNlKG5leHRBY3RpdmVFbGVtZW50KS5zaG93KCk7XG4gICAgICB9XG4gICAgfVxuICAgIF9nZXRDaGlsZHJlbigpIHtcbiAgICAgIC8vIGNvbGxlY3Rpb24gb2YgaW5uZXIgZWxlbWVudHNcbiAgICAgIHJldHVybiBTZWxlY3RvckVuZ2luZS5maW5kKFNFTEVDVE9SX0lOTkVSX0VMRU0sIHRoaXMuX3BhcmVudCk7XG4gICAgfVxuICAgIF9nZXRBY3RpdmVFbGVtKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2dldENoaWxkcmVuKCkuZmluZChjaGlsZCA9PiB0aGlzLl9lbGVtSXNBY3RpdmUoY2hpbGQpKSB8fCBudWxsO1xuICAgIH1cbiAgICBfc2V0SW5pdGlhbEF0dHJpYnV0ZXMocGFyZW50LCBjaGlsZHJlbikge1xuICAgICAgdGhpcy5fc2V0QXR0cmlidXRlSWZOb3RFeGlzdHMocGFyZW50LCAncm9sZScsICd0YWJsaXN0Jyk7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgIHRoaXMuX3NldEluaXRpYWxBdHRyaWJ1dGVzT25DaGlsZChjaGlsZCk7XG4gICAgICB9XG4gICAgfVxuICAgIF9zZXRJbml0aWFsQXR0cmlidXRlc09uQ2hpbGQoY2hpbGQpIHtcbiAgICAgIGNoaWxkID0gdGhpcy5fZ2V0SW5uZXJFbGVtZW50KGNoaWxkKTtcbiAgICAgIGNvbnN0IGlzQWN0aXZlID0gdGhpcy5fZWxlbUlzQWN0aXZlKGNoaWxkKTtcbiAgICAgIGNvbnN0IG91dGVyRWxlbSA9IHRoaXMuX2dldE91dGVyRWxlbWVudChjaGlsZCk7XG4gICAgICBjaGlsZC5zZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnLCBpc0FjdGl2ZSk7XG4gICAgICBpZiAob3V0ZXJFbGVtICE9PSBjaGlsZCkge1xuICAgICAgICB0aGlzLl9zZXRBdHRyaWJ1dGVJZk5vdEV4aXN0cyhvdXRlckVsZW0sICdyb2xlJywgJ3ByZXNlbnRhdGlvbicpO1xuICAgICAgfVxuICAgICAgaWYgKCFpc0FjdGl2ZSkge1xuICAgICAgICBjaGlsZC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJy0xJyk7XG4gICAgICB9XG4gICAgICB0aGlzLl9zZXRBdHRyaWJ1dGVJZk5vdEV4aXN0cyhjaGlsZCwgJ3JvbGUnLCAndGFiJyk7XG5cbiAgICAgIC8vIHNldCBhdHRyaWJ1dGVzIHRvIHRoZSByZWxhdGVkIHBhbmVsIHRvb1xuICAgICAgdGhpcy5fc2V0SW5pdGlhbEF0dHJpYnV0ZXNPblRhcmdldFBhbmVsKGNoaWxkKTtcbiAgICB9XG4gICAgX3NldEluaXRpYWxBdHRyaWJ1dGVzT25UYXJnZXRQYW5lbChjaGlsZCkge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gU2VsZWN0b3JFbmdpbmUuZ2V0RWxlbWVudEZyb21TZWxlY3RvcihjaGlsZCk7XG4gICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl9zZXRBdHRyaWJ1dGVJZk5vdEV4aXN0cyh0YXJnZXQsICdyb2xlJywgJ3RhYnBhbmVsJyk7XG4gICAgICBpZiAoY2hpbGQuaWQpIHtcbiAgICAgICAgdGhpcy5fc2V0QXR0cmlidXRlSWZOb3RFeGlzdHModGFyZ2V0LCAnYXJpYS1sYWJlbGxlZGJ5JywgYCR7Y2hpbGQuaWR9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIF90b2dnbGVEcm9wRG93bihlbGVtZW50LCBvcGVuKSB7XG4gICAgICBjb25zdCBvdXRlckVsZW0gPSB0aGlzLl9nZXRPdXRlckVsZW1lbnQoZWxlbWVudCk7XG4gICAgICBpZiAoIW91dGVyRWxlbS5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfRFJPUERPV04pKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRvZ2dsZSA9IChzZWxlY3RvciwgY2xhc3NOYW1lKSA9PiB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBTZWxlY3RvckVuZ2luZS5maW5kT25lKHNlbGVjdG9yLCBvdXRlckVsZW0pO1xuICAgICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWUsIG9wZW4pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdG9nZ2xlKFNFTEVDVE9SX0RST1BET1dOX1RPR0dMRSwgQ0xBU1NfTkFNRV9BQ1RJVkUpO1xuICAgICAgdG9nZ2xlKFNFTEVDVE9SX0RST1BET1dOX01FTlUsIENMQVNTX05BTUVfU0hPVyQxKTtcbiAgICAgIG91dGVyRWxlbS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBvcGVuKTtcbiAgICB9XG4gICAgX3NldEF0dHJpYnV0ZUlmTm90RXhpc3RzKGVsZW1lbnQsIGF0dHJpYnV0ZSwgdmFsdWUpIHtcbiAgICAgIGlmICghZWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlKSkge1xuICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShhdHRyaWJ1dGUsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX2VsZW1Jc0FjdGl2ZShlbGVtKSB7XG4gICAgICByZXR1cm4gZWxlbS5jbGFzc0xpc3QuY29udGFpbnMoQ0xBU1NfTkFNRV9BQ1RJVkUpO1xuICAgIH1cblxuICAgIC8vIFRyeSB0byBnZXQgdGhlIGlubmVyIGVsZW1lbnQgKHVzdWFsbHkgdGhlIC5uYXYtbGluaylcbiAgICBfZ2V0SW5uZXJFbGVtZW50KGVsZW0pIHtcbiAgICAgIHJldHVybiBlbGVtLm1hdGNoZXMoU0VMRUNUT1JfSU5ORVJfRUxFTSkgPyBlbGVtIDogU2VsZWN0b3JFbmdpbmUuZmluZE9uZShTRUxFQ1RPUl9JTk5FUl9FTEVNLCBlbGVtKTtcbiAgICB9XG5cbiAgICAvLyBUcnkgdG8gZ2V0IHRoZSBvdXRlciBlbGVtZW50ICh1c3VhbGx5IHRoZSAubmF2LWl0ZW0pXG4gICAgX2dldE91dGVyRWxlbWVudChlbGVtKSB7XG4gICAgICByZXR1cm4gZWxlbS5jbG9zZXN0KFNFTEVDVE9SX09VVEVSKSB8fCBlbGVtO1xuICAgIH1cblxuICAgIC8vIFN0YXRpY1xuICAgIHN0YXRpYyBqUXVlcnlJbnRlcmZhY2UoY29uZmlnKSB7XG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IFRhYi5nZXRPckNyZWF0ZUluc3RhbmNlKHRoaXMpO1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFbY29uZmlnXSA9PT0gdW5kZWZpbmVkIHx8IGNvbmZpZy5zdGFydHNXaXRoKCdfJykgfHwgY29uZmlnID09PSAnY29uc3RydWN0b3InKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgTm8gbWV0aG9kIG5hbWVkIFwiJHtjb25maWd9XCJgKTtcbiAgICAgICAgfVxuICAgICAgICBkYXRhW2NvbmZpZ10oKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEYXRhIEFQSSBpbXBsZW1lbnRhdGlvblxuICAgKi9cblxuICBFdmVudEhhbmRsZXIub24oZG9jdW1lbnQsIEVWRU5UX0NMSUNLX0RBVEFfQVBJLCBTRUxFQ1RPUl9EQVRBX1RPR0dMRSwgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgaWYgKFsnQScsICdBUkVBJ10uaW5jbHVkZXModGhpcy50YWdOYW1lKSkge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gICAgaWYgKGlzRGlzYWJsZWQodGhpcykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgVGFiLmdldE9yQ3JlYXRlSW5zdGFuY2UodGhpcykuc2hvdygpO1xuICB9KTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSBvbiBmb2N1c1xuICAgKi9cbiAgRXZlbnRIYW5kbGVyLm9uKHdpbmRvdywgRVZFTlRfTE9BRF9EQVRBX0FQSSwgKCkgPT4ge1xuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBTZWxlY3RvckVuZ2luZS5maW5kKFNFTEVDVE9SX0RBVEFfVE9HR0xFX0FDVElWRSkpIHtcbiAgICAgIFRhYi5nZXRPckNyZWF0ZUluc3RhbmNlKGVsZW1lbnQpO1xuICAgIH1cbiAgfSk7XG4gIC8qKlxuICAgKiBqUXVlcnlcbiAgICovXG5cbiAgZGVmaW5lSlF1ZXJ5UGx1Z2luKFRhYik7XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCB0b2FzdC5qc1xuICAgKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21haW4vTElDRU5TRSlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cblxuICAvKipcbiAgICogQ29uc3RhbnRzXG4gICAqL1xuXG4gIGNvbnN0IE5BTUUgPSAndG9hc3QnO1xuICBjb25zdCBEQVRBX0tFWSA9ICdicy50b2FzdCc7XG4gIGNvbnN0IEVWRU5UX0tFWSA9IGAuJHtEQVRBX0tFWX1gO1xuICBjb25zdCBFVkVOVF9NT1VTRU9WRVIgPSBgbW91c2VvdmVyJHtFVkVOVF9LRVl9YDtcbiAgY29uc3QgRVZFTlRfTU9VU0VPVVQgPSBgbW91c2VvdXQke0VWRU5UX0tFWX1gO1xuICBjb25zdCBFVkVOVF9GT0NVU0lOID0gYGZvY3VzaW4ke0VWRU5UX0tFWX1gO1xuICBjb25zdCBFVkVOVF9GT0NVU09VVCA9IGBmb2N1c291dCR7RVZFTlRfS0VZfWA7XG4gIGNvbnN0IEVWRU5UX0hJREUgPSBgaGlkZSR7RVZFTlRfS0VZfWA7XG4gIGNvbnN0IEVWRU5UX0hJRERFTiA9IGBoaWRkZW4ke0VWRU5UX0tFWX1gO1xuICBjb25zdCBFVkVOVF9TSE9XID0gYHNob3cke0VWRU5UX0tFWX1gO1xuICBjb25zdCBFVkVOVF9TSE9XTiA9IGBzaG93biR7RVZFTlRfS0VZfWA7XG4gIGNvbnN0IENMQVNTX05BTUVfRkFERSA9ICdmYWRlJztcbiAgY29uc3QgQ0xBU1NfTkFNRV9ISURFID0gJ2hpZGUnOyAvLyBAZGVwcmVjYXRlZCAtIGtlcHQgaGVyZSBvbmx5IGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICBjb25zdCBDTEFTU19OQU1FX1NIT1cgPSAnc2hvdyc7XG4gIGNvbnN0IENMQVNTX05BTUVfU0hPV0lORyA9ICdzaG93aW5nJztcbiAgY29uc3QgRGVmYXVsdFR5cGUgPSB7XG4gICAgYW5pbWF0aW9uOiAnYm9vbGVhbicsXG4gICAgYXV0b2hpZGU6ICdib29sZWFuJyxcbiAgICBkZWxheTogJ251bWJlcidcbiAgfTtcbiAgY29uc3QgRGVmYXVsdCA9IHtcbiAgICBhbmltYXRpb246IHRydWUsXG4gICAgYXV0b2hpZGU6IHRydWUsXG4gICAgZGVsYXk6IDUwMDBcbiAgfTtcblxuICAvKipcbiAgICogQ2xhc3MgZGVmaW5pdGlvblxuICAgKi9cblxuICBjbGFzcyBUb2FzdCBleHRlbmRzIEJhc2VDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgc3VwZXIoZWxlbWVudCwgY29uZmlnKTtcbiAgICAgIHRoaXMuX3RpbWVvdXQgPSBudWxsO1xuICAgICAgdGhpcy5faGFzTW91c2VJbnRlcmFjdGlvbiA9IGZhbHNlO1xuICAgICAgdGhpcy5faGFzS2V5Ym9hcmRJbnRlcmFjdGlvbiA9IGZhbHNlO1xuICAgICAgdGhpcy5fc2V0TGlzdGVuZXJzKCk7XG4gICAgfVxuXG4gICAgLy8gR2V0dGVyc1xuICAgIHN0YXRpYyBnZXQgRGVmYXVsdCgpIHtcbiAgICAgIHJldHVybiBEZWZhdWx0O1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IERlZmF1bHRUeXBlKCkge1xuICAgICAgcmV0dXJuIERlZmF1bHRUeXBlO1xuICAgIH1cbiAgICBzdGF0aWMgZ2V0IE5BTUUoKSB7XG4gICAgICByZXR1cm4gTkFNRTtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWNcbiAgICBzaG93KCkge1xuICAgICAgY29uc3Qgc2hvd0V2ZW50ID0gRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfU0hPVyk7XG4gICAgICBpZiAoc2hvd0V2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2xlYXJUaW1lb3V0KCk7XG4gICAgICBpZiAodGhpcy5fY29uZmlnLmFuaW1hdGlvbikge1xuICAgICAgICB0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5hZGQoQ0xBU1NfTkFNRV9GQURFKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvbXBsZXRlID0gKCkgPT4ge1xuICAgICAgICB0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoQ0xBU1NfTkFNRV9TSE9XSU5HKTtcbiAgICAgICAgRXZlbnRIYW5kbGVyLnRyaWdnZXIodGhpcy5fZWxlbWVudCwgRVZFTlRfU0hPV04pO1xuICAgICAgICB0aGlzLl9tYXliZVNjaGVkdWxlSGlkZSgpO1xuICAgICAgfTtcbiAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX0hJREUpOyAvLyBAZGVwcmVjYXRlZFxuICAgICAgcmVmbG93KHRoaXMuX2VsZW1lbnQpO1xuICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfU0hPVywgQ0xBU1NfTkFNRV9TSE9XSU5HKTtcbiAgICAgIHRoaXMuX3F1ZXVlQ2FsbGJhY2soY29tcGxldGUsIHRoaXMuX2VsZW1lbnQsIHRoaXMuX2NvbmZpZy5hbmltYXRpb24pO1xuICAgIH1cbiAgICBoaWRlKCkge1xuICAgICAgaWYgKCF0aGlzLmlzU2hvd24oKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBoaWRlRXZlbnQgPSBFdmVudEhhbmRsZXIudHJpZ2dlcih0aGlzLl9lbGVtZW50LCBFVkVOVF9ISURFKTtcbiAgICAgIGlmIChoaWRlRXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBjb21wbGV0ZSA9ICgpID0+IHtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfSElERSk7IC8vIEBkZXByZWNhdGVkXG4gICAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX1NIT1dJTkcsIENMQVNTX05BTUVfU0hPVyk7XG4gICAgICAgIEV2ZW50SGFuZGxlci50cmlnZ2VyKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0hJRERFTik7XG4gICAgICB9O1xuICAgICAgdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKENMQVNTX05BTUVfU0hPV0lORyk7XG4gICAgICB0aGlzLl9xdWV1ZUNhbGxiYWNrKGNvbXBsZXRlLCB0aGlzLl9lbGVtZW50LCB0aGlzLl9jb25maWcuYW5pbWF0aW9uKTtcbiAgICB9XG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIHRoaXMuX2NsZWFyVGltZW91dCgpO1xuICAgICAgaWYgKHRoaXMuaXNTaG93bigpKSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShDTEFTU19OQU1FX1NIT1cpO1xuICAgICAgfVxuICAgICAgc3VwZXIuZGlzcG9zZSgpO1xuICAgIH1cbiAgICBpc1Nob3duKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKENMQVNTX05BTUVfU0hPVyk7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZVxuXG4gICAgX21heWJlU2NoZWR1bGVIaWRlKCkge1xuICAgICAgaWYgKCF0aGlzLl9jb25maWcuYXV0b2hpZGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX2hhc01vdXNlSW50ZXJhY3Rpb24gfHwgdGhpcy5faGFzS2V5Ym9hcmRJbnRlcmFjdGlvbikge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl90aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuaGlkZSgpO1xuICAgICAgfSwgdGhpcy5fY29uZmlnLmRlbGF5KTtcbiAgICB9XG4gICAgX29uSW50ZXJhY3Rpb24oZXZlbnQsIGlzSW50ZXJhY3RpbmcpIHtcbiAgICAgIHN3aXRjaCAoZXZlbnQudHlwZSkge1xuICAgICAgICBjYXNlICdtb3VzZW92ZXInOlxuICAgICAgICBjYXNlICdtb3VzZW91dCc6XG4gICAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5faGFzTW91c2VJbnRlcmFjdGlvbiA9IGlzSW50ZXJhY3Rpbmc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIGNhc2UgJ2ZvY3VzaW4nOlxuICAgICAgICBjYXNlICdmb2N1c291dCc6XG4gICAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5faGFzS2V5Ym9hcmRJbnRlcmFjdGlvbiA9IGlzSW50ZXJhY3Rpbmc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaXNJbnRlcmFjdGluZykge1xuICAgICAgICB0aGlzLl9jbGVhclRpbWVvdXQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgbmV4dEVsZW1lbnQgPSBldmVudC5yZWxhdGVkVGFyZ2V0O1xuICAgICAgaWYgKHRoaXMuX2VsZW1lbnQgPT09IG5leHRFbGVtZW50IHx8IHRoaXMuX2VsZW1lbnQuY29udGFpbnMobmV4dEVsZW1lbnQpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX21heWJlU2NoZWR1bGVIaWRlKCk7XG4gICAgfVxuICAgIF9zZXRMaXN0ZW5lcnMoKSB7XG4gICAgICBFdmVudEhhbmRsZXIub24odGhpcy5fZWxlbWVudCwgRVZFTlRfTU9VU0VPVkVSLCBldmVudCA9PiB0aGlzLl9vbkludGVyYWN0aW9uKGV2ZW50LCB0cnVlKSk7XG4gICAgICBFdmVudEhhbmRsZXIub24odGhpcy5fZWxlbWVudCwgRVZFTlRfTU9VU0VPVVQsIGV2ZW50ID0+IHRoaXMuX29uSW50ZXJhY3Rpb24oZXZlbnQsIGZhbHNlKSk7XG4gICAgICBFdmVudEhhbmRsZXIub24odGhpcy5fZWxlbWVudCwgRVZFTlRfRk9DVVNJTiwgZXZlbnQgPT4gdGhpcy5fb25JbnRlcmFjdGlvbihldmVudCwgdHJ1ZSkpO1xuICAgICAgRXZlbnRIYW5kbGVyLm9uKHRoaXMuX2VsZW1lbnQsIEVWRU5UX0ZPQ1VTT1VULCBldmVudCA9PiB0aGlzLl9vbkludGVyYWN0aW9uKGV2ZW50LCBmYWxzZSkpO1xuICAgIH1cbiAgICBfY2xlYXJUaW1lb3V0KCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVvdXQpO1xuICAgICAgdGhpcy5fdGltZW91dCA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gU3RhdGljXG4gICAgc3RhdGljIGpRdWVyeUludGVyZmFjZShjb25maWcpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBkYXRhID0gVG9hc3QuZ2V0T3JDcmVhdGVJbnN0YW5jZSh0aGlzLCBjb25maWcpO1xuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGRhdGFbY29uZmlnXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYE5vIG1ldGhvZCBuYW1lZCBcIiR7Y29uZmlnfVwiYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRhdGFbY29uZmlnXSh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERhdGEgQVBJIGltcGxlbWVudGF0aW9uXG4gICAqL1xuXG4gIGVuYWJsZURpc21pc3NUcmlnZ2VyKFRvYXN0KTtcblxuICAvKipcbiAgICogalF1ZXJ5XG4gICAqL1xuXG4gIGRlZmluZUpRdWVyeVBsdWdpbihUb2FzdCk7XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIEJvb3RzdHJhcCBpbmRleC51bWQuanNcbiAgICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYWluL0xJQ0VOU0UpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG4gIGNvbnN0IGluZGV4X3VtZCA9IHtcbiAgICBBbGVydCxcbiAgICBCdXR0b24sXG4gICAgQ2Fyb3VzZWwsXG4gICAgQ29sbGFwc2UsXG4gICAgRHJvcGRvd24sXG4gICAgTW9kYWwsXG4gICAgT2ZmY2FudmFzLFxuICAgIFBvcG92ZXIsXG4gICAgU2Nyb2xsU3B5LFxuICAgIFRhYixcbiAgICBUb2FzdCxcbiAgICBUb29sdGlwXG4gIH07XG5cbiAgcmV0dXJuIGluZGV4X3VtZDtcblxufSkpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Ym9vdHN0cmFwLmJ1bmRsZS5qcy5tYXBcbiIsICIvLyBodWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy9hcHB3cml0ZS1jbGllbnQuanNcbi8vIE1vZHVsZSBjb21tdW4gcG91ciBsJ2luaXRpYWxpc2F0aW9uIGV0IGxhIGdlc3Rpb24gZHUgY2xpZW50IEFwcHdyaXRlXG4vLyBcdTAwQzl2aXRlIGxhIGR1cGxpY2F0aW9uIGQnaW5pdGlhbGlzYXRpb24gZW50cmUgYXV0aC1zdGF0dXMuanMgZXQgYXV0aEFwcHdyaXRlLmpzXG5cbi8vIC0tLSBDT05GSUdVUkFUSU9OIEFQUFdSSVRFIC0tLVxuY29uc3QgQVBQV1JJVEVfRU5EUE9JTlQgPSBcImh0dHBzOi8vY2xvdWQuYXBwd3JpdGUuaW8vdjFcIjtcbmNvbnN0IEFQUFdSSVRFX1BST0pFQ1RfSUQgPSBcIjY4OTcyNTgyMDAyNGU4MTc4MWI3XCI7XG5jb25zdCBBUFBXUklURV9GVU5DVElPTl9JRCA9IFwiNjg5NzY1MDAwMDJlYjVjNmVlNGZcIjsgLy8gSUQgZGUgbGEgZm9uY3Rpb24gY21zLWF1dGgtZnVuY3Rpb25cbmNvbnN0IEFDQ0VTU19SRVFVRVNUX0ZVTkNUSU9OX0lEID0gXCI2ODljZGVhNTAwMWE0ZDc0NTQ5ZFwiOyAvLyBJRCBkZSBsYSBmb25jdGlvbiBkJ2Vudm9pIGQnZW1haWxcblxuLy8gVmFyaWFibGVzIGdsb2JhbGVzIHBvdXIgbGVzIGNsaWVudHMgQXBwd3JpdGUgKGluaXRpYWxpc1x1MDBFOWVzIHVuZSBzZXVsZSBmb2lzKVxubGV0IGNsaWVudCA9IG51bGw7XG5sZXQgYWNjb3VudCA9IG51bGw7XG5sZXQgZnVuY3Rpb25zID0gbnVsbDtcbmxldCBpbml0aWFsaXphdGlvblByb21pc2UgPSBudWxsO1xuXG4vKipcbiAqIEF0dGVuZCBxdWUgbGUgU0RLIEFwcHdyaXRlIHNvaXQgY2hhcmdcdTAwRTkgZXQgaW5pdGlhbGlzZSBsZXMgY2xpZW50c1xuICogQHJldHVybnMge1Byb21pc2V9IFByb21pc2UgcXVpIHNlIHJcdTAwRTlzb3V0IHF1YW5kIGwnaW5pdGlhbGlzYXRpb24gZXN0IHRlcm1pblx1MDBFOWVcbiAqL1xuZnVuY3Rpb24gd2FpdEZvckFwcHdyaXRlKG1heEF0dGVtcHRzID0gNTAsIGludGVydmFsID0gMTAwKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgbGV0IGF0dGVtcHRzID0gMDtcblxuICAgICAgICBmdW5jdGlvbiBjaGVja0FwcHdyaXRlKCkge1xuICAgICAgICAgICAgYXR0ZW1wdHMrKztcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBWXHUwMEU5cmlmaWNhdGlvbiBTREsgLSB0ZW50YXRpdmUgJHthdHRlbXB0c30vJHttYXhBdHRlbXB0c31gKTtcblxuICAgICAgICAgICAgaWYgKHdpbmRvdy5BcHB3cml0ZSAmJiB3aW5kb3cuQXBwd3JpdGUuQ2xpZW50ICYmIHdpbmRvdy5BcHB3cml0ZS5BY2NvdW50KSB7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBTREsgQXBwd3JpdGUgY2hhcmdcdTAwRTkgYXZlYyBzdWNjXHUwMEU4c1wiKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGF0dGVtcHRzID49IG1heEF0dGVtcHRzKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIltBcHB3cml0ZSBDbGllbnRdIFNESyBBcHB3cml0ZSBub24gY2hhcmdcdTAwRTkgYXByXHUwMEU4cyBsZSBub21icmUgbWF4aW11bSBkZSB0ZW50YXRpdmVzXCIpO1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJMZSBTREsgQXBwd3JpdGUgbidhIHBhcyBwdSBcdTAwRUF0cmUgY2hhcmdcdTAwRTkuXCIpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChjaGVja0FwcHdyaXRlLCBpbnRlcnZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjaGVja0FwcHdyaXRlKCk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogSW5pdGlhbGlzZSBsZXMgY2xpZW50cyBBcHB3cml0ZSAodW5lIHNldWxlIGZvaXMpXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7Y2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnN9Pn0gTGVzIGNsaWVudHMgaW5pdGlhbGlzXHUwMEU5c1xuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplQXBwd3JpdGUoKSB7XG4gICAgLy8gU2kgZFx1MDBFOWpcdTAwRTAgaW5pdGlhbGlzXHUwMEU5LCByZXRvdXJuZXIgbGVzIGNsaWVudHMgZXhpc3RhbnRzXG4gICAgaWYgKGNsaWVudCAmJiBhY2NvdW50ICYmIGZ1bmN0aW9ucykge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIENsaWVudHMgZFx1MDBFOWpcdTAwRTAgaW5pdGlhbGlzXHUwMEU5cywgclx1MDBFOXV0aWxpc2F0aW9uXCIpO1xuICAgICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucyB9O1xuICAgIH1cblxuICAgIC8vIFNpIHVuZSBpbml0aWFsaXNhdGlvbiBlc3QgZW4gY291cnMsIGF0dGVuZHJlIHF1J2VsbGUgc2UgdGVybWluZVxuICAgIGlmIChpbml0aWFsaXphdGlvblByb21pc2UpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBJbml0aWFsaXNhdGlvbiBlbiBjb3VycywgYXR0ZW50ZS4uLlwiKTtcbiAgICAgICAgcmV0dXJuIGluaXRpYWxpemF0aW9uUHJvbWlzZTtcbiAgICB9XG5cbiAgICAvLyBDb21tZW5jZXIgdW5lIG5vdXZlbGxlIGluaXRpYWxpc2F0aW9uXG4gICAgaW5pdGlhbGl6YXRpb25Qcm9taXNlID0gKGFzeW5jICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWJ1dCBkZSBsJ2luaXRpYWxpc2F0aW9uXCIpO1xuXG4gICAgICAgICAgICAvLyBBdHRlbmRyZSBxdWUgbGUgU0RLIHNvaXQgY2hhcmdcdTAwRTlcbiAgICAgICAgICAgIGF3YWl0IHdhaXRGb3JBcHB3cml0ZSgpO1xuXG4gICAgICAgICAgICAvLyBJbml0aWFsaXNlciBsZXMgY2xpZW50c1xuICAgICAgICAgICAgY29uc3QgeyBDbGllbnQsIEFjY291bnQsIEZ1bmN0aW9ucyB9ID0gd2luZG93LkFwcHdyaXRlO1xuXG4gICAgICAgICAgICBjbGllbnQgPSBuZXcgQ2xpZW50KClcbiAgICAgICAgICAgICAgICAuc2V0RW5kcG9pbnQoQVBQV1JJVEVfRU5EUE9JTlQpXG4gICAgICAgICAgICAgICAgLnNldFByb2plY3QoQVBQV1JJVEVfUFJPSkVDVF9JRCk7XG5cbiAgICAgICAgICAgIGFjY291bnQgPSBuZXcgQWNjb3VudChjbGllbnQpO1xuICAgICAgICAgICAgZnVuY3Rpb25zID0gbmV3IEZ1bmN0aW9ucyhjbGllbnQpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIEluaXRpYWxpc2F0aW9uIHRlcm1pblx1MDBFOWUgYXZlYyBzdWNjXHUwMEU4c1wiKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgY2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnMgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsJ2luaXRpYWxpc2F0aW9uOlwiLCBlcnJvcik7XG4gICAgICAgICAgICAvLyBSXHUwMEU5aW5pdGlhbGlzZXIgbGVzIHZhcmlhYmxlcyBlbiBjYXMgZCdlcnJldXJcbiAgICAgICAgICAgIGNsaWVudCA9IG51bGw7XG4gICAgICAgICAgICBhY2NvdW50ID0gbnVsbDtcbiAgICAgICAgICAgIGZ1bmN0aW9ucyA9IG51bGw7XG4gICAgICAgICAgICBpbml0aWFsaXphdGlvblByb21pc2UgPSBudWxsO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgcmV0dXJuIGluaXRpYWxpemF0aW9uUHJvbWlzZTtcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgbGVzIGNsaWVudHMgQXBwd3JpdGUgaW5pdGlhbGlzXHUwMEU5c1xuICogQHJldHVybnMge1Byb21pc2U8e2NsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zfT59IExlcyBjbGllbnRzIEFwcHdyaXRlXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEFwcHdyaXRlQ2xpZW50cygpIHtcbiAgICByZXR1cm4gYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG59XG5cbi8qKlxuICogUlx1MDBFOWN1cFx1MDBFOHJlIHVuaXF1ZW1lbnQgbGUgY2xpZW50IEFjY291bnRcbiAqIEByZXR1cm5zIHtQcm9taXNlPEFjY291bnQ+fSBMZSBjbGllbnQgQWNjb3VudFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRBY2NvdW50KCkge1xuICAgIGNvbnN0IHsgYWNjb3VudCB9ID0gYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBSXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGR1IGNvbXB0ZSBBcHB3cml0ZSByXHUwMEU5dXNzaWVcIiwgYWNjb3VudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltBcHB3cml0ZSBDbGllbnRdIFJcdTAwRTljdXBcdTAwRTlyYXRpb24gZHUgY29tcHRlIEFwcHdyaXRlIFx1MDBFOWNob3VcdTAwRTllXCIpO1xuICAgIH1cbiAgICByZXR1cm4gYWNjb3VudDtcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgdW5pcXVlbWVudCBsZSBjbGllbnQgRnVuY3Rpb25zXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxGdW5jdGlvbnM+fSBMZSBjbGllbnQgRnVuY3Rpb25zXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEZ1bmN0aW9ucygpIHtcbiAgICBjb25zdCB7IGZ1bmN0aW9ucyB9ID0gYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gICAgcmV0dXJuIGZ1bmN0aW9ucztcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgdW5pcXVlbWVudCBsZSBjbGllbnQgVGVhbXNcbiAqIEByZXR1cm5zIHtQcm9taXNlPFRlYW1zPn0gTGUgY2xpZW50IFRlYW1zXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFRlYW1zKCkge1xuICAgIGNvbnN0IHsgQ2xpZW50LCBUZWFtcyB9ID0gd2luZG93LkFwcHdyaXRlO1xuICAgIGlmICghY2xpZW50KSB7XG4gICAgICAgIGF3YWl0IGluaXRpYWxpemVBcHB3cml0ZSgpO1xuICAgIH1cbiAgICBjb25zdCB0ZWFtcyA9IG5ldyBUZWFtcyhjbGllbnQpO1xuICAgIHJldHVybiB0ZWFtcztcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgbGVzIGNvbnN0YW50ZXMgZGUgY29uZmlndXJhdGlvblxuICogQHJldHVybnMge09iamVjdH0gQ29uZmlndXJhdGlvbiBBcHB3cml0ZVxuICovXG5mdW5jdGlvbiBnZXRDb25maWcoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgQVBQV1JJVEVfRU5EUE9JTlQsXG4gICAgICAgIEFQUFdSSVRFX1BST0pFQ1RfSUQsXG4gICAgICAgIEFQUFdSSVRFX0ZVTkNUSU9OX0lELFxuICAgICAgICBBQ0NFU1NfUkVRVUVTVF9GVU5DVElPTl9JRFxuICAgIH07XG59XG5cbi8qKlxuICogVlx1MDBFOXJpZmllIHNpIGxlcyBjbGllbnRzIHNvbnQgZFx1MDBFOWpcdTAwRTAgaW5pdGlhbGlzXHUwMEU5c1xuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgc2kgbGVzIGNsaWVudHMgc29udCBpbml0aWFsaXNcdTAwRTlzXG4gKi9cbmZ1bmN0aW9uIGlzSW5pdGlhbGl6ZWQoKSB7XG4gICAgcmV0dXJuICEhKGNsaWVudCAmJiBhY2NvdW50ICYmIGZ1bmN0aW9ucyk7XG59XG5cbi8qKlxuICogVlx1MDBFOXJpZmllIGwnYXV0aGVudGlmaWNhdGlvbiBDTVMgbG9jYWxlIChzb3VyY2UgZGUgdlx1MDBFOXJpdFx1MDBFOSBwcmluY2lwYWxlKVxuICogQHJldHVybnMge29iamVjdHxudWxsfSBMJ29iamV0IHV0aWxpc2F0ZXVyIHMnaWwgZXN0IHZhbGlkZSwgc2lub24gbnVsbFxuICovXG5mdW5jdGlvbiBnZXRMb2NhbENtc1VzZXIoKSB7XG4gICAgY29uc3QgY21zVXNlciA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzdmVsdGlhLWNtcy51c2VyJyk7XG4gICAgLy8gY29uc29sZS5sb2coJ1x1RDgzRFx1REQwRCBbZ2V0TG9jYWxDbXNVc2VyXSBUb2tlbiBicnV0IGRlcHVpcyBsb2NhbFN0b3JhZ2U6JywgY21zVXNlcik7XG5cbiAgICBpZiAoIWNtc1VzZXIpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1x1MjEzOVx1RkUwRiBbZ2V0TG9jYWxDbXNVc2VyXSBBdWN1biB0b2tlbiBDTVMgZGFucyBsb2NhbFN0b3JhZ2UnKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGFyc2VkVXNlciA9IEpTT04ucGFyc2UoY21zVXNlcik7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdcdUQ4M0RcdUREMEQgW2dldExvY2FsQ21zVXNlcl0gVG9rZW4gcGFyc1x1MDBFOTonLCB7XG4gICAgICAgICAgLy8gICAgIGhhc1Rva2VuOiAhIXBhcnNlZFVzZXIudG9rZW4sXG4gICAgICAgICAgLy8gICAgIHRva2VuVHlwZTogdHlwZW9mIHBhcnNlZFVzZXIudG9rZW4sXG4gICAgICAgICAgLy8gICAgIHRva2VuTGVuZ3RoOiBwYXJzZWRVc2VyLnRva2VuID8gcGFyc2VkVXNlci50b2tlbi5sZW5ndGggOiAwLFxuICAgICAgICAgIC8vICAgICB0b2tlblByZXZpZXc6IHBhcnNlZFVzZXIudG9rZW4gPyBwYXJzZWRVc2VyLnRva2VuLnN1YnN0cmluZygwLCAyMCkgKyAnLi4uJyA6ICdOL0EnLFxuICAgICAgICAgIC8vICAgICBoYXNJZDogISFwYXJzZWRVc2VyLmlkLFxuICAgICAgICAgIC8vICAgICBoYXNFbWFpbDogISFwYXJzZWRVc2VyLmVtYWlsLFxuICAgICAgICAgIC8vICAgICBiYWNrZW5kTmFtZTogcGFyc2VkVXNlci5iYWNrZW5kTmFtZVxuICAgICAgICAvLyB9KTtcblxuICAgICAgICBpZiAocGFyc2VkVXNlci50b2tlbiAmJiB0eXBlb2YgcGFyc2VkVXNlci50b2tlbiA9PT0gJ3N0cmluZycgJiYgcGFyc2VkVXNlci50b2tlbi50cmltKCkgIT09ICcnKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnXHUyNzA1IFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIENNUyB2YWxpZGUnKTtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZWRVc2VyO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ1x1MjZBMFx1RkUwRiBbZ2V0TG9jYWxDbXNVc2VyXSBUb2tlbiBDTVMgaW52YWxpZGUgLSBuZXR0b3lhZ2UnKTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1x1Mjc0QyBbZ2V0TG9jYWxDbXNVc2VyXSBEb25uXHUwMEU5ZXMgQ01TIGNvcnJvbXB1ZXMgZGFucyBsb2NhbFN0b3JhZ2UuIE5ldHRveWFnZS4uLicsIGUpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogVlx1MDBFOXJpZmllIHNpIGwndXRpbGlzYXRldXIgZXN0IGF1dGhlbnRpZmlcdTAwRTkgKGJhc1x1MDBFOSBzdXIgbGUgdG9rZW4gQ01TKVxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgYXV0aGVudGlmaVx1MDBFOVxuICovXG5mdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRDbXMoKSB7XG4gIGNvbnNvbGUubG9nKCdnZXRMb2NhbENtc1VzZXIoKTogJywgZ2V0TG9jYWxDbXNVc2VyKCkgIT09IG51bGwpO1xuICAgIHJldHVybiBnZXRMb2NhbENtc1VzZXIoKSAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkQXBwd3JpdGUoKSB7XG4gIGdldEFjY291bnRcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCdlbWFpbCBkZSBsJ3V0aWxpc2F0ZXVyIGVzdCB2XHUwMEU5cmlmaVx1MDBFOVxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IFRydWUgc2kgbCdlbWFpbCBlc3Qgdlx1MDBFOXJpZmlcdTAwRTlcbiAqL1xuYXN5bmMgZnVuY3Rpb24gaXNFbWFpbFZlcmlmaWVkKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhY2NvdW50LmdldCgpO1xuICAgICAgICByZXR1cm4gdXNlci5lbWFpbFZlcmlmaWNhdGlvbiB8fCBmYWxzZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tBcHB3cml0ZUNsaWVudF0gSW1wb3NzaWJsZSBkZSB2XHUwMEU5cmlmaWVyIGxcXCdcdTAwRTl0YXQgZGUgdlx1MDBFOXJpZmljYXRpb24gZFxcJ2VtYWlsOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuLyoqXG4gKiBFbnZvaWUgdW4gZW1haWwgZGUgdlx1MDBFOXJpZmljYXRpb24gXHUwMEUwIGwndXRpbGlzYXRldXIgY29ubmVjdFx1MDBFOVxuICogQHBhcmFtIHtzdHJpbmd9IHJlZGlyZWN0VVJMIC0gVVJMIHZlcnMgbGFxdWVsbGUgcmVkaXJpZ2VyIGFwclx1MDBFOHMgdlx1MDBFOXJpZmljYXRpb25cbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICovXG5hc3luYyBmdW5jdGlvbiBzZW5kVmVyaWZpY2F0aW9uRW1haWwocmVkaXJlY3RVUkwgPSBudWxsKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgY29uc3QgdmVyaWZpY2F0aW9uVVJMID0gcmVkaXJlY3RVUkwgfHwgYCR7d2luZG93LmxvY2F0aW9uLm9yaWdpbn0vdmVyaWZ5LWVtYWlsYDtcbiAgICAgICAgYXdhaXQgYWNjb3VudC5jcmVhdGVWZXJpZmljYXRpb24odmVyaWZpY2F0aW9uVVJMKTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBcHB3cml0ZUNsaWVudF0gRW1haWwgZGUgdlx1MDBFOXJpZmljYXRpb24gZW52b3lcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbFxcJ2Vudm9pIGRlIGxcXCdlbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbjonLCBlcnJvcik7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgbCdlbWFpbCBhdmVjIGxlcyBwYXJhbVx1MDBFOHRyZXMgZGUgdlx1MDBFOXJpZmljYXRpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSB1c2VySWQgLSBJRCBkZSBsJ3V0aWxpc2F0ZXVyXG4gKiBAcGFyYW0ge3N0cmluZ30gc2VjcmV0IC0gU2VjcmV0IGRlIHZcdTAwRTlyaWZpY2F0aW9uXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn1cbiAqL1xuYXN5bmMgZnVuY3Rpb24gdmVyaWZ5RW1haWwodXNlcklkLCBzZWNyZXQpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgICAgICBhd2FpdCBhY2NvdW50LnVwZGF0ZVZlcmlmaWNhdGlvbih1c2VySWQsIHNlY3JldCk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQXBwd3JpdGVDbGllbnRdIEVtYWlsIHZcdTAwRTlyaWZpXHUwMEU5IGF2ZWMgc3VjY1x1MDBFOHMnKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQXBwd3JpdGVDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHZcdTAwRTlyaWZpY2F0aW9uIGRcXCdlbWFpbDonLCBlcnJvcik7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgbCdcdTAwRTl0YXQgZCdhdXRoZW50aWZpY2F0aW9uIGNvbXBsZXQgZGUgbCd1dGlsaXNhdGV1clxuICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0Pn0gXHUwMEM5dGF0IGQnYXV0aGVudGlmaWNhdGlvbiBhdmVjIHZcdTAwRTlyaWZpY2F0aW9uIGVtYWlsXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEF1dGhlbnRpY2F0aW9uU3RhdGUoKSB7XG4gICAgY29uc3QgY21zVXNlciA9IGdldExvY2FsQ21zVXNlcigpO1xuICAgIGNvbnN0IHVzZXJFbWFpbCA9IGdldFVzZXJFbWFpbCgpO1xuICAgIGNvbnN0IHVzZXJOYW1lID0gZ2V0VXNlck5hbWUoKTtcblxuICAgIGlmICghY21zVXNlcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNBdXRoZW50aWNhdGVkOiBmYWxzZSxcbiAgICAgICAgICAgIGlzRW1haWxWZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICBlbWFpbDogbnVsbCxcbiAgICAgICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgICAgICByZXF1aXJlc0FjdGlvbjogZmFsc2VcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBlbWFpbFZlcmlmaWVkID0gYXdhaXQgaXNFbWFpbFZlcmlmaWVkKCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpc0F1dGhlbnRpY2F0ZWQ6IHRydWUsXG4gICAgICAgICAgICBpc0VtYWlsVmVyaWZpZWQ6IGVtYWlsVmVyaWZpZWQsXG4gICAgICAgICAgICBlbWFpbDogdXNlckVtYWlsLFxuICAgICAgICAgICAgbmFtZTogdXNlck5hbWUsXG4gICAgICAgICAgICByZXF1aXJlc0FjdGlvbjogIWVtYWlsVmVyaWZpZWRcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgclx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkZSBsXFwnXHUwMEU5dGF0IGRcXCdhdXRoZW50aWZpY2F0aW9uOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzQXV0aGVudGljYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgIGlzRW1haWxWZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICBlbWFpbDogdXNlckVtYWlsLFxuICAgICAgICAgICAgbmFtZTogdXNlck5hbWUsXG4gICAgICAgICAgICByZXF1aXJlc0FjdGlvbjogdHJ1ZVxuICAgICAgICB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgbCdlbWFpbCBkZSBsJ3V0aWxpc2F0ZXVyIGRlcHVpcyBsZSBsb2NhbFN0b3JhZ2VcbiAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gTCdlbWFpbCBkZSBsJ3V0aWxpc2F0ZXVyIG91IG51bGxcbiAqL1xuZnVuY3Rpb24gZ2V0VXNlckVtYWlsKCkge1xuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcpO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZSBub20gZGUgbCd1dGlsaXNhdGV1ciBkZXB1aXMgbGUgbG9jYWxTdG9yYWdlXG4gKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IExlIG5vbSBkZSBsJ3V0aWxpc2F0ZXVyIG91IG51bGxcbiAqL1xuZnVuY3Rpb24gZ2V0VXNlck5hbWUoKSB7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhcHB3cml0ZS11c2VyLW5hbWUnKTtcbn1cblxuZnVuY3Rpb24gZ2V0TG9jYWxFbWFpbFZlcmlmaWNhdGlvblN0YXR1cygpIHtcbiAgICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2VtYWlsLXZlcmlmaWNhdGlvbi1zdGF0dXMnKSA7XG59XG5cblxuLyoqXG4gKiBOZXR0b2llIHRvdXRlcyBsZXMgZG9ublx1MDBFOWVzIGQnYXV0aGVudGlmaWNhdGlvbiBsb2NhbGVzXG4gKi9cbmZ1bmN0aW9uIGNsZWFyQXV0aERhdGEoKSB7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhcHB3cml0ZS11c2VyLW5hbWUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1cycpO1xuICAgIC8vIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gRG9ublx1MDBFOWVzIGQnYXV0aGVudGlmaWNhdGlvbiBsb2NhbGVzIG5ldHRveVx1MDBFOWVzXCIpO1xufVxuXG4vKipcbiAqIERcdTAwRTljb25uZXhpb24gZ2xvYmFsZSAtIHN1cHByaW1lIGxhIHNlc3Npb24gQXBwd3JpdGUgZXQgbmV0dG9pZSBsZXMgZG9ublx1MDBFOWVzIGxvY2FsZXNcbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICovXG5hc3luYyBmdW5jdGlvbiBsb2dvdXRHbG9iYWwoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gTmV0dG95ZXIgZCdhYm9yZCBsZXMgZG9ublx1MDBFOWVzIGxvY2FsZXNcbiAgICAgICAgY2xlYXJBdXRoRGF0YSgpO1xuXG4gICAgICAgIC8vIFN1cHByaW1lciBsYSBzZXNzaW9uIEFwcHdyaXRlXG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICAgIGF3YWl0IGFjY291bnQuZGVsZXRlU2Vzc2lvbignY3VycmVudCcpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIERcdTAwRTljb25uZXhpb24gZ2xvYmFsZSByXHUwMEU5dXNzaWVcIik7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFwiW0FwcHdyaXRlIENsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgZFx1MDBFOWNvbm5leGlvbiBBcHB3cml0ZSAocGV1dC1cdTAwRUF0cmUgZFx1MDBFOWpcdTAwRTAgZFx1MDBFOWNvbm5lY3RcdTAwRTkpOlwiLCBlcnJvcik7XG4gICAgfVxufVxuXG4vKipcbiAqIENvbmZpZ3VyZSBsZXMgZG9ublx1MDBFOWVzIGQnYXV0aGVudGlmaWNhdGlvbiBsb2NhbGVzXG4gKiBAcGFyYW0ge3N0cmluZ30gZW1haWwgLSBMJ2VtYWlsIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gTGUgbm9tIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7b2JqZWN0fSBjbXNBdXRoIC0gTCdvYmpldCBkJ2F1dGhlbnRpZmljYXRpb24gQ01TXG4gKi9cbmZ1bmN0aW9uIHNldEF1dGhEYXRhKGVtYWlsLCBuYW1lLCBjbXNBdXRoKSB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2FwcHdyaXRlLXVzZXItZW1haWwnLCBlbWFpbCk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScsIG5hbWUpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzdmVsdGlhLWNtcy51c2VyJywgSlNPTi5zdHJpbmdpZnkoY21zQXV0aCkpO1xufVxuXG4vLyBFeHBvcnQgZGVzIGZvbmN0aW9ucyBwdWJsaXF1ZXNcbmV4cG9ydCB7XG4gICAgZ2V0QXBwd3JpdGVDbGllbnRzLFxuICAgIGdldEFjY291bnQsXG4gICAgZ2V0RnVuY3Rpb25zLFxuICAgIGdldFRlYW1zLFxuICAgIGdldENvbmZpZyxcbiAgICBpc0luaXRpYWxpemVkLFxuICAgIGluaXRpYWxpemVBcHB3cml0ZSxcbiAgICBnZXRMb2NhbENtc1VzZXIsXG4gICAgaXNBdXRoZW50aWNhdGVkQ21zICxcbiAgICBnZXRVc2VyRW1haWwsXG4gICAgZ2V0VXNlck5hbWUsXG4gICAgY2xlYXJBdXRoRGF0YSxcbiAgICBzZXRBdXRoRGF0YSxcbiAgICBsb2dvdXRHbG9iYWwsXG4gICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgIHNlbmRWZXJpZmljYXRpb25FbWFpbCxcbiAgICB2ZXJpZnlFbWFpbCxcbiAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzXG59O1xuXG5cbi8vIEV4cG9zaXRpb24gZ2xvYmFsZSBwb3VyIGNvbXBhdGliaWxpdFx1MDBFOSBhdmVjIGxlcyBzY3JpcHRzIG5vbi1tb2R1bGVcbmlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5BcHB3cml0ZUNsaWVudCA9IHtcbiAgICAgICAgZ2V0QXBwd3JpdGVDbGllbnRzLFxuICAgICAgICBnZXRBY2NvdW50LFxuICAgICAgICBnZXRGdW5jdGlvbnMsXG4gICAgICAgIGdldFRlYW1zLFxuICAgICAgICBnZXRDb25maWcsXG4gICAgICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgICAgIGluaXRpYWxpemVBcHB3cml0ZSxcbiAgICAgICAgZ2V0TG9jYWxDbXNVc2VyLFxuICAgICAgICBpc0F1dGhlbnRpY2F0ZWRDbXMsXG4gICAgICAgIGdldFVzZXJFbWFpbCxcbiAgICAgICAgZ2V0VXNlck5hbWUsXG4gICAgICAgIGNsZWFyQXV0aERhdGEsXG4gICAgICAgIHNldEF1dGhEYXRhLFxuICAgICAgICBsb2dvdXRHbG9iYWwsXG4gICAgICAgIGlzRW1haWxWZXJpZmllZCxcbiAgICAgICAgc2VuZFZlcmlmaWNhdGlvbkVtYWlsLFxuICAgICAgICB2ZXJpZnlFbWFpbCxcbiAgICAgICAgZ2V0TG9jYWxFbWFpbFZlcmlmaWNhdGlvblN0YXR1c1xuICAgIH07XG59XG4iLCAiLy8gaHVnby1jb29rYm9vay10aGVtZS9hc3NldHMvanMvYXBwLmpzXG4vLyBDZSBmaWNoaWVyIGVzdCBsZSBwb2ludCBkJ2VudHJcdTAwRTllIEphdmFTY3JpcHQgcHJpbmNpcGFsIHBvdXIgbGUgdGhcdTAwRThtZS5cbi8vIElsIGVzdCByZXNwb25zYWJsZSBkZSBsJ2luaXRpYWxpc2F0aW9uIGRlcyBzY3JpcHRzIGdsb2JhdXggZXQgZGVzIGJpYmxpb3RoXHUwMEU4cXVlcy5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBJbXBvcnRlciBhcHB3cml0ZS1jbGllbnQgc2V1bGVtZW50IHNpIG9uIG4nZXN0IHBhcyBzdXIgbGEgcGFnZSBkZSBsb2dpblxuLy8gcG91ciBcdTAwRTl2aXRlciBsZXMgY29uZmxpdHMgYXZlYyBhdXRoQXBwd3JpdGUuanNcbmlmICh3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvbG9naW4vJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvbG9naW4nKSB7XG4gIGltcG9ydCgnLi9hcHB3cml0ZS1jbGllbnQuanMnKTtcbn1cblxuaW1wb3J0IGJvb3RzdHJhcCBmcm9tICdqcy9ib290c3RyYXAuYnVuZGxlLmpzJztcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFLQSxPQUFDLFNBQVUsUUFBUSxTQUFTO0FBQzFCLGVBQU8sWUFBWSxZQUFZLE9BQU8sV0FBVyxjQUFjLE9BQU8sVUFBVSxRQUFRLElBQ3hGLE9BQU8sV0FBVyxjQUFjLE9BQU8sTUFBTSxPQUFPLE9BQU8sS0FDMUQsU0FBUyxPQUFPLGVBQWUsY0FBYyxhQUFhLFVBQVUsTUFBTSxPQUFPLFlBQVksUUFBUTtBQUFBLE1BQ3hHLEdBQUcsVUFBTyxXQUFZO0FBQUU7QUFhdEIsY0FBTSxhQUFhLG9CQUFJLElBQUk7QUFDM0IsY0FBTSxPQUFPO0FBQUEsVUFDWCxJQUFJLFNBQVMsS0FBSyxVQUFVO0FBQzFCLGdCQUFJLENBQUMsV0FBVyxJQUFJLE9BQU8sR0FBRztBQUM1Qix5QkFBVyxJQUFJLFNBQVMsb0JBQUksSUFBSSxDQUFDO0FBQUEsWUFDbkM7QUFDQSxrQkFBTSxjQUFjLFdBQVcsSUFBSSxPQUFPO0FBSTFDLGdCQUFJLENBQUMsWUFBWSxJQUFJLEdBQUcsS0FBSyxZQUFZLFNBQVMsR0FBRztBQUVuRCxzQkFBUSxN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O0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0o7QUFBQSxNQUNKO0FBQUE7QUFBQTs7O0FDN1lBLGdDQUFzQjtBQUp0QixNQUFJLE9BQU8sU0FBUyxhQUFhLGFBQWEsT0FBTyxTQUFTLGFBQWEsVUFBVTtBQUNuRjtBQUFBLEVBQ0Y7IiwKICAibmFtZXMiOiBbImNhbGxiYWNrIiwgImZuIiwgIm9yZGVyIiwgIm5hbWUiLCAic3R5bGUiLCAid2luZG93IiwgIm1pbiIsICJtYXgiLCAidG9QYWRkaW5nT2JqZWN0IiwgInBvcHBlck9mZnNldHMiLCAib2Zmc2V0IiwgInBvcHBlciIsICJjbGlwcGluZ1BhcmVudHMiLCAicmVmZXJlbmNlIiwgInBsYWNlbWVudCIsICJwbGFjZW1lbnRzIiwgIl9sb29wIiwgIl9pIiwgImNoZWNrcyIsICJtZXJnZWQiLCAiZGVmYXVsdE1vZGlmaWVycyIsICJjcmVhdGVQb3BwZXIiLCAib3B0aW9ucyIsICJzdGF0ZSIsICJlZmZlY3QiLCAibm9vcEZuIiwgImlzVmlzaWJsZSIsICJlbGVtZW50IiwgImFjY291bnQiLCAiZnVuY3Rpb25zIl0KfQo=
