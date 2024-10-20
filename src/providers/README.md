# Chat Provider Configuration Documentation

This document outlines the standardized process for configuring new chat providers in our system. The configuration uses a YAML format to ensure consistency and ease of integration across different providers.

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Provider Information](#provider-information)
3. [File Format](#file-format)
4. [Conversation Schema](#conversation-schema)
5. [Message Schema](#message-schema)
6. [Adding a New Provider](#adding-a-new-provider)
7. [Validation Process](#validation-process)
8. [Example Configuration](#example-configuration)

## Configuration Overview

The provider configuration is structured in YAML format with the following main sections:

```yaml
provider:
    name: ProviderName
    file_format:
        # File format details
    conversation:
        # Conversation schema details
```

Each section serves a specific purpose in defining how the provider's data should be interpreted and processed.

### Important Note on Field Requirements

-   All fields defined in this configuration structure are mandatory.
-   If a specific field is not available or not applicable for a provider, it must be explicitly set to `null`.
-   Omitting a field entirely is not allowed and will result in validation errors.

This approach ensures consistency across different providers and makes it clear which fields are intentionally not used versus accidentally omitted.

Example of proper usage:

```yaml
field_name: actual_value # When the field is available
another_field: null # When the field is not applicable or available
```

## Provider Information

The `name` field identifies the chat provider:

```yaml
provider:
    name: ProviderName
```

-   `name`: A string representing the name of the chat provider.

## File Format

The `file_format` section defines the structure of the provider's data files:

```yaml
file_format:
    type: file_type
    filename_regex: "regex_pattern"
    required_files:
        - file1.json
        - file2.json
```

-   `type`: Specifies the file type (e.g., 'zip', 'json').
-   `filename_regex`: A regular expression pattern to validate filenames.
-   `required_files`: (Optional) A list of files required in a zip archive.

## Conversation Schema

The `conversation` section defines how conversation data is structured:

```yaml
conversation:
    file: conversation_file.json
    schema:
        required_fields:
            conversation_id: field_name
            conversation_model: field_name_or_null
            create_time:
                field: field_name_or_null
                format: format_or_null
            update_time:
                field: field_name_or_null
                format: format_or_null
            chat_messages: field_name
```

-   `file`: The name of the file containing conversations (null if not applicable).
-   `schema`: Defines the structure of the conversation data.
    -   `required_fields`: Maps required fields to their corresponding fields in the provider's data.
        -   `conversation_id`: Unique identifier for the conversation.
        -   `conversation_model`: Model used for the conversation (if applicable).
        -   `create_time`: Timestamp for conversation creation.
        -   `update_time`: Timestamp for the last update to the conversation.
        -   `chat_messages`: Field containing the array of messages.

## Message Schema

The `message_schema` section, nested under `conversation.schema`, defines the structure of individual messages:

```yaml
message_schema:
    message_id: field_name
    role: field_name
    message_content: field_name
    created_at:
        field: field_name_or_null
        format: format_or_null
    updated_at:
        field: field_name_or_null
        format: format_or_null
    message_model: field_name_or_null
```

-   `message_id`: Unique identifier for each message.
-   `role`: The role of the message sender (e.g., 'user', 'assistant').
-   `message_content`: The content of the message.
-   `created_at`: Timestamp for message creation.
-   `updated_at`: Timestamp for the last update to the message.
-   `message_model`: Model used for this specific message (if applicable).

## Adding a New Provider

To add a new provider:

1. Create a new YAML file named `provider_name.yaml` in the `providers` directory.
2. Fill in the YAML structure with the provider's specific information.
3. Use `null` for any fields that are not applicable to the provider.
4. Ensure all required fields are present, even if set to `null`.

## Validation Process

The system validates the provider configuration based on:

1. Presence of all required fields in the YAML structure.
    - Every field defined in the configuration structure must be present.
    - Fields that are not applicable must be explicitly set to `null`.
2. File format specifications (zip or individual file).
3. Filename matching the provided regex.
4. Presence of required files (for zip archives).
5. Conversation data structure matching the specified schema.

Fields marked as `null` in the configuration are acknowledged as intentionally unused and are ignored during data processing, but their presence in the configuration is still required for validation.

## Example Configuration

Here's an example configuration for ChatGPT:

```yaml
provider:
    name: ChatGPT
    file_format:
        type: zip
        filename_regex: '^[a-f0-9]{64}-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$'
        required_files:
            - conversations.json
            - user.json
    conversation:
        file: conversations.json
        schema:
            required_fields:
                conversation_id: conversation_id
                conversation_model: Unspecified
                create_time:
                    field: create_time
                    format: unix
                update_time:
                    field: update_time
                    format: unix
                chat_messages: mapping
            message_schema:
                message_id: id
                role: author.role
                message_content: content.parts
                created_at:
                    field: create_time
                    format: unix
                updated_at:
                    field: update_time
                    format: unix
                message_model: model_slug
```

This configuration demonstrates how to set up a provider that uses a zip file format and has specific mappings for conversation and message fields.

By following this documentation and structure, you can easily add and configure new chat providers while maintaining consistency across the system. Remember that all fields must be present in the configuration, using `null` for fields that are not applicable to your specific provider.
