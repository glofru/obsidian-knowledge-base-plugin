import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { KendraClient } from '@aws-sdk/client-kendra';
import { S3Client } from '@aws-sdk/client-s3';
import { BedrockClient } from '@aws-sdk/client-bedrock';
import { Pricing } from '@aws-sdk/client-pricing';

export interface AWSCredential extends AwsCredentialIdentity {
    profile: string;
}

export class CredentialsFileNotFoundError extends Error {
    constructor() {
        super('Credentials file not found');
        this.name = 'CredentialsFileNotFoundError';

        // This line is necessary for proper stack trace in Node.js
        Object.setPrototypeOf(this, CredentialsFileNotFoundError.prototype);
    }
}

export class CredentialProfileNotFoundError extends Error {
    constructor(profile: string) {
        super(`Credentials profile "${profile}" not found`);
        this.name = 'CredentialProfileNotFoundError';

        // This line is necessary for proper stack trace in Node.js
        Object.setPrototypeOf(this, CredentialProfileNotFoundError.prototype);
    }
}

/**
 * Decorator factory that refreshes AWS credentials before method execution
 */
export function refreshAwsCredentials() {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            // Refresh the credentials before method execution
            const credentials = getCredentials(
                this.configuration.profile ?? 'default'
            ) as AWSCredential;

            // Refresh Bedrock client
            this.bedrockClient = new BedrockClient({
                region: this.configuration.region,
                credentials,
            });

            // Refresh Bedrock Agent client
            this.bedrockAgentClient = new BedrockAgentClient({
                region: this.configuration.region,
                credentials,
            });

            // Refresh Bedrock Runtime client
            this.bedrockRuntimeClient = new BedrockAgentRuntimeClient({
                region: this.configuration.region,
                credentials,
            });

            // Refresh Kendra client
            this.kendraClient = new KendraClient({
                region: this.configuration.region,
                credentials,
            });

            // Refresh pricing client
            this.pricingClient = new Pricing({
                region: 'us-east-1',
                credentials,
            });

            // Refresh S3 client
            this.s3Client = new S3Client({
                region: this.configuration.region,
                credentials,
            });

            // Execute the original method with the refreshed credentials
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

const parseIni = (
    input: string
): {
    [key: string]: string | { [key: string]: string };
} => {
    const result: { [key: string]: string | { [key: string]: string } } = {};
    let section = result;

    input.split('\n').forEach((line) => {
        let match;
        if ((match = line.match(/^\s*\[\s*([^\]]*)\s*\]\s*$/))) {
            section = result[match[1]] = {};
        } else if ((match = line.match(/^\s*([^=]+?)\s*=\s*(.*?)\s*$/))) {
            section[match[1]] = match[2];
        }
    });

    return result;
};

export function getCredentials(
    profile?: string
): AWSCredential | AWSCredential[] {
    const filePath = path.join(os.homedir(), '.aws', 'credentials'); // TODO: make it setting

    if (!fs.existsSync(filePath)) {
        throw new CredentialsFileNotFoundError();
    }

    const content = fs.readFileSync(filePath).toString('utf8');
    const credentialsContent = parseIni(content);

    const credentials = Object.entries(credentialsContent).reduce(
        (acc, [profileName, data]) => {
            if (profile && profileName !== profile) {
                return acc;
            }

            const {
                aws_access_key_id,
                aws_secret_access_key,
                aws_session_token,
            } = data as any;

            if (!aws_access_key_id || !aws_secret_access_key) {
                console.warn(
                    `AWS Access Key ID or Secret Access ID missing for credentials with profile "${profileName}"`
                );
                return acc;
            }

            return [
                ...acc,
                {
                    profile: profileName,
                    accessKeyId: aws_access_key_id,
                    secretAccessKey: aws_secret_access_key,
                    sessionToken: aws_session_token,
                } as AWSCredential,
            ];
        },
        [] as AWSCredential[]
    );

    if (!profile) {
        return credentials;
    }

    if (credentials.length === 0) {
        throw new CredentialProfileNotFoundError(profile);
    }

    return credentials[0];
}
