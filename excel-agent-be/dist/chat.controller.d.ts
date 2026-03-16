import { ChatService } from './chat.service';
export interface ChatRequestDto {
    prompt: string;
    context: string;
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
    }>;
    handleRoute(body: ChatRouteRequestDto): Promise<any>;
}
