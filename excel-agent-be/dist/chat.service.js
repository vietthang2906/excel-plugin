"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const prompt_service_1 = require("./prompt.service");
let ChatService = ChatService_1 = class ChatService {
    promptService;
    logger = new common_1.Logger(ChatService_1.name);
    ollamaUrl = 'http://127.0.0.1:11434/api/generate';
    constructor(promptService) {
        this.promptService = promptService;
    }
    async generateResponse(userPrompt, excelContext) {
        const fullPrompt = this.promptService.buildAnswerPrompt(excelContext, userPrompt);
        this.logger.log(`Sending prompt to local model (Context length: ${excelContext?.length || 0} chars)\n---------`);
        try {
            const response = await fetch(this.ollamaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-r1:8b',
                    prompt: fullPrompt,
                    stream: false,
                    options: {
                        temperature: 0.1
                    }
                }),
            });
            if (!response.ok) {
                throw new Error(`Ollama API returned status: ${response.status}`);
            }
            const data = (await response.json());
            let textResponse = data.response.trim();
            textResponse = textResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            return textResponse;
        }
        catch (error) {
            this.logger.error('Failed to communicate with Ollama', error);
            throw error;
        }
    }
    async routeTask(userPrompt, schema, structureContext) {
        if (schema.isEmpty) {
            return { action: 'answer', reply: "The current worksheet is empty." };
        }
        const getColumnLetter = (colIndex) => {
            let letter = '';
            let temp = colIndex;
            while (temp >= 0) {
                letter = String.fromCharCode((temp % 26) + 65) + letter;
                temp = Math.floor(temp / 26) - 1;
            }
            return letter;
        };
        const getColumnIndex = (letter) => {
            let index = 0;
            for (let i = 0; i < letter.length; i++) {
                index = index * 26 + (letter.charCodeAt(i) - 64);
            }
            return index - 1;
        };
        const startColMatch = schema.fullRangeAddress.match(/([A-Z]+)\d+/);
        const startColLetter = startColMatch ? startColMatch[1] : 'A';
        const startColIndex = getColumnIndex(startColLetter);
        const headerMapping = schema.headers.map((header, index) => {
            return `Column ${getColumnLetter(startColIndex + index)}: "${header}"`;
        }).join('\n');
        const schemaBlock = `Active Worksheet: ${schema.sheetName}
Full Data Range: ${schema.fullRangeAddress}
Total Rows: ${schema.rowCount}
Total Columns: ${schema.columnCount}
Headers Mapping:
${headerMapping}`;
        const fullPrompt = this.promptService.buildRouterPrompt(schemaBlock, userPrompt, structureContext);
        this.logger.log(`Routing Task for user prompt: "${userPrompt}"\n--- FULL ROUTER PROMPT ---\n${fullPrompt}\n--------------------------`);
        try {
            const response = await fetch(this.ollamaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama3.1',
                    prompt: fullPrompt,
                    stream: false,
                    options: {
                        temperature: 0.0
                    },
                    format: 'json'
                }),
            });
            if (!response.ok) {
                throw new Error(`Ollama API returned status: ${response.status}`);
            }
            const data = (await response.json());
            const textResponse = data.response.trim();
            this.logger.log(`Router Output: ${textResponse}`);
            try {
                return JSON.parse(textResponse);
            }
            catch (e) {
                this.logger.error("Failed to parse Router output as JSON. Falling back to fetch_all.");
                return { action: 'fetch_all' };
            }
        }
        catch (error) {
            this.logger.error('Failed to communicate with Ollama Router', error);
            throw error;
        }
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prompt_service_1.PromptService])
], ChatService);
//# sourceMappingURL=chat.service.js.map