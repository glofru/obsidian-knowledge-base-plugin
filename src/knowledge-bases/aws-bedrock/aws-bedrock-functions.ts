import {
    BedrockClient,
    FoundationModelSummary,
    ListFoundationModelsCommand,
} from '@aws-sdk/client-bedrock';

export interface ListFoundationalModelsProps {
    bedrockClient: BedrockClient;
}

export const listFoundationalModels = async ({
    bedrockClient,
}: ListFoundationalModelsProps): Promise<FoundationModelSummary[]> => {
    const command = new ListFoundationModelsCommand({
        byOutputModality: 'TEXT',
        byInferenceType: 'ON_DEMAND',
    });

    const { modelSummaries } = await bedrockClient.send(command);

    if (!modelSummaries) {
        throw 'No foundational models found';
    }

    return modelSummaries;
};
