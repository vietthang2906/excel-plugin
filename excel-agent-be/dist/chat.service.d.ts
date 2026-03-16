import { ConfigService } from '@nestjs/config';
export declare class ChatService {
    private readonly configService;
    private readonly logger;
    private readonly apiKey;
    private readonly apiUrl;
    private readonly model;
    constructor(configService: ConfigService);
    generateResponse(userPrompt: string, excelContext: string, history?: Array<{
        role: string;
        content: string;
    }>): Promise<string>;
}
