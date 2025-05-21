import { QueryCitationReference } from '../knowledge-base';

export const SYSTEM_PROMPT = `You are an expert knowledge assistant integrated with an Obsidian vault. Your role is to provide accurate, helpful answers based strictly on the contents of the retrieved notes. Always maintain academic rigor by properly citing your sources. You must:
1. Only use information from the given citations
2. Cite your sources using [Citation X] format
3. If you cannot answer the question using the provided citations, say "I cannot answer this based on the provided citations"
4. Avoid making assumptions or adding information not present in the citations
5. Synthesize information from multiple citations when relevant`;

export const userPrompt = async (
    prompt: string,
    references: QueryCitationReference[]
) => {
    const citations = references
        .map(
            ({ text, fileName }, index) =>
                `[${index + 1}] (file name "${fileName}) ${text}"`
        )
        .join('\n');
    return `Citations:
${citations}

Question: ${prompt}`;
};
