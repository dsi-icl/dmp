export interface MinioGlobal {
    hasMinio: boolean;
    minioContainerPort?: number;
}

export type MinioAwareGlobal = typeof global & MinioGlobal;

export const getMinioAwareGlobal = (): MinioAwareGlobal => {
    return global as MinioAwareGlobal;
};

export const getRequiredMinioPort = (): number => {
    const minioGlobal = getMinioAwareGlobal();
    if (minioGlobal.minioContainerPort === undefined) {
        throw new Error('minioContainerPort is not available on global. Ensure Minio test environment is initialised.');
    }
    return minioGlobal.minioContainerPort;
};

