import { pipeline } from '@xenova/transformers';

// Cache the model to avoid reloading it for each request
let embeddingPipeline = null;

export async function getEmbeddingPipeline() {
    if (!embeddingPipeline) {
        console.time('Loading E5 embedding model');
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/multilingual-e5-base');
        console.timeEnd('Loading E5 embedding model');
    }
    return embeddingPipeline;
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const pipe = await getEmbeddingPipeline();

    // Format input according to E5 model requirements
    // For queries, prefix with "query: "
    const formattedText = `query: ${text}`;

    // Generate embeddings
    console.time('E5 embedding generation');
    const result = await pipe(formattedText, {
        pooling: 'mean',
        normalize: true
    });
    console.timeEnd('E5 embedding generation');

    // Convert to array of numbers
    const embedding = Array.from(result.data) as number[];
    return embedding;
}