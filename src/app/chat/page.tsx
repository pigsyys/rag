// app/chat/page.tsx
"use client";

import { useState, FormEvent, useRef, useEffect, ChangeEvent } from "react";
import ChatMessage from "../components/chatmessage"; // Ensure this path is correct

interface Message {
    id: string;
    text: string;
    sender: "user" | "ai";
}

interface FetchedDatasetMetadata {
    id: number;
    dataset_table_name: string;
    display_name: string | null;
    description: string | null;
    created_at: string; // Dates are strings over JSON
    updated_at: string;
}

interface DatasetMetadataForChat {
    // Simplified for chat page dropdown
    dataset_table_name: string;
    display_name: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingDatasets, setIsLoadingDatasets] = useState<boolean>(true);
    const [availableDatasets, setAvailableDatasets] = useState<
        DatasetMetadataForChat[]
    >([]);
    const [selectedDataset, setSelectedDataset] = useState<string>("");
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    const scrollToBottom = () => {
        useEffect(scrollToBottom, [messages]);
    };
    useEffect(scrollToBottom, [messages]);

    const fetchAvailableDatasets = async () => {
        setIsLoadingDatasets(true);
        try {
            const response = await fetch("/api/datasets");
            if (!response.ok) {
                console.error("Failed to fetch datasets for chat page");
                setAvailableDatasets([]);
                return;
            }
            // Use the more specific type here
            const data: FetchedDatasetMetadata[] = await response.json();

            const formattedDatasets: DatasetMetadataForChat[] = data.map(
                (ds: FetchedDatasetMetadata) => ({
                    // Type the ds parameter
                    dataset_table_name: ds.dataset_table_name,
                    display_name: ds.display_name || ds.dataset_table_name, // Fallback if display_name is null
                })
            );
            setAvailableDatasets(formattedDatasets);
            if (formattedDatasets.length > 0 && !selectedDataset) {
                setSelectedDataset(formattedDatasets[0].dataset_table_name);
            }
        } catch (error) {
            console.error("Error fetching datasets for chat page:", error);
            setAvailableDatasets([]);
        } finally {
            setIsLoadingDatasets(false);
        }
    };

    useEffect(() => {
        fetchAvailableDatasets();
    }, []); // Fetch on mount

    const handleDatasetChange = (e: ChangeEvent<HTMLSelectElement>) => {
        setSelectedDataset(e.target.value);
        setMessages([]); // Clear messages when dataset changes
        // TODO: Consider localStorage for messages per dataset
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !selectedDataset) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            sender: "user",
        };
        setMessages((prev) => [...prev, userMessage]);
        const currentInput = input; // Capture input before clearing
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: currentInput,
                    datasetName: selectedDataset,
                    history: messages.slice(-6, -1), // Send last 5 actual messages (excluding current user message)
                }),
            });

            if (!response.ok) {
                const errorResult = await response.json().catch(() => ({
                    answer: "Sorry, something went wrong with the API.",
                }));
                throw new Error(
                    errorResult.error ||
                        errorResult.details ||
                        "API request failed"
                );
            }

            const data = await response.json();
            const aiResponseText = data.answer;

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: aiResponseText,
                sender: "ai",
            };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (error) {
            console.error("Chat API error:", error);
            const errorMessageText =
                error instanceof Error
                    ? error.message
                    : "An error occurred. Please try again.";
            const aiErrorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: `Error: ${errorMessageText}`,
                sender: "ai",
            };
            setMessages((prev) => [...prev, aiErrorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-10rem)] max-w-3xl mx-auto bg-white shadow-xl rounded-lg">
            <div className="p-4 border-b flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-gray-700">
                    Chatbot
                </h1>
                {isLoadingDatasets ? (
                    <p className="text-sm text-gray-500">Loading datasets...</p>
                ) : availableDatasets.length > 0 ? (
                    <div>
                        <label
                            htmlFor="dataset-select"
                            className="text-sm font-medium text-gray-700 mr-2"
                        >
                            Dataset:
                        </label>
                        <select
                            id="dataset-select"
                            value={selectedDataset}
                            onChange={handleDatasetChange}
                            className="p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            disabled={isLoading || isLoadingDatasets}
                        >
                            {availableDatasets.map((ds) => (
                                <option
                                    key={ds.dataset_table_name}
                                    value={ds.dataset_table_name}
                                >
                                    {ds.display_name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">
                        No datasets available. Import data first.
                    </p>
                )}
            </div>
            {/* ... (rest of the chat UI: message display area, input form) ... */}
            <div className="flex-grow p-6 space-y-4 overflow-y-auto">
                {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                ))}
                {isLoading && <></>}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t bg-gray-50">
                <form
                    onSubmit={handleSubmit}
                    className="flex items-center space-x-2"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                            selectedDataset
                                ? `Ask about ${selectedDataset}...`
                                : "Select a dataset to chat"
                        }
                        className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        disabled={
                            isLoading || !selectedDataset || isLoadingDatasets
                        }
                    />
                    <button
                        type="submit"
                        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-5 rounded-lg disabled:opacity-50"
                        disabled={
                            isLoading ||
                            !input.trim() ||
                            !selectedDataset ||
                            isLoadingDatasets
                        }
                    >
                        {isLoading ? "Sending..." : "Send"}
                    </button>
                </form>
            </div>
        </div>
    );
}
