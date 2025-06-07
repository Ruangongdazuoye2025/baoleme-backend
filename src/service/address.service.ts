// 文件: src/service/address.service.ts
import { PrismaClient, Address, Prisma } from '@prisma/client';
import { classInjection, injected } from '../util/injection-decorators';
import { ResponseError } from '../util/errors';

import { CreateAddressApiDto, UpdateAddressApiDto, UpdateAddressOrderDto } from '../schema/address.schema';

const MAX_ADDRESSES_PER_USER = 16;

export interface ApiAddressResponse {
    id: string;
    coordinate: [number | null, number | null];
    province: string;
    city: string;
    district: string;
    address: string;
    name: string;
    tel: string;
    isDefault: boolean;
}

@classInjection
export default class AddressService {

    @injected
    private prisma!: PrismaClient;

    private mapDbAddressToApiResponse(dbAddress: Address): ApiAddressResponse {
        return {
            id: dbAddress.id,
            coordinate: [dbAddress.longitude, dbAddress.latitude],
            province: dbAddress.province,
            city: dbAddress.city,
            district: dbAddress.district,
            address: dbAddress.detail,
            name: dbAddress.recipientName,
            tel: dbAddress.phoneNumber,
            isDefault: dbAddress.isDefault,
        };
    }

    /**
     * 一个辅助方法：重新调整用户地址的 displayOrder
     */
    private async reorderdisplayOrders(
        tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
        userId: string
    ): Promise<void> {
        const addresses = await tx.address.findMany({
            where: { userId },
            orderBy: { displayOrder: 'asc' },
        });
        for (let i = 0; i < addresses.length; i++) {
            if (addresses[i].displayOrder !== i) {
                await tx.address.update({ where: { id: addresses[i].id }, data: { displayOrder: i } });
            }
        }
    }

    async addAddress(userId: string, apiAddressData: CreateAddressApiDto): Promise<ApiAddressResponse> {
        const [longitude, latitude] = apiAddressData.coordinate;

        const newDbAddress = await this.prisma.$transaction(async (tx) => {
            const currentAddresses = await tx.address.findMany({
                where: { userId },
                orderBy: { displayOrder: 'asc' },
            });

            if (currentAddresses.length >= MAX_ADDRESSES_PER_USER) {
                throw new ResponseError(403, `一个用户最多只能拥有 ${MAX_ADDRESSES_PER_USER} 个收货地址`);
            }

            if (apiAddressData.isDefault) {
                await tx.address.updateMany({
                    where: { userId: userId, isDefault: true },
                    data: { isDefault: false },
                });
            }

            // 新地址总是添加到末尾
            const targetdisplayOrder = currentAddresses.length;

            const createdAddress = await tx.address.create({
                data: {
                    userId,
                    recipientName: apiAddressData.name,
                    phoneNumber: apiAddressData.tel,
                    province: apiAddressData.province,
                    city: apiAddressData.city,
                    district: apiAddressData.district,
                    detail: apiAddressData.address,
                    longitude,
                    latitude,
                    isDefault: apiAddressData.isDefault,
                    displayOrder: targetdisplayOrder,
                },
            });
            return createdAddress;
        });
        return this.mapDbAddressToApiResponse(newDbAddress);
    }

    async getAddresses(userId: string): Promise<ApiAddressResponse[]> {
        const dbAddresses = await this.prisma.address.findMany({
            where: { userId },
            orderBy: { displayOrder: 'asc' },
        });
        return dbAddresses.map(addr => this.mapDbAddressToApiResponse(addr));
    }

    async getAddressById(currentUserId: string, addressId: string): Promise<ApiAddressResponse> {
        const dbAddress = await this.prisma.address.findUnique({
            where: { id: addressId },
        });

        if (!dbAddress) {
            throw new ResponseError(404, '收货地址未找到');
        }
        if (dbAddress.userId !== currentUserId) {
            throw new ResponseError(403, '无权查看此地址');
        }
        return this.mapDbAddressToApiResponse(dbAddress);
    }

    async updateAddress(currentUserId: string, addressId: string, apiAddressData: UpdateAddressApiDto): Promise<ApiAddressResponse> {
        const dataToUpdate: Prisma.AddressUpdateInput = {
            recipientName: apiAddressData.name,
            phoneNumber: apiAddressData.tel,
            province: apiAddressData.province,
            city: apiAddressData.city,
            district: apiAddressData.district,
            detail: apiAddressData.address,
            longitude: apiAddressData.coordinate?.[0],
            latitude: apiAddressData.coordinate?.[1],
            isDefault: apiAddressData.isDefault
        }

        const updatedDbAddress = await this.prisma.$transaction(async (tx) => {
            const existingAddress = await tx.address.findUnique({ where: { id: addressId } });

            if (!existingAddress) throw new ResponseError(404, '收货地址未找到');
            if (existingAddress.userId !== currentUserId) throw new ResponseError(403, '无权修改此地址');

            if (typeof apiAddressData.isDefault === 'boolean' && apiAddressData.isDefault) {
                if (!existingAddress.isDefault || (Object.keys(dataToUpdate).length > 1)) {
                    await tx.address.updateMany({
                        where: { userId: currentUserId, isDefault: true, NOT: { id: addressId } },
                        data: { isDefault: false },
                    });
                }
            }

            return tx.address.update({ where: { id: addressId }, data: dataToUpdate });
        });
        return this.mapDbAddressToApiResponse(updatedDbAddress);
    }

    async updateAddressOrder(currentUserId: string, addressIdToMove: string, orderData: UpdateAddressOrderDto): Promise<ApiAddressResponse[]> {


        await this.prisma.$transaction(async (tx) => {
            const addressToMove = await tx.address.findUnique({
                where: { id: addressIdToMove },
            });

            if (!addressToMove || addressToMove.userId !== currentUserId) {
                throw new ResponseError(404, '需要移动的地址未找到或不属于当前用户');
            }

            const { before } = orderData; // ID of the address that addressIdToMove should be placed BEFORE. null means move to the end.

            if (before) { // Move before a specific address
                const beforeAddress = await tx.address.findUnique({
                    where: { id: before },
                });

                if (!beforeAddress || beforeAddress.userId !== currentUserId) {
                    throw new ResponseError(404, '目标位置 (before) 地址未找到或不属于当前用户');
                }

                if (addressToMove.id === beforeAddress.id) {
                    // Cannot move an address before itself, no operation needed.
                    return;
                }

                // If displayOrders happen to be the same (which ideally shouldn't for different items if managed strictly)
                // the logic below will still attempt to place addressToMove correctly relative to beforeAddress.
                // The item.service.ts check `if (category.order === beforeCategory.order) { return }`
                // might be for cases where orders are not strictly unique or if it's already in the exact target slot.
                // Our logic aims to achieve the state "addressToMove is immediately before beforeAddress".

                if (addressToMove.displayOrder < beforeAddress.displayOrder) {
                    // addressToMove is currently to the "left" of beforeAddress (e.g., A(0), B(1), C(2), D(3). Move A before D. A.order=0, D.order=3)
                    // Target state: B(0), C(1), A(2), D(3). A's new order is D.order - 1 = 2.
                    // Items between A's old order (exclusive) and D's order (exclusive) shift left. (B and C)
                    await tx.address.updateMany({
                        where: {
                            userId: currentUserId,
                            displayOrder: { gt: addressToMove.displayOrder, lt: beforeAddress.displayOrder },
                        },
                        data: { displayOrder: { decrement: 1 } },
                    });
                    await tx.address.update({
                        where: { id: addressIdToMove },
                        data: { displayOrder: beforeAddress.displayOrder - 1 },
                    });
                } else { // addressToMove.displayOrder > beforeAddress.displayOrder
                    // addressToMove is currently to the "right" of beforeAddress (e.g., B(0), C(1), D(2), A(3). Move A before B. A.order=3, B.order=0)
                    // Target state: A(0), B(1), C(2), D(3). A's new order is B.order = 0.
                    // Items from B's order (inclusive) to A's old order (exclusive) shift right. (B, C, D)
                    await tx.address.updateMany({
                        where: {
                            userId: currentUserId,
                            displayOrder: { gte: beforeAddress.displayOrder, lt: addressToMove.displayOrder },
                        },
                        data: { displayOrder: { increment: 1 } },
                    });
                    await tx.address.update({
                        where: { id: addressIdToMove },
                        data: { displayOrder: beforeAddress.displayOrder },
                    });
                }
            } else { // Move to the end
                const maxOrderAgg = await tx.address.aggregate({
                    where: { userId: currentUserId },
                    _max: { displayOrder: true },
                });
                const maxDisplayOrder = maxOrderAgg._max.displayOrder;

                if (maxDisplayOrder === null) {
                    // This implies no addresses exist for the user, or only this one.
                    // If only this one, setting its order to 0 is appropriate.
                    await tx.address.update({
                        where: { id: addressIdToMove },
                        data: { displayOrder: 0 },
                    });
                } else {
                    // Shift addresses that were logically after the old position of addressToMove
                    await tx.address.updateMany({
                        where: {
                            userId: currentUserId,
                            displayOrder: { gt: addressToMove.displayOrder },
                        },
                        data: { displayOrder: { decrement: 1 } },
                    });

                    await tx.address.update({
                        where: { id: addressIdToMove },
                        data: { displayOrder: maxDisplayOrder },
                    });
                }
            }
        });

        const updatedAddresses = await this.prisma.address.findMany({
            where: { userId: currentUserId },
            orderBy: { displayOrder: 'asc' },
        });
        return updatedAddresses.map(addr => this.mapDbAddressToApiResponse(addr));
    }


    async deleteAddress(currentUserId: string, addressId: string): Promise<void> {

        await this.prisma.$transaction(async (tx) => {
            const addressToDelete = await tx.address.findUnique({ where: { id: addressId } });

            if (!addressToDelete) throw new ResponseError(404, '收货地址未找到');
            if (addressToDelete.userId !== currentUserId) throw new ResponseError(403, '无权删除此地址');

            await tx.address.delete({ where: { id: addressId } });

            // After deleting, reorder the displayOrder for remaining addresses.
            // This is important to maintain a consistent order if displayOrder is used for UI.
            await this.reorderdisplayOrders(tx, currentUserId);


            // If the deleted address was the default, set the new first address (if any) as default.
            if (addressToDelete.isDefault) {
                const nextDefaultAddress = await tx.address.findFirst({ // findFirst will use the orderBy from reorderdisplayOrders
                    where: { userId: currentUserId },
                    orderBy: { displayOrder: 'asc' },
                });
                if (nextDefaultAddress) {
                    await tx.address.update({
                        where: { id: nextDefaultAddress.id },
                        data: { isDefault: true },
                    });
                }
            }
        });
    }

    async setDefaultAddress(currentUserId: string, addressId: string): Promise<ApiAddressResponse> {

        const updatedDbAddress = await this.prisma.$transaction(async (tx) => {
            const addressToSetDefault = await tx.address.findUnique({ where: { id: addressId } });

            if (!addressToSetDefault) throw new ResponseError(404, '收货地址未找到');
            if (addressToSetDefault.userId !== currentUserId) throw new ResponseError(403, '无权操作此地址');
            if (addressToSetDefault.isDefault) return addressToSetDefault; // Already default

            await tx.address.updateMany({
                where: { userId: currentUserId, isDefault: true },
                data: { isDefault: false },
            });
            return tx.address.update({
                where: { id: addressId },
                data: { isDefault: true },
            });
        });
        return this.mapDbAddressToApiResponse(updatedDbAddress);
    }
}