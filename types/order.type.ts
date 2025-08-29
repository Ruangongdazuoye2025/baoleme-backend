// 订单基础数据

export type UserRole = 'USER' | 'MERCHANT' | 'RIDER' | 'ADMIN'
export type OrderStatus = 'UNPAID' | 'PREPARING' | 'PREPARED' | 'DELIVERING' | 'FINISHED' | 'CANCELED'

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