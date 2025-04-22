interface Vector {
    vector: number[];
    filePath: string;
}

interface QueryResult {
    similarity: number;
    filePath: string;
}

export class VectorDatabase {
    private vectors: Vector[] = [];
    private dimension: number;

    /**
     * Constructor for VectorDatabase
     * @param dimension Dimension of the vectors
     */
    constructor(dimension: number) {
        this.dimension = dimension;
    }

    /**
     * Add a single vector to the database
     * @param id Unique identifier for the vector
     * @param vector The vector data
     */
    public addVector({ vector, filePath }: Vector): void {
        if (this.dimension === null) {
            this.dimension = vector.length;
        }

        if (vector.length !== this.dimension) {
            throw new Error(
                `Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`
            );
        }

        this.vectors.push({ vector, filePath });
    }

    /**
     * Add multiple vectors to the database
     * @param vectors Array of vectors to add
     */
    public addVectors(vectors: Vector[]): void {
        vectors.forEach((vector) => this.addVector(vector));
    }

    /**
     * Calculate the similarity between two vectors
     * @param v1 First vector
     * @param v2 Second vector
     * @returns similarity between the two vectors
     */
    private similarity(v1: number[], v2: number[]): number {
        // Cosine similarity
        if (v1.length !== v2.length) {
            throw new Error('Vectors must have the same dimension');
        }

        const dotProduct = v1.reduce((sum, v1i, i) => sum + v1i * v2[i], 0);
        const magnitude1 = Math.sqrt(
            v1.reduce((sum, v1i) => sum + v1i * v1i, 0)
        );
        const magnitude2 = Math.sqrt(
            v2.reduce((sum, v2i) => sum + v2i * v2i, 0)
        );

        return dotProduct / (magnitude1 * magnitude2);
    }

    /**
     * Query for k most similar vectors
     * @param queryVector Vector to compare against
     * @param k Number of similar vectors to return
     * @returns Array of k most similar vectors with their similarity scores
     */
    public query(queryVector: number[], k = 5): Array<QueryResult> {
        if (this.dimension === null) {
            throw new Error('Database is empty');
        }

        if (queryVector.length !== this.dimension) {
            throw new Error(
                `Query vector dimension mismatch. Expected ${this.dimension}, got ${queryVector.length}`
            );
        }

        if (k > this.vectors.length) {
            k = this.vectors.length;
        }

        // Calculate similarities for all vectors
        const similarities = this.vectors.map(({ vector, filePath }) => ({
            similarity: this.similarity(queryVector, vector),
            filePath,
        }));

        // Sort by similarity (descending) and return top k
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, k)
            .map(({ filePath, similarity }) => ({ filePath, similarity }));
    }

    /**
     * Delete a vector from the database
     * @param filePaths File paths of the vectors to delete
     */
    public delete(filePaths: string[]) {
        this.vectors = this.vectors.filter(
            ({ filePath }) => !filePaths.contains(filePath)
        );
    }
}
