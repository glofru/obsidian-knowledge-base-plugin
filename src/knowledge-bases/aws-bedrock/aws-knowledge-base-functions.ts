import {
    BedrockAgentClient,
    GetKnowledgeBaseCommand,
} from '@aws-sdk/client-bedrock-agent';
import {
    DataSourceSummary,
    KendraClient,
    ListDataSourcesCommand,
    StartDataSourceSyncJobCommand,
} from '@aws-sdk/client-kendra';

const SYNC_ID_SEPARATOR = '|';

export interface KnowledgeBaseSyncProps {
    bedrockClient: BedrockAgentClient;
    kendraClient: KendraClient;
    knowledgeBaseId: string;
}

const getKBKendraIndex = async ({
    knowledgeBaseId,
    bedrockClient,
}: KnowledgeBaseSyncProps): Promise<string | undefined> => {
    const command = new GetKnowledgeBaseCommand({ knowledgeBaseId });
    const response = await bedrockClient.send(command);
    return response.knowledgeBase?.knowledgeBaseConfiguration
        ?.kendraKnowledgeBaseConfiguration?.kendraIndexArn;
};

const listKendraDataSources = async ({
    kendraClient,
    kendraIndexId,
}: {
    kendraClient: KendraClient;
    kendraIndexId: string;
}): Promise<DataSourceSummary[]> => {
    const command = new ListDataSourcesCommand({
        IndexId: kendraIndexId,
    });
    const response = await kendraClient.send(command);
    return response.SummaryItems ?? [];
};

const syncKendraIndex = async ({
    kendraClient,
    kendraIndexArn,
}: {
    kendraClient: KendraClient;
    kendraIndexArn: string;
}): Promise<string> => {
    const kendraIndexId = kendraIndexArn.split('/')[1];
    const dataSources = await listKendraDataSources({
        kendraClient,
        kendraIndexId,
    });

    const ids = await Promise.all(
        dataSources.map(async ({ Id }) => {
            if (!Id) {
                throw new Error('Data source ID is undefined');
            }

            const command = new StartDataSourceSyncJobCommand({
                Id,
                IndexId: kendraIndexId,
            });
            await kendraClient.send(command);
            return Id;
        })
    );

    return ids.join(SYNC_ID_SEPARATOR);
};

export const syncKnowledgeBase = async (
    props: KnowledgeBaseSyncProps
): Promise<string> => {
    const kendraIndexArn = await getKBKendraIndex(props);

    if (!kendraIndexArn) {
        throw 'TODO: only Kendra KB are supported';
    }

    const { kendraClient } = props;
    return syncKendraIndex({ kendraIndexArn, kendraClient });
};
