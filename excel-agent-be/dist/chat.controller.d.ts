import { ChatService } from './chat.service';
export interface ChatRequestDto {
    prompt: string;
    context: string;
    schema?: {
        rowCount?: number;
    };
}
export interface ChatRouteRequestDto {
    prompt: string;
    schema: any;
}
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    handleChat(body: ChatRequestDto): Promise<{
        reply: string;
        model_used: string;
    }>;
    handleRoute(body: ChatRouteRequestDto): Promise<any>;
}
