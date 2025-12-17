export type UnifiedImage = {
    id: string;
    createdAt: number;
    prompt: string;
    model: string;

    image: {
        mime: string;
        kind: "base64" | "blob" | "url";
        value: string | Blob;
    };
};
