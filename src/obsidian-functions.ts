import { Notice } from 'obsidian';

export function tryCatchInNotice(prefix?: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                return await originalMethod.apply(this, args);
            } catch (error) {
                new Notice(`${prefix ?? 'Knoledge Base error:'} ${error}`);
            }
        };

        return descriptor;
    };
}
