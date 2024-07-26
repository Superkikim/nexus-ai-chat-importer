# Provider Configuration Files

This directory contains YAML configuration files for various AI providers utilized in the application. Each provider has a dedicated YAML file adhering to a standardized structure, facilitating easy modifications and the addition of new providers in the future.

## YAML File Structure

Each YAML file has a consistent and clear hierarchical format, encompassing the following sections:

### Provider Level
- **provider**: Metadata about the provider.
  - `name`: The name of the provider (e.g., ChatGPT, Claude, Open WebUI).
  - `editor`: The name of the company behind the provider.
  - `model`: The model used, set to a key in the JSON content (e.g., `model_slug`). Use `null` if not applicable.

### Export Level
- **export**: Details regarding the export format and file naming.
  - `format`: The file format used for exports (e.g., zip, json).
  - `pattern`: The naming pattern for export files.
  - `timestamp`: Formatting information for timestamps.

### Conversation Level
- **conversation**: Contains details about individual conversations.
  - `id`: Identifier for the conversation.
  - `title`: Title of the conversation.
  - `created_at`: Date and time of creation.
    - `date`: The key from the corresponding JSON content (e.g., `created_time`).
    - `format`: The format for the date (e.g., `unix_float`, `iso8601`).
  - `updated_at`: Date and time of the last update.
    - `date`: The key from the corresponding JSON content (e.g., `updated_time`).
    - `format`: The format for the date (e.g., `unix_float`, `iso8601`).
  - `model`: The model used for the conversation, set to the corresponding key or `null` if not applicable.

### Messages Level
- **messages**: Contains details about the individual messages within a conversation.
  - `id`: Identifier for the message.
  - `role`: Role of the author (user or assistant).
  - `content`: Actual content of the message.
  - `timestamp`: Date and time of message creation.
    - `date`: The key from the corresponding JSON content (e.g., `create_time`).
    - `format`: The format for the date (e.g., `unix_float`, `iso8601`).
  - `model`: The model used for the specific message, set to the corresponding key or `null` if not applicable.

## Example Files

### chatgpt.yaml
```yaml
provider:
  name: ChatGPT
  editor: OpenAI
  model: model_slug

export:
  format: zip
  pattern: "*-{timestamp}.zip"
  timestamp:
    format: "%Y-%m-%d-%H-%M-%S"

conversation:
  id: id
  title: title
  created_at: created_time
    format: unix_float
  updated_at: updated_time
    format: unix_float
  model: model_slug

messages:
  id: id
  role: author.role
  content: content.parts
  timestamp: create_time
    format: unix_float
  model: model_slug
