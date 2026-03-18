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
var AnthropicProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let AnthropicProvider = AnthropicProvider_1 = class AnthropicProvider {
    configService;
    logger = new common_1.Logger(AnthropicProvider_1.name);
    name = 'Claude';
    apiKey;
    baseUrl = 'https://api.anthropic.com/v1/messages';
    model;
    maxOutputTokens;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('ANTHROPIC_API_KEY') ?? '';
        this.model = this.configService.get('ANTHROPIC_MODEL') ?? 'claude-opus-4-6';
        this.maxOutputTokens =
            parseInt(this.configService.get('MAX_OUTPUT_TOKENS') ?? '512', 10) || 512;
    }
    isAvailable() {
        return !!this.apiKey;
    }
    async chat(systemPrompt, userPrompt, context, modelOverride) {
        if (!this.apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not configured');
        }
        const model = modelOverride ?? this.model;
        const userContent = `${context || ''}\n\nUser Question: ${userPrompt}`;
        this.logger.log(`[LLM_REQUEST] model=${model} | systemLen=${systemPrompt.length} | userContentLen=${userContent.length}`);
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: this.maxOutputTokens,
                system: systemPrompt,
                messages: [{ role: 'user', content: userContent }],
            }),
        });
        if (!response.ok) {
            const errBody = await response.text();
            this.logger.error(`[LLM_RESPONSE] status=${response.status} | error=${errBody.slice(0, 200)}`);
            throw new Error(`Anthropic API returned status ${response.status}: ${errBody}`);
        }
        const data = (await response.json());
        const content = (data.content?.[0]?.text ?? '').trim();
        this.logger.log(`[LLM_RESPONSE] status=${response.status} | contentLen=${content.length} | preview="${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`);
        return content;
    }
};
exports.AnthropicProvider = AnthropicProvider;
exports.AnthropicProvider = AnthropicProvider = AnthropicProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AnthropicProvider);
//# sourceMappingURL=anthropic.provider.js.map