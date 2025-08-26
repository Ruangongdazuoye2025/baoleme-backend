// ========== 数据类型定义 ==========

// 基础类型
export type UserRole = 'USER' | 'MERCHANT' | 'RIDER' | 'ADMIN'
export type OrderStatus = 'UNPAID' | 'PREPARING' | 'PREPARED' | 'DELIVERING' | 'FINISHED' | 'CANCELED'

// 分页和排序类型
export interface PaginationParams {
  pageSkip: number
  pageLimit: number
}

export interface SortingParams {
  sorting: string
  filterKeywords: string[]
}

// 位置信息类型
export interface LocationInfo {
  latitude: number
  longitude: number
  province: string
  city: string
  district: string
  address: string
  name: string
  tel: string
}

// 用户相关类型
export interface UserData {
  id: string
  email: string
  role: UserRole
  name?: string
  description?: string
  emailVisible: boolean
  createdAtVisible: boolean
  isVerified: boolean
  createdAt: Date
  updatedAt: Date
}

// 店铺相关类型
export interface ShopData {
  id: string
  ownerId: string
  name: string
  description: string
  addressLatitude: number
  addressLongitude: number
  addressProvince: string
  addressCity: string
  addressDistrict: string
  addressAddress: string
  addressName: string
  addressTel: string
  verified: boolean
  opened: boolean
  openTimeStart: number
  openTimeEnd: number
  deliveryThreshold: number
  deliveryPrice: number
  maximumDistance: number
  rating: number
  sale: number
  averagePrice: number
  createdAt: Date
  updatedAt: Date
}

export interface ShopCategoryData {
  id: string
  name: string
  order: number
}

export interface FullShopInfo extends ShopData {
  categories: ShopCategoryData[]
  owner?: UserData
}

// 商品相关类型
export interface ItemData {
  id: string
  shopId: string
  createdAt: Date
  name: string
  description: string
  available: boolean
  stockout: boolean
  price: number
  priceWithoutPromotion: number
  rating: number
  sale: number
}

export interface ItemCategoryData {
  id: string
  name: string
  order: number
  shopId: string
}

export interface FullItemInfo extends ItemData {
  shop?: ShopData
  categories: ItemCategoryData[]
}

// 地址相关类型
export interface AddressData {
  id: string
  userId: string
  recipientName: string
  phoneNumber: string
  province: string
  city: string
  district: string
  detail: string
  longitude: number
  latitude: number
  label?: string
  isDefault: boolean
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

// 购物车相关类型
export interface CartItemData {
  customerId: string
  itemId: string
  quantity: number
  createdAt: Date
}

export interface FullCartItemInfo extends CartItemData {
  item?: ItemData
}

// 订单相关类型
export interface OrderItemData {
  id: string
  orderId: string
  itemId?: string
  name: string
  quantity: number
  price: number
}

export interface OrderData {
  id: string
  status: OrderStatus
  createdAt: Date
  paidAt?: Date
  preparedAt?: Date
  deliveredAt?: Date
  finishedAt?: Date
  canceledAt?: Date
  customerId?: string
  shopId?: string
  riderId?: string
  deliveryFee: number
  total: number
  note: string
  deliveryLatitude?: number
  deliveryLongitude?: number
  shopLatitude: number
  shopLongitude: number
  shopProvince: string
  shopCity: string
  shopDistrict: string
  shopAddress: string
  shopName: string
  shopTel: string
  customerLatitude: number
  customerLongitude: number
  customerProvince: string
  customerCity: string
  customerDistrict: string
  customerAddress: string
  customerName: string
  customerTel: string
}

export interface FullOrderInfo extends OrderData {
  items: OrderItemData[]
  customer?: UserData
  shop?: ShopData
  rider?: UserData
}

// 评论相关类型
export interface ReviewData {
  id: string
  content: string
  rating: number
  createdAt: Date
  updatedAt: Date
  orderId: string
  userId: string
}

export interface FullReviewInfo extends ReviewData {
  user?: UserData
  order?: OrderData
}

// 历史记录和收藏相关类型
export interface ShopHistoryData {
  userId: string
  shopId: string
  createdAt: Date
}

export interface ShopFavouriteData {
  userId: string
  shopId: string
  createdAt: Date
}

export interface ItemHistoryData {
  userId: string
  itemId: string
  createdAt: Date
}

export interface ItemFavouriteData {
  userId: string
  itemId: string
  createdAt: Date
}

export interface FullShopHistoryInfo extends ShopHistoryData {
  shop?: ShopData
}

export interface FullShopFavouriteInfo extends ShopFavouriteData {
  shop?: ShopData
}

export interface FullItemHistoryInfo extends ItemHistoryData {
  item?: ItemData
}

export interface FullItemFavouriteInfo extends ItemFavouriteData {
  item?: ItemData
}

// 推荐服务相关类型
export interface RecommendedShopInfo extends FullShopInfo {
  time: number
  distance: number
  recommends: FullItemInfo[]
}

export interface RecommendedItemInfo extends FullItemInfo {
  distance?: number
  shopDistance?: number
}

// 推荐服务参数类型
export interface RecommendedShopsParams {
  currentUserId: string
  pageSkip: number
  pageLimit: number
  filterKeywords: string[]
  sorting: string
  hotItemCount: number
  categories?: string[]
  maxDistance?: number
  minRating?: number
  maxTime?: number
  latitude: number
  longitude: number
}

export interface RecommendedItemsParams {
  currentUserId: string
  pageSkip: number
  pageLimit: number
  filterKeywords: string[]
  sorting: string
  shopId?: string
  categories?: string[]
  maxPrice?: number
  minRating?: number
  latitude: number
  longitude: number
}

export interface RecommendedOrdersParams {
  currentUserId: string
  pageSkip: number
  pageLimit: number
  filterKeywords: string[]
  sorting: string
  statuses?: string[]
  minCreatedAt?: Date
  maxCreatedAt?: Date
}

// ========== 服务接口定义 ==========

// 用户服务接口
export interface IUserService {
  getUser(id: string): Promise<UserData | null>
  getUsersByIds(ids: string[]): Promise<UserData[]>
  verifyUserPermission(currentUserId: string, targetUserId: string, requiredRoles?: string[]): Promise<boolean>
}

// 商品/店铺服务接口
export interface IShopService {
  getShop(id: string): Promise<ShopData | null>
  getShopsByIds(ids: string[]): Promise<ShopData[]>
  getShopsByOwnerId(ownerId: string): Promise<ShopData[]>
  shopDataToFullShopInfo(shop: ShopData): Promise<FullShopInfo>
}

export interface IItemService {
  getItem(id: string): Promise<ItemData | null>
  getItemsByIds(ids: string[]): Promise<ItemData[]>
  getItemsByShopId(shopId: string): Promise<ItemData[]>
  itemDataToFullItemInfo(item: ItemData): Promise<FullItemInfo>
}

// 地址服务接口
export interface IAddressService {
  getAddress(id: string): Promise<AddressData | null>
  getAddressesByUserId(userId: string): Promise<AddressData[]>
  getDefaultAddress(userId: string): Promise<AddressData | null>
}

// 购物车服务接口
export interface ICartService {
  getCartItems(customerId: string): Promise<FullCartItemInfo[]>
  addToCart(customerId: string, itemId: string, quantity: number): Promise<CartItemData>
  removeFromCart(customerId: string, itemId: string): Promise<void>
}

// 订单服务接口
export interface IOrderService {
  getOrder(id: string): Promise<FullOrderInfo | null>
  getOrdersByCustomerId(customerId: string): Promise<FullOrderInfo[]>
  getOrdersByShopId(shopId: string): Promise<FullOrderInfo[]>
  getOrdersByRiderId(riderId: string): Promise<FullOrderInfo[]>
  orderDataToOrderInfo(order: OrderData): Promise<FullOrderInfo>
}

// 评论服务接口
export interface IReviewService {
  getReview(id: string): Promise<FullReviewInfo | null>
  getReviewsByOrderId(orderId: string): Promise<FullReviewInfo[]>
  getReviewsByUserId(userId: string): Promise<FullReviewInfo[]>
}

// 历史记录和收藏服务接口
export interface IHistoryService {
  getShopHistory(userId: string): Promise<FullShopHistoryInfo[]>
  getShopFavourites(userId: string): Promise<FullShopFavouriteInfo[]>
  getItemHistory(userId: string): Promise<FullItemHistoryInfo[]>
  getItemFavourites(userId: string): Promise<FullItemFavouriteInfo[]>
  addShopHistory(userId: string, shopId: string): Promise<void>
  addShopFavourite(userId: string, shopId: string): Promise<void>
  addItemHistory(userId: string, itemId: string): Promise<void>
  addItemFavourite(userId: string, itemId: string): Promise<void>
}

// 推荐服务接口
export interface IRecommendedService {
  getRecommendedShops(params: RecommendedShopsParams): Promise<RecommendedShopInfo[]>
  getRecommendedItems(params: RecommendedItemsParams): Promise<RecommendedItemInfo[]>
  getRecommendedOrders(params: RecommendedOrdersParams): Promise<FullOrderInfo[]>
}
