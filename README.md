# My RAG Application

This is a Next.js application demonstrating a Retrieval Augmented Generation (RAG) system. It allows users to import text data into different datasets, and then chat with an AI that uses this data as context to answer questions.

The tech stack includes:

- **Frontend:** Next.js (App Router) with TypeScript and Tailwind CSS
- **Backend API:** Next.js API Routes
- **Embedding Model:** Amazon Titan Text Embeddings V2 (via Amazon Bedrock)
- **Vector Database:** Neon PostgreSQL with the `pgvector` extension
- **LLM (for Generation):** Placeholder for OpenAI (ChatGPT) or Google Gemini

## Features

- **Data Import:**
    - Upload `.txt` or `.md` files, or paste text content.
    - Specify a dataset name (technical ID for the database table).
    - Backend chunks the text, generates embeddings using Amazon Titan, and stores them in a Neon PostgreSQL table specific to the dataset.
    - A metadata table (`app_datasets`) tracks available datasets.
- **Dataset Listing:**
    - An API endpoint (`/api/datasets`) lists all registered datasets.
    - The import page displays available datasets.
- **Chat Interface:**
    - Select an available dataset to chat with.
    - User queries are embedded using Amazon Titan.
    - (TODO: Relevant context chunks are retrieved from the corresponding NeonDB table based on vector similarity.)
    - (TODO: A prompt is constructed with the retrieved context and user query.)
    - (TODO: An LLM (OpenAI/Gemini) generates an answer based on the prompt.)

## Setup

1.  **Clone the repository:**

    ```bash
    git clone <your-repo-url>
    cd my-rag-app
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up Environment Variables:**
    Create a `.env.local` file in the root of the project by copying `.env.local.example` (you should create this example file):

    ```bash
    cp .env.local.example .env.local
    ```

    Then, fill in your actual credentials in `.env.local`:

    ```env
    # AWS Credentials for Bedrock/Titan
    AWS_ACCESS_KEY_ID=your_aws_access_key_id
    AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
    AWS_REGION=your_aws_region # e.g., us-east-1 (where Titan Embeddings v2 is available)

    # Neon PostgreSQL Connection String
    # Get this from your Neon dashboard (Pooled connection string is recommended)
    DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"

    # LLM API Keys
    # OPENAI_API_KEY=your_openai_api_key
    ```

    **Important:** Add `.env.local` to your `.gitignore` file to prevent committing secrets.

4.  **Set up Neon Database:**

    - Ensure your Neon PostgreSQL database is created.
    - Connect to your database and run the following SQL to create the metadata table (if not already created by the application):

        ```sql
        CREATE EXTENSION IF NOT EXISTS vector; -- Run once per database

        CREATE TABLE IF NOT EXISTS app_datasets (
            id SERIAL PRIMARY KEY,
            dataset_table_name VARCHAR(63) UNIQUE NOT NULL,
            display_name TEXT,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Optional: Trigger to auto-update 'updated_at'
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER set_timestamp_app_datasets
        BEFORE UPDATE ON app_datasets
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        ```

    - Dataset-specific tables (e.g., `infosecurity`) will be created automatically by the `/api/import` endpoint when you import data for a new dataset name.

5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## TODO List / Future Enhancements

### Core Functionality

- [ ] **Robust File Parsing in `/api/import/route.ts`:**
    - [ ] Add support for `.pdf` (e.g., using `pdf-parse`).
    - [ ] Add support for `.docx` (e.g., using `mammoth`).
- [ ] **Refine Text Chunking (`src/lib/textUtils.ts`):**
    - [ ] Consider token-based chunking (e.g., `tiktoken`).
    - [ ] Implement chunk overlap.
    - [ ] Option to store metadata with chunks (filename, page number).

### Frontend & UX

- [ ] **Chat History Handling:**
    - [ ] Modify backend prompt to include chat history.
    - [ ] Review frontend history passing.
- [ ] **Improve UI/UX for Dataset Management (Import Page):**
    - [ ] Allow separate "Display Name" for datasets.
    - [ ] Consider a "delete dataset" feature (requires new API & backend logic).
- [ ] **Chat Page UI Enhancements:**
    - [ ] Implement streaming LLM responses.
    - [ ] Render AI responses as Markdown.
    - [ ] More user-friendly error display.
    - [ ] "Stop Generating" button.

### Backend & Operational

- [ ] **Error Handling and Logging:**
    - [ ] Implement more robust and structured logging (e.g., Pino).
- [ ] **Security Hardening:**
    - [ ] Review input validation thoroughly.
    - [ ] Consider rate limiting for public APIs.
    - [ ] (Future) Authentication/Authorization for multi-user scenarios.
- [ ] **Testing:**
    - [ ] Unit tests for utility functions.
    - [ ] Integration tests for API endpoints.
- [ ] **Deployment (Vercel):**
    - [ ] Ensure all environment variables are set in Vercel project settings.
    - [ ] Test deployed application thoroughly.
