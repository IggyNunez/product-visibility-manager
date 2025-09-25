# Product Visibility Manager - Setup Guide

## Installation & Setup

### Step 1: Deploy the App
Run the following command to deploy your app:
```bash
npm run deploy
```

### Step 2: Install the App on Your Store
1. Install the app on your development store
2. Make sure the app has the necessary permissions (read_products, write_products)

### Step 3: Activate the Theme Extension
This is the most important step!

1. Go to your Shopify Admin > Online Store > Themes
2. Click "Customize" on your current theme
3. In the theme customizer, click on "App embeds" in the left sidebar
4. Look for "Product Visibility Manager" and toggle it ON
5. Configure the settings:
   - Enable Product Hiding: ON
   - Icon: 🔒 (or your preferred emoji)
   - Message: "VIP Members Only" (or your custom message)
   - Button Text: "Get VIP Access"
   - Button URL: "/pages/vip-membership" (or your page)
   - Blur Amount: 8px
   - Show Badge: ON
   - Badge Text: "VIP ONLY"
6. Click "Save"

### Step 4: Mark Products as Hidden
1. Go to your app admin page (Apps > Product Visibility Manager)
2. Use the product list to toggle products as hidden/visible
3. Products marked as hidden will be blurred on your storefront

## How It Works

The app uses Shopify metafields to mark products as hidden:
- **Namespace**: `visibility_manager`
- **Key**: `hidden`
- **Value**: `true` or `false`

The theme extension then reads these metafields and applies visual effects to hide/blur the products on your storefront.

## Troubleshooting

### Products Not Hiding?

1. **Check Theme Extension is Activated**
   - Go to Theme Customizer > App embeds
   - Make sure "Product Visibility Manager" is toggled ON
   - Save the theme

2. **Check Product Metafields**
   - In the app, verify products show as "Hidden"
   - You can also check in Shopify Admin > Products > [Product] > Metafields

3. **Clear Cache**
   - Clear your browser cache
   - Try in an incognito window
   - Shopify may cache theme assets

4. **Check Browser Console**
   - Open browser developer tools (F12)
   - Look for console messages starting with `[PVM]`
   - Should see: `[PVM] Product Visibility Manager initializing...`
   - Should see: `[PVM] Found X hidden product identifiers`

5. **Theme Compatibility**
   - The app works with most themes but may need adjustments for custom themes
   - The app looks for common product selectors:
     - Links containing `/products/`
     - Elements with `data-product-id` or `data-product-handle`
     - Common classes like `.product-card`, `.product-item`, `.grid__item`

### Manual Testing

You can test the hiding functionality in the browser console:

```javascript
// Check if the app is loaded
console.log(window.PVM);

// See list of hidden products
console.log(window.PVM.hiddenProducts);

// Manually trigger product processing
window.PVM.processProducts();

// Add a product to hidden list (by handle)
window.PVM.hiddenProducts.push('your-product-handle');
window.PVM.processProducts();
```

### Alternative Installation Method

If the app embed doesn't work with your theme, you can manually add the code:

1. Go to Online Store > Themes > Edit code
2. In `layout/theme.liquid`, add before `</body>`:

```liquid
<!-- Product Visibility Manager -->
{% comment %} Load hidden products {% endcomment %}
<script>
  window.hiddenProductHandles = [
    {% for product in collections.all.products limit: 250 %}
      {% if product.metafields.visibility_manager.hidden == true %}
        '{{ product.handle }}',
      {% endif %}
    {% endfor %}
  ];
</script>
{{ 'product-visibility-fallback.js' | asset_url | script_tag }}
{{ 'product-visibility-global.css' | asset_url | stylesheet_tag }}
```

3. Upload the CSS and JS files from `/extensions/product-visibility-extension/assets/` to your theme's Assets folder

## Support

If you continue to have issues:
1. Check that products have the correct metafields set
2. Ensure the theme extension is activated
3. Try the fallback JavaScript file
4. Check for JavaScript errors in the browser console
5. Verify your theme structure matches common Shopify patterns
