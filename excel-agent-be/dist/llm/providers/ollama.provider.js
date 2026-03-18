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
var OllamaProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let OllamaProvider = OllamaProvider_1 = class OllamaProvider {
    configService;
    logger = new common_1.Logger(OllamaProvider_1.name);
    name = 'Ollama';
    baseUrl;
    model;
    maxOutputTokens;
    constructor(configService) {
        this.configService = configService;
        this.baseUrl =
            this.configService.get('OLLAMA_BASE_URL') ?? 'http://127.0.0.1:11434/api/chat';
        this.model = this.configService.get('OLLAMA_MODEL') ?? 'llama3:70b';
        this.maxOutputTokens =
            parseInt(this.configService.get('MAX_OUTPUT_TOKENS') ?? '512', 10) || 512;
    }
    async chat(systemPrompt, userPrompt, context, modelOverride) {
        const model = modelOverride ?? this.model;
        const userContent = `${context || ''}\n\nUser Question: ${userPrompt}`;
        this.logger.log(`[LLM_REQUEST] model=${model} | systemLen=${systemPrompt.length} | userContentLen=${userContent.length}`);
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                stream: false,
                options: { num_predict: this.maxOutputTokens },
            }),
        });
        if (!response.ok) {
            const errBody = await response.text();
            this.logger.error(`[LLM_RESPONSE] status=${response.status} | error=${errBody.slice(0, 200)}`);
            throw new Error(`Ollama returned status ${response.status}: ${errBody}`);
        }
        const data = (await response.json());
        let content = (data.message?.content ?? '').trim();
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        this.logger.log(`[LLM_RESPONSE] status=${response.status} | contentLen=${content.length} | preview="${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`);
        return content;
    }
};
exports.OllamaProvider = OllamaProvider;
exports.OllamaProvider = OllamaProvider = OllamaProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OllamaProvider);
//# sourceMappingURL=ollama.provider.js.map