// Product Visibility Manager - Global Script
// Automatically loads on all pages and manages product visibility
(function() {
  'use strict';
  
  console.log('Product Visibility Manager: Global script initializing...');
  
  // Configuration - customize these as needed
  const CONFIG = {
    enabled: true,
    hideCompletely: false, // false = blur, true = hide
    blurAmount: 8,
    overlayText: 'VIP Members Only',
    buttonText: 'Get VIP Access',
    buttonUrl: '/pages/vip-membership', 
    iconEmoji: '🔒',
    showBadge: true,
    badgeText: 'VIP ONLY',
    namespace: 'visibility_manager',
    metafieldKey: 'hidden'
  };
  
  // Store of hidden products (will be populated from page data)
  let hiddenProducts = new Set();
  
  // Function to extract hidden products from Shopify data
  function extractHiddenProducts() {
    // Method 1: Check if products are in the page's JavaScript objects
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.products) {
      window.ShopifyAnalytics.meta.products.forEach(product => {
        // This would need the metafield data to be available
        console.log('Found product in analytics:', product);
      });
    }
    
    // Method 2: Check product cards for data attributes
    // Many themes include product data as attributes
    document.querySelectorAll('[data-product-id], [data-product-handle]').forEach(element => {
      const productData = element.dataset;
      // Check if element has visibility data
      if (element.dataset.productMetafields) {
        try {
          const metafields = JSON.parse(element.dataset.productMetafields);
          if (metafields[CONFIG.namespace] && metafields[CONFIG.namespace][CONFIG.metafieldKey] === 'true') {
            hiddenProducts.add(productData.productId || productData.productHandle);
          }
        } catch (e) {}
      }
    });
    
    // Method 3: Check for Liquid-injected data
    // Look for script tags that might contain product data
    const dataScript = document.getElementById('product-visibility-data');
    if (dataScript) {
      try {
        const data = JSON.parse(dataScript.textContent);
        Object.keys(data).forEach(key => {
          if (key !== 'initialized' && data[key] === true) {
            hiddenProducts.add(key);
          }
        });
      } catch (e) {
        console.error('Error parsing product visibility data:', e);
      }
    }
    
    // Method 4: Make AJAX call to get product metafields
    // This requires your app to expose an endpoint
    fetchHiddenProductsFromAPI();
  }
  
  // Fetch hidden products from your app's API
  function fetchHiddenProductsFromAPI() {
    // Check if we have an API endpoint available
    if (window.productVisibilityAPIEndpoint) {
      fetch(window.productVisibilityAPIEndpoint)
        .then(response => response.json())
        .then(data => {
          data.hiddenProducts.forEach(productId => {
            hiddenProducts.add(productId);
          });
          // Re-run restriction after getting data
          restrictProducts();
        })
        .catch(err => console.error('Error fetching hidden products:', err));
    }
  }
  
  // Main function to restrict products
  function restrictProducts() {
    if (!CONFIG.enabled) return;
    
    console.log('Restricting products. Hidden count:', hiddenProducts.size);
    
    // Define all possible product selectors
    const productSelectors = [
      '.product-card',
      '.product-item',
      '.grid__item',
      '.card--product',
      '.product-grid-item',
      'article.product',
      '.collection-product',
      '[data-product-card]',
      '.product-tile',
      '.product-block'
    ];
    
    // Find all product elements
    productSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        // Try to identify the product
        const productId = identifyProduct(element);
        
        if (productId && shouldBeHidden(productId)) {
          if (CONFIG.hideCompletely) {
            element.style.display = 'none';
          } else {
            applyBlurEffect(element);
          }
        }
      });
    });
    
    // Also check for products by link
    hiddenProducts.forEach(productId => {
      // Find products by their links
      const linkSelectors = [
        `a[href*="/products/${productId}"]`,
        `[data-product-id="${productId}"]`,
        `[data-product-handle="${productId}"]`,
        `#product-${productId}`,
        `.product-${productId}`
      ];
      
      linkSelectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(element => {
            const productElement = findProductContainer(element);
            if (productElement && !productElement.classList.contains('product-visibility-restricted')) {
              if (CONFIG.hideCompletely) {
                productElement.style.display = 'none';
              } else {
                applyBlurEffect(productElement);
              }
            }
          });
        } catch (e) {}
      });
    });
  }
  
  // Identify product from element
  function identifyProduct(element) {
    // Check data attributes
    if (element.dataset.productId) return element.dataset.productId;
    if (element.dataset.productHandle) return element.dataset.productHandle;
    
    // Check for product link
    const link = element.querySelector('a[href*="/products/"]');
    if (link) {
      const match = link.href.match(/\/products\/([^\/\?#]+)/);
      if (match) return match[1];
    }
    
    // Check ID attribute
    if (element.id) {
      const match = element.id.match(/product[_-]?(\d+)/i);
      if (match) return match[1];
    }
    
    return null;
  }
  
  // Check if product should be hidden
  function shouldBeHidden(productId) {
    // Check various formats
    return hiddenProducts.has(productId) ||
           hiddenProducts.has(String(productId)) ||
           hiddenProducts.has(`gid://shopify/Product/${productId}`) ||
           Array.from(hiddenProducts).some(id => 
             id.includes(productId) || productId.includes(id)
           );
  }
  
  // Find the product container element
  function findProductContainer(element) {
    const containerSelectors = [
      '.grid__item',
      '.product-item',
      '.product-card',
      '.card--product',
      'article',
      'li'
    ];
    
    for (let selector of containerSelectors) {
      const container = element.closest(selector);
      if (container) return container;
    }
    
    return element;
  }
  
  // Apply blur effect to product
  function applyBlurEffect(element) {
    if (element.classList.contains('product-visibility-restricted')) {
      return; // Already processed
    }
    
    element.classList.add('product-visibility-restricted');
    
    // Create protection wrapper
    const protectionWrapper = document.createElement('div');
    protectionWrapper.className = 'visibility-protection-wrapper';
    
    // Create click blocker
    const clickBlocker = document.createElement('div');
    clickBlocker.className = 'visibility-click-blocker';
    protectionWrapper.appendChild(clickBlocker);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'visibility-overlay';
    
    let overlayHTML = '<div class="visibility-overlay-content">';
    
    if (CONFIG.iconEmoji) {
      overlayHTML += `<div class="visibility-overlay-icon">${CONFIG.iconEmoji}</div>`;
    }
    
    if (CONFIG.overlayText) {
      overlayHTML += `<p class="visibility-overlay-message">${CONFIG.overlayText}</p>`;
    }
    
    if (CONFIG.buttonText && CONFIG.buttonUrl) {
      overlayHTML += `<a href="${CONFIG.buttonUrl}" class="visibility-overlay-link">${CONFIG.buttonText}</a>`;
    }
    
    overlayHTML += '</div>';
    overlay.innerHTML = overlayHTML;
    protectionWrapper.appendChild(overlay);
    
    element.appendChild(protectionWrapper);
    
    // Add VIP badge
    if (CONFIG.showBadge && CONFIG.badgeText) {
      const badge = document.createElement('div');
      badge.className = 'visibility-vip-badge';
      badge.textContent = CONFIG.badgeText;
      element.appendChild(badge);
    }
    
    // Disable original links
    const originalLinks = element.querySelectorAll('a:not(.visibility-overlay-link)');
    originalLinks.forEach(link => {
      if (link.href) {
        link.setAttribute('data-original-href', link.href);
        link.removeAttribute('href');
      }
      link.style.pointerEvents = 'none';
      link.onclick = (e) => {
        e.preventDefault();
        return false;
      };
    });
    
    // Disable buttons
    element.querySelectorAll('button').forEach(button => {
      button.disabled = true;
      button.style.pointerEvents = 'none';
    });
    
    // Block right-click
    element.addEventListener('contextmenu', (e) => {
      if (!e.target.classList.contains('visibility-overlay-link')) {
        e.preventDefault();
      }
    });
  }
  
  // Initialize when DOM is ready
  function initialize() {
    extractHiddenProducts();
    restrictProducts();
    
    // Set up mutation observer for dynamic content
    const observer = new MutationObserver(() => {
      setTimeout(restrictProducts, 100);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Re-run periodically to catch AJAX content
    setInterval(restrictProducts, 3000);
  }
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // Also run on window load
  window.addEventListener('load', () => {
    setTimeout(initialize, 500);
  });
  
  // Expose global function for manual triggering
  window.ProductVisibilityManager = {
    refresh: restrictProducts,
    addHiddenProduct: (productId) => {
      hiddenProducts.add(productId);
      restrictProducts();
    },
    removeHiddenProduct: (productId) => {
      hiddenProducts.delete(productId);
      restrictProducts();
    },
    setHiddenProducts: (products) => {
      hiddenProducts = new Set(products);
      restrictProducts();
    },
    getHiddenProducts: () => Array.from(hiddenProducts),
    config: CONFIG
  };
  
})();