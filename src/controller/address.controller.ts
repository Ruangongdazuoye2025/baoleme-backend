import { Router, Request, Response } from 'express';
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators';
import AuthService from '../service/auth.service';
import AddressService from '../service/address.service';
import { validateBody, validateParams } from '../middleware/validator.middleware';
import * as AddressSchema from '../schema/address.schema';

class AddressController {
    @factoryMethod
    static addressController(
        @injected('authService') authService: AuthService,
        @injected('addressService') addressService: AddressService
    ) {
        const router = Router();
        const API_BASE_PATH = '/addresses';

        router.post(
            API_BASE_PATH,
            authService.requireAuth(),
            validateBody(AddressSchema.createAddressSchema),
            async (req: Request, res: Response) => {
                const userId = req.user!.id;
                const addressData = req.body as AddressSchema.CreateAddressApiDto;
                const newAddress = await addressService.addAddress(userId, addressData);
                res.status(201).json(newAddress);
            }
        );

        router.get(
            API_BASE_PATH,
            authService.requireAuth(),
            async (req: Request, res: Response) => {
                const userId = req.user!.id;
                const addresses = await addressService.getAddresses(userId);
                res.status(200).json(addresses);
            }
        );

        router.get(
            `${API_BASE_PATH}/:id`,
            authService.requireAuth(),
            validateParams(AddressSchema.addressIdParamsSchema),
            async (req: Request, res: Response) => {
                const userId = req.user!.id;
                const { id: addressId } = req.params;
                const address = await addressService.getAddressById(userId, addressId);
                res.status(200).json(address);
            }
        );

        router.patch( 
            `${API_BASE_PATH}/:id`,
            authService.requireAuth(),
            validateParams(AddressSchema.addressIdParamsSchema),
            validateBody(AddressSchema.updateAddressSchema),
            async (req: Request, res: Response) => {
                const userId = req.user!.id;
                const { id: addressId } = req.params;
                const addressData = req.body as AddressSchema.UpdateAddressApiDto;
                const updatedAddress = await addressService.updateAddress(userId, addressId, addressData);
                res.status(200).json(updatedAddress);
            }
        );

        router.patch(
            `${API_BASE_PATH}/:id/pos`,
            authService.requireAuth(),
            validateParams(AddressSchema.addressIdParamsSchema),
            validateBody(AddressSchema.updateAddressOrderSchema),
            async (req: Request, res: Response) => {
                const userId = req.user!.id;
                const { id: addressIdToMove } = req.params;
                const orderData = req.body as AddressSchema.UpdateAddressOrderDto;
                await addressService.updateAddressOrder(userId, addressIdToMove, orderData);
                res.status(204).send();
            }
        );

        router.delete(
            `${API_BASE_PATH}/:id`,
            authService.requireAuth(),
            validateParams(AddressSchema.addressIdParamsSchema),
            async (req: Request, res: Response) => {
                const userId = req.user!.id;
                const { id: addressId } = req.params;
                await addressService.deleteAddress(userId, addressId);
                res.status(204).send();
            }
        );

        // 如果需要一个专门的 "设为默认" 接口，可以保留或调整
        // 例如 PATCH /addresses/{id}/default (但通常 PATCH /addresses/{id} 更新 isDefault 字段即可)
        // 已经在 updateAddress 中处理了 isDefault，所以可以考虑移除这个特定的路由
        // router.patch(
        //     `${API_BASE_PATH}/:id/default`,
        //     authService.requireAuth(),
        //     validateParams(AddressSchema.addressIdParamsSchema),
        //     async (req: Request, res: Response) => {
        //         const userId = req.user!.id;
        //         const { id: addressId } = req.params;
        //         const updatedAddress = await addressService.setDefaultAddress(userId, addressId);
        //         res.status(200).json(updatedAddress);
        //     }
        // );

        return router;
    }
}

export default factoryInjection(AddressController);