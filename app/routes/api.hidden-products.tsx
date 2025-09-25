import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Allow CORS for theme access
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Content-Type": "application/json",
    };
    
    // Try to authenticate the request
    const { admin } = await authenticate.admin(request);
    
    // Fetch all hidden products
    const response = await admin.graphql(
      `#graphql
        query getHiddenProducts {
          products(first: 250, query: "metafield:visibility_manager.hidden:true") {
            edges {
              node {
                id
                handle
              }
            }
          }
        }`
    );
    
    const responseJson = await response.json();
    const hiddenProducts = responseJson.data?.products?.edges?.map((edge: any) => ({
      id: edge.node.id.replace("gid://shopify/Product/", ""),
      handle: edge.node.handle,
    })) || [];
    
    return json(
      { 
        success: true,
        hiddenProducts,
        count: hiddenProducts.length 
      },
      { headers }
    );
    
  } catch (error) {
    // If authentication fails, try to get shop domain from referrer
    const referrer = request.headers.get("referer");
    
    // Return empty array if we can't authenticate
    return json(
      { 
        success: false,
        hiddenProducts: [],
        count: 0,
        error: "Unable to fetch hidden products"
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Content-Type": "application/json",
        }
      }
    );
  }
};
