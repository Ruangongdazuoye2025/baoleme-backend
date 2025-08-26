import { PrismaClient, Address, Prisma } from '@prisma/client';
import { classInjection, injected } from '../util/injection-decorators';
import { ResponseError } from '../util/errors';
import { BaseServiceUtils } from './base.service';
import { HTTP_STATUS } from '../constants/app.constants';

import { CreateAddressApiDto, UpdateAddressApiDto, UpdateAddressOrderDto } from '../schema/address.schema';

const MAX_ADDRESSES_PER_USER = 16;

const ADDRESS_ERROR_MESSAGES = {
    NOT_FOUND: '收货地址未找到',
    UNAUTHORIZED: '无权查看此地址',
    UNAUTHORIZED_MODIFY: '无权修改此地址',
    UNAUTHORIZED_DELETE: '无权删除此地址',
    UNAUTHORIZED_OPERATION: '无权操作此地址',
    MAX_LIMIT_REACHED: `一个用户最多只能拥有 ${MAX_ADDRESSES_PER_USER} 个收货地址`,
    MOVE_TARGET_NOT_FOUND: '需要移动的地址未找到或不属于当前用户',
    BEFORE_ADDRESS_NOT_FOUND: '目标位置 (before) 地址未找到或不属于当前用户',
} as const;

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
                throw new ResponseError(HTTP_STATUS.FORBIDDEN, ADDRESS_ERROR_MESSAGES.MAX_LIMIT_REACHED);
            }

            if (currentAddresses.length === 0) {
                apiAddressData.isDefault = true; // If it's the first address, set as default
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
        const dbAddress = await BaseServiceUtils.findByIdOrThrow(
            () => this.prisma.address.findUnique({ where: { id: addressId } }),
            ADDRESS_ERROR_MESSAGES.NOT_FOUND
        );

        if (dbAddress.userId !== currentUserId) {
            throw new ResponseError(HTTP_STATUS.FORBIDDEN, ADDRESS_ERROR_MESSAGES.UNAUTHORIZED);
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

            if (!existingAddress) throw new ResponseError(HTTP_STATUS.NOT_FOUND, ADDRESS_ERROR_MESSAGES.NOT_FOUND);
            if (existingAddress.userId !== currentUserId) throw new ResponseError(HTTP_STATUS.FORBIDDEN, ADDRESS_ERROR_MESSAGES.UNAUTHORIZED_MODIFY);

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
                throw new ResponseError(HTTP_STATUS.NOT_FOUND, ADDRESS_ERROR_MESSAGES.MOVE_TARGET_NOT_FOUND);
            }

            const { before } = orderData; // ID of the address that addressIdToMove should be placed BEFORE. null means move to the end.

            if (before) { // Move before a specific address
                const beforeAddress = await tx.address.findUnique({
                    where: { id: before },
                });

                if (!beforeAddress || beforeAddress.userId !== currentUserId) {
                    throw new ResponseError(HTTP_STATUS.NOT_FOUND, ADDRESS_ERROR_MESSAGES.BEFORE_ADDRESS_NOT_FOUND);
                }

                if (addressToMove.id === beforeAddress.id) {
                    // Cannot move an address before itself, no operation needed.
                    return;
                }

                if (addressToMove.displayOrder < beforeAddress.displayOrder) {
                    // addressToMove is currently to the "left" of beforeAddress
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
                    // addressToMove is currently to the "right" of beforeAddress
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
                    await tx.address.update({
                        where: { id: addressIdToMove },
                        data: { displayOrder: 0 },
                    });
                } else {
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

            if (!addressToDelete) throw new ResponseError(HTTP_STATUS.NOT_FOUND, ADDRESS_ERROR_MESSAGES.NOT_FOUND);
            if (addressToDelete.userId !== currentUserId) throw new ResponseError(HTTP_STATUS.FORBIDDEN, ADDRESS_ERROR_MESSAGES.UNAUTHORIZED_DELETE);

            await tx.address.delete({ where: { id: addressId } });

            // After deleting, reorder the displayOrder for remaining addresses.
            await this.reorderdisplayOrders(tx, currentUserId);

            // If the deleted address was the default, set the new first address (if any) as default.
            if (addressToDelete.isDefault) {
                const nextDefaultAddress = await tx.address.findFirst({
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

            if (!addressToSetDefault) throw new ResponseError(HTTP_STATUS.NOT_FOUND, ADDRESS_ERROR_MESSAGES.NOT_FOUND);
            if (addressToSetDefault.userId !== currentUserId) throw new ResponseError(HTTP_STATUS.FORBIDDEN, ADDRESS_ERROR_MESSAGES.UNAUTHORIZED_OPERATION);
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
