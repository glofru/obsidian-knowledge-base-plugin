import { QueryResult } from './ollama-vector-database';

export const getCitationSegments = (
    text: string,
    citations: QueryResult[]
): Array<{
    citation: string;
    start: number;
    end: number;
    fileName: string;
}> => {
    // Find all citations using regex pattern \[\d+\]
    const citationRegex = /\[\d+\]/g;
    const result: Array<{
        text: string;
        start: number;
        end: number;
        citationIndex: number;
    }> = [];

    let match;
    while ((match = citationRegex.exec(text)) !== null) {
        result.push({
            text: match[0],
            citationIndex: parseInt(match[0].replace(/[\[\]]/g, '')),
            start: match.index,
            end: match.index + match[0].length - 1,
        });
    }

    // Validate citations
    if (result.length === 0) {
        return [];
    }

    // Calculate text segments
    return result.map(({ citationIndex, start: citationStart }, index) => {
        const prev = result[index - 1];
        const start = prev ? prev.end + 1 : 0;
        const end = citationStart - 1;
        const fileName = citations[citationIndex - 1]?.filePath ?? '';
        const citation =
            citations[citationIndex - 1]?.text.split('\n\n', 2)[1] ?? '';

        return {
            citation,
            start,
            end,
            fileName,
        };
    });
};
