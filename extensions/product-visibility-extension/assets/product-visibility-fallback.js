// Product Visibility Manager - Fallback Script
// This script works without Liquid injection for better compatibility
(function() {
  'use strict';
  
  console.log('[PVM] Product Visibility Manager fallback script loading...');
  
  // Configuration
  const CONFIG = {
    namespace: 'visibility_manager',
    key: 'hidden',
    apiEndpoint: '/apps/product-visibility/api/hidden-products',
    blurAmount: 8,
    overlayText: 'VIP Members Only',
    buttonText: 'Get VIP Access', 
    buttonUrl: '/pages/vip-membership',
    icon: '🔒',
    badgeText: 'VIP ONLY'
  };
  
  // Store for hidden products
  const hiddenProducts = new Set();
  
  // Try to fetch hidden products from your app's API
  async function fetchHiddenProducts() {
    try {
      // First, try to get the shop domain
      const shopDomain = window.Shopify?.shop || window.location.hostname;
      
      // Try to fetch from your app's API endpoint
      const response = await fetch(CONFIG.apiEndpoint, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.hiddenProducts && Array.isArray(data.hiddenProducts)) {
          data.hiddenProducts.forEach(product => {
            hiddenProducts.add(product.id);
            hiddenProducts.add(product.handle);
          });
          console.log(`[PVM] Loaded ${data.hiddenProducts.length} hidden products from API`);
          return true;
        }
      }
    } catch (error) {
      console.log('[PVM] Could not fetch from API, using alternative method');
    }
    
    return false;
  }
  
  // Check if product should be hidden by examining the page
  function checkProductPage() {
    // If we're on a product page, check if it should be hidden
    if (window.location.pathname.includes('/products/')) {
      // Try to get product data from various sources
      
      // Method 1: ShopifyAnalytics
      if (window.ShopifyAnalytics?.meta?.product) {
        const product = window.ShopifyAnalytics.meta.product;
        console.log('[PVM] Found product data:', product);
        
        // Check if product has the hidden metafield
        // This would need to be exposed by your theme
        if (window.__productMetafields?.[CONFIG.namespace]?.[CONFIG.key] === true) {
          hideProductPage();
        }
      }
      
      // Method 2: Check for meta tags
      const metaProduct = document.querySelector('meta[property="og:product"]');
      if (metaProduct) {
        // Product page detected
        checkMetafieldsInDOM();
      }
    }
  }
  
  // Check DOM for metafield data
  function checkMetafieldsInDOM() {
    // Look for script tags that might contain product data
    const scripts = document.querySelectorAll('script[type="application/json"]');
    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data.product?.metafields?.[CONFIG.namespace]?.[CONFIG.key] === true) {
          hideProductPage();
        }
      } catch (e) {}
    });
  }
  
  // Hide the entire product page
  function hideProductPage() {
    console.log('[PVM] Hiding product page');
    
    const productSection = document.querySelector('.product, .product-section, main[role="main"]');
    if (productSection) {
      productSection.style.filter = `blur(${CONFIG.blurAmount}px)`;
      productSection.style.opacity = '0.4';
      productSection.style.pointerEvents = 'none';
      
      // Add overlay
      const overlay = createOverlay();
      productSection.parentElement.insertBefore(overlay, productSection);
    }
  }
  
  // Create overlay element
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 10px;
      text-align: center;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      max-width: 400px;
    `;
    
    overlay.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 15px;">${CONFIG.icon}</div>
      <h2 style="margin: 0 0 15px 0; color: #333;">${CONFIG.overlayText}</h2>
      <p style="color: #666; margin-bottom: 20px;">This product is exclusively available to VIP members.</p>
      <a href="${CONFIG.buttonUrl}" style="
        display: inline-block;
        background: #000;
        color: white;
        padding: 12px 30px;
        border-radius: 5px;
        text-decoration: none;
        font-weight: 600;
      ">${CONFIG.buttonText}</a>
    `;
    
    return overlay;
  }
  
  // Find and hide product cards in collections
  function hideProductCards() {
    let hiddenCount = 0;
    
    // Find all product cards
    const productSelectors = [
      'a[href*="/products/"]',
      '[data-product-handle]',
      '[data-product-id]',
      '.product-card',
      '.product-item'
    ];
    
    productSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        // Skip if already processed
        if (element.hasAttribute('data-pvm-processed')) return;
        
        let shouldHide = false;
        let productIdentifier = '';
        
        // Check links
        const link = element.tagName === 'A' ? element : element.querySelector('a[href*="/products/"]');
        if (link) {
          const href = link.getAttribute('href');
          const match = href?.match(/\/products\/([^\/\?#]+)/);
          if (match) {
            productIdentifier = match[1];
            shouldHide = hiddenProducts.has(productIdentifier);
          }
        }
        
        // Check data attributes
        if (!shouldHide) {
          const productId = element.getAttribute('data-product-id');
          const productHandle = element.getAttribute('data-product-handle');
          
          if (productId && hiddenProducts.has(productId)) {
            shouldHide = true;
            productIdentifier = productId;
          } else if (productHandle && hiddenProducts.has(productHandle)) {
            shouldHide = true;
            productIdentifier = productHandle;
          }
        }
        
        if (shouldHide) {
          console.log(`[PVM] Hiding product: ${productIdentifier}`);
          applyHidingEffect(element);
          hiddenCount++;
        }
        
        element.setAttribute('data-pvm-processed', 'true');
      });
    });
    
    if (hiddenCount > 0) {
      console.log(`[PVM] Hidden ${hiddenCount} products`);
    }
  }
  
  // Apply hiding effect to element
  function applyHidingEffect(element) {
    // Find the container
    let container = element;
    
    if (element.tagName === 'A') {
      // Find parent that contains the whole product card
      let parent = element.parentElement;
      let levels = 0;
      while (parent && levels < 5) {
        if (parent.classList.contains('grid__item') ||
            parent.classList.contains('product-item') ||
            parent.classList.contains('card') ||
            parent.tagName === 'LI' ||
            parent.tagName === 'ARTICLE') {
          container = parent;
          break;
        }
        parent = parent.parentElement;
        levels++;
      }
    }
    
    // Apply styles
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    
    // Blur content
    const children = container.querySelectorAll('*:not(.pvm-overlay-simple)');
    children.forEach(child => {
      child.style.filter = `blur(${CONFIG.blurAmount}px)`;
      child.style.opacity = '0.4';
      child.style.pointerEvents = 'none';
    });
    
    // Add simple overlay
    const overlay = document.createElement('div');
    overlay.className = 'pvm-overlay-simple';
    overlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      z-index: 10;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      min-width: 200px;
    `;
    
    overlay.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 10px;">${CONFIG.icon}</div>
      <div style="font-weight: 600; color: #333; margin-bottom: 10px;">${CONFIG.overlayText}</div>
      <a href="${CONFIG.buttonUrl}" style="
        display: inline-block;
        background: #000;
        color: white;
        padding: 8px 20px;
        border-radius: 4px;
        text-decoration: none;
        font-size: 14px;
      ">${CONFIG.buttonText}</a>
    `;
    
    container.appendChild(overlay);
    
    // Add badge
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: #FFD700;
      color: #000;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      z-index: 11;
    `;
    badge.textContent = CONFIG.badgeText;
    container.appendChild(badge);
    
    // Disable all links and buttons
    container.querySelectorAll('a, button').forEach(el => {
      if (!el.closest('.pvm-overlay-simple')) {
        el.style.pointerEvents = 'none';
        el.style.cursor = 'not-allowed';
        if (el.tagName === 'A') {
          el.removeAttribute('href');
        }
      }
    });
  }
  
  // Initialize
  async function init() {
    console.log('[PVM] Initializing...');
    
    // Try to fetch hidden products
    const hasApiData = await fetchHiddenProducts();
    
    // Check if we're on a product page
    checkProductPage();
    
    // Hide product cards if we have data
    if (hasApiData || hiddenProducts.size > 0) {
      hideProductCards();
    }
    
    // Set up mutation observer for dynamic content
    const observer = new MutationObserver(() => {
      clearTimeout(window.pvmDebounce);
      window.pvmDebounce = setTimeout(() => {
        if (hiddenProducts.size > 0) {
          hideProductCards();
        }
      }, 200);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Also run on window load
  window.addEventListener('load', () => {
    setTimeout(init, 500);
  });
  
  // Expose for debugging
  window.PVMFallback = {
    hiddenProducts: hiddenProducts,
    addHiddenProduct: (id) => {
      hiddenProducts.add(id);
      hideProductCards();
    },
    refresh: hideProductCards,
    config: CONFIG
  };
  
})();
