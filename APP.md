# Knowledge Base

**Purpose**: Personal AI-powered knowledge base — add any content, AI organizes and indexes it, ask questions across your entire collection.

**Type**: app

**Status**: active

## What It Does

- **Add content**: Paste articles, Twitter threads, podcast notes, personal notes, or any text
- **AI processing**: Background AI reads each item, writes a summary, extracts key points, assigns topic labels and keyword tags
- **Auto-connections**: AI finds conceptual links between new items and existing ones in the library
- **Concept map**: Topics are automatically organized into a browseable concept wiki
- **Q&A**: Ask any question across your entire library — AI synthesizes answers from all relevant saved content
- **Search & filter**: Full-text search and tag/topic filtering across all saved items

## Data Stored

- **Article**: Saved content items with raw content, URL, sourceType (twitter/url/podcast/note/text), AI-generated summary, keyPoints (JSON), topics (JSON), tags, aiStatus
- **Tag**: Keyword tags auto-extracted by AI (one global tag table, linked via ArticleTag)
- **ArticleTag**: Junction table linking articles to tags
- **ArticleConnection**: AI-discovered links between articles with reason text and strength score
- **Concept**: Topic-level groupings of articles, auto-maintained by AI
- **SavedQuery**: Q&A history — questions asked and AI-generated answers with source article IDs

## Functions (RPC procedures)

- `health()`: Health check
- `addArticle(data)`: Add content, queues AI processing job
- `getArticles(filter?)`: List articles with optional tag/topic/search filters
- `getArticle(id)`: Article detail with connections
- `deleteArticle(id)`: Delete article
- `getArticleJobStatus(articleId)`: Check AI processing status
- `getAllTags()`: Tag cloud with counts
- `getConcepts()`: AI-generated concept map
- `askQuestion(question)`: Queue a Q&A job, returns queryId
- `getQueryStatus(queryId)`: Poll for Q&A completion
- `getSavedQueries()`: History of past questions
- `deleteQuery(id)`: Delete a saved query
- `getLibraryStats()`: Summary stats (total, processed, tags, concepts, queries)

## Queue Jobs

- `processArticle`: Summarizes article, extracts key points/topics/tags, finds connections to existing articles, updates concept map
- `answerQuery`: Searches across all processed articles, synthesizes answer with source citations

## Architecture

- Background AI processing via queue (no timeouts on long AI work)
- Frontend polls for completion status
- SQLite DB via Prisma
- 4-tab mobile-first UI: Library, Add, Ask, Concepts

## Integrates With

- **AI**: `mcp.promptAgent()` for content summarization, connection discovery, and Q&A
