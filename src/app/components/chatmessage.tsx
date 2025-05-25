// app/components/ChatMessage.tsx
"use client";

interface ChatMessageProps {
    message: {
        id: string;
        text: string;
        sender: "user" | "ai";
    };
}

// Ensure this is a default export of the function itself
export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.sender === "user";
    return (
        <div
            className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"}`}
        >
            <div
                className={`max-w-3/4 p-3 rounded-lg shadow ${
                    isUser
                        ? "bg-blue-500 text-white"
                        : "bg-gray-300 text-gray-800"
                }`}
            >
                <p>{message.text}</p>
            </div>
        </div>
    );
}
