import { ServiceSchema } from "moleculer";

const HelloService: ServiceSchema = {
    name: "hello",
    actions: {
        hello: {
            handler(ctx) {
                return { message: "Hello World!" };
            }
        }
    }
}

export default HelloService;