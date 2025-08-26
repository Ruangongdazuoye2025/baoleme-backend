// ========== 通用类型定义 ==========

import { UserRole, OrderStatus } from './service.interfaces'

// 权限相关类型
export interface PermissionCheckResult<T> {
  data: T
  currentUser: UserData
  hasPermission: boolean
}

export interface ShopPermissionResult {
  shop: ShopData
  currentUser: UserData
}

export interface ShopPrivateInfoResult {
  shop: ShopData
  currentUser: UserData
  canViewPrivateInfo: boolean
}

export interface ItemPermissionResult {
  item: ItemData
  currentUser: UserData
  canViewUnavailable: boolean
}

export interface OrderPermissionResult {
  order: OrderData
  currentUser: UserData
  accessLevel: 'full' | 'omitted'
}

// 用户基础数据
export interface UserData {
  id: string
  email: string
  role: UserRole
  name?: string | null
  description?: string | null
  emailVisible: boolean
  createdAtVisible: boolean
  isVerified: boolean
  createdAt: Date
  updatedAt: Date
}

// 店铺基础数据
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

// 商品基础数据
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

// 带距离和店铺信息的商品数据（从 SQL 查询返回）
export interface ItemWithLocationData extends ItemData {
  shop_latitude: number
  shop_longitude: number
  distance: number | null
  shop_verified: boolean
  shop_opened: boolean
  shop_open_time_start: number
  shop_open_time_end: number
  shop_maximum_distance: number
  shop_rating: number
  categories: unknown  // SQL 查询返回的 JsonValue 类型
}

// 订单基础数据
export interface OrderData {
  id: string
  status: OrderStatus
  createdAt: Date
  paidAt?: Date | null
  preparedAt?: Date | null
  deliveredAt?: Date | null
  finishedAt?: Date | null
  canceledAt?: Date | null
  customerId?: string | null
  shopId?: string | null
  riderId?: string | null
  deliveryFee: number
  total: number
  note: string
  deliveryLatitude?: number | null
  deliveryLongitude?: number | null
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

// 事务相关类型
export interface TransactionStep {
  name: string
  stepName?: string  // 为了向后兼容
  execute: () => Promise<unknown>
  rollback?: () => Promise<void>
}

export interface TransactionExecutionResult {
  step: TransactionStep
  result: unknown
}

// 服务注册相关类型
export interface ServiceInstance {
  instance: unknown
  dependencies: string[]
  initialized: boolean
}

export interface ServiceDefinition {
  name: string
  factory: () => unknown
  dependencies?: string[]
  singleton?: boolean
}

// 验证相关类型
export interface ValidationResult {
  valid: boolean
  reason?: string
  item?: ItemData
  cartItem?: CartItemData
}

export interface CartItemData {
  customerId: string
  itemId: string
  quantity: number
  createdAt: Date
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: string[]
}

export interface ErrorDetails {
  field?: string
  message: string
  code?: string
}

// 文件上传相关类型
export interface FileUploadResult {
  filename: string
  originalname: string
  mimetype: string
  size: number
  path: string
}

export interface ImageLinks {
  origin: string
  thumbnail: string
}

// 分类相关类型
export interface CategoryData {
  id: string
  name: string
  order: number
  shopId?: string
}

// 地理位置相关类型
export interface Coordinate {
  latitude: number
  longitude: number
}

export interface Distance {
  value: number
  unit: 'km' | 'm'
}

// 时间相关类型
export interface TimeRange {
  start: Date
  end: Date
}

export interface BusinessHours {
  openTime: number  // 分钟数，从午夜开始
  closeTime: number // 分钟数，从午夜开始
  isOpen: boolean
}

// 分页相关类型
export interface PaginationOptions {
  page: number
  limit: number
  offset: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

// 搜索和过滤相关类型
export interface SearchOptions {
  keywords?: string[]
  categories?: string[]
  priceRange?: {
    min?: number
    max?: number
  }
  rating?: {
    min?: number
    max?: number
  }
  distance?: {
    max?: number
    unit?: 'km' | 'm'
  }
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 推荐算法相关类型
export interface RecommendationWeights {
  rating: number
  popularity: number
  distance: number
  price: number
  category: number
}

export interface RecommendationContext {
  userId: string
  location?: Coordinate
  timeOfDay?: number
  dayOfWeek?: number
  weatherCondition?: string
  previousOrders?: string[]
  preferences?: UserPreferences
}

export interface UserPreferences {
  favoriteCategories?: string[]
  priceRange?: {
    min?: number
    max?: number
  }
  maxDistance?: number
  preferredCuisineTypes?: string[]
}
