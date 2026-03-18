import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type TaskType = 'complex' | 'high_volume' | 'simple';

@Injectable()
export class ClassifierService {
    private readonly logger = new Logger(ClassifierService.name);

    constructor(private readonly configService: ConfigService) { }

    async classify(prompt: string, context: string, rowCount?: number): Promise<TaskType> {
        const contextLength = context?.length ?? 0;
        const rows = rowCount ?? this.estimateRowCount(context);

        this.logger.log(
            `[CLASSIFIER_REQUEST] promptLen=${prompt.length} prompt="${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}" | contextLen=${contextLength} | rowCount=${rows}`,
        );

        let result: TaskType;

        // High volume: large data
        if (contextLength > 20000 || rows > 500) {
            result = 'high_volume';
            this.logger.log(`[CLASSIFIER_RESPONSE] taskType=${result} | reason=contextLen>20k_or_rows>500`);
        } else {
            // Complex: keyword detection
            const complexKeywords =
                /\b(compar|analyz|model|dcf|valuation|trend|correlat|forecast|if.*then|across|between.*and|so sánh|phân tích|mô hình|định giá|xu hướng|tương quan|dự báo|nếu.*thì|giữa.*và)\b/i;
            if (complexKeywords.test(prompt)) {
                result = 'complex';
                this.logger.log(`[CLASSIFIER_RESPONSE] taskType=${result} | reason=keyword_match`);
            } else {
                result = 'simple';
                this.logger.log(`[CLASSIFIER_RESPONSE] taskType=${result} | reason=default`);
            }
        }

        return result;
    }

    private estimateRowCount(context: string): number {
        if (!context) return 0;
        const matches = context.match(/Row\s+\d+:/g);
        return matches?.length ?? 0;
    }
}
