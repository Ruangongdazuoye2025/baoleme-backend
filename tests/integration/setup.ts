import { SmtpTestServer } from "../utils/smtp.util";
import { execSync } from "child_process"

const SMTP_PORT = 1025;

const smtpServer = new SmtpTestServer(SMTP_PORT, '0.0.0.0');
(global as any).smtpServer = smtpServer;

beforeAll(async () => {
    await smtpServer.start(SMTP_PORT, '0.0.0.0');
    execSync('npx prisma migrate reset -f --skip-generate');
}, 30000);

afterAll(async () => {
    await smtpServer.stop();
}, 30000);