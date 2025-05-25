export const MAX_EMBEDDING_CHUNK_CHAR_LENGTH = 4000; // Max characters per chunk for embedding
// Titan v2 is 8192 tokens. ~4 chars/token = ~32k chars.
// Individual chunks for embedding should be smaller.
// 4000 chars is a conservative starting point.

/**
 * Splits a very long word into parts, each not exceeding maxCharLength.
 */
function splitLongWord(word: string, maxCharLength: number): string[] {
    const parts: string[] = [];
    if (!word || maxCharLength <= 0) return parts;

    let currentPart = word;
    while (currentPart.length > maxCharLength) {
        parts.push(currentPart.substring(0, maxCharLength));
        currentPart = currentPart.substring(maxCharLength);
    }
    if (currentPart.length > 0) {
        parts.push(currentPart);
    }
    return parts;
}

/**
 * Splits a paragraph by words if it exceeds maxCharLength.
 * Tries to form word groups that fit within maxCharLength.
 * Handles words that are themselves longer than maxCharLength.
 */
function splitParagraphByWords(
    paragraph: string,
    maxCharLength: number
): string[] {
    const wordChunks: string[] = [];
    if (!paragraph || maxCharLength <= 0) return wordChunks;

    const words = paragraph.split(" ");
    let currentWordChunk = "";

    for (const word of words) {
        if (word.length === 0) continue;

        if (word.length > maxCharLength) {
            if (currentWordChunk.length > 0) {
                wordChunks.push(currentWordChunk);
                currentWordChunk = "";
            }
            wordChunks.push(...splitLongWord(word, maxCharLength));
            continue;
        }

        const potentialSpace = currentWordChunk.length > 0 ? " " : "";
        if (
            currentWordChunk.length + potentialSpace.length + word.length <=
            maxCharLength
        ) {
            currentWordChunk += potentialSpace + word;
        } else {
            if (currentWordChunk.length > 0) {
                wordChunks.push(currentWordChunk);
            }
            currentWordChunk = word;
        }
    }

    if (currentWordChunk.length > 0) {
        wordChunks.push(currentWordChunk);
    }
    return wordChunks;
}

/**
 * Chunks text by paragraphs, then by words if paragraphs are too long.
 * @param text The input text.
 * @param maxCharLength The maximum character length for each output chunk.
 * @returns An array of text chunks.
 */
export function chunkText(
    text: string,
    maxCharLength: number = MAX_EMBEDDING_CHUNK_CHAR_LENGTH
): string[] {
    const allChunks: string[] = [];
    if (!text || maxCharLength <= 0) return allChunks;

    const paragraphs = text.split("\n");
    let currentParagraphChunk = "";

    for (const paragraph of paragraphs) {
        if (paragraph.trim() === "") {
            if (currentParagraphChunk.length > 0) {
                if (currentParagraphChunk.length + 1 <= maxCharLength) {
                    currentParagraphChunk += "\n";
                } else {
                    allChunks.push(currentParagraphChunk);
                    currentParagraphChunk = "";
                }
            }
            continue;
        }

        if (currentParagraphChunk.length === 0) {
            if (paragraph.length <= maxCharLength) {
                currentParagraphChunk = paragraph;
            } else {
                allChunks.push(
                    ...splitParagraphByWords(paragraph, maxCharLength)
                );
            }
        } else {
            if (
                currentParagraphChunk.length + 1 + paragraph.length <=
                maxCharLength
            ) {
                currentParagraphChunk += "\n" + paragraph;
            } else {
                allChunks.push(currentParagraphChunk);
                if (paragraph.length <= maxCharLength) {
                    currentParagraphChunk = paragraph;
                } else {
                    allChunks.push(
                        ...splitParagraphByWords(paragraph, maxCharLength)
                    );
                    currentParagraphChunk = "";
                }
            }
        }
    }

    if (currentParagraphChunk.length > 0) {
        allChunks.push(currentParagraphChunk);
    }

    return allChunks.filter((chunk) => chunk.trim() !== "");
}

export default function () {}
