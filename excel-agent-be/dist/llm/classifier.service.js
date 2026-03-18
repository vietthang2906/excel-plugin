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
var ClassifierService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifierService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ClassifierService = ClassifierService_1 = class ClassifierService {
    configService;
    logger = new common_1.Logger(ClassifierService_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    async classify(prompt, context, rowCount) {
        const contextLength = context?.length ?? 0;
        const rows = rowCount ?? this.estimateRowCount(context);
        this.logger.log(`[CLASSIFIER_REQUEST] promptLen=${prompt.length} prompt="${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}" | contextLen=${contextLength} | rowCount=${rows}`);
        let result;
        if (contextLength > 20000 || rows > 500) {
            result = 'high_volume';
            this.logger.log(`[CLASSIFIER_RESPONSE] taskType=${result} | reason=contextLen>20k_or_rows>500`);
        }
        else {
            const complexKeywords = /\b(compar|analyz|model|dcf|valuation|trend|correlat|forecast|if.*then|across|between.*and|so sánh|phân tích|mô hình|định giá|xu hướng|tương quan|dự báo|nếu.*thì|giữa.*và)\b/i;
            if (complexKeywords.test(prompt)) {
                result = 'complex';
                this.logger.log(`[CLASSIFIER_RESPONSE] taskType=${result} | reason=keyword_match`);
            }
            else {
                result = 'simple';
                this.logger.log(`[CLASSIFIER_RESPONSE] taskType=${result} | reason=default`);
            }
        }
        return result;
    }
    estimateRowCount(context) {
        if (!context)
            return 0;
        const matches = context.match(/Row\s+\d+:/g);
        return matches?.length ?? 0;
    }
};
exports.ClassifierService = ClassifierService;
exports.ClassifierService = ClassifierService = ClassifierService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ClassifierService);
//# sourceMappingURL=classifier.service.js.map