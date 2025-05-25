// app/import/page.tsx
"use client";

import { useState, ChangeEvent, FormEvent, useEffect } from "react";

// Interface for the expected API response for listing datasets
// This should match the structure returned by /api/datasets
interface DatasetMetadata {
    id: number;
    dataset_table_name: string;
    display_name: string | null; // Can be null from DB
    description: string | null; // Can be null from DB
    created_at: string; // Dates will be strings over JSON
    updated_at: string;
}

export default function ImportDataPage() {
    const [file, setFile] = useState<File | null>(null);
    const [textContent, setTextContent] = useState<string>("");
    const [datasetName, setDatasetName] = useState<string>(""); // Technical table name
    const [feedback, setFeedback] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false); // For the import process
    const [isLoadingDatasets, setIsLoadingDatasets] = useState<boolean>(true); // For fetching dataset list
    const [availableDatasets, setAvailableDatasets] = useState<
        DatasetMetadata[]
    >([]);

    const fetchAvailableDatasets = async () => {
        setIsLoadingDatasets(true);
        setFeedback(""); // Clear previous feedback
        try {
            const response = await fetch("/api/datasets");
            if (!response.ok) {
                const errorResult = await response
                    .json()
                    .catch(() => ({ details: response.statusText }));
                console.error(
                    "Failed to fetch datasets:",
                    errorResult.details || response.statusText
                );
                setFeedback(
                    `Error loading datasets: ${errorResult.details || response.statusText}`
                );
                setAvailableDatasets([]);
                return;
            }
            const data: DatasetMetadata[] = await response.json();
            setAvailableDatasets(data || []);
        } catch (error) {
            console.error("Error fetching datasets:", error);
            setFeedback(
                "Could not load existing datasets due to a network or parsing error."
            );
            setAvailableDatasets([]);
        } finally {
            setIsLoadingDatasets(false);
        }
    };

    // Fetch datasets on component mount
    useEffect(() => {
        fetchAvailableDatasets();
    }, []);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setFeedback(""); // Clear feedback when input changes
        }
    };

    const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setTextContent(e.target.value);
        setFeedback(""); // Clear feedback
    };

    const handleDatasetNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""); // Keep this strict for table names
        setDatasetName(value);
        setFeedback(""); // Clear feedback
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!datasetName.trim()) {
            setFeedback("Please enter a dataset name (e.g., my_product_docs).");
            return;
        }
        if (datasetName.length > 50) {
            // Matching backend validation
            setFeedback("Dataset name is too long (max 50 characters).");
            return;
        }
        if (!file && !textContent.trim()) {
            setFeedback("Please select a file or enter text to import.");
            return;
        }

        setIsLoading(true);
        setFeedback("Processing and importing data...");

        const formData = new FormData();
        formData.append("datasetName", datasetName);
        if (file) {
            formData.append("file", file);
        } else if (textContent.trim()) {
            formData.append("text", textContent);
        }

        try {
            const response = await fetch("/api/import", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                setFeedback(result.message || "Data imported successfully!");
                setFile(null);
                setTextContent("");
                // Optionally clear datasetName too, or keep for next import
                // setDatasetName("");
                const fileInput = document.getElementById(
                    "file-upload"
                ) as HTMLInputElement;
                if (fileInput) fileInput.value = ""; // Clear the file input visually

                // Re-fetch the list of datasets to include the new one
                await fetchAvailableDatasets();
            } else {
                setFeedback(
                    `Error: ${result.error || result.details || "Failed to import data."}`
                );
            }
        } catch (error) {
            console.error("Import submission error:", error);
            setFeedback(
                `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-xl">
            <h1 className="text-3xl font-semibold mb-6 text-gray-800">
                Import Data
            </h1>
            <p className="text-gray-600 mb-6">
                Specify a dataset name (this will be the technical table name),
                then upload a text file or paste text content.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label
                        htmlFor="dataset-name"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Dataset Name (Technical ID){" "}
                        <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="dataset-name"
                        name="dataset-name"
                        type="text"
                        value={datasetName}
                        onChange={handleDatasetNameChange}
                        className="block w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                        placeholder="e.g., product_specs_v2 (max 50 chars)"
                        disabled={isLoading}
                        maxLength={50}
                        required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Lowercase, numbers, and underscores only. This will be
                        the table name.
                    </p>
                </div>

                <div>
                    <label
                        htmlFor="file-upload"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Upload File (.txt, .md)
                    </label>
                    <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".txt,.md" // Restrict to what backend currently supports simply
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                        disabled={isLoading || !!textContent.trim()}
                    />
                    {file && (
                        <p className="text-xs text-gray-500 mt-1">
                            Selected: {file.name}
                        </p>
                    )}
                </div>

                <div className="text-center text-sm text-gray-500">OR</div>

                <div>
                    <label
                        htmlFor="text-content"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Paste Text Content
                    </label>
                    <textarea
                        id="text-content"
                        name="text-content"
                        rows={8}
                        value={textContent}
                        onChange={handleTextChange}
                        className="block w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-50"
                        placeholder="Paste your text data here..."
                        disabled={isLoading || !!file}
                    />
                </div>

                <div>
                    <button
                        type="submit"
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        disabled={
                            isLoading ||
                            !datasetName.trim() ||
                            (!file && !textContent.trim())
                        }
                    >
                        {isLoading ? "Importing..." : "Import to Dataset"}
                    </button>
                </div>
            </form>

            {feedback && (
                <div
                    className={`mt-6 p-3 rounded-md text-sm ${
                        feedback.toLowerCase().includes("error") ||
                        feedback.toLowerCase().includes("failed") ||
                        feedback.startsWith("Please") ||
                        feedback.toLowerCase().includes("could not load")
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                    }`}
                >
                    {feedback}
                </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 mb-3">
                    Available Datasets
                </h2>
                {isLoadingDatasets ? (
                    <p className="text-gray-500">Loading datasets...</p>
                ) : availableDatasets.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {availableDatasets.map((ds) => (
                            <li key={ds.id}>
                                {ds.display_name || ds.dataset_table_name} (
                                <code>{ds.dataset_table_name}</code>)
                                {/* You can add more details here if needed, e.g., description or created_at */}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">
                        No datasets found. Create one using the form above.
                    </p>
                )}
            </div>
        </div>
    );
}
