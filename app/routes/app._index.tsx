import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  IndexTable,
  Thumbnail,
  Text,
  Badge,
  useIndexResourceState,
  Filters,
  ChoiceList,
  EmptyState,
  BlockStack,
  InlineStack,
  Box,
  Pagination,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

interface Product {
  id: string;
  title: string;
  handle: string;
  status: string;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  isHidden: boolean;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search") || "";
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "forward";
  const visibilityFilter = url.searchParams.get("visibility") || "all";
  const limit = 20;

  try {
    // Build the query string for GraphQL
    let queryParts = [];
    if (searchTerm) {
      queryParts.push(`title:*${searchTerm}*`);
    }
    
    // Note: Shopify doesn't support filtering by metafield values directly in the query
    // We'll need to filter on the client side for now
    const queryString = queryParts.join(" AND ") || null;
    
    const response = await admin.graphql(
      `#graphql
        query getProducts($first: Int, $last: Int, $query: String, $after: String, $before: String) {
          products(
            first: $first,
            last: $last,
            query: $query,
            after: $after,
            before: $before,
            sortKey: UPDATED_AT,
            reverse: true
          ) {
            edges {
              cursor
              node {
                id
                title
                handle
                status
                featuredImage {
                  url(transform: {maxWidth: 50, maxHeight: 50})
                  altText
                }
                metafield(namespace: "visibility_manager", key: "hidden") {
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }`,
      {
        variables: direction === "backward" 
          ? {
              last: limit,
              before: cursor,
              query: queryString,
            }
          : {
              first: limit,
              after: cursor,
              query: queryString,
            },
      },
    );

    const responseJson = await response.json();
    
    const products: Product[] = responseJson.data?.products?.edges?.map((edge: any) => {
      const product = edge.node;
      
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        featuredImage: product.featuredImage,
        isHidden: product.metafield?.value === "true",
      };
    }) || [];
    
    // Filter by visibility if needed (client-side filtering)
    let filteredProducts = products;
    if (visibilityFilter === "hidden") {
      filteredProducts = products.filter(p => p.isHidden);
    } else if (visibilityFilter === "visible") {
      filteredProducts = products.filter(p => !p.isHidden);
    }
    
    const pageInfo = responseJson.data?.products?.pageInfo || {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    };

    return json({ 
      products: filteredProducts, 
      pageInfo,
      searchTerm,
      visibilityFilter,
    });
    
  } catch (error) {
    console.error("Loader error:", error);
    return json({ 
      products: [], 
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
      searchTerm,
      visibilityFilter,
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;
    
    if (actionType === "toggle") {
      const productId = formData.get("productId") as string;
      const currentStatus = formData.get("currentStatus") === "true";
      
      const response = await admin.graphql(
        `#graphql
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                key
                value
              }
              userErrors {
                field
                message
              }
            }
          }`,
        {
          variables: {
            metafields: [
              {
                ownerId: productId,
                namespace: "visibility_manager",
                key: "hidden",
                value: (!currentStatus).toString(),
                type: "boolean",
              }
            ],
          },
        },
      );

      const responseJson = await response.json();
      
      if (responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
        const error = responseJson.data.metafieldsSet.userErrors[0];
        return json({ 
          error: error.message,
          success: false 
        });
      }
      
      return json({ 
        success: true, 
        message: `Product ${!currentStatus ? 'hidden' : 'shown'} successfully!`
      });
      
    } else if (actionType === "bulk-hide" || actionType === "bulk-show") {
      const productIds = JSON.parse(formData.get("productIds") as string);
      const hideValue = actionType === "bulk-hide";
      
      // Process bulk updates
      const errors = [];
      let successCount = 0;
      
      for (const productId of productIds) {
        const response = await admin.graphql(
          `#graphql
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
          {
            variables: {
              metafields: [
                {
                  ownerId: productId,
                  namespace: "visibility_manager",
                  key: "hidden",
                  value: hideValue.toString(),
                  type: "boolean",
                }
              ],
            },
          },
        );
        
        const responseJson = await response.json();
        
        if (responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
          errors.push(responseJson.data.metafieldsSet.userErrors[0].message);
        } else {
          successCount++;
        }
      }
      
      if (errors.length > 0) {
        return json({
          error: `Failed to update ${errors.length} products`,
          success: false,
        });
      }
      
      return json({
        success: true,
        message: `${successCount} products ${hideValue ? 'hidden' : 'shown'} successfully!`,
      });
    }

  } catch (error) {
    console.error("Action error:", error);
    return json({ 
      error: "Failed to update product visibility",
      success: false 
    });
  }
  
  return json({ success: false });
};

export default function ProductVisibilityManager() {
  const { products, pageInfo, searchTerm, visibilityFilter } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [searchValue, setSearchValue] = useState(searchTerm);
  const [selectedVisibility, setSelectedVisibility] = useState([visibilityFilter]);
  const [isSearching, setIsSearching] = useState(false);
  
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(products);

  const isLoading = fetcher.state === "submitting";

  // Show toast messages
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  // Handle search
  const handleSearch = useCallback(() => {
    setIsSearching(true);
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    if (selectedVisibility[0] && selectedVisibility[0] !== "all") {
      params.set("visibility", selectedVisibility[0]);
    }
    setSearchParams(params);
    setIsSearching(false);
  }, [searchValue, selectedVisibility, setSearchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchValue("");
    setSelectedVisibility(["all"]);
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const handleVisibilityChange = useCallback((value: string[]) => {
    setSelectedVisibility(value);
  }, []);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // Handle product toggle
  const handleToggle = useCallback((productId: string, currentlyHidden: boolean) => {
    fetcher.submit(
      { 
        actionType: "toggle",
        productId, 
        currentStatus: currentlyHidden.toString()
      },
      { method: "POST" }
    );
  }, [fetcher]);

  // Handle bulk actions
  const handleBulkAction = useCallback((actionType: "bulk-hide" | "bulk-show") => {
    if (selectedResources.length === 0) return;
    
    fetcher.submit(
      {
        actionType,
        productIds: JSON.stringify(selectedResources),
      },
      { method: "POST" }
    );
    clearSelection();
  }, [selectedResources, fetcher, clearSelection]);

  // Pagination handlers
  const handlePreviousPage = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set("cursor", pageInfo.startCursor || "");
    params.set("direction", "backward");
    setSearchParams(params);
  }, [pageInfo.startCursor, searchParams, setSearchParams]);

  const handleNextPage = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set("cursor", pageInfo.endCursor || "");
    params.set("direction", "forward");
    setSearchParams(params);
  }, [pageInfo.endCursor, searchParams, setSearchParams]);

  // Calculate stats
  const visibleCount = products.filter(p => !p.isHidden).length;
  const hiddenCount = products.filter(p => p.isHidden).length;

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const promotedBulkActions = [
    {
      content: "Hide selected",
      onAction: () => handleBulkAction("bulk-hide"),
    },
    {
      content: "Show selected",
      onAction: () => handleBulkAction("bulk-show"),
    },
  ];

  const filters = [
    {
      key: "visibility",
      label: "Visibility",
      filter: (
        <ChoiceList
          title="Visibility"
          titleHidden
          choices={[
            { label: "All products", value: "all" },
            { label: "Visible only", value: "visible" },
            { label: "Hidden only", value: "hidden" },
          ]}
          selected={selectedVisibility}
          onChange={handleVisibilityChange}
        />
      ),
    },
  ];

  const appliedFilters = selectedVisibility[0] !== "all" 
    ? [
        {
          key: "visibility",
          label: `Visibility: ${selectedVisibility[0]}`,
          onRemove: () => {
            setSelectedVisibility(["all"]);
            handleSearch();
          },
        },
      ]
    : [];

  const rowMarkup = products.map((product, index) => {
    const productIdShort = product.id.replace("gid://shopify/Product/", "");
    
    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        selected={selectedResources.includes(product.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Thumbnail
            source={product.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
            alt={product.featuredImage?.altText || product.title}
            size="small"
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {product.title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {product.handle}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={product.status === "ACTIVE" ? "success" : "warning"}>
            {product.status}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={product.isHidden ? "critical" : "success"}>
            {product.isHidden ? "Hidden" : "Visible"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button
              size="slim"
              variant={product.isHidden ? "primary" : "secondary"}
              loading={isLoading}
              onClick={() => handleToggle(product.id, product.isHidden)}
            >
              {product.isHidden ? "Show" : "Hide"}
            </Button>
            <Button
              size="slim"
              variant="plain"
              url={`shopify:admin/products/${productIdShort}`}
            >
              View
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page>
      <TitleBar title="Product Visibility Manager" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Stats Banner */}
            <Banner title="Product Visibility Stats">
              <InlineStack gap="800">
                <Text variant="bodyMd">
                  <strong>{visibleCount}</strong> visible products
                </Text>
                <Text variant="bodyMd">
                  <strong>{hiddenCount}</strong> hidden products
                </Text>
                <Text variant="bodyMd">
                  <strong>{products.length}</strong> on this page
                </Text>
              </InlineStack>
            </Banner>

            {/* Main Content Card */}
            <Card>
              <BlockStack gap="400">
                {/* Search and Filters */}
                <Box padding="400" paddingBlockEnd="200">
                  <BlockStack gap="300">
                    <InlineStack gap="300" align="end">
                      <Box width="100%">
                        <TextField
                          label="Search products"
                          labelHidden
                          value={searchValue}
                          onChange={handleSearchChange}
                          placeholder="Search by product title..."
                          clearButton
                          onClearButtonClick={handleSearchClear}
                          autoComplete="off"
                          connectedRight={
                            <Button 
                              primary 
                              onClick={handleSearch}
                              loading={isSearching}
                            >
                              Search
                            </Button>
                          }
                        />
                      </Box>
                    </InlineStack>
                    
                    <Filters
                      filters={filters}
                      appliedFilters={appliedFilters}
                      onClearAll={handleSearchClear}
                      hideQueryField
                    />
                  </BlockStack>
                </Box>

                {/* Products Table */}
                {isLoading && !products.length ? (
                  <Box padding="600">
                    <BlockStack gap="400" align="center">
                      <Spinner accessibilityLabel="Loading products" size="large" />
                      <Text variant="bodyMd" as="p">Loading products...</Text>
                    </BlockStack>
                  </Box>
                ) : products.length === 0 ? (
                  <EmptyState
                    heading="No products found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    fullWidth
                  >
                    <p>Try adjusting your search or filters</p>
                  </EmptyState>
                ) : (
                  <>
                    <IndexTable
                      resourceName={resourceName}
                      itemCount={products.length}
                      selectedItemsCount={
                        allResourcesSelected ? "All" : selectedResources.length
                      }
                      onSelectionChange={handleSelectionChange}
                      promotedBulkActions={promotedBulkActions}
                      headings={[
                        { title: "Image" },
                        { title: "Title" },
                        { title: "Handle" },
                        { title: "Status" },
                        { title: "Visibility" },
                        { title: "Actions" },
                      ]}
                    >
                      {rowMarkup}
                    </IndexTable>
                    
                    {/* Pagination */}
                    <Box padding="400" borderBlockStartWidth="025" borderColor="border">
                      <InlineStack align="center">
                        <Pagination
                          hasPrevious={pageInfo.hasPreviousPage}
                          onPrevious={handlePreviousPage}
                          hasNext={pageInfo.hasNextPage}
                          onNext={handleNextPage}
                        />
                      </InlineStack>
                    </Box>
                  </>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Sidebar */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                <Button fullWidth variant="primary" onClick={() => handleSearch()}>
                  Refresh Products
                </Button>
                <Button 
                  fullWidth 
                  onClick={() => setSelectedVisibility(["hidden"])}
                  variant="secondary"
                >
                  View Hidden Only
                </Button>
                <Button 
                  fullWidth 
                  onClick={() => setSelectedVisibility(["visible"])}
                  variant="secondary"
                >
                  View Visible Only
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  How it works
                </Text>
                <Text variant="bodyMd" as="p">
                  Products remain ACTIVE in your store. Visibility is controlled by metafields that your theme reads to hide/show products.
                </Text>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p">
                    <strong>Namespace:</strong> visibility_manager
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>Key:</strong> hidden
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>Value:</strong> "true" or "false"
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Tips
                </Text>
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    • Use search to quickly find specific products
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Select multiple products for bulk actions
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Hidden products stay active but won't show in your theme
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}