import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';

export interface ChatRequestDto {
    prompt: string;
    context: string;
}

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    async handleChat(@Body() body: ChatRequestDto) {
        if (!body.prompt) {
            throw new HttpException('Prompt is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const reply = await this.chatService.generateResponse(body.prompt, body.context);
            return { reply };
        } catch (error) {
            console.error('Error in ChatController:', error);
            throw new HttpException(
                'Failed to communicate with LLM Agent',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
