import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';

export interface ChatRequestDto {
    prompt: string;
    context: string;
}

export interface ChatRouteRequestDto {
    prompt: string;
    schema: any; 
    structureContext?: string;
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

    @Post('route')
    async handleRoute(@Body() body: ChatRouteRequestDto) {
        if (!body.prompt || !body.schema) {
            throw new HttpException('Prompt and schema are required', HttpStatus.BAD_REQUEST);
        }

        try {
            const routeAction = await this.chatService.routeTask(
                body.prompt, 
                body.schema, 
                body.structureContext
            );
            return routeAction;
        } catch (error) {
            console.error('Error in handleRoute:', error);
            throw new HttpException(
                'Failed to communicate with LLM Router',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
