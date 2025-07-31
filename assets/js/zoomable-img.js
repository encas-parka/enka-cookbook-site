// Inspired by Medium image zoom animation

let isOpen = false

let overlay

function createOverlay() {
  overlay = document.createElement('zoomable-image-overlay')
  document.body.appendChild(overlay)
}

class ZoomableImageOverlay extends HTMLElement {
  connectedCallback() {
    const style = document.createElement('style')
    style.textContent = ZoomableImageOverlay.style

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.appendChild(style)
  }

  show() {
    this.setAttribute('shown', '')
  }

  hide() {
    this.removeAttribute('shown')
  }

  static get style() {
    return `
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 1048;
        background: rgba(100, 100, 100, 0.8);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        width: 100%;
        height: 100%;
        opacity: 0;
        pointer-events: none;
        transition: 0.2s ease opacity;
      }

      :host([shown]) {
        cursor: zoom-out;
        opacity: 1;
        pointer-events: all;
      }
    `
  }
}

class ZoomableImage extends HTMLElement {
  isOpen = false
  connectedCallback() {
    this.image = this.querySelector('img')
    overlay.addEventListener('click', this.close.bind(this))
    window.addEventListener('scroll', this.close.bind(this))

    const style = document.createElement('style')
    style.textContent = ZoomableImage.style

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.appendChild(style)
    shadow.appendChild(this.image)

    this.addEventListener('click', this.toggle.bind(this))
    window.addEventListener('resize', this.updateTransform.bind(this))
  }

  toggle() {
    if (isOpen) {
      this.close()
      return
    }
    isOpen = true
    this.isOpen = true
    overlay.show()
    this.setAttribute('open', '')
    this.image.style.zIndex = '1049'
    this.originalImageRect = this.image.getBoundingClientRect()
    this.updateTransform()
  }

  updateTransform() {
    if (!this.isOpen) return
    const wrapperRect = this.getBoundingClientRect()
    const imageMaxWidth = this.image.naturalWidth
    const imageMaxHeight = this.image.naturalHeight
    const fullWidth = Math.min(window.innerWidth, imageMaxWidth)
    const fullHeight = Math.min(window.innerHeight, imageMaxHeight)
    const scaleX = fullWidth / this.originalImageRect.width
    const scaleY = fullHeight / this.originalImageRect.height
    const scale = Math.min(scaleX, scaleY)
    const translateX =
      -wrapperRect.left +
      (window.innerWidth - this.originalImageRect.width * scale) / 2
    const translateY =
      -wrapperRect.top +
      (window.innerHeight - this.originalImageRect.height * scale) / 2
    this.image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
  }

  close() {
    if (!this.isOpen) return
    this.isOpen = false
    isOpen = false
    this.removeAttribute('open')
    const onTransitionEnd = () => {
      this.image.style.zIndex = ''
      this.image.removeEventListener('transitionend', onTransitionEnd)
    }
    this.image.addEventListener('transitionend', onTransitionEnd)
    this.image.style.transform = 'none'
    overlay.hide()
  }

  static get style() {
    return `
      :host {
        display: flex;
        justify-content: flex-start;
        align-items: flex-start;
        cursor: zoom-in;
      }
      :host([open]) {
        cursor: zoom-out;
      }
      img {
        width: 100%;
        transition: transform 300ms cubic-bezier(0.2, 0, 0.2, 1);
        transform-origin: left top;
      }
    `
  }
}

createOverlay()

customElements.define('zoomable-image', ZoomableImage)
customElements.define('zoomable-image-overlay', ZoomableImageOverlay)